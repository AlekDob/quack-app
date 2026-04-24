/**
 * Project Stats Store
 *
 * Frontend facade over the Rust SQLite-backed token aggregation.
 * Data lives in the Rust process — this store only caches the most recently
 * loaded stats to keep UI re-reads cheap.
 *
 * Brain: decision-project-token-stats-sqlite
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

// =============================================================================
// Types (mirror src-tauri/src/project_stats.rs DTOs — keep in sync)
// =============================================================================

export interface TokenBreakdown {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  messageCount: number;
}

export interface NamedBreakdown extends TokenBreakdown {
  name: string;
}

export interface ProjectStats {
  projectPath: string;
  projectName: string;
  lifetime: TokenBreakdown;
  activeSessions: TokenBreakdown;
  deletedSessions: TokenBreakdown;
  byProvider: NamedBreakdown[];
  byModel: NamedBreakdown[];
  firstSeenAt: number;
  lastUpdatedAt: number;
}

export interface ProjectSummary {
  projectPath: string;
  projectName: string;
  lifetime: TokenBreakdown;
  lastUpdatedAt: number;
}

export interface RecordUsagePayload {
  sessionId: string;
  messageId: string;
  projectPath: string;
  projectName: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  // Agent attribution (nullable — pre-v2 rows store NULL)
  agentId?: string | null;
  agentName?: string | null;
  agentRole?: string | null;
}

export interface AgentModelStats extends TokenBreakdown {
  model: string;
}

export interface AgentStats {
  agentId: string | null;
  agentName: string | null;
  agentRole: string | null;
  agentDeleted: boolean;
  lifetime: TokenBreakdown;
  byModel: AgentModelStats[];
}

export interface ProjectAgentStats {
  projectPath: string;
  activeAgents: AgentStats[];
  deletedAgents: AgentStats[];
}

// =============================================================================
// Utilities
// =============================================================================

/** Total across all token kinds — useful for UI "grand total" display. */
export function totalOf(b: TokenBreakdown): number {
  return b.inputTokens + b.outputTokens + b.cacheCreationTokens + b.cacheReadTokens;
}

/** Empty breakdown used as a safe default when a project has no recorded events. */
export const EMPTY_BREAKDOWN: TokenBreakdown = {
  inputTokens: 0,
  outputTokens: 0,
  cacheCreationTokens: 0,
  cacheReadTokens: 0,
  messageCount: 0,
};

/**
 * Normalize a project path to the same form used as SQLite row key.
 * MUST mirror `normalize_project_path` in src-tauri/src/project_stats.rs.
 *
 * Without this, raw caller paths (with trailing slashes or backslashes) would
 * hit a different cache key than what Rust stores, causing the UI to never
 * reflect fresh data.
 *
 * Brain: gotcha-windows-path-separators
 */
export function normalizeProjectPath(p: string): string {
  if (!p) return p;
  let out = p.replace(/\\/g, '/');
  while (out.length > 1 && out.endsWith('/')) out = out.slice(0, -1);
  return out;
}

// =============================================================================
// Store shape
// =============================================================================

interface ProjectStatsState {
  /** Last-loaded per-project detail, keyed by normalized projectPath. */
  projectCache: Record<string, ProjectStats>;
  /** Per-agent breakdown cache, keyed by normalized projectPath. */
  agentCache: Record<string, ProjectAgentStats>;
  /** Last-loaded global summary list. */
  allSummaries: ProjectSummary[];
  /** Tracks in-flight refreshes so we can dedupe rapid UI reads. */
  loading: Record<string, boolean>;
  /** Fatal error surfaced to the UI. */
  lastError: string | null;

  // -- Mutations
  recordUsage: (payload: RecordUsagePayload) => Promise<void>;
  markSessionDeleted: (sessionId: string) => Promise<number>;
  markAgentDeleted: (agentId: string) => Promise<number>;
  bulkImport: (events: RecordUsagePayload[]) => Promise<number>;

  // -- Reads (refresh from DB)
  refreshProject: (projectPath: string) => Promise<ProjectStats | null>;
  refreshProjectAgents: (projectPath: string) => Promise<ProjectAgentStats | null>;
  refreshAll: () => Promise<ProjectSummary[]>;

  // -- Migration flag helpers
  getMigrationFlag: (key: string) => Promise<string | null>;
  setMigrationFlag: (key: string, value: string) => Promise<void>;
}

// =============================================================================
// Auto-refresh debouncer
// =============================================================================

/**
 * After any successful recordUsage we schedule a refresh of the per-agent
 * breakdown for the affected project. Bursts within a single turn coalesce
 * into one DB read (~800ms debounce).
 *
 * Must live at module scope so timers survive across store instances.
 * Brain: decision-project-token-stats-sqlite
 */
const autoRefreshTimers = new Map<string, ReturnType<typeof setTimeout>>();
const AUTO_REFRESH_DEBOUNCE_MS = 800;

function scheduleAutoRefresh(projectPath: string) {
  const key = normalizeProjectPath(projectPath);
  if (!key) return;
  const existing = autoRefreshTimers.get(key);
  if (existing) clearTimeout(existing);
  const t = setTimeout(() => {
    autoRefreshTimers.delete(key);
    void useProjectStatsStore.getState().refreshProjectAgents(key);
  }, AUTO_REFRESH_DEBOUNCE_MS);
  autoRefreshTimers.set(key, t);
}

