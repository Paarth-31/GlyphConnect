// // signaling-server/src/routes/favourites.ts
// //
// // [FIX 5] POST /favourites accepts optional body field `bump: true` to call
// //   bumpFavouriteUsage (increments use_count + last_used_at) vs upsertFavourite
// //   (add/rename only). The frontend sends bump=true when actually connecting to
// //   a peer, and omits it when adding or renaming a contact.

// import { Router, Request, Response } from 'express';
// import { authenticate } from './auth';
// import {
//   getFavourites,
//   upsertFavourite,
//   bumpFavouriteUsage,
//   deleteFavourite,
// } from '../db/favourites';

// const router = Router();

// // GET /favourites
// router.get('/', authenticate, async (req: Request, res: Response) => {
//   try {
//     const rows = await getFavourites((req as any).userId);
//     return res.json(rows);
//   } catch (e: any) {
//     console.error('[Favourites] List error:', e.message);
//     return res.status(500).json({ error: 'Failed to fetch favourites' });
//   }
// });

// // POST /favourites — add/update label (default) or bump usage (bump: true)
// router.post('/', authenticate, async (req: Request, res: Response) => {
//   const { remoteId, label, bump } = req.body ?? {};
//   if (!remoteId) return res.status(400).json({ error: 'remoteId is required' });

//   try {
//     let rows: any[];
//     if (bump === true) {
//       // Called when user actually connects to a peer — increments use_count
//       rows = await bumpFavouriteUsage((req as any).userId, remoteId);
//     } else {
//       // Called when adding or renaming a contact — does NOT increment use_count
//       rows = await upsertFavourite((req as any).userId, remoteId, label);
//     }
//     return res.status(201).json(rows[0]);
//   } catch (e: any) {
//     console.error('[Favourites] Upsert error:', e.message);
//     return res.status(500).json({ error: 'Failed to save favourite' });
//   }
// });

// // DELETE /favourites/:id
// router.delete('/:id', authenticate, async (req: Request, res: Response) => {
//   try {
//     await deleteFavourite((req as any).userId, req.params.id as string);
//     return res.json({ ok: true });
//   } catch (e: any) {
//     console.error('[Favourites] Delete error:', e.message);
//     return res.status(500).json({ error: 'Failed to delete favourite' });
//   }
// });

// export default router;






// signaling-server/src/routes/favourites.ts
//
// FIXED: POST /favourites now handles bump:true separately so
// use_count increments on every connect without requiring a label.
// upsert_favourite() DB function handles the insert-or-update atomically.

import { Router, Request, Response } from 'express';
import { authenticateToken } from './auth';
import { pool } from '../db/client';

const router = Router();

// GET /favourites
router.get('/', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, remote_id, label, use_count, last_used_at, created_at
       FROM favourites
       WHERE user_id = $1
       ORDER BY last_used_at DESC NULLS LAST, use_count DESC`,
      [(req as any).user.id]
    );
    res.json(rows);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// POST /favourites — upsert (add or update label) or bump (increment count)
router.post('/', authenticateToken, async (req: Request, res: Response) => {
  const { remoteId, label, bump } = req.body;

  if (!remoteId || typeof remoteId !== 'string') {
    return res.status(400).json({ error: 'remoteId is required' });
  }

  try {
    if (bump) {
      // Increment use_count and last_used_at, create if not exists
      const { rows } = await pool.query(
        `INSERT INTO favourites (user_id, remote_id, use_count, last_used_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT (user_id, remote_id) DO UPDATE SET
           use_count    = favourites.use_count + 1,
           last_used_at = NOW()
         RETURNING *`,
        [(req as any).user.id, remoteId]
      );
      return res.json(rows[0]);
    }

    // Regular upsert: add or update label
    const { rows } = await pool.query(
      `INSERT INTO favourites (user_id, remote_id, label, use_count)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (user_id, remote_id) DO UPDATE SET
         label = COALESCE(EXCLUDED.label, favourites.label),
         updated_at = NOW()
       RETURNING *`,
      [(req as any).user.id, remoteId, label ?? null]
    );
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// PATCH /favourites/:id — update label only
router.patch('/:id', authenticateToken, async (req: Request, res: Response) => {
  const { label } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE favourites SET label = $1
       WHERE id = $2 AND user_id = $3
       RETURNING *`,
      [label ?? null, req.params.id, (req as any).user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Favourite not found' });
    res.json(rows[0]);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /favourites/:id
router.delete('/:id', authenticateToken, async (req: Request, res: Response) => {
  try {
    const result = await pool.query(
      'DELETE FROM favourites WHERE id = $1 AND user_id = $2',
      [req.params.id, (req as any).user.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;