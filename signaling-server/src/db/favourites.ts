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
