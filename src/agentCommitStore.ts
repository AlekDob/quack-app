// Per-chat agent commit snapshot for the composer dock. Keyed by
// workspace + session so switching chats shows the right indicator.

export type AgentCommitSnapshot = {
  message: string;
  hash: string | null;
  shortHash: string | null;
  /** Wall-clock ms when we detected the commit. */
  at: number;
  pushed: boolean;
};

const byKey = new Map<string, AgentCommitSnapshot>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function commitKey(wsId: string, sessionId: string): string {
  return `${wsId}:${sessionId}`;
}

export function publishAgentCommit(
  key: string,
  snap: AgentCommitSnapshot,
): void {
  byKey.set(key, snap);
  notify();
}

export function markAgentCommitPushed(key: string): void {
  const cur = byKey.get(key);
  if (!cur || cur.pushed) return;
  byKey.set(key, { ...cur, pushed: true });
  notify();
}

export function getAgentCommit(key: string): AgentCommitSnapshot | null {
  return byKey.get(key) ?? null;
}

export function clearAgentCommit(key: string): void {
  if (!byKey.delete(key)) return;
  notify();
}

export function subscribeAgentCommit(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
