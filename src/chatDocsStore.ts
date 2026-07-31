// Documentation (.md / .mmd) touched by an agent turn, per chat. Feeds the
// Agent Mode "Docs" context tab: AIChatPanel publishes on every `messages`
// change so the tab appears as soon as a doc shows up in the stream.

import type { ChatMessage } from "./ai";
import { pathOf } from "./components/chatToolRender";

export interface ChatDoc {
  /** Path exactly as the tool reported it (absolute or workspace-relative). */
  path: string;
  /** True when the agent wrote/edited it (vs only read it). */
  edited: boolean;
}

const DOC_RE = /\.(md|mmd)$/i;
const WRITE_TOOLS = new Set([
  "Edit",
  "Write",
  "MultiEdit",
  "NotebookEdit",
  "edit_file",
  "edit",
  "write",
  "create_file",
]);

const docsByChat = new Map<string, ChatDoc[]>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

/** Collect .md/.mmd paths from every tool call in the transcript, in order. */
export function collectChatDocs(messages: ChatMessage[]): ChatDoc[] {
  const byPath = new Map<string, ChatDoc>();
  for (const m of messages) {
    if (m.role !== "assistant" || !m.tool_calls) continue;
    for (const c of m.tool_calls) {
      const path = pathOf(c);
      if (!path || path === "(unknown)" || !DOC_RE.test(path)) continue;
      const edited = WRITE_TOOLS.has(c.function.name);
      const prev = byPath.get(path);
      // A write anywhere in the chat wins over a read-only mention.
      if (prev) prev.edited = prev.edited || edited;
      else byPath.set(path, { path, edited });
    }
  }
  return [...byPath.values()];
}

function sameDocs(a: ChatDoc[], b: ChatDoc[]): boolean {
  if (a.length !== b.length) return false;
  return a.every(
    (d, i) => d.path === b[i].path && d.edited === b[i].edited,
  );
}

export function publishChatDocs(chatId: string, docs: ChatDoc[]): void {
  // Dedupe: the publish effect runs on every `messages` change but notify()
  // re-renders the context column; skip the fan-out when nothing changed.
  const prev = docsByChat.get(chatId);
  if (prev && sameDocs(prev, docs)) return;
  docsByChat.set(chatId, docs);
  notify();
}

export function getChatDocs(chatId: string | null): ChatDoc[] {
  if (!chatId) return [];
  return docsByChat.get(chatId) ?? [];
}

export function clearChatDocs(chatId: string): void {
  if (!docsByChat.delete(chatId)) return;
  notify();
}

export function subscribeChatDocs(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}
