// signaling-server/src/db/favourites.ts
//
// [FIX 5] upsertFavourite split into two operations:
//   - addOrUpdateLabel: INSERT or UPDATE label only — use_count NOT incremented
//     (used by addContact and saveEdit in AddressBookPage)
//   - bumpUsage: increments use_count and sets last_used_at
//     (used when actually connecting to a remote peer)
//
// This prevents use_count from being inflated every time the label is changed
// or a contact is added. The route POST /favourites accepts an optional
// `bump` query param (default false) to call the right function.

import { queryService } from './client';

export async function getFavourites(userId: string) {
  return queryService(
    `SELECT id, remote_id, label, last_used_at, use_count, created_at
     FROM   favourites
     WHERE  user_id = $1
     ORDER  BY use_count DESC, last_used_at DESC NULLS LAST`,
    [userId]
  );
}

/** Add a new favourite or update its label. Does NOT bump use_count. */
export async function upsertFavourite(
  userId: string,
  remoteId: string,
  label?: string
) {
  return queryService(
    `INSERT INTO favourites (user_id, remote_id, label)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, remote_id) DO UPDATE
       SET label = COALESCE(EXCLUDED.label, favourites.label)
     RETURNING *`,
    [userId, remoteId, label ?? null]
  );
}

/** Bump use_count + last_used_at when the user actually connects to a peer. */
export async function bumpFavouriteUsage(userId: string, remoteId: string) {
  return queryService(
    `INSERT INTO favourites (user_id, remote_id, last_used_at, use_count)
     VALUES ($1, $2, NOW(), 1)
     ON CONFLICT (user_id, remote_id) DO UPDATE
       SET last_used_at = NOW(),
           use_count    = favourites.use_count + 1
     RETURNING *`,
    [userId, remoteId]
  );
}

export async function deleteFavourite(userId: string, favouriteId: string) {
  await queryService(
    `DELETE FROM favourites WHERE id = $1 AND user_id = $2`,
    [favouriteId, userId]
  );
}
