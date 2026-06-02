// signaling-server/src/routes/favourites.ts
//
// [FIX 5] POST /favourites accepts optional body field `bump: true` to call
//   bumpFavouriteUsage (increments use_count + last_used_at) vs upsertFavourite
//   (add/rename only). The frontend sends bump=true when actually connecting to
//   a peer, and omits it when adding or renaming a contact.

import { Router, Request, Response } from 'express';
import { authenticate } from './auth';
import {
  getFavourites,
  upsertFavourite,
  bumpFavouriteUsage,
  deleteFavourite,
} from '../db/favourites';

const router = Router();

// GET /favourites
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const rows = await getFavourites((req as any).userId);
    return res.json(rows);
  } catch (e: any) {
    console.error('[Favourites] List error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch favourites' });
  }
});

// POST /favourites — add/update label (default) or bump usage (bump: true)
router.post('/', authenticate, async (req: Request, res: Response) => {
  const { remoteId, label, bump } = req.body ?? {};
  if (!remoteId) return res.status(400).json({ error: 'remoteId is required' });

  try {
    let rows: any[];
    if (bump === true) {
      // Called when user actually connects to a peer — increments use_count
      rows = await bumpFavouriteUsage((req as any).userId, remoteId);
    } else {
      // Called when adding or renaming a contact — does NOT increment use_count
      rows = await upsertFavourite((req as any).userId, remoteId, label);
    }
    return res.status(201).json(rows[0]);
  } catch (e: any) {
    console.error('[Favourites] Upsert error:', e.message);
    return res.status(500).json({ error: 'Failed to save favourite' });
  }
});

// DELETE /favourites/:id
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    await deleteFavourite((req as any).userId, req.params.id as string);
    return res.json({ ok: true });
  } catch (e: any) {
    console.error('[Favourites] Delete error:', e.message);
    return res.status(500).json({ error: 'Failed to delete favourite' });
  }
});

export default router;
