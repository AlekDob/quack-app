// Pub/sub for "stop this chat's in-flight turn" without prop drilling.
// CLI providers (Claude Code, Cursor) are killed on the Rust side by
// session id; HTTP providers (Anthropic, OpenAI, Ollama) need
// the mounted AIChatPanel to abort its AbortController — this bus covers
// that second path. Also fired on archive / done / close so panels that
// are still mounted get a clean UI reset.

type Listener = (chatId: string) => void;

const listeners = new Set<Listener>();

export function requestChatStop(chatId: string): void {
  for (const l of listeners) l(chatId);
}

export function onChatStopRequest(cb: Listener): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
