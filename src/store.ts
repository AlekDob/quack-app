import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import {
  getActiveSftp,
  lookupRemoteLink,
} from "./sftpLinks";
import { consumeAutoPushSuppression, pushLinkedFile } from "./sftpPush";
import { resolveDefaultShell } from "./terminalPrefs";
import { clearEditorState, disposeModelForPath } from "./editorState";
import { clearChatDiff } from "./chatDiffStore";
import {
  error as toastError,
  errMsg,
  success as toastSuccess,
  warning as toastWarning,
} from "./notify";
import {
  workspaces as wsApi,
  type WorkspaceMeta,
  fs as fsApi,
  pty as ptyApi,
} from "./ipc";
import { choice as dialogChoice } from "./dialog";
import { getEditorSettings } from "./editorSettings";
import { getFootprintSettings } from "./footprintSettings";
import { basename, dirname } from "./pathUtils";
import { mediaKindOf } from "./mediaPreview";
import { fsBus, pathsEqual } from "./fsBus";
import { pushClosedTab, popClosedTab, forgetClosedTab } from "./closedTabsStack";
import { getRecentFiles } from "./recentFiles";

// -------- Idle tracking (footprint features) --------
//
// Two non-persisted maps track the last time the user touched each
// file or terminal. They live at module scope so the sweeper can read
// them without going through Zustand state — an idle file's "last
// touched" timestamp is metadata, not part of the user-visible
// workspace and not worth persisting (a fresh app start resets the
// clock, which is fine: it just delays the next unload by a few
// minutes).
const fileLastTouched = new Map<string, Map<string, number>>();
const terminalLastTouched = new Map<string, Map<string, number>>();

function touchInMap(
  m: Map<string, Map<string, number>>,
  outer: string,
  inner: string,
): void {
  let bucket = m.get(outer);
  if (!bucket) {
    bucket = new Map();
    m.set(outer, bucket);
  }
  bucket.set(inner, Date.now());
}

/** Walk a pane tree and collect the active tab key in every leaf. */
function collectActiveTabs(p: Pane | null, out: Set<string>): void {
  if (!p) return;
  if (p.kind === "tabs") {
    if (p.active) out.add(p.active);
    return;
  }
  collectActiveTabs(p.first, out);
  collectActiveTabs(p.second, out);
}

/**
 * Close the pop-out window hosting a terminal, if any. Best-effort —
 * silently swallows the case where no such window exists. Imported lazily
 * so we don't pull the webviewWindow API into popout windows themselves
 * (where the store should never run).
 */
async function closePopoutWindow(termId: string): Promise<void> {
  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const w = await WebviewWindow.getByLabel(`popout-${termId}`);
    if (w) await w.close();
  } catch {
    /* ignore */
  }
}

export type TerminalLocation = "editor" | "bottom";

export interface TerminalShell {
  path: string;
  args: string[];
  label: string;
}

export interface TerminalDescriptor {
  id: string;
  title: string;
  shell?: TerminalShell;
  /**
   * Backend PTY session id. Set after pty.spawn returns, persisted to disk.
   * On reload we filter the descriptors against `pty.listSessions()` and
   * re-attach to any whose ptyId is still alive — the user keeps their
   * running shell across hot-reload / Ctrl+R.
   */
  ptyId?: string;
  /**
   * True when this terminal is currently rendered in a separate pop-out
   * window. Tab stays in main so the user can re-dock; the in-tab area
   * shows a "Popped out" placeholder. Not persisted — on reload all
   * popout windows are gone, so popped resets to false naturally.
   */
  popped?: boolean;
}

export interface FileData {
  contents: string;
  original: string;
}

/**
 * Descriptor for one AI chat that lives as a moveable tab inside a pane.
 * Multiple chats can run in parallel — each has its own descriptor (and
 * its own AIChatPanel instance kept alive via portal).
 *
 * `sessionId` is the chat-history id used by the panel to load/save the
 * conversation transcript from disk. `title` is shown in the tab.
 */
export interface AIChatDescriptor {
  id: string;
  title: string;
  sessionId: string;
  /** Wall-clock creation timestamp. Doubles as the sort key in the AI
   *  chats rail — drag-reorder rewrites this so the rail order is purely
   *  a sort by `createdAt`, no separate order list to keep in sync. */
  createdAt: number;
  /** Last selected qualified model id (e.g. "claude-code:default",
   *  "openai:gpt-4o", "ollama:llama3.1"). Used by the rail to render a
   *  per-chat provider badge. The chat panel writes this when the user
   *  picks a model. Optional for back-compat with older sessions. */
  model?: string;
  /** Manual lifecycle set from the Agent Hub's right-click menu.
   *  `doneAt` → shown in the collapsed "Done" group; `archivedAt`
   *  → hidden from the hub. Both optional/back-compat. */
  doneAt?: number;
  archivedAt?: number;
  /** True once the user renamed the chat by hand — stops the auto-title
   *  effect (derives a title from the first message) from clobbering it. */
  titleLocked?: boolean;
}

export type SidebarView =
  | "files"
  | "search"
  | "git"
  | "tasks"
  | "todos"
  | "outline"
  | "bookmarks"
  | "ai"
  | "remote"
  | "usage";

export interface SidebarSection {
  view: SidebarView;
  collapsed: boolean;
  /** Relative size (flex-grow) when uncollapsed. Default 1. */
  size: number;
}

export type DropEdge = "center" | "top" | "bottom" | "left" | "right";

export type PaneId = string;

export interface TabsPane {
  kind: "tabs";
  id: PaneId;
  tabs: string[];
  active: string | null;
}

export interface SplitPane {
  kind: "split";
  id: PaneId;
  orientation: "horizontal" | "vertical";
  ratio: number;
  first: Pane;
  second: Pane;
}

export type Pane = TabsPane | SplitPane;

export interface WorkspaceLayout {
  editorRoot: Pane;
  bottomRoot: Pane | null;
  activePaneId: PaneId | null;
  bottomVisible: boolean;
  sidebarVisible: boolean;
  expandedDirs: string[];
  sidebarW: number;
  termH: number;
  sidebarView: SidebarView;
  /** Tab keys pinned across the workspace; render first and skip bulk-close. */
  pinned: string[];
  /** Stacked sidebar sections in render order. */
  sidebarSections: SidebarSection[];
  /** Whether the sidebar+activity bar sit on the left or right of the editor. */
  sidebarSide: "left" | "right";
  /** AI panel is a dedicated right-side column, independent of sidebarSide. */
  aiPanelVisible: boolean;
  aiPanelW: number;
  /** When true, the AI chats rail expands to ~220px and shows each
   *  chat's full title + model + close button. When false (default), the
   *  rail is a 36px-wide icon strip. Toggled from the rail header. */
  aiRailExpanded: boolean;
}

export interface WorkspaceData {
  meta: WorkspaceMeta;
  layout: WorkspaceLayout;
  files: Record<string, FileData>;
  terminals: Record<string, TerminalDescriptor>;
  aiChats: Record<string, AIChatDescriptor>;
}

export const fileKey = (p: string) => "file:" + p;
export const termKey = (id: string) => "term:" + id;
export const aiKey = (id: string) => "ai:" + id;
// Read-only subagent transcript tab. Self-contained key (no backing store
// record): carries everything the view needs to reload from disk —
// the CC session id, the parent Task tool-call id, and the agent type.
export const subKey = (sessionId: string, toolUseId: string, agentType: string) =>
  `sub:${sessionId}|${toolUseId}|${agentType}`;
// Whiteboard tab. One persistent tab per workspace (mirrors the
// per-workspace ai: chats) — survives restart because the data it shows
// is reloaded from the filesystem on mount.
export const wbKey = (wsId: string) => `wb:${wsId}`;
// Tab key for an inline Claude Code session transcript. The `project`
// segment encodes the on-disk encoded-cwd; the sessionId is the CLI
// session uuid. Two tabs with the same key are the same session —
// re-clicking the Usage row focuses the existing tab instead of duping.
export const sessionKey = (project: string, sessionId: string) =>
  `sess:${project}|${sessionId}`;
// Usage tab. Machine-global content (every Claude Code session on this
// box) but keyed per-workspace like the whiteboard, so each workspace
// owns at most one Usage tab. Self-contained — its data is polled from
// the Rust backend on mount, so it survives restart with no descriptor.
export const usageKey = (wsId: string) => `usage:${wsId}`;
export function parseKey(
  k: string,
):
  | { kind: "file"; path: string }
  | { kind: "terminal"; id: string }
  | { kind: "ai"; id: string }
  | { kind: "whiteboard"; wsId: string }
  | { kind: "usage"; wsId: string }
  | { kind: "subagent"; sessionId: string; toolUseId: string; agentType: string }
  | { kind: "session"; project: string; sessionId: string }
  | null {
  if (k.startsWith("file:")) return { kind: "file", path: k.slice(5) };
  if (k.startsWith("term:")) return { kind: "terminal", id: k.slice(5) };
  if (k.startsWith("ai:")) return { kind: "ai", id: k.slice(3) };
  if (k.startsWith("wb:")) return { kind: "whiteboard", wsId: k.slice(3) };
  if (k.startsWith("usage:")) return { kind: "usage", wsId: k.slice(6) };
  if (k.startsWith("sub:")) {
    const [sessionId, toolUseId, ...rest] = k.slice(4).split("|");
    return {
      kind: "subagent",
      sessionId: sessionId ?? "",
      toolUseId: toolUseId ?? "",
      agentType: rest.join("|"),
    };
  }
  if (k.startsWith("sess:")) {
    const pipe = k.indexOf("|");
    if (pipe < 0) return null;
    return {
      kind: "session",
      project: k.slice(5, pipe),
      sessionId: k.slice(pipe + 1),
    };
  }
  return null;
}

/** The AI chat id currently focused in a workspace (active pane's active
 *  tab, if it's an `ai:` tab), else null. Shared by the Agent Hub +
 *  watcher to know which chat the user is actually looking at. */
export function activeAiChatId(ws: WorkspaceData): string | null {
  const layout = ws.layout;
  if (!layout.activePaneId) return null;
  const visit = (p: Pane): string | null => {
    if (p.kind === "tabs") {
      if (p.id === layout.activePaneId && p.active?.startsWith("ai:")) {
        return p.active.slice(3);
      }
      return null;
    }
    return visit(p.first) ?? visit(p.second);
  };
  return (
    visit(layout.editorRoot) ??
    (layout.bottomRoot ? visit(layout.bottomRoot) : null)
  );
}

// -------- Pane tree helpers --------

function makePaneId(): string {
  return "p_" + Math.random().toString(36).slice(2, 10);
}

function emptyTabsPane(): TabsPane {
  return { kind: "tabs", id: makePaneId(), tabs: [], active: null };
}

export function findTabsPaneByTab(p: Pane, key: string): TabsPane | null {
  if (p.kind === "tabs") {
    return p.tabs.includes(key) ? p : null;
  }
  return findTabsPaneByTab(p.first, key) ?? findTabsPaneByTab(p.second, key);
}

export function findPaneById(p: Pane, id: PaneId): Pane | null {
  if (p.id === id) return p;
  if (p.kind === "split") {
    return findPaneById(p.first, id) ?? findPaneById(p.second, id);
  }
  return null;
}

export function isInTree(p: Pane, paneId: PaneId): boolean {
  return findPaneById(p, paneId) !== null;
}

export function firstLeaf(p: Pane): TabsPane {
  let cur: Pane = p;
  while (cur.kind === "split") cur = cur.first;
  return cur;
}

function mapTree(p: Pane, fn: (t: TabsPane) => TabsPane): Pane {
  if (p.kind === "tabs") return fn(p);
  return {
    ...p,
    first: mapTree(p.first, fn),
    second: mapTree(p.second, fn),
  };
}

// Split a pane's tabs into pinned and unpinned suffixes, keeping the
// pinned set in their `layout.pinned` order at the head, and sorting
// only the unpinned tail with the supplied comparator. Used by the
// "Sort Tabs" palette commands so explicit pins always win over the
// alphabetical / MRU ordering.
function reorderTabsForSort(
  tabs: string[],
  pinned: string[],
  cmp: (a: string, b: string) => number,
): string[] {
  const pinSet = new Set(pinned);
  const inPaneAndPinned = pinned.filter((k) => tabs.includes(k));
  const unpinnedSorted = tabs.filter((k) => !pinSet.has(k)).slice().sort(cmp);
  return [...inPaneAndPinned, ...unpinnedSorted];
}

