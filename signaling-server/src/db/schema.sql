-- signaling-server/src/db/schema.sql
-- Run: PGPASSWORD=RDApassword psql -h localhost -U rda_app -d rda -f schema.sql
--
-- Unified schema — every table, column, index, and function matches what
-- the TypeScript source files (db/*.ts, routes/*.ts) actually query.
-- Safe to re-run: uses IF NOT EXISTS / IF EXISTS / ON CONFLICT DO NOTHING.

-- ── Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Custom ENUM types ────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE log_level AS ENUM ('debug','info','warn','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE session_status AS ENUM ('active','ended','failed','error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Users ─────────────────────────────────────────────────────────────────
-- Columns must match: db/users.ts, routes/auth.ts, routes/google-auth.ts,
-- routes/admin.ts, routes/profile.ts

CREATE TABLE IF NOT EXISTS users (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email               TEXT        UNIQUE NOT NULL,
  password_hash       TEXT        NOT NULL DEFAULT '',
  display_name        TEXT        NOT NULL DEFAULT '',
  avatar_url          TEXT,
  role                TEXT        NOT NULL DEFAULT 'user'
                        CHECK (role IN ('user','admin','superadmin')),
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  is_verified         BOOLEAN     NOT NULL DEFAULT FALSE,
  two_fa_enabled      BOOLEAN     NOT NULL DEFAULT FALSE,
  two_fa_secret       TEXT,
  permanent_room_id   TEXT        UNIQUE,
  -- Login security (db/users.ts verifyPassword)
  failed_login_count  INTEGER     NOT NULL DEFAULT 0,
  locked_until        TIMESTAMPTZ,
  last_login_at       TIMESTAMPTZ,
  last_login_ip       TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add columns safely to existing databases
ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_room_id   TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active           BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS failed_login_count  INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS locked_until        TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at       TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip       TEXT;

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── User profiles ─────────────────────────────────────────────────────────
-- Used by: db/users.ts getUserProfile/updateProfile, routes/profile.ts

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name      TEXT,
  bio            TEXT,
  timezone       TEXT DEFAULT 'UTC',
  locale         TEXT DEFAULT 'en',
  preferred_lang TEXT DEFAULT 'en',
  phone          TEXT,
  country_code   TEXT,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON user_profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Auto-create profile row when user is inserted
CREATE OR REPLACE FUNCTION fn_create_user_profile()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO user_profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_user_profile ON users;
CREATE TRIGGER trg_create_user_profile
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION fn_create_user_profile();

-- ── User limits (db/admin.ts checkSessionLimits) ─────────────────────────

CREATE TABLE IF NOT EXISTS user_limits (
  user_id                  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  max_concurrent_sessions  INTEGER DEFAULT 2,
  max_sessions_per_day     INTEGER DEFAULT 20,
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Auth sessions / refresh tokens ────────────────────────────────────────
-- Used by: db/users.ts createRefreshToken, routes/auth.ts refresh/logout/sessions

CREATE TABLE IF NOT EXISTS user_sessions_auth (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token TEXT        UNIQUE NOT NULL,
  device_info   JSONB       DEFAULT '{}',
  ip_address    TEXT,
  expires_at    TIMESTAMPTZ NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions_auth(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions_auth(expires_at);

-- ── Remote desktop sessions ──────────────────────────────────────────────
-- Used by: db/sessions.ts, db/admin.ts, routes/sessions.ts, routes/admin.ts
--
-- NOTE: Two naming conventions exist in the codebase:
--   db/sessions.ts + db/admin.ts use: host_id, controller_id
--   routes/sessions.ts uses:          user_id, controller_socket_id
-- Both sets of columns are included so all code paths work.

CREATE TABLE IF NOT EXISTS sessions (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- host_id: used by db/sessions.ts createSession, db/admin.ts dashboard
  host_id              UUID        REFERENCES users(id) ON DELETE SET NULL,
  -- user_id: used by routes/sessions.ts (same concept as host_id)
  user_id              UUID        REFERENCES users(id) ON DELETE SET NULL,
  host_display_id      TEXT        NOT NULL,
  -- controller_id: used by db/sessions.ts joinSession, getSessionById
  controller_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  -- controller_socket_id: used by routes/sessions.ts POST
  controller_socket_id TEXT,
  controller_name      TEXT,
  status               TEXT        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active','ended','error','failed')),
  start_time           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time             TIMESTAMPTZ,
  -- Plain INTEGER so both db/sessions.ts endSession() and the route can write to it
  duration_seconds     INTEGER,
  screen_audio         BOOLEAN     NOT NULL DEFAULT FALSE,
  video_call           BOOLEAN     NOT NULL DEFAULT FALSE,
  control_enabled      BOOLEAN     NOT NULL DEFAULT FALSE,
  quality_preset       TEXT        DEFAULT '720p',
  summary              TEXT,
  ai_summary           TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_host_id      ON sessions(host_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id      ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status        ON sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time    ON sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_host_display  ON sessions(host_display_id);

-- Mark stale sessions (open > 12 hours) as ended automatically
CREATE OR REPLACE FUNCTION cleanup_stale_sessions()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE sessions
  SET    status   = 'error',
         end_time = NOW()
  WHERE  status   = 'active'
  AND    start_time < NOW() - INTERVAL '12 hours';
END;
$$;

-- ── Session stats (db/sessions.ts saveSessionStats) ──────────────────────
-- Primary key is session_id — matches ON CONFLICT (session_id)

CREATE TABLE IF NOT EXISTS session_stats (
  session_id        UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
  bytes_sent        BIGINT  DEFAULT 0,
  bytes_received    BIGINT  DEFAULT 0,
  avg_bitrate_kbps  NUMERIC,
  avg_fps           NUMERIC,
  packet_loss_pct   NUMERIC,
  rtt_ms_avg        NUMERIC,
  recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Session transcripts (db/transcripts.ts assembleAndSaveFullTranscript)

CREATE TABLE IF NOT EXISTS session_transcripts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID        NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
  full_text    TEXT,
  word_count   INTEGER     DEFAULT 0,
  ai_summary   TEXT,
  key_topics   TEXT[],
  action_items TEXT[],
  language     TEXT        DEFAULT 'en',
  generated_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Transcripts / chunks (db/transcripts.ts saveTranscriptChunk) ─────────

CREATE TABLE IF NOT EXISTS transcripts (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  speaker_id       UUID        REFERENCES users(id) ON DELETE SET NULL,
  speaker_label    TEXT,
  raw_text         TEXT        NOT NULL,
  cleaned_text     TEXT,
  translated_text  TEXT,
  target_lang      TEXT,
  start_offset_ms  INTEGER     NOT NULL,
  end_offset_ms    INTEGER     NOT NULL,
  confidence       NUMERIC,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_session ON transcripts(session_id);

-- ── Chats (db/chats.ts saveMessage, getChatsBySession, searchChats) ──────

CREATE TABLE IF NOT EXISTS chats (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id          UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sender_id           UUID        REFERENCES users(id) ON DELETE SET NULL,
  content             TEXT        NOT NULL,
  content_lang        TEXT        DEFAULT 'en',
  translated_content  TEXT,
  translated_lang     TEXT,
  message_type        TEXT        DEFAULT 'text',
  image_url           TEXT,
  file_url            TEXT,
  file_name           TEXT,
  is_deleted          BOOLEAN     NOT NULL DEFAULT FALSE,
  sent_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chats_session ON chats(session_id);

-- ── Favourites ────────────────────────────────────────────────────────────
-- Used by: db/favourites.ts, routes/favourites.ts, routes/sessions.ts (JOIN)

CREATE TABLE IF NOT EXISTS favourites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remote_id    TEXT        NOT NULL,
  label        TEXT,
  use_count    INTEGER     NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, remote_id)
);

CREATE INDEX IF NOT EXISTS idx_favourites_user_id ON favourites(user_id);

-- upsert_favourite helper function
CREATE OR REPLACE FUNCTION upsert_favourite(
  p_user_id   UUID,
  p_remote_id TEXT,
  p_label     TEXT DEFAULT NULL
) RETURNS favourites LANGUAGE plpgsql AS $$
DECLARE
  result favourites;
BEGIN
  INSERT INTO favourites (user_id, remote_id, label, use_count, last_used_at)
  VALUES (p_user_id, p_remote_id, p_label, 1, NOW())
  ON CONFLICT (user_id, remote_id) DO UPDATE SET
    use_count    = favourites.use_count + 1,
    last_used_at = NOW(),
    label        = COALESCE(EXCLUDED.label, favourites.label)
  RETURNING * INTO result;
  RETURN result;
END;
$$;

-- ── User logs (db/admin.ts logUserAction) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS user_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  session_id  UUID        REFERENCES sessions(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  level       log_level   DEFAULT 'info',
  ip_address  TEXT,
  user_agent  TEXT,
  metadata    JSONB       DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_logs_user_id    ON user_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_logs_created_at ON user_logs(created_at DESC);

-- ── System health (db/admin.ts recordSystemHealth) ───────────────────────

CREATE TABLE IF NOT EXISTS system_health (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  cpu_pct             NUMERIC,
  mem_used_mb         INTEGER,
  mem_total_mb        INTEGER,
  active_sessions     INTEGER     DEFAULT 0,
  active_connections  INTEGER     DEFAULT 0,
  db_pool_used        INTEGER     DEFAULT 0,
  db_pool_total       INTEGER     DEFAULT 0,
  recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_system_health_recorded ON system_health(recorded_at DESC);

-- Keep only last 7 days of health snapshots
CREATE OR REPLACE FUNCTION cleanup_health()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM system_health WHERE recorded_at < NOW() - INTERVAL '7 days';
END;
$$;

-- ── System config (db/admin.ts getSystemConfig/setSystemConfig) ──────────

CREATE TABLE IF NOT EXISTS system_config (
  key         TEXT PRIMARY KEY,
  value       TEXT        NOT NULL,
  description TEXT,
  updated_by  UUID        REFERENCES users(id) ON DELETE SET NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Default config values
INSERT INTO system_config (key, value, description)
VALUES
  ('max_concurrent_sessions', '2',  'Max active sessions per user at once'),
  ('max_sessions_per_day',    '20', 'Max sessions per user per 24 hours')
ON CONFLICT (key) DO NOTHING;

-- ── AI requests (db/ai.ts logAiRequest, getAiCostSummary) ────────────────

CREATE TABLE IF NOT EXISTS ai_requests (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        REFERENCES users(id) ON DELETE SET NULL,
  session_id     UUID        REFERENCES sessions(id) ON DELETE SET NULL,
  feature        TEXT        NOT NULL,
  model_used     TEXT        NOT NULL,
  input_tokens   INTEGER,
  output_tokens  INTEGER,
  latency_ms     INTEGER,
  cost_usd       NUMERIC,
  success        BOOLEAN     NOT NULL DEFAULT TRUE,
  error_message  TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Helper view: recent sessions per user ─────────────────────────────────

CREATE OR REPLACE VIEW user_recent_sessions AS
SELECT
  s.id,
  s.user_id,
  s.host_display_id,
  s.status,
  s.start_time,
  s.end_time,
  s.duration_seconds,
  s.screen_audio,
  s.video_call,
  s.control_enabled,
  s.summary,
  f.label AS host_label
FROM sessions s
LEFT JOIN favourites f
  ON  f.user_id = s.user_id
  AND f.remote_id = s.host_display_id
ORDER BY s.start_time DESC;

-- ── Seed: ensure permanent_room_id for existing users ─────────────────────

DO $$
BEGIN
  UPDATE users
  SET permanent_room_id = (
    floor(random() * 90000000000 + 10000000000)::bigint::text
  )
  WHERE permanent_room_id IS NULL;
END $$;
