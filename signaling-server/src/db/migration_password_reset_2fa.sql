-- Migration: Password Reset Tokens table
-- Run: PGPASSWORD=RDApassword psql -h localhost -U rda_app -d rda -f src/db/migration_password_reset_2fa.sql

-- Password reset tokens (time-limited, single-use)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT        NOT NULL,
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prt_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_prt_expires ON password_reset_tokens(expires_at);

-- Cleanup expired/used tokens
CREATE OR REPLACE FUNCTION cleanup_expired_reset_tokens()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM password_reset_tokens
  WHERE expires_at < NOW() OR used_at IS NOT NULL;
END;
$$;

-- Ensure 2FA columns exist (should already from schema.sql, but safe to re-run)
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_secret  TEXT;