function sameOrder(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function replacePaneById(root: Pane, id: PaneId, replacement: Pane): Pane {
  if (root.id === id) return replacement;
  if (root.kind === "tabs") return root;
  return {
    ...root,
    first: replacePaneById(root.first, id, replacement),
    second: replacePaneById(root.second, id, replacement),
  };
}

function removeTabFromTree(
  root: Pane,
  key: string,
): { tree: Pane | null; removedFromPaneId: PaneId | null } {
  if (root.kind === "tabs") {
    if (!root.tabs.includes(key))
      return { tree: root, removedFromPaneId: null };
    const tabs = root.tabs.filter((t) => t !== key);
    if (tabs.length === 0) {
      return { tree: null, removedFromPaneId: root.id };
    }
    let active = root.active;
    if (active === key) {
      const idx = root.tabs.indexOf(key);
      active = tabs[Math.max(0, idx - 1)] ?? tabs[0] ?? null;
    }
    return {
      tree: { ...root, tabs, active },
      removedFromPaneId: root.id,
    };
  }
  const leftRes = removeTabFromTree(root.first, key);
  if (leftRes.removedFromPaneId) {
    if (!leftRes.tree) {
      // First child collapsed; replace this split with second child.
      return { tree: root.second, removedFromPaneId: leftRes.removedFromPaneId };
    }
    return {
      tree: { ...root, first: leftRes.tree },
      removedFromPaneId: leftRes.removedFromPaneId,
    };
  }
  const rightRes = removeTabFromTree(root.second, key);
  if (rightRes.removedFromPaneId) {
    if (!rightRes.tree) {
      return { tree: root.first, removedFromPaneId: rightRes.removedFromPaneId };
    }
    return {
      tree: { ...root, second: rightRes.tree },
      removedFromPaneId: rightRes.removedFromPaneId,
    };
  }
  return { tree: root, removedFromPaneId: null };
}

function pruneEmptyTabsPanes(p: Pane | null): Pane | null {
  if (!p) return null;
  if (p.kind === "tabs") return p.tabs.length === 0 ? null : p;
  const first = pruneEmptyTabsPanes(p.first);
  const second = pruneEmptyTabsPanes(p.second);
  if (!first && !second) return null;
  if (!first) return second!;
  if (!second) return first;
  return { ...p, first, second };
}

export function dropTabAt(
  root: Pane,
  targetPaneId: PaneId,
  edge: DropEdge,
  key: string,
): { tree: Pane; activePaneId: PaneId } {
  const { tree: cleaned } = removeTabFromTree(root, key);
  const cleanedRoot: Pane = cleaned ?? emptyTabsPane();

  let target = findPaneById(cleanedRoot, targetPaneId);
  // After cleanup the target may have collapsed; fall back to first leaf.
  if (!target) {
    const leaf = firstLeaf(cleanedRoot);
    const updated = mapTree(cleanedRoot, (t) =>
      t.id === leaf.id
        ? {
            ...t,
            tabs: t.tabs.includes(key) ? t.tabs : [...t.tabs, key],
            active: key,
          }
        : t,
    );
    return { tree: updated, activePaneId: leaf.id };
  }

  if (edge === "center" || target.kind !== "tabs") {
    // Add to target's tabs (if it's a leaf). If target is a split, add to its first leaf.
    if (target.kind === "split") {
      const leaf = firstLeaf(target);
      target = leaf;
    }
    const targetId = target.id;
    const updated = mapTree(cleanedRoot, (t) =>
      t.id === targetId
        ? {
            ...t,
            tabs: t.tabs.includes(key) ? t.tabs : [...t.tabs, key],
            active: key,
          }
        : t,
    );
    return { tree: updated, activePaneId: targetId };
  }

  const newPane: TabsPane = {
    kind: "tabs",
    id: makePaneId(),
    tabs: [key],
    active: key,
  };
  const orientation: SplitPane["orientation"] =
    edge === "left" || edge === "right" ? "horizontal" : "vertical";
  const split: SplitPane = {
    kind: "split",
    id: makePaneId(),
    orientation,
    ratio: 0.5,
    first: edge === "left" || edge === "top" ? newPane : target,
    second: edge === "left" || edge === "top" ? target : newPane,
  };
  const tree = replacePaneById(cleanedRoot, target.id, split);
  return { tree, activePaneId: newPane.id };
}

export function setActiveInPane(
  root: Pane,
  paneId: PaneId,
  key: string | null,
): Pane {
  return mapTree(root, (t) => (t.id === paneId ? { ...t, active: key } : t));
}

// Insert a tab at a specific position inside a leaf pane. The visualIndex
// is computed from the *current* tab list (including the dragged tab if it
// already lives in this pane), so we adjust by -1 if the dragged tab is
// being moved past its own current position.
export function dropTabAtIndex(
  root: Pane,
  targetPaneId: PaneId,
  visualIndex: number,
  key: string,
): { tree: Pane; activePaneId: PaneId } {
  const targetPane = findPaneById(root, targetPaneId);
  let effectiveIdx = visualIndex;
  if (targetPane && targetPane.kind === "tabs") {
    const sourceIdx = targetPane.tabs.indexOf(key);
    if (sourceIdx >= 0 && visualIndex > sourceIdx) {
      effectiveIdx = visualIndex - 1;
    }
  }

  const { tree: cleaned } = removeTabFromTree(root, key);
  let cleanedRoot: Pane = cleaned ?? emptyTabsPane();

  const newTarget = findPaneById(cleanedRoot, targetPaneId);
  if (!newTarget || newTarget.kind !== "tabs") {
    const leaf = firstLeaf(cleanedRoot);
    cleanedRoot = mapTree(cleanedRoot, (t) =>
      t.id === leaf.id
        ? {
            ...t,
            tabs: t.tabs.includes(key) ? t.tabs : [...t.tabs, key],
            active: key,
          }
        : t,
    );
    return { tree: cleanedRoot, activePaneId: leaf.id };
  }

  cleanedRoot = mapTree(cleanedRoot, (t) => {
    if (t.id !== targetPaneId) return t;
    const tabs = [...t.tabs];
    const clamped = Math.max(0, Math.min(effectiveIdx, tabs.length));
    tabs.splice(clamped, 0, key);
    return { ...t, tabs, active: key };
  });
  return { tree: cleanedRoot, activePaneId: targetPaneId };
}

function setSplitRatioInTree(
  root: Pane,
  splitId: PaneId,
  ratio: number,
): Pane {
  if (root.id === splitId && root.kind === "split") {
    return { ...root, ratio };
  }
  if (root.kind === "split") {
    return {
      ...root,
      first: setSplitRatioInTree(root.first, splitId, ratio),
      second: setSplitRatioInTree(root.second, splitId, ratio),
    };
  }
  return root;
}

// Determine whether a pane id sits inside the bottomRoot.
export function isInBottom(layout: WorkspaceLayout, paneId: PaneId): boolean {
  return layout.bottomRoot ? isInTree(layout.bottomRoot, paneId) : false;
}

// -------- Store --------

export interface HydrateProgress {
  phase: string;
  current: number;
  total: number;
}

interface AppState {
  recent: WorkspaceMeta[];
  openIds: string[];
  activeId: string | null;
  loaded: Record<string, WorkspaceData>;
  hydrated: boolean;
  hydrateProgress: HydrateProgress;

  hydrate(): Promise<void>;
  openWorkspace(root: string): Promise<void>;
  closeWorkspace(id: string): Promise<void>;
  removeFromRecent(id: string): Promise<void>;
  setActiveWorkspace(id: string): Promise<void>;
  /** Reorder the open-workspaces list (activity bar) by moving the icon at
   *  `fromIndex` to `toIndex`. Drives the drag-and-drop sort and persists. */
  reorderWorkspaces(fromIndex: number, toIndex: number): void;

  openFile(wsId: string, path: string): Promise<void>;
  closeTab(wsId: string, key: string): Promise<void>;
  reopenClosedTab(wsId: string): Promise<boolean>;
  setActiveTab(wsId: string, paneId: PaneId, key: string): void;
  setActivePane(wsId: string, paneId: PaneId): void;
  setTabPinned(wsId: string, key: string, pinned: boolean): void;
  /** Reorder tabs in the active pane alphabetically by display label.
   *  Pinned tabs preserve their `layout.pinned` order at the head of the
   *  list; only the unpinned suffix is sorted. No-op if the active pane
   *  isn't a tabs leaf or has fewer than 2 tabs to reorder. */
  sortActiveTabsAlphabetical(wsId: string): void;
  /** Reorder tabs in the active pane by recent activity (most recently
   *  used first). Files use the recentFiles MRU stack; terminals/AI tabs
   *  fall through to a stable order at the end. Pinned tabs preserve
   *  their `layout.pinned` order at the head. */
  sortActiveTabsByRecent(wsId: string): void;
  moveTab(
    wsId: string,
    key: string,
    target:
      | { paneId: PaneId; edge: DropEdge }
      | { paneId: PaneId; insertIndex: number },
  ): void;
  setSplitRatio(wsId: string, splitId: PaneId, ratio: number): void;
  updateFileContents(wsId: string, path: string, contents: string): void;
  /** Resolves true when the buffer hit the disk (or was already
   *  clean / not open); false when the write failed — callers that
   *  deploy the on-disk file afterwards must abort on false or they'd
   *  ship stale content with a success toast. */
  saveFile(wsId: string, path: string): Promise<boolean>;
  /** Re-key open buffers + tab keys after a rename (file OR directory
   *  — children re-key by prefix). Without this, Ctrl+S on a renamed
   *  file resurrected the old path on disk. */
  handlePathRenamed(wsId: string, oldPath: string, newPath: string): void;
  saveAllFiles(wsId: string): Promise<void>;

  toggleDir(wsId: string, path: string): void;
  setSidebarW(wsId: string, w: number): void;
  setTermH(wsId: string, h: number): void;
  setBottomVisible(wsId: string, v: boolean): void;
  setSidebarVisible(wsId: string, v: boolean): void;
  setSidebarView(wsId: string, v: SidebarView): void;
  toggleSidebarSection(wsId: string, view: SidebarView): void;
  removeSidebarSection(wsId: string, view: SidebarView): void;
  collapseSidebarSection(wsId: string, view: SidebarView, collapsed: boolean): void;
  setSidebarSectionSize(wsId: string, view: SidebarView, size: number): void;
  reorderSidebarSection(
    wsId: string,
    view: SidebarView,
    beforeView: SidebarView | null,
  ): void;
  setSidebarSide(wsId: string, side: "left" | "right"): void;
  setAIPanelVisible(wsId: string, visible: boolean): void;
  setAIPanelW(wsId: string, w: number): void;
  setAIRailExpanded(wsId: string, expanded: boolean): void;

  addTerminal(
    wsId: string,
    location?: TerminalLocation,
    shell?: TerminalShell,
  ): string;
  closeTerminal(wsId: string, id: string): void;
  setTerminalPtyId(wsId: string, termId: string, ptyId: string): void;
  setTerminalPopped(wsId: string, termId: string, popped: boolean): void;

  addAIChat(wsId: string, location?: TerminalLocation): string;
  /** Open (or focus) a read-only subagent transcript tab in the editor. */
  openSubagent(
    wsId: string,
    sessionId: string,
    toolUseId: string,
    agentType: string,
  ): void;
  /** Open (or focus) the persistent Whiteboard tab for a workspace. */
  wbOpen(wsId: string): void;
  /** Open (or focus) the Usage tab (live Claude Code cost monitor) for a
   *  workspace. One tab per workspace, mirrors wbOpen. */
  usageOpen(wsId: string): void;
  /** Open (or focus) a session transcript tab in the active editor pane.
   *  The pane renders a lazy chunked loader for the given Claude Code
   *  session. Re-clicking the same row focuses the existing tab. */
  sessionOpen(wsId: string, project: string, sessionId: string): void;
  sessionClose(wsId: string, project: string, sessionId: string): void;
  closeAIChat(wsId: string, id: string): void;
  /** Focus an existing chat's tab (reopening it in the active editor pane
   *  if its tab was closed). Used by the Agent Hub to jump to a chat. */
  focusAIChat(wsId: string, id: string): void;
  setAIChatTitle(wsId: string, id: string, title: string): void;
  /** User-driven rename from the Agent Hub — locks the title against the
   *  auto-title effect. */
  renameAIChat(wsId: string, id: string, title: string): void;
  /** Manual lifecycle for the Agent Hub: "active" clears both timestamps,
   *  "done" sets doneAt, "archived" sets archivedAt + hides from the hub. */
  setAIChatLifecycle(
    wsId: string,
    id: string,
    state: "active" | "done" | "archived",
  ): void;
  setAIChatSession(wsId: string, id: string, sessionId: string): void;
  setAIChatModel(wsId: string, id: string, model: string): void;
  /** Reorder by adjusting the dragged chat's createdAt to land just
   *  before `beforeId`. Pass null to move to the end. The rail is sorted
   *  by createdAt so this is the only state mutation needed. */
  reorderAIChat(wsId: string, id: string, beforeId: string | null): void;

  /** Mark a file as "just touched" for the idle-buffer sweeper. Cheap;
   *  fired from EditorPane on focus and cursor activity. */
  touchFile(wsId: string, path: string): void;
  /** Mark a terminal as "just touched" for the idle-close sweeper. */
  touchTerminal(wsId: string, termId: string): void;
  /** Drop a file's contents from the in-memory store IF it is not dirty
   *  and not currently the active tab in any pane. The tab key stays in
   *  the layout — clicking it re-reads from disk via openFile. */
  unloadIdleFile(wsId: string, path: string): void;
}

const defaultLayout = (): WorkspaceLayout => {
  const editorRoot = emptyTabsPane();
  return {
    editorRoot,
    bottomRoot: null,
    activePaneId: editorRoot.id,
    bottomVisible: true,
    sidebarVisible: true,
    expandedDirs: [],
    sidebarW: 240,
    termH: 240,
    sidebarView: "files",
    pinned: [],
    sidebarSections: [{ view: "files", collapsed: false, size: 1 }],
    sidebarSide: "left",
    aiPanelVisible: false,
    aiPanelW: 380,
    aiRailExpanded: false,
  };
};

function makeWsId(root: string): string {
  let h = 0;
  for (let i = 0; i < root.length; i++) h = (h * 31 + root.charCodeAt(i)) | 0;
  return `ws_${Math.abs(h).toString(36)}_${root.length.toString(36)}`;
}

function makeTermId(): string {
  return "t_" + Math.random().toString(36).slice(2, 10);
}

function makeAIChatId(): string {
  return "a_" + Math.random().toString(36).slice(2, 10);
}

function parseAIChatsRaw(raw: unknown): Record<string, AIChatDescriptor> {
  const out: Record<string, AIChatDescriptor> = {};
  if (!raw || typeof raw !== "object") return out;
  // Stable insertion order from JSON.stringify — older saves had no
  // createdAt; assign monotonically increasing timestamps so they keep
  // their original order in the rail.
  let migrationStamp = 0;
  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue;
    const v = val as Record<string, unknown>;
    if (
      typeof v.id !== "string" ||
      typeof v.title !== "string" ||
      typeof v.sessionId !== "string"
    ) {
      continue;
    }
    const createdAt =
      typeof v.createdAt === "number" ? v.createdAt : ++migrationStamp;
    const model = typeof v.model === "string" ? v.model : undefined;
    const doneAt = typeof v.doneAt === "number" ? v.doneAt : undefined;
    const archivedAt =
      typeof v.archivedAt === "number" ? v.archivedAt : undefined;
    const titleLocked = v.titleLocked === true ? true : undefined;
    out[id] = {
      id: v.id,
      title: v.title,
      sessionId: v.sessionId,
      createdAt,
      model,
      doneAt,
      archivedAt,
      titleLocked,
    };
  }
  return out;
}

