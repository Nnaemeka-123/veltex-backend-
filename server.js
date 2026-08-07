require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const videoRoutes = require('./routes/videos');
const socialRoutes = require('./routes/social');
const feedRoutes = require('./routes/feed');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/auth', authRoutes);
app.use('/videos', videoRoutes);
app.use('/feed', feedRoutes);
app.use('/', socialRoutes); // exposes /videos/:id/like, /users/:id/follow, etc.

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`VELTEX backend listening on port ${PORT}`));
