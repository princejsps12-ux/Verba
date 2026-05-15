const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { query, run } = require('../db/database');
const authMiddleware = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

function parseNote(note) {
  return {
    ...note,
    tags: JSON.parse(note.tags || '[]'),
    ai_action_items: JSON.parse(note.ai_action_items || '[]'),
    is_archived: !!note.is_archived,
    is_public: !!note.is_public,
    ai_used_count: note.ai_used_count || 0,
  };
}

// GET /notes
router.get('/', (req, res) => {
  try {
    const { search, tag, sort = 'updated', archived = 'false' } = req.query;
    let sql = `SELECT * FROM notes WHERE user_id = ? AND is_archived = ?`;
    const params = [req.user.id, archived === 'true' ? 1 : 0];

    if (search) {
      sql += ` AND (title LIKE ? OR content LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }
    if (tag) {
      sql += ` AND tags LIKE ?`;
      params.push(`%"${tag}"%`);
    }

    sql += sort === 'created' ? ' ORDER BY created_at DESC' : ' ORDER BY updated_at DESC';

    const notes = query(sql, params).map(parseNote);
    res.json({ notes });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /notes
router.post('/', (req, res) => {
  try {
    const { title = 'Untitled Note', content = '', tags = [], category = 'General' } = req.body;
    const id = `NOTE_${uuidv4().slice(0, 8).toUpperCase()}`;
    run(
      `INSERT INTO notes (id, user_id, title, content, tags, category) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, req.user.id, title, content, JSON.stringify(tags), category]
    );
    const notes = query('SELECT * FROM notes WHERE id = ?', [id]);
    res.status(201).json({ note: parseNote(notes[0]) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /notes/:id
router.get('/:id', (req, res) => {
  const notes = query('SELECT * FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!notes.length) return res.status(404).json({ error: 'Note not found' });
  res.json({ note: parseNote(notes[0]) });
});

// PATCH /notes/:id
router.patch('/:id', (req, res) => {
  try {
    const notes = query('SELECT * FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!notes.length) return res.status(404).json({ error: 'Note not found' });

    const { title, content, tags, category, is_archived } = req.body;
    const note = notes[0];

    run(
      `UPDATE notes SET 
        title = ?, content = ?, tags = ?, category = ?, 
        is_archived = ?, updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
      [
        title ?? note.title,
        content ?? note.content,
        tags ? JSON.stringify(tags) : note.tags,
        category ?? note.category,
        is_archived !== undefined ? (is_archived ? 1 : 0) : note.is_archived,
        req.params.id, req.user.id
      ]
    );
    const updated = query('SELECT * FROM notes WHERE id = ?', [req.params.id]);
    res.json({ note: parseNote(updated[0]) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /notes/:id
router.delete('/:id', (req, res) => {
  run('DELETE FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ success: true });
});

// POST /notes/:id/generate-summary
router.post('/:id/generate-summary', async (req, res) => {
  try {
    const notes = query('SELECT * FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!notes.length) return res.status(404).json({ error: 'Note not found' });
    const note = parseNote(notes[0]);

    const content = note.content || '';
    if (!content.trim()) return res.status(400).json({ error: 'Note has no content to summarize' });

    // Call Groq API (OpenAI-compatible) with Llama 3.3 70B
    const prompt = `Analyze this note and return ONLY a JSON object with these exact keys:
{
  "summary": "2-3 sentence summary",
  "action_items": ["item1", "item2"],
  "suggested_title": "concise title"
}

Note title: ${note.title}
Note content: ${content}

Return ONLY valid JSON, no markdown, no explanation.`;

    const apiKey = process.env.GROQ_API_KEY || '';
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        max_tokens: 600,
        response_format: { type: 'json_object' },
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const msg = data.error?.message || `Groq API error (HTTP ${response.status})`;
      return res.status(response.status === 429 ? 429 : 502).json({ error: msg });
    }

    const text = data.choices?.[0]?.message?.content;
    if (!text) {
      return res.status(502).json({ error: 'Groq returned no content' });
    }

    let aiResult;
    try {
      aiResult = JSON.parse(text);
    } catch {
      return res.status(502).json({ error: 'Groq returned non-JSON response', raw: text });
    }

    run(
      `UPDATE notes SET ai_summary = ?, ai_action_items = ?, ai_suggested_title = ?, ai_used_count = ai_used_count + 1, updated_at = datetime('now') WHERE id = ?`,
      [aiResult.summary, JSON.stringify(aiResult.action_items || []), aiResult.suggested_title, req.params.id]
    );

    res.json({
      summary: aiResult.summary,
      action_items: aiResult.action_items || [],
      suggested_title: aiResult.suggested_title,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /notes/:id/share
router.post('/:id/share', (req, res) => {
  try {
    const { enable } = req.body;
    const notes = query('SELECT * FROM notes WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
    if (!notes.length) return res.status(404).json({ error: 'Note not found' });

    if (enable) {
      const shareId = uuidv4().replace(/-/g, '').slice(0, 16);
      run('UPDATE notes SET is_public = 1, share_id = ? WHERE id = ?', [shareId, req.params.id]);
      res.json({ share_id: shareId, share_url: `/shared/${shareId}` });
    } else {
      run('UPDATE notes SET is_public = 0, share_id = NULL WHERE id = ?', [req.params.id]);
      res.json({ success: true });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
