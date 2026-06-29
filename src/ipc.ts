import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface DirEntry {
  name: string;
  path: string;
  is_dir: boolean;
}

export const fs = {
  listDir: (path: string) => invoke<DirEntry[]>("list_dir", { path }),
  readFile: (path: string) => invoke<string>("read_file", { path }),
  writeFile: (path: string, contents: string) =>
    invoke<void>("write_file", { path, contents }),
  rename: (from: string, to: string) =>
    invoke<void>("rename_path", { from, to }),
  delete: (path: string) => invoke<void>("delete_path", { path }),
  createDir: (path: string) => invoke<void>("create_dir", { path }),
  createFile: (path: string) => invoke<void>("create_file", { path }),
  exists: (path: string) => invoke<boolean>("path_exists", { path }),
  /** Persist a chat image attachment (base64 bytes) to the temp dir;
   *  returns the absolute path Claude Code reads back with its Read tool. */
  saveImageAttachment: (filename: string, dataB64: string) =>
    invoke<string>("save_image_attachment", { filename, dataB64 }),
  /** Read an image file back as a data: URL for the preview / zoom modal. */
  readImageDataUrl: (path: string) =>
    invoke<string>("read_image_data_url", { path }),
};

export interface ShellOption {
  id: string;
  label: string;
  path: string;
  args: string[];
}

export interface SessionInfo {
  id: string;
  cwd: string | null;
  shell_path: string;
  title: string;
}

export const pty = {
  spawn: (opts: {
    shell?: string;
    args?: string[];
    cwd?: string;
    cols: number;
    rows: number;
    title?: string;
  }) => invoke<string>("pty_spawn", opts),
  write: (id: string, data: string) =>
    invoke<void>("pty_write", { id, data }),
  resize: (id: string, cols: number, rows: number) =>
    invoke<void>("pty_resize", { id, cols, rows }),
  kill: (id: string) => invoke<void>("pty_kill", { id }),
  availableShells: () => invoke<ShellOption[]>("available_shells"),
  listSessions: () => invoke<SessionInfo[]>("pty_list_sessions"),
  sessionExists: (id: string) =>
    invoke<boolean>("pty_session_exists", { id }),
  getBuffer: (id: string) => invoke<string>("pty_get_buffer", { id }),
  onOutput: (cb: (id: string, data: string) => void): Promise<UnlistenFn> =>
    listen<{ id: string; data: string }>("pty:output", (e) =>
      cb(e.payload.id, e.payload.data),
    ),
  onExit: (cb: (id: string) => void): Promise<UnlistenFn> =>
    listen<{ id: string }>("pty:exit", (e) => cb(e.payload.id)),
};

export interface SearchHit {
  path: string;
  line: number;
  col: number;
  text: string;
}
export interface TodoHit {
  path: string;
  line: number;
  kind: string;
  text: string;
}
export interface SymbolHit {
  path: string;
  line: number;
  /** "function" / "class" / "interface" / "type" / "enum" / "struct"
   *  / "trait" / "impl" / "fn" / "def" / "func" / "const" / "var". */
  kind: string;
  name: string;
}
export interface PackageScript {
  name: string;
  command: string;
}

export const search = {
  listFiles: (root: string, max?: number) =>
    invoke<string[]>("list_workspace_files", { root, max }),
  searchText: (
    root: string,
    query: string,
    caseSensitive = false,
    maxResults = 500,
    includeGlobs?: string[],
    excludeGlobs?: string[],
  ) =>
    invoke<SearchHit[]>("search_text", {
      root,
      query,
      caseSensitive,
      maxResults,
      includeGlobs: includeGlobs ?? null,
      excludeGlobs: excludeGlobs ?? null,
    }),
  searchRegex: (
    root: string,
    pattern: string,
    caseSensitive = false,
    maxResults = 500,
    includeGlobs?: string[],
    excludeGlobs?: string[],
  ) =>
    invoke<SearchHit[]>("search_regex", {
      root,
      pattern,
      caseSensitive,
      maxResults,
      includeGlobs: includeGlobs ?? null,
      excludeGlobs: excludeGlobs ?? null,
    }),
  scanTodos: (root: string, maxResults = 1000) =>
    invoke<TodoHit[]>("scan_todos", { root, maxResults }),
  findSymbols: (root: string, maxResults = 3000) =>
    invoke<SymbolHit[]>("find_symbols", { root, maxResults }),
  readPackageScripts: (root: string) =>
    invoke<PackageScript[]>("read_package_scripts", { root }),
  readCargoTasks: (root: string) =>
    invoke<PackageScript[]>("read_cargo_tasks", { root }),
  readMakefileTargets: (root: string) =>
    invoke<PackageScript[]>("read_makefile_targets", { root }),
};

