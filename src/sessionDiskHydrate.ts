import type { TurnTokens } from "./contextUsage";
import { providerSessions } from "./ipc";

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

/** Link a Quack chat row to a CC JSONL when the session id was never saved. */
export async function guessClaudeSessionId(
  root: string,
  assistantTurns: number,
): Promise<string | undefined> {
  if (assistantTurns <= 0) return undefined;
  try {
    const list = await providerSessions.listSessions(root, "claude-code");
    const exact = list.find((s) => s.turn_count === assistantTurns);
    if (exact) return exact.id;
    const close = list.filter(
      (s) => Math.abs(s.turn_count - assistantTurns) <= 1,
    );
    if (close.length === 1) return close[0].id;
    return undefined;
  } catch {
    return undefined;
  }
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
