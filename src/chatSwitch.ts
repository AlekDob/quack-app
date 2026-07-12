/** Brief full-bleed veil when picking / creating a chat (agent + editor). */

import {
  flushAllChatPersist,
  flushWorkspaceChatPersist,
} from "./chatPersistFlush";

const CHAT_SWITCH_MS = 280;

export type ChatSwitchOpts = {
  /** Full-bleed veil — only for cross-project / cold mounts. */
  veil?: boolean;
  /** Flush mounted panels for one workspace (cheaper than all). */
  flushWsId?: string;
};

let switching = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const subs = new Set<() => void>();

function notify() {
  subs.forEach((fn) => fn());
}

function clearVeilTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

export function isChatSwitching(): boolean {
  return switching;
}

/** Drop the veil as soon as the target panel has hydrated. */
export function endChatSwitch(): void {
  if (!switching) return;
  clearVeilTimer();
  switching = false;
  notify();
}

export function pulseChatSwitch(opts: ChatSwitchOpts = {}): void {
  const { veil = true, flushWsId } = opts;
  if (flushWsId) flushWorkspaceChatPersist(flushWsId);
  else flushAllChatPersist();
  if (!veil) return;
  clearVeilTimer();
  switching = true;
  notify();
  const hideAt = Date.now() + CHAT_SWITCH_MS;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      const remain = Math.max(0, hideAt - Date.now());
      timer = setTimeout(() => {
        timer = null;
        switching = false;
        notify();
      }, remain);
    });
  });
}

export function subscribeChatSwitch(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
