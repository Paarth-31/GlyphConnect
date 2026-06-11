import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import {
  createUser,
  verifyPassword,
  createRefreshToken,
  getUserById,
} from '../db/users';
import { logUserAction } from '../db/admin';
import { queryService } from '../db/client';
import bcrypt from 'bcryptjs';
import * as OTPAuth from 'otpauth';
import { sendPasswordResetEmail } from '../services/email';

const router = Router();

const JWT_SECRET  = process.env.JWT_SECRET  ?? 'change-me-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES ?? '15m';
const SERVER_BASE_URL = process.env.SERVER_BASE_URL
  ?? (process.env.NODE_ENV === 'production'
    ? 'https://rda-signaling.duckdns.org'
    : 'http://localhost:8080');

// ── Token factory ─────────────────────────────────────────────────────────
function makeAccessToken(userId: string, role: string): string {
  return jwt.sign(
    { sub: userId, role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES as any }
  );
}

// ── POST /auth/register ───────────────────────────────────────────────────
router.post('/register', async (req: Request, res: Response) => {
  const { email, password, displayName } = req.body;

  if (!email || !password || !displayName) {
    return res
      .status(400)
      .json({ error: 'email, password and displayName are required' });
  }
  if (password.length < 8) {
    return res
      .status(400)
      .json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const user = await createUser(
      email.toLowerCase().trim(),
      password,
      displayName
    );

    await logUserAction({
      userId:    user.id,
      action:    'register',
      ipAddress: req.ip,
      metadata:  { email: user.email },
    });

    const accessToken  = makeAccessToken(user.id, user.role);
    const refreshToken = await createRefreshToken(
      user.id,
      { userAgent: req.headers['user-agent'] ?? 'unknown' },
      req.ip ?? ''
    );

    return res.status(201).json({ user, accessToken, refreshToken });
  } catch (e: any) {
    // Unique violation → duplicate email
    if (e.code === '23505') {
      return res.status(409).json({ error: 'Email already registered' });
    }
    console.error('[Auth] Register error:', e.message);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

// ── POST /auth/login ──────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  try {
    const user = await verifyPassword(
      email.toLowerCase().trim(),
      password
    );

    if (!user) {
      await logUserAction({
        action:    'login_failed',
        ipAddress: req.ip,
        metadata:  { email },
      });
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await logUserAction({
      userId:    user.id,
      action:    'login',
      ipAddress: req.ip,
      metadata:  { email: user.email },
    });

    // ── 2FA check: if enabled, return a short-lived temp token ──
    if (user.two_fa_enabled) {
      const tempToken = jwt.sign(
        { sub: user.id, purpose: '2fa_login' },
        JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({ requires2FA: true, tempToken });
    }

    const accessToken  = makeAccessToken(user.id, user.role);
    const refreshToken = await createRefreshToken(
      user.id,
      { userAgent: req.headers['user-agent'] ?? 'unknown' },
      req.ip ?? ''
    );

    return res.json({ user, accessToken, refreshToken });
  } catch (e: any) {
    const status = e.message?.includes('locked') ? 429 : 500;
    return res.status(status).json({ error: e.message });
  }
});

// ── POST /auth/refresh ────────────────────────────────────────────────────
// Takes a refreshToken, returns a new accessToken without requiring login
router.post('/refresh', async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'refreshToken is required' });
  }

  try {
    // [FIX C5] Fetch all valid sessions for comparison with bcrypt
    // Since tokens are now stored as hashes, we can't do exact-match lookup.
    // Fetch all non-expired sessions and compare each hash.
    const rows = await queryService(
      `SELECT
         usa.id AS session_id,
         usa.user_id,
         usa.refresh_token AS token_hash,
         usa.expires_at,
         u.role,
         u.is_active,
         u.email
       FROM user_sessions_auth usa
       JOIN users u ON u.id = usa.user_id
       WHERE usa.expires_at > NOW()
         AND u.is_active    = TRUE`,
    );

    // Find the session whose hash matches the submitted token
    let matchedRow: any = null;
    for (const row of rows) {
      const isMatch = await bcrypt.compare(refreshToken, (row as any).token_hash);
      if (isMatch) { matchedRow = row; break; }
    }

    if (!matchedRow) {
      return res
        .status(401)
        .json({ error: 'Refresh token is invalid or has expired' });
    }

    const { user_id, role, email } = matchedRow as any;

    const newAccessToken = makeAccessToken(user_id, role);

    await logUserAction({
      userId:   user_id,
      action:   'token_refresh',
      metadata: { email },
    });

    return res.json({ accessToken: newAccessToken });
  } catch (e: any) {
    console.error('[Auth] Refresh error:', e.message);
    return res.status(500).json({ error: 'Token refresh failed' });
  }
});

