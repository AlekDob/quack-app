// Transient "name this session" prompt — anchored near whichever New chat
// control created the tab. Pub/sub (not Zustand): UI-only, not persisted.

export interface NewChatNameRequest {
  wsId: string;
  chatId: string;
  anchor: { x: number; y: number };
}

let pending: NewChatNameRequest | null = null;
const listeners = new Set<(req: NewChatNameRequest | null) => void>();

function notify() {
  for (const l of listeners) l(pending);
}

export function openNewChatNamePrompt(req: NewChatNameRequest): void {
  pending = req;
  notify();
}

export function closeNewChatNamePrompt(): void {
  if (!pending) return;
  pending = null;
  notify();
}

export function getNewChatNamePrompt(): NewChatNameRequest | null {
  return pending;
}

export function subscribeNewChatNamePrompt(
  fn: (req: NewChatNameRequest | null) => void,
): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
