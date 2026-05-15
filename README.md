# Peblo Notes — AI-Powered Collaborative Workspace

A full-stack, AI-powered notes workspace built for the Peblo Full Stack Developer Challenge.

## Live Demo
> Add your deployment URL here after deployment

## Features

| Feature | Description |
|---|---|
| ✅ Auth | Signup/Login with JWT sessions, bcrypt password hashing |
| ✅ Notes | Create, edit, archive, delete with auto-save (1s debounce) |
| ✅ Tags & Categories | Multi-tag system + category selector, filterable sidebar |
| ✅ AI Integration | Groq (Llama 3.3 70B) for summaries, action items, title suggestions |
| ✅ Search & Filter | Real-time search by keyword + tag filter chips |
| ✅ Public Sharing | Shareable links with clean public-facing view |
| ✅ Insights Dashboard | Stats, top tags, weekly activity, AI usage metrics |

### Bonus Features
- Auto-save with visual indicator (saving / saved)
- Apply AI-suggested title with one click
- Archive / restore notes flow
- Responsive cyberpunk dark theme
- Public note view with AI summary display

---

## Architecture

```
peblo-notes/
├── backend/                 # Node.js + Express API
│   ├── index.js             # Server entry point
│   ├── src/
│   │   ├── db/
│   │   │   └── database.js  # sql.js SQLite setup + schema
│   │   ├── middleware/
│   │   │   └── auth.js      # JWT middleware
│   │   └── routes/
│   │       ├── auth.js      # /auth/signup, /auth/login, /auth/me
│   │       ├── notes.js     # CRUD + AI + sharing
│   │       └── shared.js    # Public share view + dashboard insights
│   ├── .env.example
│   └── package.json
│
└── frontend/                # Vanilla React (CDN) SPA
    ├── index.html           # Main app (auth, editor, dashboard)
    └── shared.html          # Public note view page
```

### Tech Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | React 18 (CDN, no build step) | Fast to ship; focus on product not tooling |
| Backend | Node.js + Express | Lightweight, familiar, fast to iterate |
| Database | SQLite via sql.js | Zero-config, portable, perfect for this scope |
| AI | Groq (llama-3.3-70b-versatile) | Fast inference, free tier, no credit card required |
| Auth | JWT + bcryptjs | Stateless, secure |

### API Endpoints

```
POST   /auth/signup              Create account
POST   /auth/login               Get JWT token
GET    /auth/me                  Validate session

GET    /notes                    List notes (supports ?search=, ?tag=, ?archived=)
POST   /notes                    Create note
GET    /notes/:id                Get single note
PATCH  /notes/:id                Update note (auto-save)
DELETE /notes/:id                Delete note
POST   /notes/:id/generate-summary  Generate AI summary via Groq (Llama 3.3 70B)
POST   /notes/:id/share          Toggle public sharing

GET    /shared/:shareId          Public note view (no auth)
GET    /shared/dashboard/insights  User stats + activity data
```

### Database Schema

```sql
users (
  id TEXT PRIMARY KEY,        -- USR_XXXXXXXX
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,     -- bcrypt hashed
  created_at TEXT
)

notes (
  id TEXT PRIMARY KEY,        -- NOTE_XXXXXXXX
  user_id TEXT,
  title TEXT,
  content TEXT,
  tags TEXT,                  -- JSON array string
  category TEXT,
  is_archived INTEGER,        -- 0 or 1
  is_public INTEGER,          -- 0 or 1
  share_id TEXT UNIQUE,       -- random 16-char ID
  ai_summary TEXT,
  ai_action_items TEXT,       -- JSON array string
  ai_suggested_title TEXT,
  ai_used_count INTEGER,
  created_at TEXT,
  updated_at TEXT
)
```

---

## Setup & Running

### Prerequisites
- Node.js 18+
- A Groq API key (free from https://console.groq.com/keys — no credit card required)

### Backend

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values
node index.js
# API runs on http://localhost:4000
```

### Frontend

The frontend is a single HTML file — no build step needed.

```bash
# Option 1: Open directly in browser
open frontend/index.html

# Option 2: Serve with any static server
npx serve frontend
# App runs on http://localhost:3000

# Option 3: Python
cd frontend && python3 -m http.server 3000
```

> **Important**: Set `FRONTEND_URL` in your backend `.env` to match your frontend origin for CORS.

### Environment Variables

```env
PORT=4000
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production
GROQ_API_KEY=gsk_...
FRONTEND_URL=http://localhost:3000
```

### Testing the App

1. Open `http://localhost:3000` (or wherever frontend is served)
2. Create an account via the Sign Up form
3. Click **New Note** in the sidebar
4. Write some content in the editor
5. Click **AI Summary** in the toolbar → generates summary, action items, title
6. Click **Share** → generates a public URL viewable at `/shared.html?id=...`
7. Click **Insights** in the sidebar → view your productivity dashboard

---

## Sample API Responses

### POST /auth/signup
```json
{
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "user": { "id": "USR_A1B2C3D4", "name": "John Doe", "email": "john@example.com" }
}
```

### POST /notes/:id/generate-summary
```json
{
  "summary": "Weekly planning session covering the upcoming sprint goals...",
  "action_items": ["Prepare UI mockups by Friday", "Review API structure with team"],
  "suggested_title": "Sprint Planning — Week 20"
}
```

### GET /shared/dashboard/insights
```json
{
  "total_notes": 12,
  "archived_notes": 3,
  "recent_notes": [...],
  "top_tags": [{ "tag": "work", "count": 5 }, { "tag": "ideas", "count": 3 }],
  "ai_usage": { "total_generations": 8, "notes_with_ai": 6 },
  "weekly_activity": [{ "day": "2026-05-15", "count": 4 }]
}
```

---

## Design Decisions

- **No build toolchain**: The frontend uses React from CDN to keep setup minimal and focus on product logic over config.
- **SQLite for persistence**: sql.js gives an in-process SQLite database — zero installation, self-contained, and sufficient for this scope. Easily swappable with PostgreSQL for production.
- **Debounced auto-save**: Notes save 1 second after the last keystroke, giving a smooth UX without hammering the API.
- **Groq (Llama 3.3 70B)**: Chosen for speed and a globally-available free tier — gives near-instant summaries with no card required, and OpenAI-compatible JSON-mode output keeps the response-parsing path simple.

---

## What I'd Add with More Time

- WebSocket real-time collaboration (multiple cursors, presence)
- Markdown rendering with preview toggle
- Full-text search with ranking
- Note versioning / history
- OAuth (Google login)
- Deploy to Railway / Fly.io + Vercel
- Jest + Supertest automated test suite
