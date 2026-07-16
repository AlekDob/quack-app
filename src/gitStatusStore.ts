// Shared per-workspace git status cache. Before this module, every
// consumer of git status (SourceControlPanel) ran its own debounced
// `git status` on fsBus "ws" events — adding tree decorations and an
// activity-bar badge the same way would have tripled the subprocess
// spawns per save. Instead the panels register interest here
// (startGitStatusWatch) and ONE fetch per debounce window feeds all
// subscribers. Module cache + subscribe + notify, same shape as
// bookmarks.ts.
//
// Also owns `git diff HEAD --numstat` (composer Changes +N −M). That
// used to run once per mounted AIChatPanel on every status notify —
// sticky multitask hosts × huge dirty trees pegged WebKit + Quack.

import { fsBus } from "./fsBus";
import {
  git as gitApi,
  type GitDiffStat,
  type GitFile,
  type GitStatus,
} from "./ipc";
import { joinPath } from "./pathUtils";

/** Same normalization as fsBus's pathsEqual: forward slashes, no
 *  trailing slash, lowercase (Windows paths are case-insensitive and
 *  arrive with mixed separators depending on the source). Keys into
 *  byPath / changedDirs must go through this. */
export function normalizeGitPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

const EMPTY_DIFF: GitDiffStat = {
  insertions: 0,
  deletions: 0,
  files: [],
};

export interface GitStatusSnapshot {
  /** Last full status, null until the first fetch resolves. */
  status: GitStatus | null;
  /** Shared `git diff HEAD --numstat` — composer Changes pill. */
  diffStat: GitDiffStat | null;
  /** normalized absolute path → its status entry. */
  byPath: Map<string, GitFile>;
  /** Normalized absolute paths of every ancestor dir (up to and
   *  including the workspace root) that contains a changed file. */
  changedDirs: Set<string>;
  /** invoke-level failure (git missing, root gone). Non-repos are NOT
   *  errors — they come back as status.is_repo === false. */
  error: string | null;
}

const EMPTY: GitStatusSnapshot = {
  status: null,
  diffStat: null,
  byPath: new Map(),
  changedDirs: new Set(),
  error: null,
};

interface WatchEntry {
  root: string;
  /** How many mounted consumers asked for this workspace. The fsBus
   *  handler and cache live until the last one stops. */
  refs: number;
  timer: number | null;
  fetching: boolean;
  /** A change arrived mid-fetch — rerun once so we don't publish a
   *  status that's already stale. */
  queued: boolean;
  snapshot: GitStatusSnapshot;
}

const watches = new Map<string, WatchEntry>();
// Last snapshot per ws, kept across unwatch so a switch-back paints git
// decorations immediately (the live WatchEntry is dropped at refs 0).
const lastSnapshotByWs = new Map<string, GitStatusSnapshot>();
type Listener = (wsId: string) => void;
const listeners = new Set<Listener>();

function notify(wsId: string) {
  for (const l of listeners) l(wsId);
}

export function subscribeGitStatus(wsId: string, fn: () => void): () => void {
  const l: Listener = (id) => {
    if (id === wsId) fn();
  };
  listeners.add(l);
  return () => listeners.delete(l);
}

export function getGitStatus(wsId: string): GitStatusSnapshot {
  return watches.get(wsId)?.snapshot ?? EMPTY;
}

function buildSnapshot(
  root: string,
  status: GitStatus,
  diffStat: GitDiffStat | null,
): GitStatusSnapshot {
  const byPath = new Map<string, GitFile>();
  const changedDirs = new Set<string>();
  const rootNorm = normalizeGitPath(root);
  for (const f of status.files) {
    const abs = normalizeGitPath(joinPath(root, f.path));
    byPath.set(abs, f);
    // Walk up to the workspace root marking every ancestor dir. The
    // tree shows a muted dot on these so collapsed folders still hint
    // at changes inside.
    let dir = abs;
    for (;;) {
      const cut = dir.lastIndexOf("/");
      if (cut <= 0) break;
      dir = dir.slice(0, cut);
      if (dir.length < rootNorm.length) break;
      changedDirs.add(dir);
      if (dir === rootNorm) break;
    }
  }
  return { status, diffStat, byPath, changedDirs, error: null };
}

async function loadDiffStat(root: string, status: GitStatus): Promise<GitDiffStat | null> {
  if (!status.is_repo) return EMPTY_DIFF;
  // No dirty files → skip the heavy numstat (common idle case).
  if (status.files.length === 0) return EMPTY_DIFF;
  try {
    return await gitApi.diffStat(root);
  } catch {
    return null;
  }
}

