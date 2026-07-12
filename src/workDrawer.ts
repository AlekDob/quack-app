// App-level work-item drawer — same pattern as toolDrawer.ts / ToolResultDrawer.

import { closeFeatureDocDrawer } from "./featureDocDrawer";

export interface WorkDrawerRequest {
  wsId: string;
  root: string;
  workId: string;
}

type Listener = (req: WorkDrawerRequest | null) => void;

let current: WorkDrawerRequest | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l(current);
}

export function openWorkDrawer(req: WorkDrawerRequest): void {
  closeFeatureDocDrawer();
  current = req;
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
