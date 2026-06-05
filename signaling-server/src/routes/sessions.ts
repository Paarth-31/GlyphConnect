// // // signaling-server/src/routes/sessions.ts

// // import { Router, Request, Response } from 'express';
// // import { authenticate } from './auth';
// // import {
// //   createSession, endSession, getSessionsByUser,
// //   getSessionById, saveSessionStats
// // } from '../db/sessions';
// // import { checkSessionLimits, logUserAction } from '../db/admin';

// // const router = Router();

// // // POST /sessions — start a new session
// // router.post('/', authenticate, async (req: Request, res: Response) => {
// //   const userId = (req as any).userId;
// //   const { hostDisplayId, screenAudio, videoCall, controlEnabled } = req.body;

// //   const check = await checkSessionLimits(userId);
// //   if (!check.allowed) {
// //     return res.status(429).json({ error: check.reason });
// //   }

// //   const session = await createSession({
// //     hostId: userId,
// //     hostDisplayId,
// //     screenAudio,
// //     videoCall,
// //     controlEnabled,
// //   });

// //   await logUserAction({
// //     userId, sessionId: session.id,
// //     action: 'session_start',
// //     ipAddress: req.ip,
// //   });

// //   res.status(201).json(session);
// // });

// // // PATCH /sessions/:id/end
// // router.patch('/:id/end', authenticate, async (req: Request, res: Response) => {
// //   const { summary, stats } = req.body;
// //   const sessionId = req.params.id as string;
// //   const session = await endSession(sessionId, summary);
// //   if (!session) return res.status(404).json({ error: 'Session not found' });

// //  if (stats) await saveSessionStats(sessionId, stats);

// //   await logUserAction({
// //     userId: (req as any).userId,
// //     sessionId: sessionId,
// //     action: 'session_end',
// //   });

// //   res.json(session);
// // });

// // // GET /sessions — list my sessions
// // router.get('/', authenticate, async (req: Request, res: Response) => {
// //   const sessions = await getSessionsByUser((req as any).userId);
// //   res.json(sessions);
// // });

// // // GET /sessions/:id
// // router.get('/:id', authenticate, async (req: Request, res: Response) => {
// // const sessionId = req.params.id as string; 
// //   const session = await getSessionById(sessionId);
// //   if (!session) return res.status(404).json({ error: 'Not found' });
// //   res.json(session);
// // });

// // export default router;



// // signaling-server/src/routes/sessions.ts

// import { Router, Request, Response } from 'express';
// import { authenticate } from './auth';
// import {
//   createSession,
//   endSession,
//   getSessionsByUser,
//   getSessionById,
//   saveSessionStats,
// } from '../db/sessions';
// import { checkSessionLimits, logUserAction } from '../db/admin';

// const router = Router();

// // ── POST /sessions — start a new session ─────────────────────────────────
// router.post('/', authenticate, async (req: Request, res: Response) => {
//   // Guard: body may be empty if Content-Type header was missing in Postman
//   if (!req.body || typeof req.body !== 'object') {
//     return res.status(400).json({ error: 'Request body is required' });
//   }

//   const {
//     hostDisplayId,
//     screenAudio    = false,
//     videoCall      = false,
//     controlEnabled = false,
//     qualityPreset  = '720p',
//   } = req.body;

//   if (!hostDisplayId) {
//     return res.status(400).json({ error: 'hostDisplayId is required' });
//   }

//   const userId = (req as any).userId;

//   try {
//     // Check if user has hit their session limits
//     const check = await checkSessionLimits(userId);
//     if (!check.allowed) {
//       return res.status(429).json({ error: check.reason });
//     }

//     const session = await createSession({
//       hostId: userId,
//       hostDisplayId,
//       screenAudio,
//       videoCall,
//       controlEnabled,
//       qualityPreset,
//     });

//     await logUserAction({
//       userId,
//       sessionId:  session.id,
//       action:     'session_start',
//       ipAddress:  req.ip,
//       metadata:   { hostDisplayId },
//     });

//     return res.status(201).json(session);
//   } catch (e: any) {
//     console.error('[Sessions] Create error:', e.message);
//     return res.status(500).json({ error: 'Failed to create session' });
//   }
// });

// // ── GET /sessions — list my sessions ─────────────────────────────────────
// router.get('/', authenticate, async (req: Request, res: Response) => {
//   try {
//     const limit = parseInt(req.query.limit as string ?? '20');
//     const sessions = await getSessionsByUser((req as any).userId, limit);
//     return res.json(sessions);
//   } catch (e: any) {
//     console.error('[Sessions] List error:', e.message);
//     return res.status(500).json({ error: 'Failed to fetch sessions' });
//   }
// });

