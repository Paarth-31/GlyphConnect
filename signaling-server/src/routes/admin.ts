import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from './auth';
import { getAdminDashboard, setSystemConfig, logUserAction } from '../db/admin';
import { queryService } from '../db/client';

const router = Router();
function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  authenticate(req, res, () => {
    const role = (req as any).userRole;
    if (role !== 'admin' && role !== 'superadmin') {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  });
}

router.get('/dashboard', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const data = await getAdminDashboard();
    return res.json(data);
  } catch (e: any) {
    console.error('[Admin] Dashboard error:', e.message);
    return res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

router.get('/users', requireAdmin, async (req: Request, res: Response) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page  as string ?? '1'));
    const limit  = Math.min(100, parseInt(req.query.limit as string ?? '50'));
    const offset = (page - 1) * limit;

    const rows = await queryService(
      `SELECT
         u.id,
         u.email,
         u.display_name,
         u.role,
         u.is_active,
         u.is_verified,
         u.last_login_at,
         u.last_login_ip,
         u.failed_login_count,
         u.created_at,
         COUNT(s.id)::INT AS session_count
       FROM users u
       LEFT JOIN sessions s ON s.host_id = u.id
       GROUP BY u.id
       ORDER BY u.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countRows = await queryService(
      `SELECT COUNT(*)::INT AS total FROM users`
    );

    return res.json({
      users: rows,
      total: (countRows[0] as any).total,
      page,
      limit,
    });
  } catch (e: any) {
    console.error('[Admin] Users error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.patch('/users/:id', requireAdmin, async (req: Request, res: Response) => {
  const { is_active, role } = req.body ?? {};

  if (role && (req as any).userRole !== 'superadmin' && role === 'superadmin') {
    return res.status(403).json({ error: 'Only superadmin can grant superadmin role' });
  }

  try {
    const rows = await queryService(
      `UPDATE users
       SET
         is_active  = COALESCE($2, is_active),
         role       = COALESCE($3, role),
         updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, display_name, role, is_active`,
      [req.params.id, is_active ?? null, role ?? null]
    );

    if (!rows[0]) {
      return res.status(404).json({ error: 'User not found' });
    }

    await logUserAction({
      userId:   (req as any).userId,
      action:   'admin_user_update',
      metadata: { targetUserId: req.params.id, changes: { is_active, role } },
    });

    return res.json(rows[0]);
  } catch (e: any) {
    console.error('[Admin] User update error:', e.message);
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

router.get('/config', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const rows = await queryService(
      `SELECT key, value, description, updated_at
       FROM system_config
       ORDER BY key`
    );
    return res.json(rows);
  } catch (e: any) {
    console.error('[Admin] Config error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch config' });
  }
});

router.patch('/config/:key', requireAdmin, async (req: Request, res: Response) => {
  const { value } = req.body ?? {};

  if (value === undefined) {
    return res.status(400).json({ error: 'value is required in request body' });
  }

  try {
    await setSystemConfig(req.params.key as string, value, (req as any).userId);

    await logUserAction({
      userId:   (req as any).userId,
      action:   'admin_config_update',
      metadata: { key: req.params.key as string, value },
    });

    return res.json({ ok: true, key: req.params.key as string, value });
  } catch (e: any) {
    console.error('[Admin] Config update error:', e.message);
    return res.status(500).json({ error: 'Failed to update config' });
  }
});

router.get('/health/history', requireAdmin, async (req: Request, res: Response) => {
  try {
    const hours = Math.min(168, parseInt(req.query.hours as string ?? '24'));
    const rows  = await queryService(
      `SELECT
         id, cpu_pct, mem_used_mb, mem_total_mb,
         active_sessions, active_connections,
         db_pool_used, db_pool_total, recorded_at
       FROM system_health
       WHERE recorded_at > NOW() - ($1 || ' hours')::INTERVAL
       ORDER BY recorded_at DESC`,
      [hours]
    );
    return res.json(rows);
  } catch (e: any) {
    console.error('[Admin] Health history error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch health history' });
  }
});

router.get('/logs', requireAdmin, async (req: Request, res: Response) => {
  try {
    const {
      userId,
      action,
      level,
      limit = '100',
    } = req.query;

    const rows = await queryService(
      `SELECT
         ul.id,
         ul.action,
         ul.level,
         ul.ip_address,
         ul.metadata,
         ul.created_at,
         u.email,
         u.display_name
       FROM user_logs ul
       LEFT JOIN users u ON u.id = ul.user_id
       WHERE ($1::UUID IS NULL OR ul.user_id = $1::UUID)
         AND ($2::TEXT IS NULL OR ul.action   = $2)
         AND ($3::TEXT IS NULL OR ul.level    = $3::log_level)
       ORDER BY ul.created_at DESC
       LIMIT $4`,
      [
        userId ?? null,
        action ?? null,
        level  ?? null,
        Math.min(500, parseInt(limit as string)),
      ]
    );
    return res.json(rows);
  } catch (e: any) {
    console.error('[Admin] Logs error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

router.get('/sessions', requireAdmin, async (req: Request, res: Response) => {
  try {
    const limit  = Math.min(100, parseInt(req.query.limit as string ?? '50'));
    const status = req.query.status as string ?? null;

    const rows = await queryService(
      `SELECT
         s.id,
         s.host_display_id,
         s.status,
         s.start_time,
         s.end_time,
         s.duration_seconds,
         s.screen_audio,
         s.video_call,
         s.control_enabled,
         u_host.email        AS host_email,
         u_host.display_name AS host_name,
         u_ctrl.email        AS controller_email,
         u_ctrl.display_name AS controller_name
       FROM sessions s
       JOIN  users u_host ON u_host.id = s.host_id
       LEFT JOIN users u_ctrl ON u_ctrl.id = s.controller_id
       WHERE ($2::TEXT IS NULL OR s.status = $2)
       ORDER BY s.start_time DESC
       LIMIT $1`,
      [limit, status]
    );
    return res.json(rows);
  } catch (e: any) {
    console.error('[Admin] Sessions error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

router.get('/stats', requireAdmin, async (_req: Request, res: Response) => {
  try {
    const [users, sessions, health] = await Promise.all([
      queryService(`
        SELECT
          COUNT(*)                                            AS total_users,
          COUNT(*) FILTER (WHERE is_active = TRUE)           AS active_users,
          COUNT(*) FILTER (WHERE role = 'admin')             AS admin_count,
          COUNT(*) FILTER (
            WHERE created_at > NOW() - INTERVAL '24 hours'
          )                                                   AS new_today
        FROM users
      `),
      queryService(`
        SELECT
          COUNT(*)                                                   AS total_sessions,
          COUNT(*) FILTER (WHERE status = 'active')                  AS active_now,
          COUNT(*) FILTER (
            WHERE start_time > NOW() - INTERVAL '24 hours'
          )                                                           AS today,
          AVG(duration_seconds) FILTER (WHERE duration_seconds > 0)  AS avg_duration_sec
        FROM sessions
      `),
      queryService(`
        SELECT cpu_pct, mem_used_mb, active_sessions
        FROM system_health
        ORDER BY recorded_at DESC
        LIMIT 1
      `),
    ]);

    return res.json({
      users:   users[0],
      sessions: sessions[0],
      health:  health[0] ?? null,
    });
  } catch (e: any) {
    console.error('[Admin] Stats error:', e.message);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;