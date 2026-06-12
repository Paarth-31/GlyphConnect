import { queryService } from './client';
import os from 'os';

export async function recordSystemHealth(
  activeSessions: number,
  activeConnections: number,
  dbPoolUsed: number,
  dbPoolTotal: number
) {
  const cpuUsage = os.loadavg()[0] * 10;
  const totalMem = Math.round(os.totalmem() / 1024 / 1024);
  const freeMem  = Math.round(os.freemem()  / 1024 / 1024);

  await queryService(
    `INSERT INTO system_health
       (cpu_pct, mem_used_mb, mem_total_mb,
        active_sessions, active_connections,
        db_pool_used, db_pool_total)
     VALUES ($1,$2,$3,$4,$5,$6,$7)`,
    [
      cpuUsage.toFixed(2),
      totalMem - freeMem,
      totalMem,
      activeSessions,
      activeConnections,
      dbPoolUsed,
      dbPoolTotal,
    ]
  );
}

export async function getSystemConfig(key: string): Promise<any> {
  const rows = await queryService(
    `SELECT value FROM system_config WHERE key = $1`,
    [key]
  );
  return rows[0]?.value ?? null;
}

export async function setSystemConfig(
  key: string,
  value: any,
  updatedBy: string
) {
  await queryService(
    `INSERT INTO system_config (key, value, updated_by)
     VALUES ($1,$2,$3)
     ON CONFLICT (key) DO UPDATE SET
       value      = EXCLUDED.value,
       updated_by = EXCLUDED.updated_by,
       updated_at = NOW()`,
    [key, JSON.stringify(value), updatedBy]
  );
}

export async function logUserAction(data: {
  userId?: string;
  sessionId?: string;
  action: string;
  level?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: object;
}) {
  try {
    await queryService(
      `INSERT INTO user_logs
         (user_id, session_id, action, level, ip_address, user_agent, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [
        data.userId    ?? null,
        data.sessionId ?? null,
        data.action,
        data.level     ?? 'info',
        data.ipAddress ?? null,
        data.userAgent ?? null,
        data.metadata ? JSON.stringify(data.metadata) : null,
      ]
    );
  } catch (e: any) {
    console.warn('[Admin] Log write failed:', e.message);
  }
}

export async function getAdminDashboard() {
  const [health, activeSessions, userSummary] = await Promise.all([
    queryService(
      `SELECT * FROM system_health ORDER BY recorded_at DESC LIMIT 1`
    ),
    queryService(
      `SELECT s.id, s.host_display_id, s.status, s.start_time,
              u.display_name AS host_name, u.email AS host_email
       FROM sessions s
       JOIN users u ON u.id = s.host_id
       WHERE s.status = 'active'
       ORDER BY s.start_time DESC`
    ),
    queryService(
      `SELECT u.id, u.email, u.display_name,
              COUNT(s.id)::INT AS total_sessions,
              MAX(s.start_time) AS last_session_at
       FROM users u
       LEFT JOIN sessions s ON s.host_id = u.id
       GROUP BY u.id
       ORDER BY total_sessions DESC
       LIMIT 20`
    ),
  ]);

  return {
    health:   health[0] ?? null,
    sessions: activeSessions,
    users:    userSummary,
  };
}

export async function checkSessionLimits(
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const [userLimits, globalConfig] = await Promise.all([
    queryService(
      `SELECT max_concurrent_sessions, max_sessions_per_day
       FROM user_limits WHERE user_id = $1`,
      [userId]
    ),
    queryService(
      `SELECT key, value FROM system_config
       WHERE key IN ('max_concurrent_sessions','max_sessions_per_day')`
    ),
  ]);

  const userLimit = userLimits[0] as any ?? {};
  const globalMap: Record<string, number> = {};
  for (const row of globalConfig as any[]) {
    globalMap[row.key] = parseInt(row.value);
  }

  const maxConcurrent = userLimit.max_concurrent_sessions
    ?? globalMap['max_concurrent_sessions']
    ?? 2;
  const maxPerDay = userLimit.max_sessions_per_day
    ?? globalMap['max_sessions_per_day']
    ?? 20;

  const [concurrentRows, dailyRows] = await Promise.all([
    queryService(
      `SELECT COUNT(*)::INT AS cnt FROM sessions
       WHERE host_id = $1 AND status = 'active'`,
      [userId]
    ),
    queryService(
      `SELECT COUNT(*)::INT AS cnt FROM sessions
       WHERE host_id = $1
         AND start_time >= NOW() - INTERVAL '24 hours'`,
      [userId]
    ),
  ]);

  const concurrent = (concurrentRows[0] as any).cnt;
  const daily      = (dailyRows[0] as any).cnt;

  if (concurrent >= maxConcurrent) {
    return { allowed: false, reason: `Max ${maxConcurrent} concurrent sessions reached` };
  }
  if (daily >= maxPerDay) {
    return { allowed: false, reason: `Daily session limit of ${maxPerDay} reached` };
  }

  return { allowed: true };
}