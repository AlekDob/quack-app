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
import { logChatSwitch } from "./chatSwitchDebug";

// Graceful floor: keep the veil up at least this long so even an instant switch
// clearly shows the loader (the user wants a minimum always visible). The freeze
// is fixed, so this is pure perceived-smoothness polish.
const MIN_VISIBLE_MS = 320;
// Hard fallback: drop the veil after this even if `endChatSwitch` never fires.
const CAP_MS = 1000;

export type ChatSwitchOpts = {
  /** Show the veil — the gradual loader. Only skip for empty/new chats. */
  veil?: boolean;
  /** Sync-flush mounted panels before switch. Off for same-workspace tab hops. */
  flush?: boolean;
  /** Flush mounted panels for one workspace (cheaper than all). */
  flushWsId?: string;
  /** Caller label for console perf trace. */
  source?: string;
  /** Only this chat tab may call `endChatSwitch` for this pulse. */
  chatId?: string;
};

let switching = false;
let startedAt = 0;
let lastSource = "";
let targetChatId: string | null = null;
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

function finish(reason: string) {
  clearTimers();
  if (!switching) return;
  const elapsedMs = Date.now() - startedAt;
  switching = false;
  targetChatId = null;
  notify();
  logChatSwitch("veil down", { reason, source: lastSource, elapsedMs });
}

export function isChatSwitching(): boolean {
  return switching;
}

/** Drop the veil once the target panel has hydrated — after the MIN floor. */
export function endChatSwitch(source = "unknown", chatId?: string): void {
  if (!switching) return;
  if (targetChatId && chatId && chatId !== targetChatId) {
    logChatSwitch("end ignored", { source, chatId, targetChatId });
    return;
  }
  const elapsed = Date.now() - startedAt;
  const remain = Math.max(0, MIN_VISIBLE_MS - elapsed);
  logChatSwitch("end scheduled", {
    source,
    elapsedMs: elapsed,
    remainMs: remain,
    pulseSource: lastSource,
  });
  if (endTimer) clearTimeout(endTimer);
  endTimer = setTimeout(() => finish(`end:${source}`), remain);
}

export function pulseChatSwitch(opts: ChatSwitchOpts = {}): void {
  const { veil = true, flush = false, flushWsId, source = "unknown", chatId } =
    opts;
  lastSource = source;
  targetChatId = chatId ?? null;
  logChatSwitch("pulse", {
    source,
    veil,
    flush,
    flushWsId: flushWsId ?? null,
    chatId: targetChatId,
  });
  if (flush) {
    if (flushWsId) flushWorkspaceChatPersist(flushWsId, source);
    else flushAllChatPersist();
  }
  // New/empty chats skip the veil — but must still clear a prior pulse,
  // otherwise sticky hosts stay `!is-visible` until CAP and look "missing".
  if (!veil) {
    if (switching) finish(`veil-skipped:${source}`);
    return;
  }
  clearTimers();
  startedAt = Date.now();
  if (!switching) {
    switching = true;
    notify();
  }
  capTimer = setTimeout(() => finish("cap"), CAP_MS);
}

export function subscribeChatSwitch(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
