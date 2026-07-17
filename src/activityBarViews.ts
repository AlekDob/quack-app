import type { IconName } from "./components/Icon";
import type { SidebarView } from "./store";

export type ActivityBarIconId =
  | "files"
  | "search"
  | "git"
  | "tasks"
  | "works"
  | "outline"
  | "bookmarks"
  | "remote"
  | "store"
  | "usage"
  | "brain"
  | "whiteboard";

export type ActivityBarIconKind = "sidebar" | "tab";

export interface ActivityBarViewDef {
  id: ActivityBarIconId;
  label: string;
  title: string;
  icon: IconName;
  kind: ActivityBarIconKind;
  /** Sidebar section key when kind === "sidebar". */
  sidebarView?: SidebarView;
  /** Tab key prefix when kind === "tab". */
  tabPrefix?: string;
  showGitBadge?: boolean;
}

export const ACTIVITY_BAR_ICON_IDS: ActivityBarIconId[] = [
  "files",
  "search",
  "git",
  "tasks",
  "works",
  "outline",
  "bookmarks",
  "remote",
  "store",
  "usage",
  "brain",
  "whiteboard",
];

export const DEFAULT_ACTIVITY_BAR_ORDER: ActivityBarIconId[] = [
  ...ACTIVITY_BAR_ICON_IDS,
];

export const DEFAULT_VISIBLE_COUNT = 8;

export const ACTIVITY_BAR_VIEWS: Record<ActivityBarIconId, ActivityBarViewDef> = {
  files: {
    id: "files",
    label: "Explorer",
    title: "Explorer (Ctrl+Shift+E) — click to toggle section",
    icon: "folder",
    kind: "sidebar",
    sidebarView: "files",
  },
  search: {
    id: "search",
    label: "Search",
    title: "Search (Ctrl+Shift+F) — full text search across the workspace",
    icon: "search",
    kind: "sidebar",
    sidebarView: "search",
  },
  git: {
    id: "git",
    label: "Source Control",
    title: "Source Control (Ctrl+Shift+G) — click to toggle section",
    icon: "git-branch",
    kind: "sidebar",
    sidebarView: "git",
    showGitBadge: true,
  },
  tasks: {
    id: "tasks",
    label: "Tasks",
    title: "Tasks (npm scripts) — click to toggle section",
    icon: "play",
    kind: "sidebar",
    sidebarView: "tasks",
  },
  outline: {
    id: "outline",
    label: "Outline",
    title: "Outline — symbols defined in the active editor file",
    icon: "file-text",
    kind: "sidebar",
    sidebarView: "outline",
  },
  bookmarks: {
    id: "bookmarks",
    label: "Bookmarks",
    title: "Bookmarks — pinned files for quick access",
    icon: "star",
    kind: "sidebar",
    sidebarView: "bookmarks",
  },
  remote: {
    id: "remote",
    label: "Remote SFTP",
    title: "Remote (SFTP) — click to toggle section. Manage connections in Settings.",
    icon: "cloud",
    kind: "sidebar",
    sidebarView: "remote",
  },
  store: {
    id: "store",
    label: "Quack Store",
    title: "Quack Store — optional brain extensions (opens as a tab)",
    icon: "store",
    kind: "tab",
    tabPrefix: "store:",
  },
  usage: {
    id: "usage",
    label: "Usage",
    title: "Usage — live Claude Code session + cost monitor (opens as a tab)",
    icon: "chart-bar",
    kind: "tab",
    tabPrefix: "usage:",
  },
  brain: {
    id: "brain",
    label: "Quack Brain",
    title: "Quack Brain — knowledge + skill extensions (opens as a tab)",
    icon: "brain",
    kind: "tab",
    tabPrefix: "brain:",
  },
  whiteboard: {
    id: "whiteboard",
    label: "Team",
    title: "Team — agents + skills runbook (⌘P → Open Team)",
    icon: "users",
    kind: "tab",
    tabPrefix: "wb:",
  },
  works: {
    id: "works",
    label: "Features",
    title: "Features — product component docs (Ctrl+Alt+T)",
    icon: "check-square",
    kind: "tab",
    tabPrefix: "works:",
  },
};

export function getActivityBarView(id: ActivityBarIconId): ActivityBarViewDef {
  return ACTIVITY_BAR_VIEWS[id];
}

export type BarIconSegment =
  | { kind: "icon"; id: ActivityBarIconId }
  | { kind: "sep" };

/** Insert separators when sidebar vs tab launcher kinds alternate. */
export function barIconSegments(ids: ActivityBarIconId[]): BarIconSegment[] {
  const out: BarIconSegment[] = [];
  let prev: ActivityBarIconKind | null = null;
  for (const id of ids) {
    const next = getActivityBarView(id).kind;
    if (prev !== null && prev !== next) out.push({ kind: "sep" });
    out.push({ kind: "icon", id });
    prev = next;
  }
  return out;
}

const isIconId = (v: unknown): v is ActivityBarIconId =>
  typeof v === "string" && v in ACTIVITY_BAR_VIEWS;

const LEGACY_ICON_IDS: Record<string, ActivityBarIconId> = {
  todos: "works",
};

export function normalizeActivityBarOrder(order: unknown): ActivityBarIconId[] {
  const raw = Array.isArray(order)
    ? order
        .filter((v): v is string => typeof v === "string")
        .map((v) => LEGACY_ICON_IDS[v] ?? v)
        .filter(isIconId)
    : [];
  const seen = new Set<ActivityBarIconId>();
  const next: ActivityBarIconId[] = [];
  for (const id of raw) {
    if (seen.has(id)) continue;
    seen.add(id);
    next.push(id);
  }
  for (const id of ACTIVITY_BAR_ICON_IDS) {
    if (!seen.has(id)) next.push(id);
  }
  return next;
}
