const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../db');

const router = express.Router();

function sanitizeHandle(raw) {
  return String(raw || '').toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 30);
}

router.post('/register', async (req, res) => {
  const { email, password, handle } = req.body;
  if (!email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Email and an 8+ character password are required' });
  }
  const cleanHandle = sanitizeHandle(handle) || 'user' + Date.now();

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await pool.query(
      `INSERT INTO users (handle, email, password_hash) VALUES ($1, $2, $3)
       RETURNING id, handle, display_name, email, verified, created_at`,
      [cleanHandle, email, passwordHash]
    );
    const user = result.rows[0];
    const token = jwt.sign({ sub: user.id, handle: user.handle }, process.env.JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ user, token });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Handle or email already taken' });
    console.error(err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  if (user.is_banned) return res.status(403).json({ error: 'Account suspended' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  const token = jwt.sign({ sub: user.id, handle: user.handle }, process.env.JWT_SECRET, { expiresIn: '30d' });
  delete user.password_hash;
  res.json({ user, token });
});

module.exports = router;
