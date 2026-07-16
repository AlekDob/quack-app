/** Gradual full-cover loader when picking / switching a chat or session.
 *
 * A module-level pulse the chat hosts render as a fading translucent veil
 * (`ChatSwitchVeil`). The point is PERCEIVED smoothness: even a now-fast
 * switch shows a brief, graceful wash instead of a hard content pop.
 *
 * Timing:
 *  - on pulse → `switching = true` immediately (veil fades in),
 *  - `endChatSwitch()` (called when the target panel has hydrated) ends the
 *    pulse only after a MIN floor, so a sub-floor hydration still fades
 *    gently rather than flashing,
 *  - a CAP timer ends it regardless, in case hydration never signals.
 */

import {
  flushAllChatPersist,
  flushWorkspaceChatPersist,
} from "./chatPersistFlush";

// Graceful floor: keep the veil up at least this long so a fast switch still
// reads as a smooth transition. Kept short — the freeze is fixed, this is polish.
const MIN_VISIBLE_MS = 240;
// Hard fallback: drop the veil after this even if `endChatSwitch` never fires.
const CAP_MS = 1000;

export type ChatSwitchOpts = {
  /** Show the veil — the gradual loader. Only skip for empty/new chats. */
  veil?: boolean;
  /** Flush mounted panels for one workspace (cheaper than all). */
  flushWsId?: string;
};

let switching = false;
let startedAt = 0;
let capTimer: ReturnType<typeof setTimeout> | null = null;
let endTimer: ReturnType<typeof setTimeout> | null = null;
const subs = new Set<() => void>();

function notify() {
  subs.forEach((fn) => fn());
}

function clearTimers() {
  if (capTimer) clearTimeout(capTimer);
  if (endTimer) clearTimeout(endTimer);
  capTimer = null;
  endTimer = null;
}

function finish() {
  clearTimers();
  if (!switching) return;
  switching = false;
  notify();
}

export function isChatSwitching(): boolean {
  return switching;
}

/** Drop the veil once the target panel has hydrated — after the MIN floor. */
export function endChatSwitch(): void {
  if (!switching) return;
  const remain = Math.max(0, MIN_VISIBLE_MS - (Date.now() - startedAt));
  if (endTimer) clearTimeout(endTimer);
  endTimer = setTimeout(finish, remain);
}

export function pulseChatSwitch(opts: ChatSwitchOpts = {}): void {
  const { veil = true, flushWsId } = opts;
  if (flushWsId) flushWorkspaceChatPersist(flushWsId);
  else flushAllChatPersist();
  if (!veil) return;
  clearTimers();
  startedAt = Date.now();
  if (!switching) {
    switching = true;
    notify();
  }
  capTimer = setTimeout(finish, CAP_MS);
}

export function subscribeChatSwitch(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
