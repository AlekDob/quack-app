import type { IconName } from "./components/Icon";
import type { WorkPriority, WorkStatus } from "./works";

export function workStatusIcon(status: WorkStatus): IconName {
  const map: Record<WorkStatus, IconName> = {
    backlog: "circle",
    todo: "check-square",
    in_progress: "play",
    done: "check-circle",
    cancelled: "x-circle",
  };
  return map[status];
}

export function workPriorityIcon(priority: WorkPriority): IconName {
  const map: Record<WorkPriority, IconName> = {
    urgent: "alert-triangle",
    high: "zap",
    medium: "minus",
    low: "arrow-down-circle",
  };
  return map[priority];
}

export function workPriorityLabel(priority: WorkPriority): string {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}
