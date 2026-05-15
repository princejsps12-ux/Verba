const express = require('express');
const { query } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// GET /shared/:shareId - public, no auth needed
router.get('/:shareId', (req, res) => {
  const notes = query('SELECT * FROM notes WHERE share_id = ? AND is_public = 1', [req.params.shareId]);
  if (!notes.length) return res.status(404).json({ error: 'Note not found or not public' });
  const note = notes[0];
  res.json({
    note: {
      id: note.id,
      title: note.title,
      content: note.content,
      tags: JSON.parse(note.tags || '[]'),
      category: note.category,
      ai_summary: note.ai_summary,
      ai_action_items: JSON.parse(note.ai_action_items || '[]'),
      updated_at: note.updated_at,
      created_at: note.created_at,
    }
  });
});

// GET /insights - protected
router.get('/dashboard/insights', authMiddleware, (req, res) => {
  try {
    const userId = req.user.id;

    const totalNotes = query('SELECT COUNT(*) as count FROM notes WHERE user_id = ? AND is_archived = 0', [userId]);
    const archivedNotes = query('SELECT COUNT(*) as count FROM notes WHERE user_id = ? AND is_archived = 1', [userId]);
    const recent = query('SELECT id, title, updated_at, tags FROM notes WHERE user_id = ? AND is_archived = 0 ORDER BY updated_at DESC LIMIT 5', [userId]);
    const allNotes = query('SELECT tags FROM notes WHERE user_id = ?', [userId]);
    const aiStats = query('SELECT SUM(ai_used_count) as total, COUNT(CASE WHEN ai_used_count > 0 THEN 1 END) as with_ai FROM notes WHERE user_id = ?', [userId]);
    
    // Weekly activity (last 7 days)
    const weekly = query(`
      SELECT date(updated_at) as day, COUNT(*) as count 
      FROM notes WHERE user_id = ? AND updated_at >= date('now', '-7 days')
      GROUP BY date(updated_at) ORDER BY day
    `, [userId]);

    // Tag frequency
    const tagMap = {};
    allNotes.forEach(n => {
      try {
        JSON.parse(n.tags || '[]').forEach(t => {
          tagMap[t] = (tagMap[t] || 0) + 1;
        });
      } catch {}
    });
    const topTags = Object.entries(tagMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([tag, count]) => ({ tag, count }));

    res.json({
      total_notes: totalNotes[0]?.count || 0,
      archived_notes: archivedNotes[0]?.count || 0,
      recent_notes: recent.map(n => ({ ...n, tags: JSON.parse(n.tags || '[]') })),
      top_tags: topTags,
      ai_usage: {
        total_generations: aiStats[0]?.total || 0,
        notes_with_ai: aiStats[0]?.with_ai || 0,
      },
      weekly_activity: weekly,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
