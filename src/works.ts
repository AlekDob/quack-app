// Works layer — typed project-management tickets (Plane-inspired).

import type { WorksSidebarView } from "./worksViews";

export type WorkOrigin = "plan" | "hotfix" | "manual" | "agent" | "sync";
export type WorkStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "done"
  | "cancelled";
export type WorkPriority = "urgent" | "high" | "medium" | "low";
export type WorksLayout = "list" | "kanban" | "timeline";
export type WorksGroupBy = "status" | "module";

export type WorkBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "bullet"; items: string[] }
  | { type: "ordered"; items: string[] }
  | { type: "checklist"; items: { text: string; done: boolean }[] }
  | { type: "code"; lang?: string; text: string }
  | { type: "divider" }
  | { type: "tech_refs"; text: string };

export interface WorkLabel {
  id: string;
  name: string;
  color: string;
}

export interface WorkModule {
  id: string;
  name: string;
  color?: string;
  /** Stable slug from documentation/features/{slug}.md */
  featureSlug?: string;
  /** Workspace-relative path, e.g. documentation/features/054-works-layer.md */
  featurePath?: string;
  /** Numeric prefix from filename, e.g. 54 from 054-works-layer.md */
  featureNum?: number;
}

export interface WorkCycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: CycleStatus;
  /** Auto-generated ISO week cycles vs user-created. */
  auto: boolean;
}

export type CycleStatus = "upcoming" | "active" | "completed";

export type StoryStatus = "draft" | "active" | "done";

export interface WorkStory {
  id: string;
  shortId: string;
  /** Workspace-relative path, e.g. works/stories/S-001.md */
  filePath: string;
  title: string;
  moduleId: string;
  cycleId?: string;
  status: StoryStatus;
  /** Markdown body — loaded from filePath; omitted in persisted snapshot. */
  bodyMd?: string;
  /** Extra Brain doc paths from frontmatter `refs:` (loaded from .md). */
  brainRefs?: string[];
  /** Docs opted out of context inject (still on disk; module unchanged). */
  contextExcludedRefs?: string[];
  /** Chat sessions linked while planning this story. */
  linkedChatIds: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WorkComment {
  id: string;
  workItemId: string;
  author: string;
  body: string;
  createdAt: number;
  source?: "human" | "agent" | "sync";
}

export interface WorkItem {
  id: string;
  shortId: string;
  /** Workspace-relative path, e.g. works/items/W-001.md */
  filePath: string;
  moduleId: string;
  parentId?: string;
  title: string;
  origin: WorkOrigin;
  /** Markdown body — loaded from filePath; omitted in persisted snapshot. */
  bodyMd?: string;
  /** @deprecated v1 — migrated to bodyMd on hydrate. */
  descriptionBlocks?: WorkBlock[];
  status: WorkStatus;
  priority: WorkPriority;
  labelIds: string[];
  cycleId?: string;
  startDate?: string;
  targetDate?: string;
  linkedChatIds: string[];
  planApprovedAt?: number;
  planeIssueId?: string;
  agentReady?: boolean;
  comments: WorkComment[];
  createdAt: number;
  updatedAt: number;
  /** Extra Brain doc paths from frontmatter `refs:` (loaded from .md). */
  brainRefs?: string[];
  /** Docs opted out of context inject (still on disk; module unchanged). */
  contextExcludedRefs?: string[];
}

export interface WorksViewPrefs {
  layout: WorksLayout;
  groupBy: WorksGroupBy;
  activeModuleId?: string;
  /** Plane-style sidebar view (status filters + modules catalog). */
  sidebarView?: WorksSidebarView;
  /** Selected cycle in the Cycles view. */
  activeCycleId?: string;
}

export interface WorksSnapshot {
  version: 1 | 2 | 3;
  labels: WorkLabel[];
  modules: WorkModule[];
  cycles: WorkCycle[];
  stories: WorkStory[];
  items: WorkItem[];
  viewPrefs: WorksViewPrefs;
  nextSeq: number;
  nextStorySeq: number;
}

export const DEFAULT_MODULES: Omit<WorkModule, "id">[] = [
  { name: "Bug" },
  { name: "DevOps" },
  { name: "Agent / AI" },
  { name: "Authoring" },
  { name: "Product / UX" },
  { name: "Feature" },
];

export const HOTFIX_LABEL = "hotfix";

export function newId(): string {
  return crypto.randomUUID();
}

export function emptySnapshot(): WorksSnapshot {
  return {
    version: 3,
    labels: [
      { id: newId(), name: HOTFIX_LABEL, color: "semantic-warning" },
    ],
    modules: [],
    cycles: [],
    stories: [],
    items: [],
    viewPrefs: { layout: "list", groupBy: "status" },
    nextSeq: 1,
    nextStorySeq: 1,
  };
}

/** Backfill labels missing from early snapshots. Modules sync from feature docs. */
export function normalizeWorksSnapshot(snap: WorksSnapshot): {
  snap: WorksSnapshot;
  changed: boolean;
} {
  let changed = false;
  const labels = [...snap.labels];
  if (!labels.some((l) => l.name === HOTFIX_LABEL)) {
    labels.push({
      id: newId(),
      name: HOTFIX_LABEL,
      color: "semantic-warning",
    });
    changed = true;
  }
  if (!changed) return { snap, changed: false };
  return { snap: { ...snap, labels }, changed: true };
}

export function moduleByName(
  snap: WorksSnapshot,
  name: string,
): WorkModule | undefined {
  return snap.modules.find(
    (m) => m.name.toLowerCase() === name.toLowerCase(),
  );
}

export function moduleByFeatureSlug(
  snap: WorksSnapshot,
  slug: string,
): WorkModule | undefined {
  const q = slug.toLowerCase();
  return snap.modules.find((m) => m.featureSlug?.toLowerCase() === q);
}

export function blocksToPlainText(blocks: WorkBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "paragraph" || b.type === "heading") return b.text;
      if (b.type === "tech_refs") return b.text;
      if (b.type === "code") return b.text;
      if (b.type === "bullet" || b.type === "ordered") return b.items.join("\n");
      if (b.type === "checklist") {
        return b.items.map((i) => `${i.done ? "[x]" : "[ ]"} ${i.text}`).join("\n");
      }
      return "";
    })
    .filter(Boolean)
    .join("\n\n");
}

