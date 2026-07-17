// Per-chat open/pin state for the story plan drawer (not persisted).

const pinnedByKey = new Map<string, boolean>();
const listeners = new Set<() => void>();

function drawerKey(wsId: string, chatId: string): string {
  return `${wsId}|${chatId}`;
}

function notify(): void {
  for (const l of listeners) l();
}

export function isStoryPlanDrawerPinned(
  wsId: string,
  chatId: string,
): boolean {
  return pinnedByKey.get(drawerKey(wsId, chatId)) ?? false;
}

export function pinStoryPlanDrawer(wsId: string, chatId: string): void {
  const k = drawerKey(wsId, chatId);
  if (pinnedByKey.get(k)) return;
  pinnedByKey.set(k, true);
  notify();
}

export function unpinStoryPlanDrawer(wsId: string, chatId: string): void {
  const k = drawerKey(wsId, chatId);
  if (!pinnedByKey.delete(k)) return;
  notify();
}

export function toggleStoryPlanDrawer(wsId: string, chatId: string): void {
  if (isStoryPlanDrawerPinned(wsId, chatId)) {
    unpinStoryPlanDrawer(wsId, chatId);
  } else {
    pinStoryPlanDrawer(wsId, chatId);
  }
}

export function subscribeStoryPlanDrawer(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
