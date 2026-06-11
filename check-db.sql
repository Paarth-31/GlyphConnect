-- Check if password_reset_tokens table exists
SELECT table_name FROM information_schema.tables WHERE table_name = 'password_reset_tokens';

-- Check if cleanup function exists
SELECT routine_name FROM information_schema.routines WHERE routine_name = 'cleanup_expired_reset_tokens';

-- Check 2FA columns on users table
SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND column_name IN ('two_fa_enabled', 'two_fa_secret');
