// App-level story drawer — mirrors workDrawer.ts.

import { closeFeatureDocDrawer } from "./featureDocDrawer";
import { closeWorkDrawer } from "./workDrawer";
import type { StoryStatus } from "./works";

export interface StoryCreateDraft {
  title?: string;
  moduleId?: string;
  cycleId?: string;
  status?: StoryStatus;
  bodyMd?: string;
}

export type StoryDrawerRequest =
  | { wsId: string; root: string; storyId: string }
  | { wsId: string; root: string; create: true; draft?: StoryCreateDraft };

type Listener = (req: StoryDrawerRequest | null) => void;

let current: StoryDrawerRequest | null = null;
const listeners = new Set<Listener>();

function emit(): void {
  for (const l of listeners) l(current);
}

export function isStoryDrawerCreate(
  req: StoryDrawerRequest,
): req is Extract<StoryDrawerRequest, { create: true }> {
  return "create" in req && req.create;
}

export function openStoryDrawer(
  req: Extract<StoryDrawerRequest, { storyId: string }>,
): void {
  closeFeatureDocDrawer();
  closeWorkDrawer();
  current = req;
  emit();
}

export function openStoryCreateDrawer(
  req: Omit<Extract<StoryDrawerRequest, { create: true }>, "create">,
): void {
  closeFeatureDocDrawer();
  closeWorkDrawer();
  current = { ...req, create: true };
  emit();
}

export function closeStoryDrawer(): void {
  if (!current) return;
  current = null;
  emit();
}

export function getStoryDrawer(): StoryDrawerRequest | null {
  return current;
}

export function subscribeStoryDrawer(cb: Listener): () => void {
  listeners.add(cb);
  cb(current);
  return () => listeners.delete(cb);
}
