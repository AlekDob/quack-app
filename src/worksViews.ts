import type { WorkItem, WorkStatus, WorksSnapshot } from "./works";

export type WorksSidebarView =
  | "all"
  | "backlog"
  | "todo"
  | "in_progress"
  | "done"
  | "cancelled"
  | "cycles"
  | "stories"
  | "modules";

export interface WorksSidebarViewDef {
  id: WorksSidebarView;
  label: string;
  status?: WorkStatus;
  separatorBefore?: boolean;
}

export const WORKS_SIDEBAR_VIEWS: WorksSidebarViewDef[] = [
  { id: "all", label: "All work items" },
  { id: "in_progress", label: "In progress", status: "in_progress" },
  { id: "todo", label: "Todo", status: "todo" },
  { id: "backlog", label: "Backlog", status: "backlog" },
  { id: "done", label: "Completed", status: "done" },
  { id: "cancelled", label: "Cancelled", status: "cancelled" },
  { id: "cycles", label: "Cycles", separatorBefore: true },
  { id: "stories", label: "Stories" },
  { id: "modules", label: "Modules", separatorBefore: true },
];

export function worksViewLabel(id: WorksSidebarView): string {
  return WORKS_SIDEBAR_VIEWS.find((v) => v.id === id)?.label ?? id;
}

export function filterItemsByView(
  items: WorkItem[],
  view: WorksSidebarView,
): WorkItem[] {
  const def = WORKS_SIDEBAR_VIEWS.find((v) => v.id === view);
  if (!def?.status) return items;
  return items.filter((w) => w.status === def.status);
}

export function countForView(
  snap: WorksSnapshot | null,
  view: WorksSidebarView,
): number {
  if (!snap) return 0;
  if (view === "modules") return 0;
  if (view === "cycles") return snap.cycles.length;
  if (view === "stories") return snap.stories.length;
  return filterItemsByView(snap.items, view).length;
}

export function isCatalogView(view: WorksSidebarView): boolean {
  return view === "modules" || view === "cycles" || view === "stories";
}
