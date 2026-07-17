/** Registry so chat switches flush in-flight transcripts before unmount. */

import { logChatSwitch } from "./chatSwitchDebug";

type Entry = { wsId: string; flush: () => void };

const entries = new Map<string, Entry>();

export function registerChatPersist(
  key: string,
  wsId: string,
  flush: () => void,
): () => void {
  entries.set(key, { wsId, flush });
  return () => {
    entries.get(key)?.flush();
    entries.delete(key);
  };
}

export function flushAllChatPersist(): void {
  const t0 = performance.now();
  let count = 0;
  for (const e of entries.values()) {
    e.flush();
    count++;
  }
  logChatSwitch("flush all", {
    count,
    elapsedMs: Math.round(performance.now() - t0),
  });
}

export function flushWorkspaceChatPersist(wsId: string, source = "unknown"): void {
  const t0 = performance.now();
  let count = 0;
  for (const e of entries.values()) {
    if (e.wsId === wsId) {
      e.flush();
      count++;
    }
  }
  if (count > 0) {
    const elapsedMs = Math.round(performance.now() - t0);
    logChatSwitch("flush workspace", { source, wsId, count, elapsedMs });
  }
}