function sanitizePane(p: unknown): Pane {
  if (!p || typeof p !== "object") return emptyTabsPane();
  const o = p as Record<string, unknown>;
  if (o.kind === "split") {
    return {
      kind: "split",
      id: typeof o.id === "string" ? o.id : makePaneId(),
      orientation: o.orientation === "vertical" ? "vertical" : "horizontal",
      ratio:
        typeof o.ratio === "number"
          ? Math.max(0.1, Math.min(0.9, o.ratio))
          : 0.5,
      first: sanitizePane(o.first),
      second: sanitizePane(o.second),
    };
  }
  return {
    kind: "tabs",
    id: typeof o.id === "string" ? o.id : makePaneId(),
    tabs: Array.isArray(o.tabs) ? (o.tabs as string[]) : [],
    active: typeof o.active === "string" ? (o.active as string) : null,
  };
}

// Parse the dozen common fields (visibility flags, sidebar config, AI panel
// settings, etc.) that BOTH the old-shape migration path and the modern
// path return identically. Both branches differ only in how they construct
// editorRoot/bottomRoot/activePaneId; pulling the shared bag out kept the
// migration path from drifting again every time we add a new field.
function commonLayoutFields(
  r: Record<string, unknown>,
): Omit<WorkspaceLayout, "editorRoot" | "bottomRoot" | "activePaneId"> {
  const validViews: SidebarView[] = [
    "files", "search", "git", "tasks", "todos", "outline", "bookmarks", "ai", "remote", "usage",
  ];
  const view = validViews.includes(r.sidebarView as SidebarView)
    ? (r.sidebarView as SidebarView)
    : "files";
  return {
    bottomVisible:
      typeof r.bottomVisible === "boolean" ? r.bottomVisible : true,
    sidebarVisible:
      typeof r.sidebarVisible === "boolean" ? r.sidebarVisible : true,
    expandedDirs: Array.isArray(r.expandedDirs)
      ? (r.expandedDirs as string[])
      : [],
    sidebarW: typeof r.sidebarW === "number" ? r.sidebarW : 240,
    termH: typeof r.termH === "number" ? r.termH : 240,
    sidebarView: view,
    pinned: Array.isArray(r.pinned)
      ? r.pinned.filter((x: unknown): x is string => typeof x === "string")
      : [],
    sidebarSections: parseSidebarSections(r.sidebarSections, view),
    sidebarSide: r.sidebarSide === "right" ? "right" : "left",
    aiPanelVisible: r.aiPanelVisible === true,
    aiPanelW:
      typeof r.aiPanelW === "number"
        ? Math.max(220, Math.min(800, r.aiPanelW))
        : 380,
    aiRailExpanded: r.aiRailExpanded === true,
  };
}

function normalizeLayout(raw: unknown): WorkspaceLayout {
  if (!raw || typeof raw !== "object") return defaultLayout();
  const r = raw as Record<string, unknown>;

  // Old-shape migration (editorOrder / bottomOrder / openTabs).
  if (
    Array.isArray(r.editorOrder) ||
    Array.isArray(r.openTabs) ||
    Array.isArray(r.bottomOrder)
  ) {
    const editorTabs: string[] = Array.isArray(r.editorOrder)
      ? (r.editorOrder as string[])
      : Array.isArray(r.openTabs)
        ? (r.openTabs as string[]).map((p) => fileKey(p))
        : [];
    const editorActiveOld =
      typeof r.editorActive === "string"
        ? (r.editorActive as string)
        : typeof r.activeTab === "string"
          ? fileKey(r.activeTab as string)
          : null;
    const editorPane: TabsPane = {
      kind: "tabs",
      id: makePaneId(),
      tabs: editorTabs,
      active:
        editorActiveOld && editorTabs.includes(editorActiveOld)
          ? editorActiveOld
          : (editorTabs[editorTabs.length - 1] ?? null),
    };
    const bottomTabs: string[] = Array.isArray(r.bottomOrder)
      ? (r.bottomOrder as string[])
      : [];
    let bottomRoot: Pane | null = null;
    if (bottomTabs.length > 0) {
      const bottomActiveOld =
        typeof r.bottomActive === "string" ? (r.bottomActive as string) : null;
      bottomRoot = {
        kind: "tabs",
        id: makePaneId(),
        tabs: bottomTabs,
        active:
          bottomActiveOld && bottomTabs.includes(bottomActiveOld)
            ? bottomActiveOld
            : (bottomTabs[bottomTabs.length - 1] ?? null),
      };
    }
    return {
      editorRoot: editorPane,
      bottomRoot,
      activePaneId: editorPane.id,
      ...commonLayoutFields(r),
    };
  }

  const editorRoot = r.editorRoot ? sanitizePane(r.editorRoot) : emptyTabsPane();
  const bottomRoot = r.bottomRoot ? sanitizePane(r.bottomRoot) : null;
  return {
    editorRoot,
    bottomRoot,
    activePaneId:
      typeof r.activePaneId === "string"
        ? (r.activePaneId as string)
        : firstLeaf(editorRoot).id,
    ...commonLayoutFields(r),
  };
}

function parseSidebarSections(
  raw: unknown,
  fallback: SidebarView,
): SidebarSection[] {
  const validViews: SidebarView[] = [
    "files",
    "git",
    "tasks",
    "todos",
    "remote",
  ];
  if (Array.isArray(raw)) {
    const out: SidebarSection[] = [];
    for (const r of raw) {
      if (!r || typeof r !== "object") continue;
      const v = (r as Record<string, unknown>).view;
      if (typeof v !== "string" || !validViews.includes(v as SidebarView))
        continue;
      out.push({
        view: v as SidebarView,
        collapsed: (r as Record<string, unknown>).collapsed === true,
        size:
          typeof (r as Record<string, unknown>).size === "number"
            ? Math.max(0.1, Math.min(10, (r as { size: number }).size))
            : 1,
      });
    }
    if (out.length > 0) return out;
  }
  return [
    {
      view: validViews.includes(fallback) ? fallback : "files",
      collapsed: false,
      size: 1,
    },
  ];
}

function parseTerminalsRaw(
  raw: unknown,
): Record<string, TerminalDescriptor> {
  const out: Record<string, TerminalDescriptor> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [id, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== "object") continue;
    const v = val as Record<string, unknown>;
    if (typeof v.id !== "string" || typeof v.title !== "string") continue;
    const desc: TerminalDescriptor = {
      id: v.id,
      title: v.title,
      ptyId: typeof v.ptyId === "string" ? v.ptyId : undefined,
    };
    if (v.shell && typeof v.shell === "object") {
      const s = v.shell as Record<string, unknown>;
      if (
        typeof s.path === "string" &&
        typeof s.label === "string" &&
        Array.isArray(s.args)
      ) {
        desc.shell = {
          path: s.path,
          label: s.label,
          args: s.args.filter((a) => typeof a === "string") as string[],
        };
      }
    }
    out[id] = desc;
  }
  return out;
}

