/** Brief full-bleed veil when picking / creating a chat (agent + editor). */

import { flushAllChatPersist } from "./chatPersistFlush";

const CHAT_SWITCH_MS = 500;

let switching = false;
let timer: ReturnType<typeof setTimeout> | null = null;
const subs = new Set<() => void>();

function notify() {
  subs.forEach((fn) => fn());
}

export function isChatSwitching(): boolean {
  return switching;
}

export function pulseChatSwitch(): void {
  flushAllChatPersist();
  if (timer) clearTimeout(timer);
  switching = true;
  notify();
  const hideAt = Date.now() + CHAT_SWITCH_MS;
  // Two rAFs so WKWebView paints the veil before we start the hide timer
  // (release builds are fast enough to skip a visible frame otherwise).
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
