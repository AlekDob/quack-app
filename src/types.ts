export interface TerminalInfo {
  id: string;
  label: string;
  color: string;
  cwd: string;
  alive: boolean;
  status?: "idle" | "busy";
  needsAttention?: boolean;
}

export type SavedCommandCategory = "dev" | "build" | "test" | "custom";

export interface SavedCommand {
  id: string;
  name: string;
  command: string;
  cwd?: string;
  color: string;
  category: SavedCommandCategory;
}

export interface ProcessInfo {
  terminalId: string;
  terminalLabel: string;
  command?: string;
  pid?: number;
  port?: number;
  uptimeSeconds: number;
  status: "running" | "idle";
}

export interface DirectoryEntry {
  name: string;
  path: string;
  is_dir: boolean;
  is_symlink: boolean;
}

export interface DirectoryListing {
  path: string;
  entries: DirectoryEntry[];
}

export interface GitStatusEntry {
  path: string;
  original_path: string | null;
  staged_status: string | null;
  unstaged_status: string | null;
  is_untracked: boolean;
  additions: number | null;
  deletions: number | null;
}

export interface GitStatusSummary {
  branch: string;
  upstream: string | null;
  ahead: number | null;
  behind: number | null;
  entries: GitStatusEntry[];
  clean: boolean;
}

export interface GitCommitEntry {
  hash: string;
  summary: string;
  author: string;
  relativeTime: string;
  timestamp?: number;
}

export interface TerminalDataEvent {
  id: string;
  data: string;
}

export interface TerminalExitEvent {
  id: string;
  code: number;
  success: boolean;
  message: string | null;
}

// AI Assistant types
export interface AISuggestion {
  command: string;
  explanation: string;
  confidence: number;
  alternative?: string;
}

export interface AISettings {
  apiKey: string;
  model: 'gpt-4o-mini' | 'gpt-4o' | 'gpt-3.5-turbo';
  enableCommandAssistant: boolean;
  enableErrorAnalyzer: boolean;
}

export interface TokenStats {
  totalTokensUsed: number;
  estimatedCost: number;
  requestCount: number;
}

export interface TerminalContext {
  os: string;
  shell: string;
  cwd: string;
  recentCommands: string[];
  errorOutput?: string;
}

export interface AIRequest {
  intent: string;
  context: TerminalContext;
  requestType: 'command' | 'error';
}
