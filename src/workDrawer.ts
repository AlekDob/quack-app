// App-level work-item drawer — same pattern as toolDrawer.ts / ToolResultDrawer.

import { closeFeatureDocDrawer } from "./featureDocDrawer";
import { closeStoryDrawer } from "./storyDrawer";
import type { WorkOrigin, WorkPriority, WorkStatus } from "./works";

export interface WorkCreateDraft {
  title?: string;
  origin?: WorkOrigin;
  status?: WorkStatus;
  priority?: WorkPriority;
  bodyMd?: string;
  labelIds?: string[];
  startDate?: string;
  targetDate?: string;
  moduleId?: string;
}

export type WorkDrawerRequest =
  | { wsId: string; root: string; workId: string }
  | { wsId: string; root: string; create: true; draft?: WorkCreateDraft };

type Listener = (req: WorkDrawerRequest | null) => void;

let current: WorkDrawerRequest | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l(current);
}

export function isWorkDrawerCreate(
  req: WorkDrawerRequest,
): req is Extract<WorkDrawerRequest, { create: true }> {
  return "create" in req && req.create;
}

export function openWorkDrawer(
  req: Extract<WorkDrawerRequest, { workId: string }>,
): void {
  closeFeatureDocDrawer();
  closeStoryDrawer();
  current = req;
  emit();
}

export function openWorkCreateDrawer(
  req: Omit<Extract<WorkDrawerRequest, { create: true }>, "create">,
): void {
  closeFeatureDocDrawer();
  closeStoryDrawer();
  current = { ...req, create: true };
  emit();
}

export function closeWorkDrawer(): void {
  if (!current) return;
  current = null;
  emit();
}

export function getWorkDrawer(): WorkDrawerRequest | null {
  return current;
}

export function subscribeWorkDrawer(cb: Listener): () => void {
  listeners.add(cb);
  cb(current);
  return () => listeners.delete(cb);
}
