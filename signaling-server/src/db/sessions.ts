import { pool, queryService } from './client';

export interface SessionRow {
  id: string;
  host_id: string;
  controller_id: string | null;
  host_display_id: string;
  status: string;
  start_time: Date;
  end_time: Date | null;
  duration_seconds: number | null;
  screen_audio: boolean;
  video_call: boolean;
  control_enabled: boolean;
  summary: string | null;
}

export async function createSession(data: {
  hostId: string;
  hostDisplayId: string;
  screenAudio?: boolean;
  videoCall?: boolean;
  controlEnabled?: boolean;
  qualityPreset?: string;
}): Promise<SessionRow> {
  const rows = await queryService<SessionRow>(
    `INSERT INTO sessions
       (host_id, host_display_id, screen_audio, video_call, control_enabled, quality_preset)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      data.hostId,
      data.hostDisplayId,
      data.screenAudio ?? false,
      data.videoCall ?? false,
      data.controlEnabled ?? false,
      data.qualityPreset ?? '720p',
    ]
  );
  return rows[0];
}

export async function joinSession(
  sessionId: string,
  controllerId: string
): Promise<SessionRow | null> {
  const rows = await queryService<SessionRow>(
    `UPDATE sessions
     SET controller_id = $2, status = 'active'
     WHERE id = $1 AND status = 'active' AND controller_id IS NULL
     RETURNING *`,
    [sessionId, controllerId]
  );
  return rows[0] ?? null;
}

export async function endSession(
  sessionId: string,
  summary?: string
): Promise<SessionRow | null> {
  const rows = await queryService<SessionRow>(
    `UPDATE sessions
     SET status           = 'ended',
         end_time         = NOW(),
         duration_seconds = EXTRACT(EPOCH FROM (NOW() - start_time))::INTEGER,
         summary          = COALESCE($2, summary)
     WHERE id = $1
     RETURNING *`,
    [sessionId, summary ?? null]
  );
  return rows[0] ?? null;
}

export async function saveSessionStats(
  sessionId: string,
  stats: {
    bytesSent: number;
    bytesReceived: number;
    avgBitrateKbps?: number;
    avgFps?: number;
    packetLossPct?: number;
    rttMsAvg?: number;
  }
) {
  await queryService(
    `INSERT INTO session_stats
       (session_id, bytes_sent, bytes_received,
        avg_bitrate_kbps, avg_fps, packet_loss_pct, rtt_ms_avg)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     ON CONFLICT (session_id) DO UPDATE SET
       bytes_sent       = EXCLUDED.bytes_sent,
       bytes_received   = EXCLUDED.bytes_received,
       avg_bitrate_kbps = EXCLUDED.avg_bitrate_kbps,
       avg_fps          = EXCLUDED.avg_fps,
       packet_loss_pct  = EXCLUDED.packet_loss_pct,
       rtt_ms_avg       = EXCLUDED.rtt_ms_avg,
       recorded_at      = NOW()`,
    [
      sessionId,
      stats.bytesSent,
      stats.bytesReceived,
      stats.avgBitrateKbps ?? null,
      stats.avgFps ?? null,
      stats.packetLossPct ?? null,
      stats.rttMsAvg ?? null,
    ]
  );
}

export async function getSessionsByUser(userId: string, limit = 20) {
  return queryService(
    `SELECT s.*,
            u.display_name AS controller_name,
            st.ai_summary,
            st.key_topics,
            ss.avg_bitrate_kbps,
            ss.avg_fps
     FROM   sessions s
     LEFT JOIN users u       ON u.id  = s.controller_id
     LEFT JOIN session_transcripts st ON st.session_id = s.id
     LEFT JOIN session_stats ss      ON ss.session_id  = s.id
     WHERE  s.host_id = $1
     ORDER  BY s.start_time DESC
     LIMIT  $2`,
    [userId, limit]
  );
}

export async function getSessionById(sessionId: string) {
  const rows = await queryService(
    `SELECT s.*,
            u_host.display_name AS host_name,
            u_ctrl.display_name AS controller_name,
            st.full_text        AS transcript,
            st.ai_summary,
            st.key_topics,
            st.action_items
     FROM   sessions s
     JOIN   users u_host ON u_host.id = s.host_id
     LEFT JOIN users u_ctrl ON u_ctrl.id = s.controller_id
     LEFT JOIN session_transcripts st ON st.session_id = s.id
     WHERE  s.id = $1`,
    [sessionId]
  );
  return rows[0] ?? null;
}