async function loadWorkspaceFromDisk(
  meta: WorkspaceMeta,
  liveSessionIds: Set<string>,
): Promise<WorkspaceData> {
  const raw = await wsApi.loadState(meta.id);
  let layoutRaw: unknown = raw;
  let terminalsRaw: unknown = null;
  if (
    raw &&
    typeof raw === "object" &&
    "layout" in (raw as Record<string, unknown>)
  ) {
    const r = raw as Record<string, unknown>;
    layoutRaw = r.layout;
    terminalsRaw = r.terminals ?? null;
  }
  const layout = normalizeLayout(layoutRaw);
  const allTerminals = parseTerminalsRaw(terminalsRaw);
  let aiChatsRaw: unknown = null;
  if (
    raw &&
    typeof raw === "object" &&
    "aiChats" in (raw as Record<string, unknown>)
  ) {
    aiChatsRaw = (raw as Record<string, unknown>).aiChats;
  }
  const aiChats = parseAIChatsRaw(aiChatsRaw);

  // Filter terminals to only those whose PTY is still alive in the backend.
  const liveTerminals: Record<string, TerminalDescriptor> = {};
  for (const [tid, desc] of Object.entries(allTerminals)) {
    if (desc.ptyId && liveSessionIds.has(desc.ptyId)) {
      liveTerminals[tid] = desc;
    }
  }

  // Collect file paths from the layout to load.
  const fileKeys: string[] = [];
  function collect(p: Pane) {
    if (p.kind === "tabs") {
      for (const k of p.tabs) {
        if (k.startsWith("file:")) fileKeys.push(k);
      }
    } else {
      collect(p.first);
      collect(p.second);
    }
  }
  collect(layout.editorRoot);
  if (layout.bottomRoot) collect(layout.bottomRoot);

  const files: Record<string, FileData> = {};
  await Promise.all(
    Array.from(new Set(fileKeys)).map(async (k) => {
      const path = k.slice(5);
      if (mediaKindOf(path)) {
        // Media tabs carry an empty sentinel buffer (see openFile) so the
        // tab survives the restore filter without a text read.
        files[path] = { contents: "", original: "" };
        return;
      }
      try {
        const c = await fsApi.readFile(path);
        files[path] = { contents: c, original: c };
      } catch {
        /* ignore */
      }
    }),
  );

  function clean(p: Pane): Pane | null {
    if (p.kind === "tabs") {
      const tabs = p.tabs.filter((k) => {
        if (k.startsWith("file:")) return files[k.slice(5)] !== undefined;
        if (k.startsWith("term:")) return liveTerminals[k.slice(5)] !== undefined;
        if (k.startsWith("ai:")) return aiChats[k.slice(3)] !== undefined;
        // Whiteboard is per-workspace and self-contained (its data is
        // re-loaded from disk on mount). Always survives layout cleanup
        // so an active whiteboard tab is never silently dropped.
        if (k.startsWith("wb:")) return true;
        // Usage is self-contained too (polls the backend on mount), so it
        // survives cleanup like the whiteboard tab.
        if (k.startsWith("usage:")) return true;
        return false;
      });
      if (tabs.length === 0) return null;
      const active =
        p.active && tabs.includes(p.active)
          ? p.active
          : (tabs[tabs.length - 1] ?? null);
      return { ...p, tabs, active };
    }
    const first = clean(p.first);
    const second = clean(p.second);
    if (!first && !second) return null;
    if (!first) return second!;
    if (!second) return first;
    return { ...p, first, second };
  }
  const editorClean = clean(layout.editorRoot) ?? emptyTabsPane();
  const bottomClean = layout.bottomRoot ? clean(layout.bottomRoot) : null;
  return {
    meta,
    layout: {
      ...layout,
      editorRoot: editorClean,
      bottomRoot: bottomClean,
      activePaneId: firstLeaf(editorClean).id,
    },
    files,
    terminals: liveTerminals,
    aiChats,
  };
}

