import { Router, Request, Response } from 'express';
import { authenticate } from './auth';
import { pool } from '../db/client';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  try {
    const { rows } = await pool.query(
      `SELECT
         s.id, s.host_display_id, s.status,
         s.start_time, s.end_time, s.duration_seconds,
         s.screen_audio, s.video_call, s.control_enabled,
         s.summary, s.ai_summary,
         COALESCE(f.label, s.host_display_id) AS controller_name,
         f.id AS favourite_id
       FROM (
         SELECT DISTINCT ON (host_display_id)
           id, user_id, host_display_id, status,
           start_time, end_time, duration_seconds,
           screen_audio, video_call, control_enabled,
           summary, ai_summary
         FROM sessions
         WHERE user_id = $1
         ORDER BY host_display_id, start_time DESC
       ) s
       LEFT JOIN favourites f
         ON f.user_id = s.user_id AND f.remote_id = s.host_display_id
       ORDER BY s.start_time DESC
       LIMIT $2`,
      [(req as any).userId, limit]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT s.*, COALESCE(f.label, s.host_display_id) AS controller_name
       FROM sessions s
       LEFT JOIN favourites f
         ON f.user_id = s.user_id AND f.remote_id = s.host_display_id
       WHERE s.id = $1 AND s.user_id = $2`,
      [req.params.id, (req as any).userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Session not found' });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
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
    await pool.query(
      `UPDATE sessions SET status='error', end_time=NOW()
       WHERE user_id=$1 AND status='active'
       AND start_time < NOW() - INTERVAL '12 hours'`,
      [(req as any).userId]
    );

    const { rows } = await pool.query(
      `INSERT INTO sessions
         (user_id, host_id, host_display_id, controller_socket_id,
          screen_audio, video_call, control_enabled, status)
       VALUES ($1,$1,$2,$3,$4,$5,$6,'active')
       RETURNING *`,
      [
        (req as any).userId,
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

router.patch('/:id/end', authenticate, async (req: Request, res: Response) => {
  const { summary, videoCall, controlEnabled } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE sessions SET
         status           = 'ended',
         end_time         = NOW(),
         duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER,
         summary          = COALESCE($3, summary),
         video_call       = COALESCE($4, video_call),
         control_enabled  = COALESCE($5, control_enabled)
       WHERE id = $1 AND user_id = $2 AND status = 'active'
       RETURNING *`,
      [
        req.params.id,
        (req as any).userId,
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