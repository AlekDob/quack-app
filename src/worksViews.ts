import type { WorkItem, WorkStatus } from "./works";

export type WorksSidebarView =
  | "all"
  | "backlog"
  | "todo"
  | "in_progress"
  | "done"
  | "cancelled"
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
  items: WorkItem[],
  view: WorksSidebarView,
): number {
  if (view === "modules") return 0;
  return filterItemsByView(items, view).length;
}
