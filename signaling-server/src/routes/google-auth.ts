import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { queryService } from '../db/client';
import { logUserAction } from '../db/admin';
import { createRefreshToken } from '../db/users';

const router = Router();
const GOOGLE_CLIENT_ID     = process.env.GOOGLE_CLIENT_ID     ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const FRONTEND_URL         = process.env.FRONTEND_URL ?? 'http://localhost:5173';
const JWT_SECRET           = process.env.JWT_SECRET   ?? 'change-me';
const JWT_EXPIRES          = process.env.JWT_EXPIRES  ?? '15m';

function makeAccessToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRES as any });
}

router.post('/google/callback', async (req: Request, res: Response) => {
 const { code, redirectUri } = req.body;
 const effectiveRedirectUri = redirectUri ?? FRONTEND_URL;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(500).json({ error: 'Google OAuth is not configured on the server' });
  }

  try {
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id:     GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri:  effectiveRedirectUri,
        grant_type:    'authorization_code',
      }),
    });

    const tokenData = await tokenRes.json() as any;

    if (tokenData.error) {
      console.error('[Google OAuth] Token exchange failed:', tokenData.error_description);
      return res.status(401).json({ error: 'Google token exchange failed' });
    }

    const profileRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    const profile = await profileRes.json() as {
      sub: string;
      email: string;
      name: string;
      picture: string;
      email_verified: boolean;
    };

    if (!profile.email) {
      return res.status(400).json({ error: 'Could not retrieve email from Google' });
    }

    let user: any;
    const existing = await queryService(
      `SELECT id, email, display_name, avatar_url, role, is_verified, two_fa_enabled, created_at
       FROM users WHERE email = $1 AND is_active = TRUE`,
      [profile.email.toLowerCase()]
    );

    if (existing[0]) {
      user = existing[0];
      await queryService(
        `UPDATE users SET avatar_url = $1, is_verified = TRUE, updated_at = NOW()
         WHERE id = $2`,
        [profile.picture, user.id]
      );
      user.avatar_url  = profile.picture;
      user.is_verified = true;
    } else {
      const permRoomId = Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join('');
      const rows = await queryService(
        `INSERT INTO users
           (email, display_name, avatar_url, is_verified, password_hash, permanent_room_id)
         VALUES ($1, $2, $3, TRUE, '', $4)
         RETURNING id, email, display_name, avatar_url, role,
                   is_verified, two_fa_enabled, permanent_room_id, created_at`,
        [profile.email.toLowerCase(), profile.name, profile.picture, permRoomId]
      );
      user = rows[0];

      await logUserAction({
        userId:    user.id,
        action:    'register_google',
        ipAddress: req.ip,
        metadata:  { email: user.email },
      });
    }

    await logUserAction({
      userId:    user.id,
      action:    'login_google',
      ipAddress: req.ip,
      metadata:  { email: user.email },
    });

    const accessToken  = makeAccessToken(user.id, user.role);
    const refreshToken = await createRefreshToken(
      user.id,
      { userAgent: req.headers['user-agent'] ?? 'google-oauth', provider: 'google' },
      req.ip ?? ''
    );

    return res.json({ user, accessToken, refreshToken });
  } catch (e: any) {
    console.error('[Google OAuth] Error:', e.message);
    return res.status(500).json({ error: 'Google login failed' });
  }
});

export default router;