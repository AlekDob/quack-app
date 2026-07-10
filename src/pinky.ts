import { invoke } from "@tauri-apps/api/core";

export interface PinkyAvailability {
  ok: boolean;
  version: string | null;
}

export interface PinkyWorkspaceStatus {
  pinky_ok: boolean;
  version: string | null;
  documentation_exists: boolean;
  mcp_installed: boolean;
  rule_installed: boolean;
  db_exists: boolean;
  entries: number;
  chunks: number;
  global_migrated: boolean;
}

export interface PinkySearchHit {
  id: string;
  path: string;
  title: string;
  snippet: string;
  entry_type?: string | null;
  score: number;
}

export interface PinkySearchResult {
  query: string;
  results: PinkySearchHit[];
}

export interface PinkySetupResult {
  ok: boolean;
  message: string;
}

export interface PinkyUsageStats {
  hits: number;
  noise_hits: number;
  served_entries: number;
  sessions: number;
  useful_entries: number;
  useful_hits: number;
}

export interface PinkyValueStats {
  entries: number;
  chunks: number;
  never_used: number;
  by_type: Record<string, number>;
  usage: PinkyUsageStats;
}

export interface PinkyTelemetryEntry {
  path: string;
  title: string;
  count: number;
}

export interface PinkyTelemetryStale {
  path: string;
  title: string;
}

export interface PinkyTelemetry {
  most_used: PinkyTelemetryEntry[];
  never_used: PinkyTelemetryStale[];
}

export const pinky = {
  available: () => invoke<PinkyAvailability>("pinky_available"),
  workspaceStatus: (root: string) =>
    invoke<PinkyWorkspaceStatus>("pinky_workspace_status", { root }),
  search: (root: string, query: string, limit?: number) =>
    invoke<PinkySearchResult>("pinky_search", { root, query, limit }),
  setup: (root: string) => invoke<PinkySetupResult>("pinky_setup", { root }),
  reindex: (root: string) => invoke<PinkySetupResult>("pinky_reindex", { root }),
  migrateGlobal: () => invoke<boolean>("pinky_migrate_global_brain"),
  statsValue: (root: string) =>
    invoke<PinkyValueStats>("pinky_stats_value", { root }),
  telemetry: (root: string) =>
    invoke<PinkyTelemetry>("pinky_telemetry", { root }),
};
