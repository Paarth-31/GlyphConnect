// signaling-server/src/db/client.ts
// Pool setup — import this everywhere instead of creating new clients

import { Pool } from 'pg';

export const pool = new Pool({
  host:     process.env.DB_HOST     ?? 'localhost',
  port:     parseInt(process.env.DB_PORT ?? '5432'),
  database: process.env.DB_NAME     ?? 'rda',
  user:     process.env.DB_USER     ?? 'rda_app',
  password: process.env.DB_PASSWORD ?? '',
  max:      20,          // max pool size
  idleTimeoutMillis:    30_000,
  connectionTimeoutMillis: 5_000,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err);
});

// Helper: run a query with the RLS user context set
export async function queryAsUser<T = any>(
  userId: string,
  text: string,
  params?: any[]
): Promise<T[]> {
  const client = await pool.connect();
  try {
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [userId]);
    const result = await client.query(text, params);
    return result.rows as T[];
  } finally {
    client.release();
  }
}

// Helper: run as service role (bypasses RLS — admin/internal use only)
export async function queryService<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}
export async function getPoolStats() {
  return {
    total: pool.totalCount,
    idle: pool.idleCount,
    waiting: pool.waitingCount
  };
}