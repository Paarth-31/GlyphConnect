import { queryService } from './client';

export async function logAiRequest(data: {
  userId?: string;
  sessionId?: string;
  feature: string;
  modelUsed: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
  costUsd?: number;
  success: boolean;
  errorMessage?: string;
}) {
  await queryService(
    `INSERT INTO ai_requests
       (user_id, session_id, feature, model_used,
        input_tokens, output_tokens, latency_ms,
        cost_usd, success, error_message)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      data.userId ?? null,
      data.sessionId ?? null,
      data.feature,
      data.modelUsed,
      data.inputTokens ?? null,
      data.outputTokens ?? null,
      data.latencyMs ?? null,
      data.costUsd ?? null,
      data.success,
      data.errorMessage ?? null,
    ]
  );
}

export async function getAiCostSummary(adminId: string) {
  return queryService(
    `SELECT feature,
            COUNT(*)         AS requests,
            SUM(cost_usd)    AS total_cost_usd,
            AVG(latency_ms)  AS avg_latency_ms,
            COUNT(*) FILTER (WHERE NOT success) AS errors
     FROM ai_requests
     GROUP BY feature
     ORDER BY total_cost_usd DESC NULLS LAST`
  );
}