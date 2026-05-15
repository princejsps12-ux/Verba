require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { getDb } = require('./src/db/database');

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(o => o.trim())
  .filter(Boolean);

app.use(cors({
  origin(origin, cb) {
    // Allow same-origin / curl (no Origin header) and any configured origin.
    // Vercel preview deploys end in .vercel.app — allow them if the production URL is a vercel.app domain.
    if (!origin) return cb(null, true);
    if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) return cb(null, true);
    if (allowedOrigins.some(o => o.endsWith('.vercel.app')) && origin.endsWith('.vercel.app')) return cb(null, true);
    cb(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true
}));
app.use(express.json());

// Initialize DB then mount routes
async function start() {
  await getDb();
  
  app.use('/auth', require('./src/routes/auth'));
  app.use('/notes', require('./src/routes/notes'));
  app.use('/shared', require('./src/routes/shared'));

  app.get('/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

  app.listen(PORT, () => {
    console.log(`🚀 Peblo Notes API running on http://localhost:${PORT}`);
  });
}

start().catch(console.error);
