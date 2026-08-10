const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

// Search users by handle or display name — registered before any /users/:id
// routes so "search" is never mistaken for an :id parameter.
router.get('/users/search', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q) return res.json([]);
    const result = await pool.query(
      `SELECT id, handle, display_name, verified FROM users
       WHERE handle ILIKE $1 OR display_name ILIKE $1
       ORDER BY verified DESC, handle ASC LIMIT 20`,
      ['%' + q + '%']
    );
    res.json(result.rows);
  } catch (err) {
    console.error('users/search failed:', err);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Public profile lookup by handle — used to view someone else's account,
// follower/following counts included.
router.get('/users/:handle/profile', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, handle, display_name, bio, verified, created_at,
         (SELECT COUNT(*) FROM follows WHERE followee_id = users.id) AS followers,
         (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) AS following
       FROM users WHERE handle = $1`,
      [req.params.handle]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('users/:handle/profile failed:', err);
    res.status(500).json({ error: 'Could not load profile' });
  }
});

router.post('/videos/:id/like', requireAuth, async (req, res) => {
  try {
    await pool.query(
      `INSERT INTO likes (user_id, video_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.sub, req.params.id]
    );
    res.status(204).end();
  } catch (err) {
    console.error('like failed:', err);
    res.status(500).json({ error: 'Could not like this' });
  }
});

router.delete('/videos/:id/like', requireAuth, async (req, res) => {
  try {
    await p
