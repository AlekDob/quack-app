// App-level feature-doc drawer — preview documentation/features/*.md.

import { closeWorkDrawer } from "./workDrawer";

export interface FeatureDocDrawerRequest {
  wsId: string;
  root: string;
  /** Workspace-relative path, e.g. documentation/features/054-works-layer.md */
  featurePath: string;
  title: string;
  featureNum?: number;
}

type Listener = (req: FeatureDocDrawerRequest | null) => void;

let current: FeatureDocDrawerRequest | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l(current);
}

export function openFeatureDocDrawer(req: FeatureDocDrawerRequest): void {
  closeWorkDrawer();
  current = req;
  emit();
}

export function closeFeatureDocDrawer(): void {
  if (!current) return;
  current = null;
  emit();
}

export function getFeatureDocDrawer(): FeatureDocDrawerRequest | null {
  return current;
}

export function subscribeFeatureDocDrawer(
  cb: Listener,
): () => void {
  listeners.add(cb);
  cb(current);
  return () => listeners.delete(cb);
}
