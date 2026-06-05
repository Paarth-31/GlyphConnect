-- -- signaling-server/src/db/schema.sql
-- -- Run: PGPASSWORD=localdevpassword psql -h localhost -U rda_app -d rda -f schema.sql

-- -- ── Custom ENUM types ──────────────────────────────────────────────────────

-- DO $$ BEGIN
--   CREATE TYPE log_level AS ENUM ('debug','info','warn','error');
-- EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- DO $$ BEGIN
--   CREATE TYPE session_status AS ENUM ('active','ended','failed');
-- EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- -- ── Users ──────────────────────────────────────────────────────────────────
-- -- Column names must match EXACTLY what users.ts queries

-- CREATE TABLE IF NOT EXISTS users (
--   id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   email               TEXT UNIQUE NOT NULL,
--   password_hash       TEXT NOT NULL DEFAULT '',
--   display_name        TEXT NOT NULL,
--   avatar_url          TEXT,
--   role                TEXT NOT NULL DEFAULT 'user',
--   is_active           BOOLEAN NOT NULL DEFAULT TRUE,
--   is_verified         BOOLEAN NOT NULL DEFAULT FALSE,
--   two_fa_enabled      BOOLEAN NOT NULL DEFAULT FALSE,
--   failed_login_count  INTEGER DEFAULT 0,       -- used in users.ts verifyPassword
--   locked_until        TIMESTAMPTZ,             -- used in users.ts lockout check
--   last_login_at       TIMESTAMPTZ,             -- used in users.ts reset on success
--   last_login_ip       TEXT,                    -- used in admin.ts /admin/users
--   created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- ── User profiles ──────────────────────────────────────────────────────────

-- CREATE TABLE IF NOT EXISTS user_profiles (
--   user_id        UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
--   full_name      TEXT,
--   bio            TEXT,
--   timezone       TEXT DEFAULT 'UTC',
--   locale         TEXT DEFAULT 'en',
--   preferred_lang TEXT DEFAULT 'en',
--   phone          TEXT,
--   country_code   TEXT,
--   updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- Auto-create profile row when user is inserted
-- CREATE OR REPLACE FUNCTION fn_create_user_profile()
-- RETURNS TRIGGER LANGUAGE plpgsql AS $$
-- BEGIN
--   INSERT INTO user_profiles (user_id) VALUES (NEW.id) ON CONFLICT DO NOTHING;
--   RETURN NEW;
-- END;
-- $$;

-- DROP TRIGGER IF EXISTS trg_create_user_profile ON users;
-- CREATE TRIGGER trg_create_user_profile
--   AFTER INSERT ON users
--   FOR EACH ROW EXECUTE FUNCTION fn_create_user_profile();

-- -- ── User limits (used by admin checkSessionLimits) ─────────────────────────

-- CREATE TABLE IF NOT EXISTS user_limits (
--   user_id                  UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
--   max_concurrent_sessions  INTEGER DEFAULT 2,
--   max_sessions_per_day     INTEGER DEFAULT 20,
--   updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- ── Auth sessions (refresh tokens) ────────────────────────────────────────

-- CREATE TABLE IF NOT EXISTS user_sessions_auth (
--   id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--   refresh_token TEXT UNIQUE NOT NULL,
--   device_info   JSONB DEFAULT '{}',
--   ip_address    TEXT,
--   expires_at    TIMESTAMPTZ NOT NULL,
--   created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- ── Remote desktop sessions ────────────────────────────────────────────────

-- CREATE TABLE IF NOT EXISTS sessions (
--   id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   host_id          UUID REFERENCES users(id) ON DELETE SET NULL,
--   host_display_id  TEXT NOT NULL,
--   controller_id    UUID REFERENCES users(id) ON DELETE SET NULL,
--   controller_name  TEXT,
--   status           session_status NOT NULL DEFAULT 'active',
--   start_time       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   end_time         TIMESTAMPTZ,
--   duration_seconds INTEGER,
--   screen_audio     BOOLEAN DEFAULT FALSE,
--   video_call       BOOLEAN DEFAULT FALSE,
--   control_enabled  BOOLEAN DEFAULT FALSE,
--   quality_preset   TEXT DEFAULT '720p',
--   summary          TEXT,
--   ai_summary       TEXT,
--   created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- ── Session stats ──────────────────────────────────────────────────────────
-- -- Primary key is session_id — matches ON CONFLICT (session_id) in sessions.ts

-- CREATE TABLE IF NOT EXISTS session_stats (
--   session_id        UUID PRIMARY KEY REFERENCES sessions(id) ON DELETE CASCADE,
--   bytes_sent        BIGINT DEFAULT 0,
--   bytes_received    BIGINT DEFAULT 0,
--   avg_bitrate_kbps  NUMERIC,
--   avg_fps           NUMERIC,
--   packet_loss_pct   NUMERIC,
--   rtt_ms_avg        NUMERIC,
--   recorded_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- ── Session transcripts ────────────────────────────────────────────────────

-- CREATE TABLE IF NOT EXISTS session_transcripts (
--   id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   session_id   UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
--   full_text    TEXT,
--   ai_summary   TEXT,
--   key_topics   TEXT[],
--   action_items TEXT[],
--   language     TEXT DEFAULT 'en',
--   created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- ── Favourites ─────────────────────────────────────────────────────────────

-- CREATE TABLE IF NOT EXISTS favourites (
--   id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
--   remote_id    TEXT NOT NULL,
--   label        TEXT,
--   last_used_at TIMESTAMPTZ,
--   use_count    INTEGER DEFAULT 0,
--   created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
--   UNIQUE(user_id, remote_id)
-- );

-- -- ── User logs (admin.ts logUserAction writes here) ─────────────────────────

-- CREATE TABLE IF NOT EXISTS user_logs (
--   id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   user_id     UUID REFERENCES users(id) ON DELETE SET NULL,
--   session_id  UUID REFERENCES sessions(id) ON DELETE SET NULL,
--   action      TEXT NOT NULL,
--   level       log_level DEFAULT 'info',
--   ip_address  TEXT,
--   user_agent  TEXT,
--   metadata    JSONB DEFAULT '{}',
--   created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- ── System health (admin.ts recordSystemHealth writes here) ────────────────

-- CREATE TABLE IF NOT EXISTS system_health (
--   id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   cpu_pct             NUMERIC,
--   mem_used_mb         INTEGER,
--   mem_total_mb        INTEGER,
--   active_sessions     INTEGER DEFAULT 0,
--   active_connections  INTEGER DEFAULT 0,
--   db_pool_used        INTEGER DEFAULT 0,
--   db_pool_total       INTEGER DEFAULT 0,
--   recorded_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- ── System config (admin.ts getSystemConfig / setSystemConfig) ─────────────

-- CREATE TABLE IF NOT EXISTS system_config (
--   key         TEXT PRIMARY KEY,
--   value       TEXT NOT NULL,
--   description TEXT,
--   updated_by  UUID REFERENCES users(id) ON DELETE SET NULL,
--   updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
-- );

-- -- Default config values
-- INSERT INTO system_config (key, value, description)
-- VALUES
--   ('max_concurrent_sessions', '2',  'Max active sessions per user at once'),
--   ('max_sessions_per_day',    '20', 'Max sessions per user per 24 hours')
-- ON CONFLICT (key) DO NOTHING;

-- -- ── Indexes ────────────────────────────────────────────────────────────────

-- CREATE INDEX IF NOT EXISTS idx_sessions_host_id      ON sessions(host_id);
-- CREATE INDEX IF NOT EXISTS idx_sessions_status        ON sessions(status);
-- CREATE INDEX IF NOT EXISTS idx_sessions_start_time    ON sessions(start_time DESC);
-- CREATE INDEX IF NOT EXISTS idx_favourites_user_id     ON favourites(user_id);
-- CREATE INDEX IF NOT EXISTS idx_user_logs_user_id      ON user_logs(user_id);
-- CREATE INDEX IF NOT EXISTS idx_user_logs_created_at   ON user_logs(created_at DESC);
-- CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id  ON user_sessions_auth(user_id);
-- CREATE INDEX IF NOT EXISTS idx_user_sessions_expires  ON user_sessions_auth(expires_at);
-- CREATE INDEX IF NOT EXISTS idx_system_health_recorded ON system_health(recorded_at DESC);





-- signaling-server/src/db/schema.sql
-- Run this on your RDS instance to apply all schema changes.
-- Every statement uses IF NOT EXISTS / IF EXISTS / DO NOTHING so it is
-- safe to re-run on an existing database without losing data.
--
-- Changes vs original schema:
--  [PERM-ID]  users.permanent_room_id — stable public ID persisted across
--             sessions. Separate from the JWT/internal user ID.
--  [SESSION]  sessions table fixed — controller_socket_id added, status
--             default corrected, indexes added for list queries.
--  [FAV]      favourites.use_count default 0, last_used_at nullable.

-- ── Extensions ────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Users ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           TEXT        NOT NULL UNIQUE,
  password_hash   TEXT,
  display_name    TEXT        NOT NULL DEFAULT '',
  avatar_url      TEXT,
  role            TEXT        NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin','moderator')),
  is_verified     BOOLEAN     NOT NULL DEFAULT false,
  two_fa_enabled  BOOLEAN     NOT NULL DEFAULT false,
  two_fa_secret   TEXT,
  -- [PERM-ID] Stable public room ID — generated once, never changes unless
  -- the user explicitly resets it. Stored here so it survives device changes
  -- for authenticated users. Guests use localStorage only.
  permanent_room_id TEXT      UNIQUE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add permanent_room_id to existing databases safely
ALTER TABLE users ADD COLUMN IF NOT EXISTS permanent_room_id TEXT UNIQUE;

-- Trigger to keep updated_at current
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Refresh tokens ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT        NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked    BOOLEAN     NOT NULL DEFAULT false
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token   ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);

-- ── Sessions ──────────────────────────────────────────────────────────────
-- Records every remote-access session for the Recent Sessions list.
-- host_display_id is the permanent room ID of the host machine.

CREATE TABLE IF NOT EXISTS sessions (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  -- The authenticated user who owns this session record
  user_id             UUID        REFERENCES users(id) ON DELETE SET NULL,
  -- The Room ID of the host (permanent_room_id or guest localStorage ID)
  host_display_id     TEXT        NOT NULL,
  -- Socket ID of the controller at session start (informational)
  controller_socket_id TEXT,
  -- Friendly name resolved from favourites, if available
  controller_name     TEXT,
  status              TEXT        NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active','ended','error')),
  start_time          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_time            TIMESTAMPTZ,
  duration_seconds    INTEGER     GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (end_time - start_time))::INTEGER
  ) STORED,
  -- Feature flags recorded at session start
  screen_audio        BOOLEAN     NOT NULL DEFAULT false,
  video_call          BOOLEAN     NOT NULL DEFAULT false,
  control_enabled     BOOLEAN     NOT NULL DEFAULT false,
  -- Free-form notes or AI summary
  summary             TEXT,
  ai_summary          TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id    ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_start_time ON sessions(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_host_id    ON sessions(host_display_id);

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

-- ── User profiles (extended) ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id       UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  full_name     TEXT,
  bio           TEXT,
  timezone      TEXT DEFAULT 'UTC',
  locale        TEXT DEFAULT 'en',
  preferred_lang TEXT DEFAULT 'en',
  phone         TEXT,
  country_code  TEXT,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS profiles_updated_at ON user_profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Favourites ────────────────────────────────────────────────────────────
-- Stores the remote Room IDs a user connects to frequently.
-- remote_id should be a permanent_room_id so entries stay valid forever.

CREATE TABLE IF NOT EXISTS favourites (
  id           UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  remote_id    TEXT        NOT NULL,
  label        TEXT,                       -- user-defined nickname
  use_count    INTEGER     NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, remote_id)
);

CREATE INDEX IF NOT EXISTS idx_favourites_user_id ON favourites(user_id);

-- upsert_favourite: insert or increment use_count + update last_used_at
CREATE OR REPLACE FUNCTION upsert_favourite(
  p_user_id  UUID,
  p_remote_id TEXT,
  p_label    TEXT DEFAULT NULL
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

-- ── Chat transcripts ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS chat_transcripts (
  id         UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sender     TEXT        NOT NULL CHECK (sender IN ('host','viewer')),
  content    TEXT        NOT NULL,
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transcripts_session ON chat_transcripts(session_id);

-- ── System health ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS system_health (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  active_sockets   INTEGER     NOT NULL DEFAULT 0,
  active_sessions  INTEGER     NOT NULL DEFAULT 0,
  db_connections   INTEGER     NOT NULL DEFAULT 0,
  db_pool_size     INTEGER     NOT NULL DEFAULT 0,
  recorded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep only last 7 days of health snapshots
CREATE OR REPLACE FUNCTION cleanup_health()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM system_health WHERE recorded_at < NOW() - INTERVAL '7 days';
END;
$$;

-- ── Admin audit log ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id    UUID        REFERENCES users(id) ON DELETE SET NULL,
  action      TEXT        NOT NULL,
  target_type TEXT,
  target_id   TEXT,
  metadata    JSONB,
  performed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_admin_id ON admin_audit_log(admin_id);

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
  f.label AS host_label          -- favourite label if the host was saved
FROM sessions s
LEFT JOIN favourites f
  ON  f.user_id = s.user_id
  AND f.remote_id = s.host_display_id
ORDER BY s.start_time DESC;

-- ── Seed: ensure permanent_room_id for existing users ─────────────────────
-- Generates a random 11-digit permanent_room_id for any user that doesn't
-- have one yet. Safe to run multiple times.

DO $$
BEGIN
  UPDATE users
  SET permanent_room_id = (
    floor(random() * 90000000000 + 10000000000)::bigint::text
  )
  WHERE permanent_room_id IS NULL;
END $$;