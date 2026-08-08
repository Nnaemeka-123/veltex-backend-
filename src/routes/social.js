const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.get('/users/search', async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const result = await pool.query(
    `SELECT id, handle, display_name, verified FROM users
     WHERE handle ILIKE $1 OR display_name ILIKE $1
     ORDER BY verified DESC, handle ASC LIMIT 20`,
    ['%' + q + '%']
  );
  res.json(result.rows);
});

router.get('/users/:handle/profile', async (req, res) => {
  const result = await pool.query(
    `SELECT id, handle, display_name, bio, verified, created_at,
       (SELECT COUNT(*) FROM follows WHERE followee_id = users.id) AS followers,
       (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) AS following
     FROM users WHERE handle = $1`,
    [req.params.handle]
  );
  if (!result.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(result.rows[0]);
});

router.post('/videos/:id/like', requireAuth, async (req, res) => {
  await pool.query(
    `INSERT INTO likes (user_id, video_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.user.sub, req.params.id]
  );
  res.status(204).end();
});

router.delete('/videos/:id/like', requireAuth, async (req, res) => {
  await pool.query(`DELETE FROM likes WHERE user_id = $1 AND video_id = $2`, [req.user.sub, req.params.id]);
  res.status(204).end();
});

router.post('/videos/:id/comments', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });
  const result = await pool.query(
    `INSERT INTO comments (video_id, user_id, text) VALUES ($1, $2, $3) RETURNING *`,
    [req.params.id, req.user.sub, text.trim().slice(0, 500)]
  );
  res.status(201).json(result.rows[0]);
});

router.get('/videos/:id/comments', async (req, res) => {
  const result = await pool.query(
    `SELECT c.*, u.handle, u.display_name FROM comments c
     JOIN users u ON u.id = c.user_id WHERE c.video_id = $1 ORDER BY c.created_at ASC`,
    [req.params.id]
  );
  res.json(result.rows);
});

router.post('/users/:id/follow', requireAuth, async (req, res) => {
  if (req.user.sub === req.params.id) return res.status(400).json({ error: "Can't follow yourself" });
  await pool.query(
    `INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [req.user.sub, req.params.id]
  );
  res.status(204).end();
});

router.delete('/users/:id/follow', requireAuth, async (req, res) => {
  await pool.query(`DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [req.user.sub, req.params.id]);
  res.status(204).end();
});

module.exports = router;
