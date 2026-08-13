const express = require('express');
const { pool } = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function safe(fn) {
  return async (req, res) => {
    try { await fn(req, res); }
    catch (err) { console.error(err); res.status(500).json({ error: 'Something went wrong' }); }
  };
}

router.get('/users/search', safe(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json([]);
  const r = await pool.query(`SELECT id, handle, display_name, verified FROM users WHERE handle ILIKE $1 OR display_name ILIKE $1 ORDER BY verified DESC, handle ASC LIMIT 20`, ['%' + q + '%']);
  res.json(r.rows);
}));

router.get('/users/:handle/profile', safe(async (req, res) => {
  const r = await pool.query(`SELECT id, handle, display_name, bio, verified, created_at, (SELECT COUNT(*) FROM follows WHERE followee_id = users.id) AS followers, (SELECT COUNT(*) FROM follows WHERE follower_id = users.id) AS following FROM users WHERE handle = $1`, [req.params.handle]);
  if (!r.rows.length) return res.status(404).json({ error: 'User not found' });
  res.json(r.rows[0]);
}));

router.post('/videos/:id/like', requireAuth, safe(async (req, res) => {
  await pool.query(`INSERT INTO likes (user_id, video_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [req.user.sub, req.params.id]);
  res.status(204).end();
}));

router.delete('/videos/:id/like', requireAuth, safe(async (req, res) => {
  await pool.query(`DELETE FROM likes WHERE user_id = $1 AND video_id = $2`, [req.user.sub, req.params.id]);
  res.status(204).end();
}));

router.post('/videos/:id/comments', requireAuth, safe(async (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) return res.status(400).json({ error: 'Comment text required' });
  const r = await pool.query(`INSERT INTO comments (video_id, user_id, text) VALUES ($1, $2, $3) RETURNING *`, [req.params.id, req.user.sub, text.trim().slice(0, 500)]);
  res.status(201).json(r.rows[0]);
}));

router.get('/videos/:id/comments', safe(async (req, res) => {
  const r = await pool.query(`SELECT c.*, u.handle, u.display_name FROM comments c JOIN users u ON u.id = c.user_id WHERE c.video_id = $1 ORDER BY c.created_at ASC`, [req.params.id]);
  res.json(r.rows);
}));

router.post('/users/:id/follow', requireAuth, safe(async (req, res) => {
  if (req.user.sub === req.params.id) return res.status(400).json({ error: "Can't follow yourself" });
  await pool.query(`INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [req.user.sub, req.params.id]);
  res.status(204).end();
}));

router.delete('/users/:id/follow', requireAuth, safe(async (req, res) => {
  await pool.query(`DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2`, [req.user.sub, req.params.id]);
  res.status(204).end();
}));

router.get('/users/my-invites', requireAuth, safe(async (req, res) => {
  const r = await pool.query(`SELECT handle, display_name, verified, created_at FROM users WHERE invited_by = $1 ORDER BY created_at DESC`, [req.user.handle]);
  res.json(r.rows);
}));

module.exports = router;
