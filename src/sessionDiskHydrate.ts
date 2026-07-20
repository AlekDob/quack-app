import type { TurnTokens } from "./contextUsage";

/** Shape from `claude_session_drawer_stats` (CC JSONL on disk). */
export interface SessionDrawerStats {
  context_input_tokens: number;
  context_cache_read_tokens: number;
  context_cache_creation_tokens: number;
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_creation_tokens: number;
  estimated_cost_usd: number;
  turns: number;
  primary_model: string;
  first_ts_ms: number;
  last_ts_ms: number;
}

export function contextTokensFromDisk(
  stats: SessionDrawerStats,
): TurnTokens | null {
  const input = stats.context_input_tokens;
  const cacheRead = stats.context_cache_read_tokens;
  const cacheCreate = stats.context_cache_creation_tokens;
  if (input + cacheRead + cacheCreate <= 0) return null;
  return { input, output: 0, cacheRead, cacheCreate };
}

export function sessionDurationMs(stats: SessionDrawerStats): number {
  if (stats.first_ts_ms > 0 && stats.last_ts_ms > stats.first_ts_ms) {
    return stats.last_ts_ms - stats.first_ts_ms;
  }
  return 0;
}

export interface DiskBillingPatch {
  tokensIn: number;
  tokensOut: number;
  cacheRead: number;
  turns: number;
  cost: number;
  model: string | null;
  durationMs: number;
}

/** Merge JSONL totals into stream metrics — never regress live counters. */
export function mergeDiskBilling(
  live: {
    tokensIn: number;
    tokensOut: number;
    cacheRead: number;
    turns: number;
    cost: number;
  },
  disk: SessionDrawerStats,
): DiskBillingPatch {
  const duration = sessionDurationMs(disk);
  return {
    tokensIn: Math.max(live.tokensIn, disk.input_tokens),
    tokensOut: Math.max(live.tokensOut, disk.output_tokens),
    cacheRead: Math.max(live.cacheRead, disk.cache_read_tokens),
    turns: Math.max(live.turns, disk.turns),
    cost: Math.max(live.cost, disk.estimated_cost_usd),
    model: disk.primary_model || null,
    durationMs: duration,
  };
}
