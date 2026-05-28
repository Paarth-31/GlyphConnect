import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
  createUser,
  verifyPassword,
  createRefreshToken,
  getUserById,
} from '../db/users';
import { logUserAction } from '../db/admin';
import { queryService } from '../db/client';

const router = Router();

const JWT_SECRET  = process.env.JWT_SECRET  ?? 'change-me-in-production';
const JWT_EXPIRES = process.env.JWT_EXPIRES ?? '15m';

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
    // Look up the session row that holds this token
    // Also verify it hasn't expired and the user is still active
    const rows = await queryService(
      `SELECT
         usa.user_id,
         usa.expires_at,
         u.role,
         u.is_active,
         u.email
       FROM user_sessions_auth usa
       JOIN users u ON u.id = usa.user_id
       WHERE usa.refresh_token = $1
         AND usa.expires_at    > NOW()
         AND u.is_active       = TRUE`,
      [refreshToken]
    );

    if (!rows[0]) {
      return res
        .status(401)
        .json({ error: 'Refresh token is invalid or has expired' });
    }

    const { user_id, role, email } = rows[0] as any;

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
    if (refreshToken) {
      await queryService(
        `DELETE FROM user_sessions_auth WHERE refresh_token = $1`,
        [refreshToken]
      );
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