async function fetchNow(wsId: string): Promise<void> {
  const entry = watches.get(wsId);
  if (!entry) return;
  if (entry.fetching) {
    entry.queued = true;
    return;
  }
  entry.fetching = true;
  try {
    const status = await gitApi.status(entry.root);
    const diffStat = await loadDiffStat(entry.root, status);
    entry.snapshot = buildSnapshot(entry.root, status, diffStat);
  } catch (e) {
    entry.snapshot = {
      status: null,
      diffStat: null,
      byPath: new Map(),
      changedDirs: new Set(),
      error: e instanceof Error ? e.message : String(e),
    };
  } finally {
    entry.fetching = false;
  }
  notify(wsId);
  if (entry.queued) {
    entry.queued = false;
    void fetchNow(wsId);
  }
}

/** Immediate fetch, bypassing the debounce — wired to the panel's
 *  Refresh button and awaited after explicit git mutations so the UI
 *  reflects the command it just ran, not the watcher's echo. */
export function forceGitStatusRefresh(wsId: string): Promise<void> {
  return fetchNow(wsId);
}

// One global fsBus listener; per-workspace debounce timers live on the
// watch entries. 400ms coalesces agent write bursts better than 250ms
// without feeling laggy on a single save.
let busStarted = false;
function ensureBusListener() {
  if (busStarted) return;
  busStarted = true;
  fsBus.addEventListener("ws", (ev) => {
    const detail = (ev as CustomEvent).detail as { wsId: string };
    const entry = watches.get(detail.wsId);
    if (!entry) return;
    if (entry.timer) window.clearTimeout(entry.timer);
    entry.timer = window.setTimeout(() => {
      entry.timer = null;
      void fetchNow(detail.wsId);
    }, 400);
  });
}

/** Register interest in a workspace's git status. Refcounted: the
 *  FileTree, SourceControlPanel, and ActivityBar each call this; the
 *  cache and timers are dropped when the last consumer unmounts. */
export function startGitStatusWatch(wsId: string, root: string): () => void {
  ensureBusListener();
  let entry = watches.get(wsId);
  if (!entry) {
    entry = {
      root,
      refs: 0,
      timer: null,
      fetching: false,
      queued: false,
      // Seed from the last snapshot for this ws so switching back renders
      // decorations instantly instead of flashing empty until the fresh
      // subprocess resolves. Still fetchNow to catch changes made away.
      snapshot: lastSnapshotByWs.get(wsId) ?? EMPTY,
    };
    watches.set(wsId, entry);
    void fetchNow(wsId);
  }
  entry.refs++;
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    const e = watches.get(wsId);
    if (!e) return;
    e.refs--;
    if (e.refs <= 0) {
      if (e.timer) window.clearTimeout(e.timer);
      // Preserve the snapshot for an instant switch-back; drop the live watch.
      lastSnapshotByWs.set(wsId, e.snapshot);
      watches.delete(wsId);
    }
  };
}

// ---- shared status presentation helpers -------------------------------
// statusLabel/statusColor began life in SourceControlPanel; they moved
// here so the file tree paints the same palette without importing a
// component module.

export function statusLabel(f: GitFile): string {
  if (f.index_status === "?" && f.worktree_status === "?") return "U";
  const i = f.index_status.trim();
  const w = f.worktree_status.trim();
  if (i && w) return `${i}${w}`;
  return i || w || " ";
}

export type GitStatusTone =
  | "conflict"
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "neutral";

export function statusTone(f: GitFile): GitStatusTone {
  if (f.conflicted) return "conflict";
  const tag = statusLabel(f);
  if (tag.includes("U")) return "added";
  if (tag.includes("A")) return "added";
  if (tag.includes("M")) return "modified";
  if (tag.includes("D")) return "deleted";
  if (tag.includes("R")) return "renamed";
  return "neutral";
}

/** Theme-aware class for git-colored labels (tree, source control). */
export function statusClass(f: GitFile): string {
  const tone = statusTone(f);
  return tone === "neutral" ? "" : `git-status--${tone}`;
}

export function statusColor(f: GitFile): string {
  const tone = statusTone(f);
  return tone === "neutral" ? "var(--fg-muted)" : `var(--git-${tone})`;
}

/** Single letter for the right edge of a tree row. Worktree side wins
 *  over index side — it's what the user touched last. */
export function treeBadge(f: GitFile): string {
  if (f.conflicted) return "!";
  if (f.index_status === "?") return "U";
  const w = f.worktree_status.trim();
  const i = f.index_status.trim();
  return (w || i || "M").slice(0, 1);
}