// ── POST /auth/logout ─────────────────────────────────────────────────────
// Deletes the refresh token row so it can never be reused
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  const { refreshToken } = req.body;

  try {
    // [FIX C5] Token is stored as hash — find and delete by bcrypt comparison
    if (refreshToken) {
      const sessions = await queryService(
        `SELECT id, refresh_token AS token_hash FROM user_sessions_auth
         WHERE user_id = $1`,
        [(req as any).userId]
      );
      for (const s of sessions) {
        const isMatch = await bcrypt.compare(refreshToken, (s as any).token_hash);
        if (isMatch) {
          await queryService(`DELETE FROM user_sessions_auth WHERE id = $1`, [(s as any).id]);
          break;
        }
      }
    }

    await logUserAction({
      userId:    (req as any).userId,
      action:    'logout',
      ipAddress: req.ip,
    });

    return res.json({ ok: true, message: 'Logged out successfully' });
  } catch (e: any) {
    console.error('[Auth] Logout error:', e.message);
    return res.status(500).json({ error: 'Logout failed' });
  }
});

// ── GET /auth/me ──────────────────────────────────────────────────────────
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await getUserById((req as any).userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    return res.json(user);
  } catch (e: any) {
    console.error('[Auth] /me error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch user' });
  }
});

// ── GET /auth/sessions ────────────────────────────────────────────────────
// Lists all active login sessions for the current user (devices)
router.get('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const rows = await queryService(
      `SELECT id, device_info, ip_address, expires_at, created_at
       FROM user_sessions_auth
       WHERE user_id    = $1
         AND expires_at > NOW()
       ORDER BY created_at DESC`,
      [(req as any).userId]
    );
    return res.json(rows);
  } catch (e: any) {
    console.error('[Auth] /sessions error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// ── DELETE /auth/sessions/:id ─────────────────────────────────────────────
// Lets a user revoke a specific device session (remote logout)
router.delete(
  '/sessions/:id',
  authenticate,
  async (req: Request, res: Response) => {
    try {
      await queryService(
        `DELETE FROM user_sessions_auth
         WHERE id      = $1
           AND user_id = $2`,
        [req.params.id, (req as any).userId]
      );
      return res.json({ ok: true });
    } catch (e: any) {
      console.error('[Auth] Delete session error:', e.message);
      return res.status(500).json({ error: 'Failed to revoke session' });
    }
  }
);

// ── PATCH /auth/password ──────────────────────────────────────────────────
router.patch('/password', authenticate, async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ error: 'New password must be at least 8 characters' });
  }

  try {
    // Fetch current hash
    const rows = await queryService(
      `SELECT email, password_hash FROM users WHERE id = $1`,
      [(req as any).userId]
    );
    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { email } = rows[0] as any;

    // Re-verify current password using the same verifyPassword path
    const valid = await verifyPassword(email, currentPassword);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash and save new password
    const bcrypt = await import('bcryptjs');
    const newHash = await bcrypt.hash(newPassword, 12);

    await queryService(
      `UPDATE users
       SET password_hash = $1, updated_at = NOW()
       WHERE id = $2`,
      [newHash, (req as any).userId]
    );

    // Invalidate ALL refresh tokens for this user — forces re-login on all devices
    await queryService(
      `DELETE FROM user_sessions_auth WHERE user_id = $1`,
      [(req as any).userId]
    );

    await logUserAction({
      userId:    (req as any).userId,
      action:    'password_changed',
      ipAddress: req.ip,
    });

    return res.json({
      ok: true,
      message: 'Password updated. Please log in again on all devices.',
    });
  } catch (e: any) {
    console.error('[Auth] Password change error:', e.message);
    return res.status(500).json({ error: 'Password change failed' });
  }
});


// ══════════════════════════════════════════════════════════════════════════
// PASSWORD RESET
// ══════════════════════════════════════════════════════════════════════════

