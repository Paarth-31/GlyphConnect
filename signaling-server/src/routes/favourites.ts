import { Router, Request, Response } from 'express';
import { authenticate } from './auth';   // FIX: was authenticateToken
import { pool } from '../db/client';

const router = Router();
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, remote_id, label, use_count, last_used_at, created_at
       FROM favourites
       WHERE user_id = $1
       ORDER BY last_used_at DESC NULLS LAST, use_count DESC`,
      [(req as any).userId]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/', authenticate, async (req: Request, res: Response) => {
  const { remoteId, label, bump } = req.body;

  if (!remoteId || typeof remoteId !== 'string') {
    return res.status(400).json({ error: 'remoteId is required' });
  }

  try {
    if (bump) {
      const { rows } = await pool.query(
        `INSERT INTO favourites (user_id, remote_id, use_count, last_used_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (user_id, remote_id) DO UPDATE SET
           use_count    = favourites.use_count + 1,
           last_used_at = NOW()
         RETURNING *`,
        [(req as any).userId, remoteId]
      );
      return res.json(rows[0]);
    }

    const { rows } = await pool.query(
      `INSERT INTO favourites (user_id, remote_id, label, use_count)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (user_id, remote_id) DO UPDATE SET
         label = COALESCE(EXCLUDED.label, favourites.label)
       RETURNING *`,
      [(req as any).userId, remoteId, label ?? null]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.patch('/:id', authenticate, async (req: Request, res: Response) => {
  const { label } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE favourites SET label = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [label ?? null, req.params.id, (req as any).userId]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Favourite not found' });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'DELETE FROM favourites WHERE id = $1 AND user_id = $2',
      [req.params.id, (req as any).userId]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;