export function planTextToBlocks(plan: string): WorkBlock[] {
  const trimmed = plan.trim();
  if (!trimmed) return [];
  return trimmed.split(/\n{2,}/).map((p) => ({
    type: "paragraph" as const,
    text: p.trim(),
  }));
}

export function nextShortId(snap: WorksSnapshot): string {
  const n = snap.nextSeq;
  return `W-${String(n).padStart(3, "0")}`;
}

export function nextStoryShortId(snap: WorksSnapshot): string {
  const n = snap.nextStorySeq;
  return `S-${String(n).padStart(3, "0")}`;
}

export function bumpStorySeq(snap: WorksSnapshot): WorksSnapshot {
  return { ...snap, nextStorySeq: snap.nextStorySeq + 1 };
}

export function bumpSeq(snap: WorksSnapshot): WorksSnapshot {
  return { ...snap, nextSeq: snap.nextSeq + 1 };
}

export function findStoryByShortId(
  snap: WorksSnapshot,
  shortId: string,
): WorkStory | undefined {
  const q = shortId.toUpperCase();
  return snap.stories.find((s) => s.shortId.toUpperCase() === q);
}

export function findWork(snap: WorksSnapshot, id: string): WorkItem | undefined {
  return snap.items.find((w) => w.id === id);
}

export function findStory(snap: WorksSnapshot, id: string): WorkStory | undefined {
  return snap.stories.find((s) => s.id === id);
}

export function findCycle(snap: WorksSnapshot, id: string): WorkCycle | undefined {
  return snap.cycles.find((c) => c.id === id);
}

export function childrenOfStory(snap: WorksSnapshot, storyId: string): WorkItem[] {
  return snap.items.filter((w) => w.parentId === storyId);
}

export function storyLabel(status: StoryStatus): string {
  const map: Record<StoryStatus, string> = {
    draft: "Draft",
    active: "Active",
    done: "Done",
  };
  return map[status];
}

export function cycleStatusLabel(status: CycleStatus): string {
  const map: Record<CycleStatus, string> = {
    upcoming: "Upcoming",
    active: "Active",
    completed: "Completed",
  };
  return map[status];
}

export function statusLabel(status: WorkStatus): string {
  const map: Record<WorkStatus, string> = {
    backlog: "Backlog",
    todo: "Todo",
    in_progress: "In progress",
    done: "Done",
    cancelled: "Cancelled",
  };
  return map[status];
}

export function priorityDotClass(p: WorkPriority): string {
  if (p === "urgent") return "works-priority-urgent";
  if (p === "high") return "works-priority-high";
  if (p === "medium") return "works-priority-medium";
  return "works-priority-low";
}
