// Cached AskUserQuestion tool_input from the PreToolUse hook. The hook
// always receives the full payload even when the streamed tool_call args
// in the transcript are empty or still partial — the dock reads here as a
// fallback so the question card never sits on a spinner forever.

const bySession = new Map<string, Record<string, unknown>>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Permission overlay publishes when AskUserQuestion hits the hook. */
export function publishAskInput(
  sessionId: string,
  input: Record<string, unknown>,
): void {
  bySession.set(sessionId, input);
  notify();
}

export function clearAskInput(sessionId: string): void {
  if (bySession.delete(sessionId)) notify();
}

export function getAskInput(
  sessionId: string | null | undefined,
): Record<string, unknown> | null {
  if (!sessionId) return null;
  return bySession.get(sessionId) ?? null;
}

export function subscribeAskInput(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