// ── POST /auth/forgot-password ────────────────────────────────────────────
// Always returns 200 to prevent email enumeration
router.post('/forgot-password', async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Cleanup expired tokens first
    await queryService('SELECT cleanup_expired_reset_tokens()');

    // Check if user exists
    const users = await queryService(
      'SELECT id, email FROM users WHERE email = $1 AND is_active = TRUE',
      [email.toLowerCase().trim()]
    );

    if (users[0]) {
      const user = users[0] as any;

      // Rate limit: max 3 reset requests per hour per user
      const recent = await queryService(
        `SELECT COUNT(*)::int AS cnt FROM password_reset_tokens
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '1 hour'`,
        [user.id]
      );
      if ((recent[0] as any).cnt >= 3) {
        // Silently succeed to prevent enumeration
        return res.json({ ok: true, message: 'If an account exists with that email, a reset link has been sent.' });
      }

      // Generate a random token
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = await bcrypt.hash(rawToken, 8);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await queryService(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      const resetUrl = `${SERVER_BASE_URL}/reset-password?token=${rawToken}`;

      try {
        await sendPasswordResetEmail(user.email, resetUrl);
      } catch (emailErr: any) {
        console.error('[Auth] Failed to send reset email:', emailErr.message);
        // Don't expose email sending failures to the client
      }

      await logUserAction({
        userId: user.id,
        action: 'password_reset_requested',
        ipAddress: req.ip,
        metadata: { email: user.email },
      });
    }

    // Always return success (prevents email enumeration)
    return res.json({
      ok: true,
      message: 'If an account exists with that email, a reset link has been sent.',
    });
  } catch (e: any) {
    console.error('[Auth] Forgot password error:', e.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

// ── POST /auth/reset-password ─────────────────────────────────────────────
router.post('/reset-password', async (req: Request, res: Response) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token and new password are required' });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    // Find all unexpired, unused tokens and check hash
    const rows = await queryService(
      `SELECT id, user_id, token_hash FROM password_reset_tokens
       WHERE expires_at > NOW() AND used_at IS NULL
       ORDER BY created_at DESC`
    );

    let matched: any = null;
    for (const row of rows) {
      const isMatch = await bcrypt.compare(token, (row as any).token_hash);
      if (isMatch) { matched = row; break; }
    }

    if (!matched) {
      return res.status(400).json({
        error: 'Invalid or expired reset link. Please request a new one.',
      });
    }

    // Hash new password and update user
    const newHash = await bcrypt.hash(newPassword, 12);
    await queryService(
      'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2',
      [newHash, matched.user_id]
    );

    // Mark token as used
    await queryService(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1',
      [matched.id]
    );

    // Invalidate all refresh tokens (force re-login everywhere)
    await queryService(
      'DELETE FROM user_sessions_auth WHERE user_id = $1',
      [matched.user_id]
    );

    await logUserAction({
      userId: matched.user_id,
      action: 'password_reset_completed',
      ipAddress: req.ip,
    });

    return res.json({ ok: true, message: 'Password reset successfully.' });
  } catch (e: any) {
    console.error('[Auth] Reset password error:', e.message);
    return res.status(500).json({ error: 'Password reset failed' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// TWO-FACTOR AUTHENTICATION (TOTP)
// ══════════════════════════════════════════════════════════════════════════

// ── POST /auth/2fa/setup ──────────────────────────────────────────────────
// Generates a TOTP secret, stores it (not yet enabled), returns QR URI
router.post('/2fa/setup', authenticate, async (req: Request, res: Response) => {
  try {
    const user = await getUserById((req as any).userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.two_fa_enabled) {
      return res.status(400).json({ error: '2FA is already enabled. Disable it first.' });
    }

    // Generate a new TOTP secret
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: 'GlyphConnect',
      label: user.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    });

    // Store secret in DB (not enabled yet — user must verify first)
    await queryService(
      'UPDATE users SET two_fa_secret = $1 WHERE id = $2',
      [secret.base32, user.id]
    );

    return res.json({
      qrUri: totp.toString(),    // otpauth:// URI for QR code
      secret: secret.base32,     // manual entry fallback
    });
  } catch (e: any) {
    console.error('[Auth] 2FA setup error:', e.message);
    return res.status(500).json({ error: '2FA setup failed' });
  }
});

// ── POST /auth/2fa/verify ─────────────────────────────────────────────────
// User enters a TOTP code to confirm setup — enables 2FA
router.post('/2fa/verify', authenticate, async (req: Request, res: Response) => {
  const { token: totpCode } = req.body;

  if (!totpCode) {
    return res.status(400).json({ error: 'TOTP code is required' });
  }

  try {
    // Get the stored secret
    const rows = await queryService(
      'SELECT two_fa_secret FROM users WHERE id = $1',
      [(req as any).userId]
    );
    const secret = (rows[0] as any)?.two_fa_secret;
    if (!secret) {
      return res.status(400).json({ error: 'No 2FA setup in progress. Call /auth/2fa/setup first.' });
    }

    // Verify the TOTP code
    const totp = new OTPAuth.TOTP({
      issuer: 'GlyphConnect',
      label: '',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(secret),
    });

    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) {
      return res.status(401).json({ error: 'Invalid code. Please try again.' });
    }

    // Enable 2FA
    await queryService(
      'UPDATE users SET two_fa_enabled = TRUE WHERE id = $1',
      [(req as any).userId]
    );

    await logUserAction({
      userId: (req as any).userId,
      action: '2fa_enabled',
      ipAddress: req.ip,
    });

    return res.json({ ok: true, message: 'Two-factor authentication enabled!' });
  } catch (e: any) {
    console.error('[Auth] 2FA verify error:', e.message);
    return res.status(500).json({ error: '2FA verification failed' });
  }
});

// ── POST /auth/2fa/disable ────────────────────────────────────────────────
// Requires current TOTP code to disable 2FA
router.post('/2fa/disable', authenticate, async (req: Request, res: Response) => {
  const { token: totpCode } = req.body;

  if (!totpCode) {
    return res.status(400).json({ error: 'Current TOTP code is required to disable 2FA' });
  }

  try {
    const rows = await queryService(
      'SELECT two_fa_secret, two_fa_enabled FROM users WHERE id = $1',
      [(req as any).userId]
    );
    const user = rows[0] as any;
    if (!user?.two_fa_enabled) {
      return res.status(400).json({ error: '2FA is not currently enabled' });
    }

    const totp = new OTPAuth.TOTP({
      issuer: 'GlyphConnect',
      label: '',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.two_fa_secret),
    });

    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) {
      return res.status(401).json({ error: 'Invalid code. Please enter the current code from your authenticator app.' });
    }

    await queryService(
      'UPDATE users SET two_fa_enabled = FALSE, two_fa_secret = NULL WHERE id = $1',
      [(req as any).userId]
    );

    await logUserAction({
      userId: (req as any).userId,
      action: '2fa_disabled',
      ipAddress: req.ip,
    });

    return res.json({ ok: true, message: 'Two-factor authentication disabled.' });
  } catch (e: any) {
    console.error('[Auth] 2FA disable error:', e.message);
    return res.status(500).json({ error: '2FA disable failed' });
  }
});

// ── POST /auth/2fa/login ──────────────────────────────────────────────────
// Step 2 of login when 2FA is enabled — verify the TOTP code
router.post('/2fa/login', async (req: Request, res: Response) => {
  const { tempToken, totpCode } = req.body;

  if (!tempToken || !totpCode) {
    return res.status(400).json({ error: 'tempToken and totpCode are required' });
  }

  try {
    // Verify the temp token
    let payload: any;
    try {
      payload = jwt.verify(tempToken, JWT_SECRET);
    } catch {
      return res.status(401).json({ error: 'Session expired. Please log in again.' });
    }

    if (payload.purpose !== '2fa_login') {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = payload.sub;
    const rows = await queryService(
      'SELECT id, email, display_name, avatar_url, role, is_verified, two_fa_enabled, two_fa_secret, created_at FROM users WHERE id = $1',
      [userId]
    );
    const user = rows[0] as any;
    if (!user || !user.two_fa_secret) {
      return res.status(401).json({ error: 'User not found or 2FA not configured' });
    }

    // Verify TOTP
    const totp = new OTPAuth.TOTP({
      issuer: 'GlyphConnect',
      label: '',
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret: OTPAuth.Secret.fromBase32(user.two_fa_secret),
    });

    const delta = totp.validate({ token: totpCode, window: 1 });
    if (delta === null) {
      return res.status(401).json({ error: 'Invalid authentication code. Please try again.' });
    }

    // Success — issue real tokens
    const accessToken = makeAccessToken(user.id, user.role);
    const refreshToken = await createRefreshToken(
      user.id,
      { userAgent: req.headers['user-agent'] ?? 'unknown' },
      req.ip ?? ''
    );

    await logUserAction({
      userId: user.id,
      action: '2fa_login_success',
      ipAddress: req.ip,
      metadata: { email: user.email },
    });

    // Remove the two_fa_secret from the response
    const { two_fa_secret, ...safeUser } = user;
    return res.json({ user: safeUser, accessToken, refreshToken });
  } catch (e: any) {
    console.error('[Auth] 2FA login error:', e.message);
    return res.status(500).json({ error: '2FA login failed' });
  }
});

// ── Middleware: authenticate ──────────────────────────────────────────────
// Export this so other routers (sessions, admin) can use it
export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const header = req.headers.authorization;

  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authorization header required' });
    return;
  }

  try {
    const payload = jwt.verify(header.slice(7), JWT_SECRET) as any;
    (req as any).userId   = payload.sub;
    (req as any).userRole = payload.role;
    next();
  } catch (e: any) {
    res.status(401).json({ error: 'Token is invalid or has expired' });
  }
}

export default router;