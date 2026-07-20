/** Gradual full-cover loader when picking / switching a chat or session.
 *
 * A module-level pulse the chat hosts render as a fading translucent veil
 * (`ChatSwitchVeil`). The point is PERCEIVED smoothness: even a now-fast
 * switch shows a brief, graceful wash instead of a hard content pop.
 *
 * Timing:
 *  - on pulse → `switching = true` immediately (veil fades in),
 *  - `endChatSwitch()` ends after an adaptive floor (short when hydrate
 *    was instant; no padding when hydrate already took ≥ floor),
 *  - a CAP timer ends it regardless, in case hydration never signals.
 */

import {
  flushAllChatPersist,
  flushWorkspaceChatPersist,
} from "./chatPersistFlush";
import { logChatSwitch } from "./chatSwitchDebug";

// Warm / empty / cache-hit: just long enough for the fade-in to register
// (~FADE_MS 160). A fixed 320ms floor made 9ms switches feel slow (086).
const MIN_VISIBLE_FAST_MS = 160;
// Soft floor when hydrate took a little but still under this.
const MIN_VISIBLE_MS = 220;
// Hard fallback: drop the veil after this even if `endChatSwitch` never fires.
const CAP_MS = 1000;

/** How long the veil should stay up given hydrate elapsed so far. */
export function veilFloorMs(elapsedMs: number): number {
  if (elapsedMs <= 60) return MIN_VISIBLE_FAST_MS;
  if (elapsedMs >= MIN_VISIBLE_MS) return elapsedMs;
  return MIN_VISIBLE_MS;
}

export type ChatSwitchOpts = {
  /** Show the veil — the gradual loader. Default true (incl. new chat). */
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

/** Pulse target chat — Agent Mode keeps this host mounted during the veil. */
export function getChatSwitchTarget(): string | null {
  return targetChatId;
}

/** Refresh the CAP timer — call when hydrate actually starts so a dense
 *  flushSync paint can exceed the original 1s window without the veil
 *  disappearing mid-commit (Audit: hydrate done 1437ms after CAP at 1000). */
export function noteChatSwitchProgress(): void {
  if (!switching) return;
  if (capTimer) clearTimeout(capTimer);
  capTimer = setTimeout(() => finish("cap"), CAP_MS);
}

/** Drop the veil once the target panel has hydrated — after the adaptive floor. */
export function endChatSwitch(source = "unknown", chatId?: string): void {
  if (!switching) return;
  if (targetChatId && chatId && chatId !== targetChatId) {
    logChatSwitch("end ignored", { source, chatId, targetChatId });
    return;
  }
  const elapsed = Date.now() - startedAt;
  const floor = veilFloorMs(elapsed);
  const remain = Math.max(0, floor - elapsed);
  logChatSwitch("end scheduled", {
    source,
    elapsedMs: elapsed,
    remainMs: remain,
    floorMs: floor,
    pulseSource: lastSource,
  });
  if (endTimer) clearTimeout(endTimer);
  // remain 0 must finish SYNCHRONOUSLY. setTimeout(0) sat behind multi-second
  // main-thread work in production (Audit: end scheduled 249ms → veil down
  // 4928ms) while the loader stayed up for nothing.
  if (remain <= 0) {
    finish(`end:${source}`);
    return;
  }
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
  // veil:false clears a prior pulse without starting a new one (rare; most
  // callers want the loader). Sticky hosts otherwise stay `!is-visible` until CAP.
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