export interface ClaudeSession {
  id: string;
  title: string;
  preview: string;
  cost_usd: number;
  turn_count: number;
  last_turn_at_ms: number;
}

export interface LoadedToolCall {
  id?: string;
  function: {
    name: string;
    arguments: Record<string, unknown>;
  };
}

export interface LoadedToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

export interface LoadedMessage {
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  tool_calls?: LoadedToolCall[];
  tool_results?: LoadedToolResult[];
}

export interface LoadedSubagent {
  agent_type: string;
  description: string;
  messages: LoadedMessage[];
}

export const claudeCode = {
  /** List on-disk Claude Code sessions for the given workspace cwd. */
  listSessions: (cwd: string) =>
    invoke<ClaudeSession[]>("claude_code_list_sessions", { cwd }),
  /** Reconstruct the full conversation from a session's JSONL file. */
  loadSession: (cwd: string, sessionId: string) =>
    invoke<LoadedMessage[]>("claude_code_load_session", {
      cwd,
      sessionId,
    }),
  /** Load one subagent's full transcript, linked by the parent Task
   *  tool-call id (toolUseId in the subagent's sidecar meta.json). */
  loadSubagent: (cwd: string, sessionId: string, toolUseId: string) =>
    invoke<LoadedSubagent>("claude_code_load_subagent", {
      cwd,
      sessionId,
      toolUseId,
    }),
  /** Chat-tab sessionIds whose subprocess is still running. Powers the
   *  Agent Hub's cross-project "working" indicator without mounting panels. */
  activeSessions: () => invoke<string[]>("claude_code_active_sessions"),
};

export interface McpServer {
  name: string;
  scope: "user" | "project";
  /** "stdio" (local command) or "http" / "sse" (remote URL). */
  transport: "stdio" | "http" | "sse";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  /** Endpoint for remote (http/sse) servers. */
  url?: string | null;
  /** Optional HTTP headers for remote servers. */
  headers?: Record<string, string>;
}

export const claudeMcp = {
  /** List installed MCP servers from user (~/.claude.json) +
   *  project (.mcp.json) scopes, sorted by name. */
  list: (cwd: string) =>
    invoke<McpServer[]>("claude_mcp_list", { cwd }),
  /** Add or replace an MCP server in the given scope. */
  add: (
    cwd: string,
    name: string,
    scope: "user" | "project",
    command: string,
    args: string[],
    env: Record<string, string>,
  ) =>
    invoke<string>("claude_mcp_add", {
      cwd,
      name,
      scope,
      command,
      args,
      env,
    }),
  /** Add or replace a remote (HTTP / SSE) MCP server in the given scope. */
  addRemote: (
    cwd: string,
    name: string,
    scope: "user" | "project",
    transport: "http" | "sse",
    url: string,
    headers: Record<string, string>,
  ) =>
    invoke<string>("claude_mcp_add_remote", {
      cwd,
      name,
      scope,
      transport,
      url,
      headers,
    }),
  /** Remove an MCP server from the given scope (no-op if absent). */
  remove: (cwd: string, name: string, scope: "user" | "project") =>
    invoke<void>("claude_mcp_remove", { cwd, name, scope }),
};

export interface PluginCmdOutput {
  code: number;
  stdout: string;
  stderr: string;
}

export const claudePlugin = {
  /** Run a `claude plugin …` subcommand and capture its output. The CLI
   *  clones/validates marketplaces and writes the correct settings scope,
   *  so this is preferred over hand-editing the plugin config JSON. */
  run: (args: string[], cwd?: string) =>
    invoke<PluginCmdOutput>("claude_plugin_cmd", { cwd: cwd ?? null, args }),
};

