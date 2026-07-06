/** Registry so chat switches flush in-flight transcripts before unmount. */

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
  for (const e of entries.values()) e.flush();
}

export function flushWorkspaceChatPersist(wsId: string): void {
  for (const e of entries.values()) {
    if (e.wsId === wsId) e.flush();
  }
}
