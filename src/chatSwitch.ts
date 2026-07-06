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
  timer = setTimeout(() => {
    timer = null;
    switching = false;
    notify();
  }, CHAT_SWITCH_MS);
}

export function subscribeChatSwitch(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}
