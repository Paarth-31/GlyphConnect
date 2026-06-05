// // signaling-server/src/routes/profile.ts

// import { Router, Request, Response } from 'express';
// import { authenticate } from './auth';
// import { getUserProfile, updateProfile } from '../db/users';
// import { queryService } from '../db/client';

// const router = Router();

// // GET /profile — full profile with joined user_profiles row
// router.get('/', authenticate, async (req: Request, res: Response) => {
//   try {
//     const profile = await getUserProfile((req as any).userId);
//     if (!profile) return res.status(404).json({ error: 'Profile not found' });
//     return res.json(profile);
//   } catch (e: any) {
//     console.error('[Profile] Get error:', e.message);
//     return res.status(500).json({ error: 'Failed to fetch profile' });
//   }
// });

// // PATCH /profile — update display_name, bio, timezone, etc.
// router.patch('/', authenticate, async (req: Request, res: Response) => {
//   const allowed = [
//     'display_name', 'full_name', 'bio',
//     'timezone', 'locale', 'preferred_lang',
//     'phone', 'country_code',
//   ];
//   const updates: Record<string, any> = {};
//   for (const key of allowed) {
//     if (req.body[key] !== undefined) updates[key] = req.body[key];
//   }
//   if (Object.keys(updates).length === 0) {
//     return res.status(400).json({ error: 'No valid fields to update' });
//   }
//   try {
//     await updateProfile((req as any).userId, updates);
//     const profile = await getUserProfile((req as any).userId);
//     return res.json(profile);
//   } catch (e: any) {
//     console.error('[Profile] Update error:', e.message);
//     return res.status(500).json({ error: 'Failed to update profile' });
//   }
// });

// // GET /profile/stats — session counts for the profile page
// router.get('/stats', authenticate, async (req: Request, res: Response) => {
//   const userId = (req as any).userId;
//   try {
//     const rows = await queryService(
//       `SELECT
//          COUNT(*)::INT                                            AS total_sessions,
//          COALESCE(SUM(duration_seconds), 0)::INT                AS total_duration_seconds,
//          COALESCE(AVG(duration_seconds) FILTER (
//            WHERE duration_seconds > 0
//          ), 0)::INT                                              AS avg_duration_seconds,
//          MAX(start_time)                                         AS last_session_at,
//          COUNT(*) FILTER (
//            WHERE start_time > NOW() - INTERVAL '24 hours'
//          )::INT                                                  AS sessions_today
//        FROM sessions
//        WHERE host_id = $1`,
//       [userId]
//     );
//     return res.json(rows[0] ?? {
//       total_sessions: 0,
//       total_duration_seconds: 0,
//       avg_duration_seconds: 0,
//       last_session_at: null,
//       sessions_today: 0,
//     });
//   } catch (e: any) {
//     console.error('[Profile] Stats error:', e.message);
//     return res.status(500).json({ error: 'Failed to fetch stats' });
//   }
// });

// export default router;






// signaling-server/src/routes/profile.ts
//
// ADDED: GET /profile/room-id and PUT /profile/room-id
// These let authenticated users sync their permanent room ID between
// devices via the DB. The client stores the ID in localStorage; these
// endpoints just persist a copy server-side.

import { Router, Request, Response } from 'express';
import { authenticateToken } from './auth';
import { pool } from '../db/client';

const router = Router();

// GET /profile — return full profile
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.email, u.display_name, u.avatar_url, u.role,
              u.two_fa_enabled, u.permanent_room_id,
              p.full_name, p.bio, p.timezone, p.locale,
              p.preferred_lang, p.phone, p.country_code
       FROM users u
       LEFT JOIN user_profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [(req as any).user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'User not found' });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /profile — update display name, bio, etc.
router.patch('/', authenticateToken, async (req: Request, res: Response) => {
  const { display_name, bio, timezone, locale, full_name, phone, country_code } = req.body;
  try {
    // Update users table
    if (display_name) {
      await pool.query(
        'UPDATE users SET display_name = $1 WHERE id = $2',
        [display_name, (req as any).user.id]
      );
    }
    // Upsert user_profiles
    await pool.query(
      `INSERT INTO user_profiles (user_id, full_name, bio, timezone, locale, phone, country_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (user_id) DO UPDATE SET
         full_name    = COALESCE(EXCLUDED.full_name,    user_profiles.full_name),
         bio          = COALESCE(EXCLUDED.bio,          user_profiles.bio),
         timezone     = COALESCE(EXCLUDED.timezone,     user_profiles.timezone),
         locale       = COALESCE(EXCLUDED.locale,       user_profiles.locale),
         phone        = COALESCE(EXCLUDED.phone,        user_profiles.phone),
         country_code = COALESCE(EXCLUDED.country_code, user_profiles.country_code),
         updated_at   = NOW()`,
      [(req as any).user.id, full_name, bio, timezone, locale, phone, country_code]
    );
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /profile/stats — session statistics
router.get('/stats', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         COUNT(*)::int                                       AS total_sessions,
         COALESCE(SUM(duration_seconds),0)::int             AS total_duration_seconds,
         COALESCE(AVG(duration_seconds),0)::int             AS avg_duration_seconds,
         MAX(start_time)                                     AS last_session_at,
         COUNT(*) FILTER (WHERE start_time > NOW() - '24h'::interval)::int AS sessions_today
       FROM sessions
       WHERE user_id = $1 AND status = 'ended'`,
      [(req as any).user.id]
    );
    res.json(rows[0] ?? {
      total_sessions: 0, total_duration_seconds: 0,
      avg_duration_seconds: 0, last_session_at: null, sessions_today: 0,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /profile/room-id — get this user's permanent room ID from DB
router.get('/room-id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      'SELECT permanent_room_id FROM users WHERE id = $1',
      [(req as any).user.id]
    );
    res.json({ permanent_room_id: rows[0]?.permanent_room_id ?? null });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PUT /profile/room-id — sync a permanent room ID to DB
// The client generates the ID locally; this just stores a copy.
router.put('/room-id', authenticateToken, async (req: Request, res: Response) => {
  const { roomId } = req.body;
  if (!roomId || !/^\d{11}$/.test(roomId)) {
    return res.status(400).json({ error: 'roomId must be an 11-digit string' });
  }
  try {
    // Check uniqueness first (another user might have claimed this ID)
    const existing = await pool.query(
      'SELECT id FROM users WHERE permanent_room_id = $1 AND id != $2',
      [roomId, (req as any).user.id]
    );
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'This Room ID is already taken. Please generate a new one.' });
    }
    await pool.query(
      'UPDATE users SET permanent_room_id = $1 WHERE id = $2',
      [roomId, (req as any).user.id]
    );
    res.json({ permanent_room_id: roomId });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;