export const useStore = create<AppState>((set, get) => {
  // Debounce per-workspace layout persistence so rapid actions (typing,
  // tab switches, splitter drags) don't spam the disk. Each workspace
  // has its own timer.
  const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const PERSIST_DELAY = 300;
  const persistWs = (id: string) => {
    const existing = persistTimers.get(id);
    if (existing) clearTimeout(existing);
    persistTimers.set(
      id,
      setTimeout(async () => {
        persistTimers.delete(id);
        const ws = get().loaded[id];
        if (!ws) return;
        // Drop the in-memory `popped` flag before persisting — popout
        // windows are gone after a reload, so the flag would be stale.
        const persistedTerminals: Record<string, TerminalDescriptor> = {};
        for (const [tid, t] of Object.entries(ws.terminals)) {
          const { popped: _drop, ...rest } = t;
          void _drop;
          persistedTerminals[tid] = rest;
        }
        try {
          await wsApi.saveState(id, {
            layout: ws.layout,
            terminals: persistedTerminals,
            aiChats: ws.aiChats,
          });
        } catch {
          /* ignore — best-effort persistence */
        }
      }, PERSIST_DELAY),
    );
  };
  let idxTimer: ReturnType<typeof setTimeout> | null = null;
  const persistIdx = async () => {
    if (idxTimer) clearTimeout(idxTimer);
    idxTimer = setTimeout(async () => {
      idxTimer = null;
      const { recent, activeId, openIds } = get();
      try {
        await wsApi.save({ recent, active_id: activeId, open_ids: openIds });
      } catch {
        /* ignore */
      }
    }, 200);
  };
  const updateWs = (id: string, fn: (w: WorkspaceData) => WorkspaceData) => {
    set((s) => {
      const w = s.loaded[id];
      if (!w) return s;
      return { loaded: { ...s.loaded, [id]: fn(w) } };
    });
    persistWs(id);
  };

  return {
    recent: [],
    openIds: [],
    activeId: null,
    loaded: {},
    hydrated: false,
    hydrateProgress: {
      phase: "Starting up…",
      current: 0,
      total: 100,
    },

    hydrate: async () => {
      const setProg = (phase: string, current: number, total: number) => {
        set({ hydrateProgress: { phase, current, total } });
      };

      setProg("Reading workspace index…", 5, 100);
      let idx: Awaited<ReturnType<typeof wsApi.load>>;
      try {
        idx = await wsApi.load();
      } catch (e) {
        // A corrupt workspaces.json used to reject here and strand the
        // app on the splash forever. Recover with a fresh index — the
        // file is rewritten on the next persist — and say so; recents
        // are lost but the app starts.
        toastError(
          `Workspace index was unreadable and has been reset: ${errMsg(e)}`,
        );
        idx = { recent: [], active_id: null, open_ids: [] };
      }
      const recent = idx.recent ?? [];
      const requestedOpen =
        idx.open_ids ?? (idx.active_id ? [idx.active_id] : []);
      let activeId = idx.active_id ?? requestedOpen[0] ?? null;

      setProg("Checking running shells…", 15, 100);
      let liveSessions = new Set<string>();
      try {
        const sessions = await ptyApi.listSessions();
        liveSessions = new Set(sessions.map((s) => s.id));
      } catch {
        /* ignore */
      }

      const total = Math.max(1, requestedOpen.length);
      const loaded: Record<string, WorkspaceData> = {};
      const survivingIds: string[] = [];

      for (let i = 0; i < requestedOpen.length; i++) {
        const id = requestedOpen[i];
        const meta = recent.find((w) => w.id === id);
        if (!meta) continue;
        const pct = 20 + Math.round(((i + 1) / total) * 70);
        setProg(`Opening ${meta.name}…`, pct, 100);
        try {
          const data = await loadWorkspaceFromDisk(meta, liveSessions);
          loaded[id] = data;
          survivingIds.push(id);
        } catch {
          /* skip */
        }
      }

      if (activeId && !loaded[activeId]) {
        activeId = survivingIds[0] ?? null;
      }

      setProg("Reattaching terminals…", 95, 100);
      set({
        recent,
        openIds: survivingIds,
        activeId,
        loaded,
        hydrated: true,
        hydrateProgress: { phase: "Ready", current: 100, total: 100 },
      });
      void persistIdx();
    },

    openWorkspace: async (root) => {
      const existing = get().recent.find((w) => w.root === root);
      const meta: WorkspaceMeta = existing
        ? { ...existing, last_opened: Date.now() }
        : {
            id: makeWsId(root),
            name: basename(root) || root,
            root,
            last_opened: Date.now(),
          };
      const recent = [
        meta,
        ...get().recent.filter((w) => w.id !== meta.id),
      ];
      let openIds = get().openIds;
      if (!openIds.includes(meta.id)) openIds = [...openIds, meta.id];
      let loaded = get().loaded;
      if (!loaded[meta.id]) {
        let liveSessions = new Set<string>();
        try {
          const sessions = await ptyApi.listSessions();
          liveSessions = new Set(sessions.map((s) => s.id));
        } catch {
          /* ignore */
        }
        try {
          const data = await loadWorkspaceFromDisk(meta, liveSessions);
          loaded = { ...loaded, [meta.id]: data };
        } catch {
          loaded = {
            ...loaded,
            [meta.id]: {
              meta,
              layout: defaultLayout(),
              files: {},
              terminals: {},
              aiChats: {},
            },
          };
        }
      } else {
        loaded = {
          ...loaded,
          [meta.id]: { ...loaded[meta.id], meta },
        };
      }
      set({ recent, openIds, activeId: meta.id, loaded });
      await persistIdx();
    },

    closeWorkspace: async (id) => {
      const ws = get().loaded[id];
      if (ws) {
        const dirty = Object.entries(ws.files).filter(
          ([, f]) => f.contents !== f.original,
        );
        if (dirty.length > 0) {
          const picked = await dialogChoice(
            `${ws.meta.name} has unsaved changes in ${dirty.length} file${dirty.length === 1 ? "" : "s"}.`,
            [
              { value: "save", label: "Save All", kind: "primary" },
              { value: "discard", label: "Don't Save", kind: "danger" },
              { value: "cancel", label: "Cancel" },
            ],
            { title: "Close workspace" },
          );
          if (picked === "cancel" || picked === null) return;
          if (picked === "save") {
            const results = await Promise.all(
              dirty.map(([p]) => get().saveFile(id, p)),
            );
            // Any failed save aborts the close — silently proceeding
            // would discard exactly the file the user asked to keep.
            if (results.some((ok) => !ok)) return;
          }
        }
        // Kill all PTYs we own in this workspace, and close any pop-out
        // windows hosting them. Both are best-effort.
        for (const t of Object.values(ws.terminals)) {
          if (t.ptyId) void ptyApi.kill(t.ptyId).catch(() => {});
          void closePopoutWindow(t.id).catch(() => {});
        }
        await wsApi.saveState(id, {
          layout: ws.layout,
          terminals: {},
          aiChats: ws.aiChats,
        });
      }
      const openIds = get().openIds.filter((i) => i !== id);
      let activeId = get().activeId;
      if (activeId === id) activeId = openIds[openIds.length - 1] ?? null;
      const { [id]: _drop, ...rest } = get().loaded;
      set({ openIds, activeId, loaded: rest });
      // All of this workspace's buffers are gone — release their
      // Monaco models (kept alive across tab switches for undo).
      if (ws) {
        for (const p of Object.keys(ws.files)) disposeModelForPath(p);
      }
      void invoke("fs_watch_stop", { wsId: id }).catch(() => {});
      await persistIdx();
    },

    removeFromRecent: async (id) => {
      if (get().openIds.includes(id)) {
        await get().closeWorkspace(id);
      }
      const recent = get().recent.filter((w) => w.id !== id);
      set({ recent });
      await persistIdx();
    },

    setActiveWorkspace: async (id) => {
      if (!get().loaded[id]) return;
      // Reset the editor-state singleton so the AI panel doesn't carry
      // the previous workspace's "active file" into the next chat turn
      // (and so other consumers don't accidentally read or write across
      // workspace boundaries). The new editor will repopulate it as
      // soon as a tab is focused in the just-activated workspace.
      const prevId = get().activeId;
      if (prevId !== id) {
        clearEditorState();
      }
      set({ activeId: id });
      await persistIdx();
    },

    reorderWorkspaces: (fromIndex, toIndex) => {
      const openIds = get().openIds;
      if (
        fromIndex === toIndex ||
        fromIndex < 0 ||
        toIndex < 0 ||
        fromIndex >= openIds.length ||
        toIndex >= openIds.length
      ) {
        return;
      }
      const next = [...openIds];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      set({ openIds: next });
      void persistIdx();
    },

    openFile: async (wsId, path) => {
      const ws = get().loaded[wsId];
      if (!ws) return;
      // Reopening this file via any route (sidebar, palette, recent
      // files cycle) makes a previously-recorded "closed" entry
      // stale — clear it so Ctrl+Shift+T moves on to the next-most
      // recent close instead of redundantly resurrecting a tab the
      // user already has open.
      forgetClosedTab(wsId, path);
      const k = fileKey(path);
      // Already open? Activate in its pane.
      const existingPane =
        findTabsPaneByTab(ws.layout.editorRoot, k) ??
        (ws.layout.bottomRoot
          ? findTabsPaneByTab(ws.layout.bottomRoot, k)
          : null);
      if (existingPane && ws.files[path]) {
        updateWs(wsId, (w) => ({
          ...w,
          layout: {
            ...w.layout,
            editorRoot: setActiveInPane(w.layout.editorRoot, existingPane.id, k),
            bottomRoot: w.layout.bottomRoot
              ? setActiveInPane(w.layout.bottomRoot, existingPane.id, k)
              : null,
            activePaneId: existingPane.id,
          },
        }));
        return;
      }
      let contents: string;
      if (mediaKindOf(path)) {
        // Image / PDF / session-transcript: never feed it to readFile
        // (the backend rejects binary, and the session kind has no
        // backing file at all). We keep an empty sentinel buffer so the
        // tab persists + tracks as a known file; MediaPreviewPane /
        // SessionTranscriptPane fetch the real bytes via IPC on mount.
        contents = "";
      } else {
        try {
          contents = await fsApi.readFile(path);
        } catch (e) {
          // The backend's messages are user-worthy ("File is too large…",
          // "binary file"); a console.error meant double-clicking a PNG
          // or a 100 MB log just silently did nothing.
          toastError(`Can't open ${basename(path)}: ${errMsg(e)}`);
          return;
        }
      }
      updateWs(wsId, (w) => {
        const targetPaneId =
          (w.layout.activePaneId &&
            isInTree(w.layout.editorRoot, w.layout.activePaneId) &&
            w.layout.activePaneId) ||
          firstLeaf(w.layout.editorRoot).id;
        const editorRoot = mapTree(w.layout.editorRoot, (t) =>
          t.id === targetPaneId
            ? {
                ...t,
                tabs: t.tabs.includes(k) ? t.tabs : [...t.tabs, k],
                active: k,
              }
            : t,
        );
        return {
          ...w,
          files: {
            ...w.files,
            [path]: { contents, original: contents },
          },
          layout: {
            ...w.layout,
            editorRoot,
            activePaneId: targetPaneId,
          },
        };
      });
    },

    closeTab: async (wsId, key) => {
      const ws = get().loaded[wsId];
      if (!ws) return;
      const parsed = parseKey(key);
      if (parsed?.kind === "terminal") {
        get().closeTerminal(wsId, parsed.id);
        return;
      }
      if (parsed?.kind === "ai") {
        get().closeAIChat(wsId, parsed.id);
        return;
      }
      if (parsed?.kind === "file") {
        const f = ws.files[parsed.path];
        if (f && f.contents !== f.original) {
          // Save / Don't Save / Cancel — the old binary Discard/Cancel
          // forced a detour (cancel, Ctrl+S, close again) for the most
          // common answer, which is "save it".
          const picked = await dialogChoice(
            `${basename(parsed.path)} has unsaved changes.`,
            [
              { value: "save", label: "Save", kind: "primary" },
              { value: "discard", label: "Don't Save", kind: "danger" },
              { value: "cancel", label: "Cancel" },
            ],
            { title: "Close tab" },
          );
          if (picked === "cancel" || picked === null) return;
          if (picked === "save") {
            // Failed save (locked file etc.) keeps the tab open — the
            // user chose to keep this content.
            if (!(await get().saveFile(wsId, parsed.path))) return;
          }
        }
        // Push onto the per-workspace "recently closed" stack so
        // Ctrl+Shift+T can resurrect it.
        pushClosedTab(wsId, parsed.path);
      }
      updateWs(wsId, (w) => {
        const er = removeTabFromTree(w.layout.editorRoot, key);
        const editorRoot: Pane = er.tree ?? emptyTabsPane();
        let bottomRoot = w.layout.bottomRoot;
        if (bottomRoot) {
          const br = removeTabFromTree(bottomRoot, key);
          bottomRoot = br.tree;
        }
        let files = w.files;
        if (parsed?.kind === "file") {
          const { [parsed.path]: _drop, ...restFiles } = w.files;
          files = restFiles;
        }
        const activePaneId =
          w.layout.activePaneId &&
          (isInTree(editorRoot, w.layout.activePaneId) ||
            (bottomRoot ? isInTree(bottomRoot, w.layout.activePaneId) : false))
            ? w.layout.activePaneId
            : firstLeaf(editorRoot).id;
        return {
          ...w,
          files,
          layout: {
            ...w.layout,
            editorRoot,
            bottomRoot,
            activePaneId,
          },
        };
      });
      // The buffer is gone — release the Monaco model too (it outlives
      // unmounts on purpose so undo survives tab SWITCHES; an explicit
      // close is where its life ends).
      if (parsed?.kind === "file") disposeModelForPath(parsed.path);
    },

    reopenClosedTab: async (wsId) => {
      // Pop the freshest entry; openFile clears any stale entries for
      // the path so this is safely idempotent if the user spams the
      // shortcut. Returns true when a tab was reopened so the caller
      // can choose whether to flash a toast on the empty case.
      while (true) {
        const entry = popClosedTab(wsId);
        if (!entry) return false;
        // Skip files that are already open — the user might have
        // reopened one via a different path while another close was
        // still on the stack.
        const ws = get().loaded[wsId];
        if (ws && ws.files[entry.path]) continue;
        await get().openFile(wsId, entry.path);
        return true;
      }
    },

    setActiveTab: (wsId, paneId, key) =>
      updateWs(wsId, (w) => ({
        ...w,
        layout: {
          ...w.layout,
          editorRoot: setActiveInPane(w.layout.editorRoot, paneId, key),
          bottomRoot: w.layout.bottomRoot
            ? setActiveInPane(w.layout.bottomRoot, paneId, key)
            : null,
          activePaneId: paneId,
        },
      })),

    setActivePane: (wsId, paneId) =>
      updateWs(wsId, (w) => ({
        ...w,
        layout: { ...w.layout, activePaneId: paneId },
      })),

    setTabPinned: (wsId, key, pinned) =>
      updateWs(wsId, (w) => {
        const cur = w.layout.pinned ?? [];
        const has = cur.includes(key);
        if (pinned && !has) {
          return { ...w, layout: { ...w.layout, pinned: [...cur, key] } };
        }
        if (!pinned && has) {
          return {
            ...w,
            layout: { ...w.layout, pinned: cur.filter((p) => p !== key) },
          };
        }
        return w;
      }),

    sortActiveTabsAlphabetical: (wsId) => {
      const ws = get().loaded[wsId];
      if (!ws) return;
      const paneId = ws.layout.activePaneId;
      if (!paneId) return;
      const target =
        findPaneById(ws.layout.editorRoot, paneId) ??
        (ws.layout.bottomRoot
          ? findPaneById(ws.layout.bottomRoot, paneId)
          : null);
      if (!target || target.kind !== "tabs" || target.tabs.length < 2) return;

      const labelFor = (key: string): string => {
        const parsed = parseKey(key);
        if (!parsed) return key;
        if (parsed.kind === "file") return basename(parsed.path) || parsed.path;
        if (parsed.kind === "terminal") {
          return ws.terminals[parsed.id]?.title ?? key;
        }
        if (parsed.kind === "subagent") return parsed.agentType || key;
        if (parsed.kind === "whiteboard") return "Organigramma";
        if (parsed.kind === "usage") return "Usage";
        if (parsed.kind === "session") {
          return `Session ${parsed.sessionId.slice(0, 8)}`;
        }
        // ai
        return ws.aiChats[parsed.id]?.title ?? key;
      };

      const reordered = reorderTabsForSort(target.tabs, ws.layout.pinned ?? [], (a, b) =>
        labelFor(a).localeCompare(labelFor(b), undefined, {
          sensitivity: "base",
          numeric: true,
        }),
      );
      if (sameOrder(reordered, target.tabs)) return;

      updateWs(wsId, (w) => ({
        ...w,
        layout: {
          ...w.layout,
          editorRoot: mapTree(w.layout.editorRoot, (t) =>
            t.id === paneId ? { ...t, tabs: reordered } : t,
          ),
          bottomRoot: w.layout.bottomRoot
            ? mapTree(w.layout.bottomRoot, (t) =>
                t.id === paneId ? { ...t, tabs: reordered } : t,
              )
            : null,
        },
      }));
    },

    sortActiveTabsByRecent: (wsId) => {
      const ws = get().loaded[wsId];
      if (!ws) return;
      const paneId = ws.layout.activePaneId;
      if (!paneId) return;
      const target =
        findPaneById(ws.layout.editorRoot, paneId) ??
        (ws.layout.bottomRoot
          ? findPaneById(ws.layout.bottomRoot, paneId)
          : null);
      if (!target || target.kind !== "tabs" || target.tabs.length < 2) return;

      // Build a recency rank for every tab in the pane. Lower rank ==
      // more recent. Files draw from the MRU stack; terminals/AI tabs
      // fall back to the module-level last-touched maps (idle tracker).
      // Anything with no recorded touch sinks to the end via Infinity.
      const recentList = getRecentFiles(wsId);
      const fileRank = new Map<string, number>();
      recentList.forEach((p, i) => fileRank.set(p, i));
      const termTouches = terminalLastTouched.get(wsId);
      // No idle map for AI chats — best we can do is fall back to
      // createdAt so the most recently created chat ranks above older
      // ones when the user has never touched any.
      const now = Date.now();

      const rankFor = (key: string): number => {
        const parsed = parseKey(key);
        if (!parsed) return Number.POSITIVE_INFINITY;
        if (parsed.kind === "file") {
          const r = fileRank.get(parsed.path);
          return r === undefined ? Number.POSITIVE_INFINITY : r;
        }
        if (parsed.kind === "terminal") {
          const last = termTouches?.get(parsed.id);
          // Convert "last-touched ms" to a rank where smaller = more
          // recent. Untouched terminals get +Infinity.
          if (last === undefined) return Number.POSITIVE_INFINITY;
          return now - last;
        }
        if (parsed.kind === "subagent") return Number.POSITIVE_INFINITY;
        if (parsed.kind === "whiteboard") return Number.POSITIVE_INFINITY;
        if (parsed.kind === "usage") return Number.POSITIVE_INFINITY;
        if (parsed.kind === "session") return Number.POSITIVE_INFINITY;
        // ai
        const desc = ws.aiChats[parsed.id];
        if (!desc) return Number.POSITIVE_INFINITY;
        // Newer createdAt ⇒ smaller rank.
        return now - desc.createdAt;
      };

      const reordered = reorderTabsForSort(target.tabs, ws.layout.pinned ?? [], (a, b) => {
        const ra = rankFor(a);
        const rb = rankFor(b);
        if (ra === rb) return 0;
        return ra < rb ? -1 : 1;
      });
      if (sameOrder(reordered, target.tabs)) return;

      updateWs(wsId, (w) => ({
        ...w,
        layout: {
          ...w.layout,
          editorRoot: mapTree(w.layout.editorRoot, (t) =>
            t.id === paneId ? { ...t, tabs: reordered } : t,
          ),
          bottomRoot: w.layout.bottomRoot
            ? mapTree(w.layout.bottomRoot, (t) =>
                t.id === paneId ? { ...t, tabs: reordered } : t,
              )
            : null,
        },
      }));
    },

    moveTab: (wsId, key, target) => {
      updateWs(wsId, (w) => {
        const inEditor = isInTree(w.layout.editorRoot, target.paneId);
        const inBottom =
          !!w.layout.bottomRoot && isInTree(w.layout.bottomRoot, target.paneId);
        let editorRoot = w.layout.editorRoot;
        let bottomRoot = w.layout.bottomRoot;
        let activePaneId = w.layout.activePaneId;

        const applyToTree = (tree: Pane): { tree: Pane; activePaneId: PaneId } => {
          if ("insertIndex" in target) {
            return dropTabAtIndex(tree, target.paneId, target.insertIndex, key);
          }
          return dropTabAt(tree, target.paneId, target.edge, key);
        };

        if (inEditor) {
          if (bottomRoot) {
            const br = removeTabFromTree(bottomRoot, key);
            bottomRoot = br.tree;
          }
          const result = applyToTree(editorRoot);
          editorRoot = result.tree;
          activePaneId = result.activePaneId;
        } else if (inBottom && bottomRoot) {
          const er = removeTabFromTree(editorRoot, key);
          editorRoot = er.tree ?? emptyTabsPane();
          const result = applyToTree(bottomRoot);
          bottomRoot = result.tree;
          activePaneId = result.activePaneId;
        } else {
          // Target gone — fall back to editor first leaf.
          const er = removeTabFromTree(editorRoot, key);
          editorRoot = er.tree ?? emptyTabsPane();
          if (bottomRoot) {
            const br = removeTabFromTree(bottomRoot, key);
            bottomRoot = br.tree;
          }
          const leaf = firstLeaf(editorRoot);
          editorRoot = mapTree(editorRoot, (t) =>
            t.id === leaf.id
              ? {
                  ...t,
                  tabs: t.tabs.includes(key) ? t.tabs : [...t.tabs, key],
                  active: key,
                }
              : t,
          );
          activePaneId = leaf.id;
        }
        return {
          ...w,
          layout: { ...w.layout, editorRoot, bottomRoot, activePaneId },
        };
      });
    },

    setSplitRatio: (wsId, splitId, ratio) =>
      updateWs(wsId, (w) => {
        const editorRoot = setSplitRatioInTree(w.layout.editorRoot, splitId, ratio);
        const bottomRoot = w.layout.bottomRoot
          ? setSplitRatioInTree(w.layout.bottomRoot, splitId, ratio)
          : null;
        return { ...w, layout: { ...w.layout, editorRoot, bottomRoot } };
      }),

    updateFileContents: (wsId, path, contents) => {
      set((s) => {
        const w = s.loaded[wsId];
        if (!w) return s;
        const f = w.files[path];
        if (!f) return s;
        return {
          loaded: {
            ...s.loaded,
            [wsId]: {
              ...w,
              files: { ...w.files, [path]: { ...f, contents } },
            },
          },
        };
      });
    },

    saveFile: async (wsId, path) => {
      const ws = get().loaded[wsId];
      const f = ws?.files[path];
      if (!ws || !f || f.contents === f.original) return true;
      // Disk guard: if the file changed on disk since we loaded it
      // (claude in a terminal, a formatter, git checkout), writing now
      // would silently destroy that work. Read-before-write costs one
      // extra IPC per save and buys the core AI-workflow guarantee.
      try {
        const onDisk = await fsApi.readFile(path);
        if (onDisk !== f.original && onDisk !== f.contents) {
          const picked = await dialogChoice(
            `${basename(path)} changed on disk while you were editing (a terminal AI session or another tool wrote it).`,
            [
              { value: "cancel", label: "Cancel", kind: "primary" },
              { value: "disk", label: "Take Disk Version" },
              { value: "mine", label: "Overwrite Disk", kind: "danger" },
            ],
            { title: "File changed on disk" },
          );
          if (picked === "cancel" || picked === null) return false;
          if (picked === "disk") {
            set((s) => {
              const w = s.loaded[wsId];
              if (!w || !w.files[path]) return s;
              return {
                loaded: {
                  ...s.loaded,
                  [wsId]: {
                    ...w,
                    files: {
                      ...w.files,
                      [path]: { contents: onDisk, original: onDisk },
                    },
                  },
                },
              };
            });
            return true; // nothing written; buffer now matches disk
          }
        }
      } catch {
        // Unreadable / not-yet-existing — proceed; the write itself
        // reports real failures.
      }
      const settings = getEditorSettings();
      let content = f.contents;
      if (settings.trimTrailingWhitespace) {
        // Keep an optional \r so CRLF files get trimmed too — the old
        // `[ \t]+$` never matched lines ending "  \r".
        content = content
          .split("\n")
          .map((line) => line.replace(/[ \t]+(\r?)$/, "$1"))
          .join("\n");
      }
      if (
        settings.insertFinalNewline &&
        content.length > 0 &&
        !content.endsWith("\n")
      ) {
        content += "\n";
      }
      try {
        await fsApi.writeFile(path, content);
      } catch (e) {
        // Locked / read-only / disk-full. Buffer stays dirty so the
        // tab dot keeps signalling unsaved work; without this toast the
        // rejection was swallowed and Ctrl+S looked like it worked.
        toastError(`Save failed for ${basename(path)}: ${errMsg(e)}`);
        return false;
      }
      set((s) => {
        const w = s.loaded[wsId];
        if (!w || !w.files[path]) return s;
        return {
          loaded: {
            ...s.loaded,
            [wsId]: {
              ...w,
              files: {
                ...w.files,
                [path]: { contents: content, original: content },
              },
            },
          },
        };
      });
      // Auto-push to remote if this file is linked AND has autoPush
      // enabled AND the matching SFTP session is currently connected.
      // Fire-and-forget: never block the save on a network round-trip.
      // pushLinkedFile stale-checks the remote first — in "auto" mode a
      // changed remote file SKIPS the push with a warning instead of
      // silently clobbering a second writer's edits on every Ctrl+S —
      // and records the outcome in the deploy log.
      const link = lookupRemoteLink(wsId, path);
      if (link && link.autoPush && !consumeAutoPushSuppression(path)) {
        const active = getActiveSftp(wsId);
        if (active && active.profileId === link.profileId) {
          void pushLinkedFile({
            wsId,
            conn: active.conn,
            localPath: path,
            link,
            mode: "auto",
          }).then((sent) => {
            if (sent) toastSuccess(`↥ Auto-pushed → ${link.remotePath}`);
          });
        }
      }
      return true;
    },

    handlePathRenamed: (wsId, oldPath, newPath) => {
      const ws = get().loaded[wsId];
      if (!ws) return;
      const normOld = oldPath.replace(/\\/g, "/").toLowerCase();
      // A renamed DIRECTORY re-keys every open buffer underneath it,
      // matching separators loosely (tree paths are OS-native, reveal
      // paths forward-slash).
      const mapPath = (p: string): string | null => {
        if (pathsEqual(p, oldPath)) return newPath;
        const norm = p.replace(/\\/g, "/").toLowerCase();
        if (norm.startsWith(normOld + "/")) {
          return newPath + p.slice(oldPath.length);
        }
        return null;
      };
      const renames: [string, string][] = [];
      for (const p of Object.keys(ws.files)) {
        const np = mapPath(p);
        if (np) renames.push([p, np]);
      }
      if (renames.length === 0) return;
      const keyMap = new Map(
        renames.map(([o, n]) => [fileKey(o), fileKey(n)]),
      );
      updateWs(wsId, (w) => {
        const files: typeof w.files = {};
        for (const [p, f] of Object.entries(w.files)) {
          files[mapPath(p) ?? p] = f;
        }
        const renamePane = (pane: Pane): Pane =>
          mapTree(pane, (t) => ({
            ...t,
            tabs: t.tabs.map((k) => keyMap.get(k) ?? k),
            active: t.active ? (keyMap.get(t.active) ?? t.active) : t.active,
          }));
        return {
          ...w,
          files,
          layout: {
            ...w.layout,
            editorRoot: renamePane(w.layout.editorRoot),
            bottomRoot: w.layout.bottomRoot
              ? renamePane(w.layout.bottomRoot)
              : null,
            pinned: w.layout.pinned.map((k) => keyMap.get(k) ?? k),
          },
        };
      });
      // The old-path models are orphans now; the re-keyed tabs create
      // fresh models at the new URI from the (preserved) buffer.
      for (const [o] of renames) disposeModelForPath(o);
    },

    saveAllFiles: async (wsId) => {
      const ws = get().loaded[wsId];
      if (!ws) return;
      const dirty = Object.entries(ws.files).filter(
        ([, f]) => f.contents !== f.original,
      );
      await Promise.all(dirty.map(([p]) => get().saveFile(wsId, p)));
    },

    toggleDir: (wsId, path) =>
      updateWs(wsId, (w) => {
        const cur = w.layout.expandedDirs;
        // Normalize-aware: reveal-in-tree stores forward-slash paths
        // while tree clicks store the OS-native form. Exact matching
        // would leave a phantom variant behind and make the folder
        // impossible to collapse.
        const next = cur.some((p) => pathsEqual(p, path))
          ? cur.filter((p) => !pathsEqual(p, path))
          : [...cur, path];
        return { ...w, layout: { ...w.layout, expandedDirs: next } };
      }),

    setSidebarW: (wsId, w) =>
      updateWs(wsId, (x) => ({ ...x, layout: { ...x.layout, sidebarW: w } })),

    setTermH: (wsId, h) =>
      updateWs(wsId, (x) => ({ ...x, layout: { ...x.layout, termH: h } })),

    setBottomVisible: (wsId, v) =>
      updateWs(wsId, (w) => ({
        ...w,
        layout: { ...w.layout, bottomVisible: v },
      })),

    setSidebarVisible: (wsId, v) =>
      updateWs(wsId, (w) => ({
        ...w,
        layout: { ...w.layout, sidebarVisible: v },
      })),

    setSidebarView: (wsId, v) =>
      updateWs(wsId, (w) => {
        // Activate the section: ensure it exists and isn't collapsed.
        const sections = w.layout.sidebarSections.slice();
        const idx = sections.findIndex((s) => s.view === v);
        if (idx === -1) {
          sections.push({ view: v, collapsed: false, size: 1 });
        } else {
          sections[idx] = { ...sections[idx], collapsed: false };
        }
        return {
          ...w,
          layout: { ...w.layout, sidebarView: v, sidebarSections: sections },
        };
      }),

    toggleSidebarSection: (wsId, view) =>
      updateWs(wsId, (w) => {
        const sections = w.layout.sidebarSections.slice();
        const idx = sections.findIndex((s) => s.view === view);
        if (idx === -1) {
          sections.push({ view, collapsed: false, size: 1 });
        } else {
          sections.splice(idx, 1);
        }
        // No remaining sections → collapse the whole sidebar so the user
        // gets back the editor real estate. Re-clicking any activity-bar
        // button will re-show it (see switchView in ActivityBar).
        const sidebarVisible =
          sections.length === 0 ? false : w.layout.sidebarVisible;
        return {
          ...w,
          layout: { ...w.layout, sidebarSections: sections, sidebarVisible },
        };
      }),

    removeSidebarSection: (wsId, view) =>
      updateWs(wsId, (w) => {
        const sections = w.layout.sidebarSections.filter(
          (s) => s.view !== view,
        );
        const sidebarVisible =
          sections.length === 0 ? false : w.layout.sidebarVisible;
        return {
          ...w,
          layout: { ...w.layout, sidebarSections: sections, sidebarVisible },
        };
      }),

    collapseSidebarSection: (wsId, view, collapsed) =>
      updateWs(wsId, (w) => {
        const sections = w.layout.sidebarSections.map((s) =>
          s.view === view ? { ...s, collapsed } : s,
        );
        return { ...w, layout: { ...w.layout, sidebarSections: sections } };
      }),

    setSidebarSectionSize: (wsId, view, size) =>
      updateWs(wsId, (w) => {
        const clamped = Math.max(0.1, Math.min(10, size));
        const sections = w.layout.sidebarSections.map((s) =>
          s.view === view ? { ...s, size: clamped } : s,
        );
        return { ...w, layout: { ...w.layout, sidebarSections: sections } };
      }),

    setSidebarSide: (wsId, side) =>
      updateWs(wsId, (w) => ({
        ...w,
        layout: { ...w.layout, sidebarSide: side },
      })),

    setAIPanelVisible: (wsId, visible) =>
      updateWs(wsId, (w) => ({
        ...w,
        layout: { ...w.layout, aiPanelVisible: visible },
      })),

    setAIPanelW: (wsId, w) =>
      updateWs(wsId, (ws) => ({
        ...ws,
        layout: {
          ...ws.layout,
          aiPanelW: Math.max(220, Math.min(800, w)),
        },
      })),

    setAIRailExpanded: (wsId, expanded) =>
      updateWs(wsId, (w) => ({
        ...w,
        layout: { ...w.layout, aiRailExpanded: expanded },
      })),

    reorderSidebarSection: (wsId, view, beforeView) =>
      updateWs(wsId, (w) => {
        const next = w.layout.sidebarSections.slice();
        const fromIdx = next.findIndex((s) => s.view === view);
        if (fromIdx === -1) return w;
        const [moved] = next.splice(fromIdx, 1);
        let toIdx = next.length;
        if (beforeView) {
          const i = next.findIndex((s) => s.view === beforeView);
          if (i !== -1) toIdx = i;
        }
        next.splice(toIdx, 0, moved);
        return { ...w, layout: { ...w.layout, sidebarSections: next } };
      }),

    addTerminal: (wsId, location = "bottom", shell) => {
      // No explicit shell → the user's configured default (Settings →
      // Terminal), falling back to the system default when unset.
      if (!shell) shell = resolveDefaultShell();
      const id = makeTermId();
      const k = termKey(id);
      const existing = Object.keys(get().loaded[wsId]?.terminals ?? {}).length;
      const baseTitle = shell?.label ?? "Terminal";
      const title = `${baseTitle} ${existing + 1}`;
      updateWs(wsId, (w) => {
        const terminals = {
          ...w.terminals,
          [id]: { id, title, shell },
        };
        let editorRoot = w.layout.editorRoot;
        let bottomRoot = w.layout.bottomRoot;
        let activePaneId = w.layout.activePaneId;
        if (location === "editor") {
          const targetPaneId =
            (activePaneId && isInTree(editorRoot, activePaneId) && activePaneId) ||
            firstLeaf(editorRoot).id;
          editorRoot = mapTree(editorRoot, (t) =>
            t.id === targetPaneId
              ? { ...t, tabs: [...t.tabs, k], active: k }
              : t,
          );
          activePaneId = targetPaneId;
        } else {
          if (!bottomRoot) {
            bottomRoot = {
              kind: "tabs",
              id: makePaneId(),
              tabs: [k],
              active: k,
            };
          } else {
            const leafId = firstLeaf(bottomRoot).id;
            bottomRoot = mapTree(bottomRoot, (t) =>
              t.id === leafId
                ? { ...t, tabs: [...t.tabs, k], active: k }
                : t,
            );
          }
        }
        return {
          ...w,
          terminals,
          layout: {
            ...w.layout,
            editorRoot,
            bottomRoot,
            activePaneId,
            bottomVisible:
              location === "bottom" ? true : w.layout.bottomVisible,
          },
        };
      });
      return id;
    },

    setTerminalPtyId: (wsId, termId, ptyId) =>
      updateWs(wsId, (w) => {
        const t = w.terminals[termId];
        if (!t) return w;
        return {
          ...w,
          terminals: { ...w.terminals, [termId]: { ...t, ptyId } },
        };
      }),

    setTerminalPopped: (wsId, termId, popped) =>
      updateWs(wsId, (w) => {
        const t = w.terminals[termId];
        if (!t) return w;
        return {
          ...w,
          terminals: { ...w.terminals, [termId]: { ...t, popped } },
        };
      }),

    closeTerminal: (wsId, id) => {
      const ws = get().loaded[wsId];
      const desc = ws?.terminals[id];
      if (desc?.ptyId) {
        void ptyApi.kill(desc.ptyId).catch(() => {});
      }
      // If a pop-out window is hosting this terminal, close it too. The PTY
      // is already being killed above, so the popout's TerminalCore will see
      // the exit event regardless.
      void closePopoutWindow(id).catch(() => {});
      updateWs(wsId, (w) => {
        const k = termKey(id);
        const { [id]: _drop, ...restT } = w.terminals;
        const er = removeTabFromTree(w.layout.editorRoot, k);
        const editorRoot: Pane = er.tree ?? emptyTabsPane();
        let bottomRoot = w.layout.bottomRoot;
        if (bottomRoot) {
          const br = removeTabFromTree(bottomRoot, k);
          bottomRoot = pruneEmptyTabsPanes(br.tree);
        }
        const activePaneId =
          w.layout.activePaneId &&
          (isInTree(editorRoot, w.layout.activePaneId) ||
            (bottomRoot ? isInTree(bottomRoot, w.layout.activePaneId) : false))
            ? w.layout.activePaneId
            : firstLeaf(editorRoot).id;
        return {
          ...w,
          terminals: restT,
          layout: { ...w.layout, editorRoot, bottomRoot, activePaneId },
        };
      });
    },

    addAIChat: (wsId, location = "editor") => {
      const id = makeAIChatId();
      const k = aiKey(id);
      const existing = Object.values(get().loaded[wsId]?.aiChats ?? {});
      const title = existing.length === 0 ? "AI Chat" : `AI Chat ${existing.length + 1}`;
      // createdAt must always be larger than every existing chat so a
      // freshly-created chat appears at the bottom of the rail. Don't
      // rely on Date.now() alone — drag-reorder may have pushed an
      // older chat past `now` to slot it last.
      const maxCreated = existing.reduce(
        (acc, c) => (c.createdAt > acc ? c.createdAt : acc),
        0,
      );
      const desc: AIChatDescriptor = {
        id,
        title,
        sessionId: id,
        createdAt: Math.max(Date.now(), maxCreated + 1),
      };
      updateWs(wsId, (w) => {
        const aiChats = { ...w.aiChats, [id]: desc };
        let editorRoot = w.layout.editorRoot;
        let bottomRoot = w.layout.bottomRoot;
        let activePaneId = w.layout.activePaneId;
        if (location === "bottom") {
          if (!bottomRoot) {
            bottomRoot = {
              kind: "tabs",
              id: makePaneId(),
              tabs: [k],
              active: k,
            };
          } else {
            const leafId = firstLeaf(bottomRoot).id;
            bottomRoot = mapTree(bottomRoot, (t) =>
              t.id === leafId
                ? { ...t, tabs: [...t.tabs, k], active: k }
                : t,
            );
          }
        } else {
          const targetPaneId =
            (activePaneId && isInTree(editorRoot, activePaneId) && activePaneId) ||
            firstLeaf(editorRoot).id;
          editorRoot = mapTree(editorRoot, (t) =>
            t.id === targetPaneId
              ? { ...t, tabs: [...t.tabs, k], active: k }
              : t,
          );
          activePaneId = targetPaneId;
        }
        return {
          ...w,
          aiChats,
          layout: {
            ...w.layout,
            editorRoot,
            bottomRoot,
            activePaneId,
            bottomVisible:
              location === "bottom" ? true : w.layout.bottomVisible,
          },
        };
      });
      return id;
    },

    focusAIChat: (wsId, id) => {
      const ws = get().loaded[wsId];
      if (!ws || !ws.aiChats[id]) return;
      const k = aiKey(id);
      updateWs(wsId, (w) => {
        const inEditor = findTabsPaneByTab(w.layout.editorRoot, k);
        if (inEditor) {
          return {
            ...w,
            layout: {
              ...w.layout,
              editorRoot: setActiveInPane(w.layout.editorRoot, inEditor.id, k),
              activePaneId: inEditor.id,
            },
          };
        }
        const inBottom = w.layout.bottomRoot
          ? findTabsPaneByTab(w.layout.bottomRoot, k)
          : null;
        if (inBottom && w.layout.bottomRoot) {
          return {
            ...w,
            layout: {
              ...w.layout,
              bottomRoot: setActiveInPane(w.layout.bottomRoot, inBottom.id, k),
              activePaneId: inBottom.id,
              bottomVisible: true,
            },
          };
        }
        // Tab was closed but the descriptor survives — reopen it in the
        // active editor pane.
        const targetPaneId =
          (w.layout.activePaneId &&
            isInTree(w.layout.editorRoot, w.layout.activePaneId) &&
            w.layout.activePaneId) ||
          firstLeaf(w.layout.editorRoot).id;
        return {
          ...w,
          layout: {
            ...w.layout,
            editorRoot: mapTree(w.layout.editorRoot, (t) =>
              t.id === targetPaneId
                ? {
                    ...t,
                    tabs: t.tabs.includes(k) ? t.tabs : [...t.tabs, k],
                    active: k,
                  }
                : t,
            ),
            activePaneId: targetPaneId,
          },
        };
      });
    },

    openSubagent: (wsId, sessionId, toolUseId, agentType) => {
      const k = subKey(sessionId, toolUseId, agentType);
      updateWs(wsId, (w) => {
        // Already open somewhere? Focus that pane + tab instead of duping.
        let foundPane: PaneId | null = null;
        mapTree(w.layout.editorRoot, (t) => {
          if (t.tabs.includes(k)) foundPane = t.id;
          return t;
        });
        if (foundPane) {
          return {
            ...w,
            layout: {
              ...w.layout,
              activePaneId: foundPane,
              editorRoot: mapTree(w.layout.editorRoot, (t) =>
                t.id === foundPane ? { ...t, active: k } : t,
              ),
            },
          };
        }
        const targetPaneId =
          (w.layout.activePaneId &&
            isInTree(w.layout.editorRoot, w.layout.activePaneId) &&
            w.layout.activePaneId) ||
          firstLeaf(w.layout.editorRoot).id;
        return {
          ...w,
          layout: {
            ...w.layout,
            activePaneId: targetPaneId,
            editorRoot: mapTree(w.layout.editorRoot, (t) =>
              t.id === targetPaneId
                ? { ...t, tabs: [...t.tabs, k], active: k }
                : t,
            ),
          },
        };
      });
    },

    wbOpen: (wsId) => {
      const k = wbKey(wsId);
      updateWs(wsId, (w) => {
        // Already open? Focus the pane + tab instead of duping.
        let foundPane: PaneId | null = null;
        mapTree(w.layout.editorRoot, (t) => {
          if (t.tabs.includes(k)) foundPane = t.id;
          return t;
        });
        if (foundPane) {
          return {
            ...w,
            layout: {
              ...w.layout,
              activePaneId: foundPane,
              editorRoot: mapTree(w.layout.editorRoot, (t) =>
                t.id === foundPane ? { ...t, active: k } : t,
              ),
            },
          };
        }
        const targetPaneId =
          (w.layout.activePaneId &&
            isInTree(w.layout.editorRoot, w.layout.activePaneId) &&
            w.layout.activePaneId) ||
          firstLeaf(w.layout.editorRoot).id;
        return {
          ...w,
          layout: {
            ...w.layout,
            activePaneId: targetPaneId,
            editorRoot: mapTree(w.layout.editorRoot, (t) =>
              t.id === targetPaneId
                ? { ...t, tabs: [...t.tabs, k], active: k }
                : t,
            ),
          },
        };
      });
    },

    // Same focus-or-append shape as wbOpen (singleton per-workspace tab).
    usageOpen: (wsId) => {
      const k = usageKey(wsId);
      updateWs(wsId, (w) => {
        let foundPane: PaneId | null = null;
        mapTree(w.layout.editorRoot, (t) => {
          if (t.tabs.includes(k)) foundPane = t.id;
          return t;
        });
        if (foundPane) {
          return {
            ...w,
            layout: {
              ...w.layout,
              activePaneId: foundPane,
              editorRoot: mapTree(w.layout.editorRoot, (t) =>
                t.id === foundPane ? { ...t, active: k } : t,
              ),
            },
          };
        }
        const targetPaneId =
          (w.layout.activePaneId &&
            isInTree(w.layout.editorRoot, w.layout.activePaneId) &&
            w.layout.activePaneId) ||
          firstLeaf(w.layout.editorRoot).id;
        return {
          ...w,
          layout: {
            ...w.layout,
            activePaneId: targetPaneId,
            editorRoot: mapTree(w.layout.editorRoot, (t) =>
              t.id === targetPaneId
                ? { ...t, tabs: [...t.tabs, k], active: k }
                : t,
            ),
          },
        };
      });
    },

    sessionOpen: (wsId, project, sessionId) => {
      const k = sessionKey(project, sessionId);
      updateWs(wsId, (w) => {
        // Already open? Just focus the existing tab.
        let foundPane: PaneId | null = null;
        mapTree(w.layout.editorRoot, (t) => {
          if (t.tabs.includes(k)) foundPane = t.id;
          return t;
        });
        if (foundPane) {
          return {
            ...w,
            layout: {
              ...w.layout,
              activePaneId: foundPane,
              editorRoot: mapTree(w.layout.editorRoot, (t) =>
                t.id === foundPane ? { ...t, active: k } : t,
              ),
            },
          };
        }
        const targetPaneId =
          (w.layout.activePaneId &&
            isInTree(w.layout.editorRoot, w.layout.activePaneId) &&
            w.layout.activePaneId) ||
          firstLeaf(w.layout.editorRoot).id;
        return {
          ...w,
          layout: {
            ...w.layout,
            activePaneId: targetPaneId,
            editorRoot: mapTree(w.layout.editorRoot, (t) =>
              t.id === targetPaneId
                ? { ...t, tabs: [...t.tabs, k], active: k }
                : t,
            ),
          },
        };
      });
    },

    sessionClose: (wsId, project, sessionId) => {
      const k = sessionKey(project, sessionId);
      updateWs(wsId, (w) => {
        // Remove the tab from every pane that holds it (usually one).
        const editorRoot = mapTree(w.layout.editorRoot, (t) =>
          t.tabs.includes(k)
            ? {
                ...t,
                tabs: t.tabs.filter((x) => x !== k),
                active: t.active === k ? (t.tabs[0] ?? null) : t.active,
              }
            : t,
        );
        const bottomRoot = w.layout.bottomRoot
          ? mapTree(w.layout.bottomRoot, (t) =>
              t.tabs.includes(k)
                ? {
                    ...t,
                    tabs: t.tabs.filter((x) => x !== k),
                    active:
                      t.active === k ? (t.tabs[0] ?? null) : t.active,
                  }
                : t,
            )
          : null;
        return {
          ...w,
          layout: { ...w.layout, editorRoot, bottomRoot },
        };
      });
    },

    closeAIChat: (wsId, id) => {
      updateWs(wsId, (w) => {
        const k = aiKey(id);
        const { [id]: _drop, ...restAi } = w.aiChats;
        void _drop;
        const er = removeTabFromTree(w.layout.editorRoot, k);
        const editorRoot: Pane = er.tree ?? emptyTabsPane();
        let bottomRoot = w.layout.bottomRoot;
        if (bottomRoot) {
          const br = removeTabFromTree(bottomRoot, k);
          bottomRoot = pruneEmptyTabsPanes(br.tree);
        }
        const activePaneId =
          w.layout.activePaneId &&
          (isInTree(editorRoot, w.layout.activePaneId) ||
            (bottomRoot ? isInTree(bottomRoot, w.layout.activePaneId) : false))
            ? w.layout.activePaneId
            : firstLeaf(editorRoot).id;
        return {
          ...w,
          aiChats: restAi,
          layout: { ...w.layout, editorRoot, bottomRoot, activePaneId },
        };
      });
      clearChatDiff(id);
    },

    setAIChatTitle: (wsId, id, title) =>
      updateWs(wsId, (w) => {
        const desc = w.aiChats[id];
        if (!desc) return w;
        return {
          ...w,
          aiChats: { ...w.aiChats, [id]: { ...desc, title } },
        };
      }),

    renameAIChat: (wsId, id, title) =>
      updateWs(wsId, (w) => {
        const desc = w.aiChats[id];
        if (!desc) return w;
        return {
          ...w,
          aiChats: {
            ...w.aiChats,
            [id]: { ...desc, title, titleLocked: true },
          },
        };
      }),

    setAIChatLifecycle: (wsId, id, state) =>
      updateWs(wsId, (w) => {
        const desc = w.aiChats[id];
        if (!desc) return w;
        const next = { ...desc };
        // Mutually exclusive timestamps — a chat is active, done, OR
        // archived, never two at once.
        delete next.doneAt;
        delete next.archivedAt;
        if (state === "done") next.doneAt = Date.now();
        else if (state === "archived") next.archivedAt = Date.now();
        return { ...w, aiChats: { ...w.aiChats, [id]: next } };
      }),

    setAIChatSession: (wsId, id, sessionId) =>
      updateWs(wsId, (w) => {
        const desc = w.aiChats[id];
        if (!desc) return w;
        return {
          ...w,
          aiChats: { ...w.aiChats, [id]: { ...desc, sessionId } },
        };
      }),

    setAIChatModel: (wsId, id, model) =>
      updateWs(wsId, (w) => {
        const desc = w.aiChats[id];
        if (!desc || desc.model === model) return w;
        return {
          ...w,
          aiChats: { ...w.aiChats, [id]: { ...desc, model } },
        };
      }),

    touchFile: (wsId, path) => {
      touchInMap(fileLastTouched, wsId, path);
    },

    touchTerminal: (wsId, termId) => {
      touchInMap(terminalLastTouched, wsId, termId);
    },

    unloadIdleFile: (wsId, path) => {
      const ws = get().loaded[wsId];
      if (!ws) return;
      const f = ws.files[path];
      if (!f) return;
      // Never drop unsaved edits.
      if (f.contents !== f.original) return;
      // Never drop a file the user is currently looking at. We check
      // every leaf pane in both editor and bottom roots — a tab can be
      // visible in only one pane at a time, but the user might have
      // multiple panes with different active tabs.
      const visible = new Set<string>();
      collectActiveTabs(ws.layout.editorRoot, visible);
      collectActiveTabs(ws.layout.bottomRoot, visible);
      if (visible.has(fileKey(path))) return;
      set((s) => {
        const w = s.loaded[wsId];
        if (!w || !w.files[path]) return s;
        const { [path]: _drop, ...rest } = w.files;
        void _drop;
        return {
          loaded: { ...s.loaded, [wsId]: { ...w, files: rest } },
        };
      });
      // Drop the per-path tracker so the next open-and-touch starts
      // from a fresh clock instead of inheriting an ancient timestamp.
      fileLastTouched.get(wsId)?.delete(path);
      // Buffer unloaded → free the Monaco model (and its undo stack)
      // as well; that's most of the memory the sweeper exists to claw
      // back. Re-opening re-reads from disk anyway.
      disposeModelForPath(path);
    },

    reorderAIChat: (wsId, id, beforeId) =>
      updateWs(wsId, (w) => {
        const desc = w.aiChats[id];
        if (!desc) return w;
        if (beforeId === id) return w;
        const sorted = Object.values(w.aiChats)
          .filter((c) => c.id !== id)
          .sort((a, b) => a.createdAt - b.createdAt);
        // Compute the createdAt slot for `id`:
        //   - beforeId is null  → after the last remaining chat
        //   - beforeId matches  → halfway between target's predecessor and target
        //   - beforeId unknown  → no-op
        let newCreated: number;
        if (beforeId === null) {
          const last = sorted[sorted.length - 1];
          newCreated = last ? last.createdAt + 1000 : Date.now();
        } else {
          const targetIdx = sorted.findIndex((c) => c.id === beforeId);
          if (targetIdx < 0) return w;
          const target = sorted[targetIdx];
          const prev = sorted[targetIdx - 1];
          newCreated = prev
            ? (prev.createdAt + target.createdAt) / 2
            : target.createdAt - 1000;
        }
        if (newCreated === desc.createdAt) return w;
        return {
          ...w,
          aiChats: {
            ...w.aiChats,
            [id]: { ...desc, createdAt: newCreated },
          },
        };
      }),
  };
});

