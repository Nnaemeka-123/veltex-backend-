-- VELTEX database schema (PostgreSQL)

CREATE EXTENSION IF NOT EXISTS "pgcrypto"; -- for gen_random_uuid()

CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle          TEXT UNIQUE NOT NULL,
  display_name    TEXT NOT NULL DEFAULT 'VELTEX',
  email           TEXT UNIQUE NOT NULL,
  password_hash   TEXT NOT NULL,
  bio             TEXT DEFAULT '',
  avatar_key      TEXT,               -- object storage key, not a public URL
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  is_banned       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TYPE video_status AS ENUM ('processing', 'pending_review', 'published', 'rejected', 'removed');

CREATE TABLE videos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key     TEXT NOT NULL,      -- object storage key for the source file
  caption         TEXT DEFAULT '',
  status          video_status NOT NULL DEFAULT 'processing',
  reject_reason   TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  published_at    TIMESTAMPTZ
);

CREATE TABLE likes (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  video_id  UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, video_id)
);

CREATE TABLE comments (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id   UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  text       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE follows (
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  followee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id <> followee_id)
);

-- Engagement signals, used by the feed ranking system (see services/recommendation.js)
CREATE TYPE event_type AS ENUM ('view', 'watch_complete', 'share');

CREATE TABLE video_events (
  id          BIGSERIAL PRIMARY KEY,
  video_id    UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES users(id) ON DELETE SET NULL, -- nullable: anonymous views allowed
  event_type  event_type NOT NULL,
  watch_ms    INTEGER,             -- how long they watched, for 'view' events
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every upload lands here before it can go live. See services/moderation.js.
CREATE TABLE moderation_queue (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id       UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  auto_flags     JSONB DEFAULT '[]',   -- results from automated scanners
  reviewed_by    UUID REFERENCES users(id),
  decision       TEXT,                 -- 'approved' | 'rejected'
  decision_notes TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at    TIMESTAMPTZ
);

CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_video_events_video ON video_events(video_id, created_at);
CREATE INDEX idx_comments_video ON comments(video_id);