// // ── GET /sessions/:id — get one session ──────────────────────────────────
// router.get('/:id', authenticate, async (req: Request, res: Response) => {
//   try {
//     const session = await getSessionById(req.params.id as string);
//     if (!session) {
//       return res.status(404).json({ error: 'Session not found' });
//     }
//     return res.json(session);
//   } catch (e: any) {
//     console.error('[Sessions] Get error:', e.message);
//     return res.status(500).json({ error: 'Failed to fetch session' });
//   }
// });

// // ── PATCH /sessions/:id/end — end a session ───────────────────────────────
// router.patch('/:id/end', authenticate, async (req: Request, res: Response) => {
//   const { summary, stats } = req.body ?? {};

//   try {
//     const session = await endSession(req.params.id as string, summary);
//     if (!session) {
//       return res.status(404).json({ error: 'Session not found or already ended' });
//     }

//     if (stats) {
//       await saveSessionStats(req.params.id as string, stats);
//     }

//     await logUserAction({
//       userId:    (req as any).userId,
//       sessionId: req.params.id as string,
//       action:    'session_end',
//       ipAddress: req.ip,
//       metadata:  { summary: summary ?? null },
//     });

//     return res.json(session);
//   } catch (e: any) {
//     console.error('[Sessions] End error:', e.message);
//     return res.status(500).json({ error: 'Failed to end session' });
//   }
// });

// export default router;




// signaling-server/src/routes/sessions.ts
//
// FIXED: sessions were never being created or ended by the client.
// The create endpoint now records controller_socket_id.
// The end endpoint marks the session ended and calculates duration.
// List now joins with favourites to resolve host labels.

import { Router, Request, Response } from 'express';
import { authenticateToken } from './auth';
import { pool } from '../db/client';

const router = Router();

// GET /sessions?limit=20
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  try {
    const { rows } = await pool.query(
      `SELECT
         s.id, s.host_display_id, s.status,
         s.start_time, s.end_time, s.duration_seconds,
         s.screen_audio, s.video_call, s.control_enabled,
         s.summary, s.ai_summary,
         COALESCE(f.label, s.host_display_id) AS controller_name
       FROM sessions s
       LEFT JOIN favourites f
         ON f.user_id = s.user_id AND f.remote_id = s.host_display_id
       WHERE s.user_id = $1
       ORDER BY s.start_time DESC
       LIMIT $2`,
      [(req as any).user.id, limit]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /sessions/:id
router.get('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, COALESCE(f.label, s.host_display_id) AS controller_name
       FROM sessions s
       LEFT JOIN favourites f
         ON f.user_id = s.user_id AND f.remote_id = s.host_display_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [req.params.id, (req as any).user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /sessions — create a new session record when ICE connects
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const {
    hostDisplayId,
    controllerSocketId,
    screenAudio    = false,
    videoCall      = false,
    controlEnabled = false,
  } = req.body;

  if (!hostDisplayId) {
    return res.status(400).json({ error: 'hostDisplayId is required' });
  }

  try {
    // Mark any previous active sessions for this user as error (cleanup)
    await pool.query(
      `UPDATE sessions SET status='error', end_time=NOW()
       WHERE user_id=$1 AND status='active'
       AND start_time < NOW() - INTERVAL '12 hours'`,
      [(req as any).user.id]
    );

    const { rows } = await pool.query(
      `INSERT INTO sessions
         (user_id, host_display_id, controller_socket_id,
          screen_audio, video_call, control_enabled, status)
       VALUES ($1,$2,$3,$4,$5,$6,'active')
       RETURNING *`,
      [
        (req as any).user.id,
        hostDisplayId,
        controllerSocketId ?? null,
        screenAudio,
        videoCall,
        controlEnabled,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /sessions/:id/end — mark session as ended
router.patch('/:id/end', authenticateToken, async (req: Request, res: Response) => {
  const { summary, videoCall, controlEnabled } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE sessions SET
         status          = 'ended',
         end_time        = NOW(),
         summary         = COALESCE($3, summary),
         video_call      = COALESCE($4, video_call),
         control_enabled = COALESCE($5, control_enabled)
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       RETURNING *`,
      [
        req.params.id,
        (req as any).user.id,
        summary ?? null,
        videoCall ?? null,
        controlEnabled ?? null,
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Active session not found' });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;