// -------- Idle sweeper --------
//
// Runs once a minute (cheap) and reads footprint settings live, so a
// user toggling "drop idle buffers" in Settings sees the next sweep
// honor the new value without an app restart. Lives at module scope so
// there's exactly one sweeper regardless of how many components mount;
// the `typeof window` guard keeps it out of any non-DOM contexts (SSR
// / unit tests).
function runIdleSweep(): void {
  const settings = getFootprintSettings();
  if (
    !settings.idleBufferUnloadEnabled &&
    !settings.idleTerminalCloseEnabled
  ) {
    return;
  }
  const now = Date.now();
  const fileTtl = settings.idleBufferUnloadMinutes * 60_000;
  const termTtl = settings.idleTerminalCloseMinutes * 60_000;
  const state = useStore.getState();
  for (const [wsId, ws] of Object.entries(state.loaded)) {
    if (settings.idleBufferUnloadEnabled) {
      const visible = new Set<string>();
      collectActiveTabs(ws.layout.editorRoot, visible);
      collectActiveTabs(ws.layout.bottomRoot, visible);
      const fileTouches = fileLastTouched.get(wsId);
      for (const [path, f] of Object.entries(ws.files)) {
        if (f.contents !== f.original) continue; // never touch dirty
        if (visible.has(fileKey(path))) continue; // never touch visible
        // Files we've never seen a touch for get treated as "touched
        // at workspace load" — bootstrap their timestamp now so the
        // first sweep doesn't immediately unload everything that was
        // hydrated from disk.
        let last = fileTouches?.get(path);
        if (last === undefined) {
          touchInMap(fileLastTouched, wsId, path);
          last = now;
        }
        if (now - last > fileTtl) {
          state.unloadIdleFile(wsId, path);
        }
      }
    }
    if (settings.idleTerminalCloseEnabled) {
      const termTouches = terminalLastTouched.get(wsId);
      for (const [termId, term] of Object.entries(ws.terminals)) {
        // Popped-out terminals live in another window — their activity
        // never reaches this window's touch map, so without this guard
        // the sweeper kills a shell the user is actively typing in.
        if (term.popped) continue;
        let last = termTouches?.get(termId);
        if (last === undefined) {
          touchInMap(terminalLastTouched, wsId, termId);
          last = now;
        }
        if (now - last > termTtl) {
          state.closeTerminal(wsId, termId);
          terminalLastTouched.get(wsId)?.delete(termId);
        }
      }
    }
  }
}