export interface GitFile {
  path: string;
  /** First char of porcelain "XY" — staged side. " " = unchanged. */
  index_status: string;
  /** Second char of porcelain "XY" — worktree side. " " = unchanged. */
  worktree_status: string;
  staged: boolean;
  modified: boolean;
  /** Merge-conflict entry (UU, AA, AU, …). Never also `staged`. */
  conflicted: boolean;
}

export interface GitStatus {
  is_repo: boolean;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  files: GitFile[];
}

export interface GitCommit {
  hash: string;
  full_hash: string;
  subject: string;
  author_name: string;
  author_email: string;
  timestamp: number;
  parents: string;
}

export interface GitStash {
  ref_spec: string;
  branch: string;
  message: string;
  timestamp: number;
}

export const git = {
  status: (path: string) => invoke<GitStatus>("git_status", { path }),
  diff: (path: string, file?: string) =>
    invoke<string>("git_diff", { path, file: file ?? null }),
  diffStaged: (path: string, file?: string) =>
    invoke<string>("git_diff_staged", { path, file: file ?? null }),
  show: (path: string, refspec: string, file: string) =>
    invoke<string>("git_show", { path, refspec, file }),
  discard: (path: string, files: string[]) =>
    invoke<string>("git_discard", { path, files }),
  /** Delete untracked files (git clean -f). git_discard's
   *  `checkout HEAD --` fails on files git has never tracked. */
  clean: (path: string, files: string[]) =>
    invoke<string>("git_clean", { path, files }),
  /** Take one side of a merge conflict wholesale and stage it. */
  resolveConflict: (path: string, file: string, side: "ours" | "theirs") =>
    invoke<string>("git_resolve_conflict", { path, file, side }),
  /** Push; setUpstream publishes the current branch (-u origin). */
  push: (path: string, setUpstream = false) =>
    invoke<string>("git_push", { path, setUpstream }),
  branches: (path: string) => invoke<string[]>("git_branches", { path }),
  checkoutBranch: (path: string, branch: string) =>
    invoke<string>("git_checkout_branch", { path, branch }),
  createBranch: (
    path: string,
    name: string,
    base?: string,
    checkout = true,
  ) =>
    invoke<string>("git_create_branch", {
      path,
      name,
      base: base ?? null,
      checkout,
    }),
  deleteBranch: (path: string, name: string, force = false) =>
    invoke<string>("git_delete_branch", { path, name, force }),
  log: (path: string, limit = 50) =>
    invoke<GitCommit[]>("git_log", { path, limit }),
  /** Commits touching one file (git log --follow -- <file>). `file` is
   *  repo-relative with forward slashes. */
  fileLog: (path: string, file: string, limit = 50) =>
    invoke<GitCommit[]>("git_file_log", { path, file, limit }),
  showCommit: (path: string, refspec: string) =>
    invoke<string>("git_show_commit", { path, refspec }),
  stashList: (path: string) =>
    invoke<GitStash[]>("git_stash_list", { path }),
  stashPush: (path: string, message?: string, includeUntracked = false) =>
    invoke<string>("git_stash_push", {
      path,
      message: message ?? null,
      includeUntracked,
    }),
  stashPop: (path: string, refSpec: string) =>
    invoke<string>("git_stash_pop", { path, refSpec }),
  stashApply: (path: string, refSpec: string) =>
    invoke<string>("git_stash_apply", { path, refSpec }),
  stashDrop: (path: string, refSpec: string) =>
    invoke<string>("git_stash_drop", { path, refSpec }),
};

export interface WorkspaceMeta {
  id: string;
  name: string;
  root: string;
  last_opened: number;
}

export interface WorkspacesIndex {
  recent: WorkspaceMeta[];
  active_id: string | null;
  open_ids?: string[];
}

export const workspaces = {
  load: () => invoke<WorkspacesIndex>("workspaces_load"),
  save: (index: WorkspacesIndex) => invoke<void>("workspaces_save", { index }),
  loadState: (id: string) =>
    invoke<unknown>("workspace_state_load", { id }),
  saveState: (id: string, state: unknown) =>
    invoke<void>("workspace_state_save", { id, state }),
};
