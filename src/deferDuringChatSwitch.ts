// Queue work that would fight the chat-switch veil (file-tree listDir,
// etc.) and drain it once when the pulse ends — one listener for the
// whole app instead of one per tree Node.

import { isChatSwitching, subscribeChatSwitch } from "./chatSwitch";

const pending = new Map<string, () => void>();
let listening = false;

function ensureListen(): void {
  if (listening) return;
  listening = true;
  subscribeChatSwitch(() => {
    if (isChatSwitching()) return;
    const batch = [...pending.values()];
    pending.clear();
    for (const fn of batch) fn();
  });
}

/** Run `fn` now, or once (keyed) when the chat-switch veil drops. */
export function runOrDeferDuringChatSwitch(
  key: string,
  fn: () => void,
): void {
  if (!isChatSwitching()) {
    fn();
    return;
  }
  pending.set(key, fn);
  ensureListen();
}