if (typeof window !== "undefined") {
  setInterval(runIdleSweep, 60_000);
}

// ---- External-edit sync for ALL open buffers --------------------------
//
// The core "claude in a terminal edits my files" workflow: EditorPane
// already watches the ACTIVE tab (it can prompt in context), but
// background buffers got nothing — switch away from a tab, let the AI
// rewrite the file, switch back, Ctrl+S, and the AI's work was silently
// clobbered. This listener covers every open buffer:
//   - clean buffers silently adopt the on-disk content (the editor
//     always shows what the AI just wrote);
//   - dirty BACKGROUND buffers get a one-time warning toast — the hard
//     guard lives in saveFile, which re-checks the disk before writing
//     (dirty ACTIVE buffers keep EditorPane's interactive prompt).
const externalDirtyWarned = new Set<string>();

function syncBufferWithDisk(wsId: string, path: string) {
  void (async () => {
    let onDisk: string;
    try {
      onDisk = await fsApi.readFile(path);
    } catch {
      // Deleted / unreadable — the close/save flows surface that.
      return;
    }
    const ws = useStore.getState().loaded[wsId];
    const cur = ws?.files[path];
    if (!ws || !cur) return;
    if (onDisk === cur.contents) {
      // Disk caught up with the buffer (or never differed). If the
      // buffer was "dirty" only relative to a stale original, sync the
      // dirty-tracker so the dot clears.
      if (onDisk !== cur.original) {
        useStore.setState((s) => {
          const w = s.loaded[wsId];
          if (!w || !w.files[path]) return s;
          return {
            loaded: {
              ...s.loaded,
              [wsId]: {
                ...w,
                files: {
                  ...w.files,
                  [path]: { contents: onDisk, original: onDisk },
                },
              },
            },
          };
        });
      }
      externalDirtyWarned.delete(path);
      return;
    }
    if (cur.contents === cur.original) {
      // Clean — adopt the external edit. The mounted editor (if any)
      // syncs via the value prop with undo preserved.
      useStore.setState((s) => {
        const w = s.loaded[wsId];
        const f = w?.files[path];
        // Re-check cleanliness: a keystroke may have landed during the
        // disk read.
        if (!w || !f || f.contents !== f.original) return s;
        return {
          loaded: {
            ...s.loaded,
            [wsId]: {
              ...w,
              files: {
                ...w.files,
                [path]: { contents: onDisk, original: onDisk },
              },
            },
          },
        };
      });
      externalDirtyWarned.delete(path);
      return;
    }
    // Dirty + disk diverged. The active tab gets EditorPane's prompt;
    // for background tabs, warn once — saveFile's disk guard does the
    // actual protecting.
    const visible = new Set<string>();
    collectActiveTabs(ws.layout.editorRoot, visible);
    collectActiveTabs(ws.layout.bottomRoot, visible);
    if (!visible.has(fileKey(path)) && !externalDirtyWarned.has(path)) {
      externalDirtyWarned.add(path);
      toastWarning(
        `${basename(path)} changed on disk while you have unsaved edits — saving will ask before overwriting.`,
      );
    }
  })();
}

if (typeof window !== "undefined") {
  fsBus.addEventListener("ws", (ev) => {
    const detail = (ev as CustomEvent).detail as {
      wsId: string;
      dirs: string[];
    };
    const ws = useStore.getState().loaded[detail.wsId];
    if (!ws) return;
    for (const path of Object.keys(ws.files)) {
      const parent = dirname(path);
      if (detail.dirs.some((d) => pathsEqual(d, parent))) {
        syncBufferWithDisk(detail.wsId, path);
      }
    }
  });
}
