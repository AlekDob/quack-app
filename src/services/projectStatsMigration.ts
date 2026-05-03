/**
 * Project Stats: one-shot migration from existing agentSessions.
 *
 * On first boot after this feature rolls out, we synthesize one token_event
 * row per session that already has recorded totals. This preserves lifetime
 * aggregates without needing per-message granularity for historical data.
 *
 * Idempotent: the `migration_v1_done` flag in project_stats_meta prevents
 * re-running. Even if re-run, the deterministic (sessionId, messageId) pair
 * combined with `INSERT OR IGNORE` would dedupe.
 *
 * Brain: decision-project-token-stats-sqlite
 */

import type { AgentSession } from '../types';
import { useProjectStatsStore, type RecordUsagePayload } from '../stores/projectStatsStore';

const MIGRATION_KEY = 'migration_v1_done';
const MIGRATION_VERSION = '1';

/** Build a synthetic token event from an existing AgentSession record. */
function sessionToEvent(s: AgentSession): RecordUsagePayload | null {
  const input = s.inputTokens ?? 0;
  const output = s.outputTokens ?? 0;
  const cacheCreate = s.cacheCreationTokens ?? 0;
  const cacheRead = s.cacheReadTokens ?? 0;
  if (input + output + cacheCreate + cacheRead <= 0) return null;

  // Use the Claude SDK id when available so deletion-flag operations work.
  // Fall back to the AgentSession id for older records (still unique).
  const sessionId = s.claudeSessionId || s.id;

  return {
    sessionId,
    // Deterministic synthetic messageId scoped to migration — avoids collision
    // with real per-message ids that use Anthropic's msg_* format.
    messageId: `migration-v1-${s.id}`,
    projectPath: s.projectPath,
    projectName: s.projectName,
    // We don't know the provider/model historically — bucket under 'legacy'
    // so users can distinguish pre-migration totals in the breakdown view.
    provider: 'legacy',
    model: 'legacy',
    inputTokens: input,
    outputTokens: output,
    cacheCreationTokens: cacheCreate,
    cacheReadTokens: cacheRead,
  };
}

/**
 * Run the migration if not already done.
 * Safe to call multiple times — the meta flag guards re-execution.
 */
export async function runProjectStatsMigrationIfNeeded(
  sessions: AgentSession[]
): Promise<{ ran: boolean; inserted: number }> {
  const store = useProjectStatsStore.getState();

  const flag = await store.getMigrationFlag(MIGRATION_KEY);
  if (flag === MIGRATION_VERSION) {
    return { ran: false, inserted: 0 };
  }

  const events = sessions
    .map(sessionToEvent)
    .filter((e): e is RecordUsagePayload => e !== null);

  if (events.length === 0) {
    // Still mark the flag — no need to keep trying on every boot
    await store.setMigrationFlag(MIGRATION_KEY, MIGRATION_VERSION);
    return { ran: true, inserted: 0 };
  }

  const inserted = await store.bulkImport(events);
  await store.setMigrationFlag(MIGRATION_KEY, MIGRATION_VERSION);

  // eslint-disable-next-line no-console
  console.log(
    `[projectStats] Historical migration complete: ${inserted} events from ${sessions.length} sessions`
  );

  return { ran: true, inserted };
}