// =============================================================================
// Store
// =============================================================================

export const useProjectStatsStore = create<ProjectStatsState>()((set, get) => ({
  projectCache: {},
  agentCache: {},
  allSummaries: [],
  loading: {},
  lastError: null,

  // ---------------------------------------------------------------------------
  // Mutations
  // ---------------------------------------------------------------------------

  async recordUsage(payload) {
    try {
      await invoke('record_token_usage', { payload });
      // Auto-refresh the accordion panel: coalesce bursts within a turn so we
      // only hit the DB once per ~800ms rather than per assistant event.
      scheduleAutoRefresh(payload.projectPath);
    } catch (e) {
      // Non-fatal: failing to record a single event shouldn't break the chat UX.
      // Surface to console for debugging; store a lastError for settings UI.
      const msg = String(e);
      // eslint-disable-next-line no-console
      console.warn('[projectStats] recordUsage failed:', msg);
      set({ lastError: msg });
    }
  },

  async markSessionDeleted(sessionId) {
    try {
      const affected = await invoke<number>('mark_session_deleted', { sessionId });
      // Invalidate caches — sessions could span many projects.
      set({ projectCache: {}, agentCache: {} });
      return affected;
    } catch (e) {
      const msg = String(e);
      // eslint-disable-next-line no-console
      console.error('[projectStats] markSessionDeleted failed:', msg);
      set({ lastError: msg });
      return 0;
    }
  },

  async markAgentDeleted(agentId) {
    try {
      const affected = await invoke<number>('mark_agent_deleted', { agentId });
      // Agent cancellation shifts events to "agenti licenziati" bucket; both
      // per-agent and lifetime caches need to reflect that.
      set({ projectCache: {}, agentCache: {} });
      return affected;
    } catch (e) {
      const msg = String(e);
      // eslint-disable-next-line no-console
      console.error('[projectStats] markAgentDeleted failed:', msg);
      set({ lastError: msg });
      return 0;
    }
  },

  async bulkImport(events) {
    try {
      const inserted = await invoke<number>('bulk_import_token_events', { events });
      // Bulk import changes everything — drop all caches.
      set({ projectCache: {}, allSummaries: [] });
      return inserted;
    } catch (e) {
      const msg = String(e);
      // eslint-disable-next-line no-console
      console.error('[projectStats] bulkImport failed:', msg);
      set({ lastError: msg });
      return 0;
    }
  },

  // ---------------------------------------------------------------------------
  // Reads
  // ---------------------------------------------------------------------------

  async refreshProject(projectPath) {
    // Normalize upfront so cache keys match what Rust stores (both ends use the
    // same canonical form: forward slashes, no trailing '/').
    const key = normalizeProjectPath(projectPath);
    if (get().loading[key]) {
      return get().projectCache[key] ?? null;
    }
    set((s) => ({ loading: { ...s.loading, [key]: true } }));

    try {
      const stats = await invoke<ProjectStats | null>('get_project_stats', { projectPath: key });
      set((s) => ({
        projectCache: stats
          ? { ...s.projectCache, [key]: stats }
          : s.projectCache,
        loading: { ...s.loading, [key]: false },
        lastError: null,
      }));
      return stats;
    } catch (e) {
      const msg = String(e);
      // eslint-disable-next-line no-console
      console.error('[projectStats] refreshProject failed:', msg);
      set((s) => ({
        loading: { ...s.loading, [key]: false },
        lastError: msg,
      }));
      return null;
    }
  },

  async refreshProjectAgents(projectPath) {
    // Normalize so the cache key matches the panel's lookup key.
    const key = normalizeProjectPath(projectPath);
    try {
      const stats = await invoke<ProjectAgentStats>('get_project_agent_stats', {
        projectPath: key,
      });
      set((s) => ({
        agentCache: { ...s.agentCache, [key]: stats },
        lastError: null,
      }));
      return stats;
    } catch (e) {
      const msg = String(e);
      // eslint-disable-next-line no-console
      console.error('[projectStats] refreshProjectAgents failed:', msg);
      set({ lastError: msg });
      return null;
    }
  },

  async refreshAll() {
    try {
      const summaries = await invoke<ProjectSummary[]>('get_all_project_stats');
      set({ allSummaries: summaries, lastError: null });
      return summaries;
    } catch (e) {
      const msg = String(e);
      // eslint-disable-next-line no-console
      console.error('[projectStats] refreshAll failed:', msg);
      set({ lastError: msg });
      return [];
    }
  },

  // ---------------------------------------------------------------------------
  // Migration flag
  // ---------------------------------------------------------------------------

  async getMigrationFlag(key) {
    try {
      return await invoke<string | null>('get_stats_migration_flag', { key });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[projectStats] getMigrationFlag failed:', e);
      return null;
    }
  },

  async setMigrationFlag(key, value) {
    try {
      await invoke('set_stats_migration_flag', { key, value });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[projectStats] setMigrationFlag failed:', e);
    }
  },
}));

// =============================================================================
// Convenience selectors (use from components to avoid re-rendering the world)
// =============================================================================

export const selectProjectStats = (projectPath: string) =>
  (s: ProjectStatsState): ProjectStats | undefined =>
    s.projectCache[projectPath];

export const selectAllSummaries = (s: ProjectStatsState) => s.allSummaries;
