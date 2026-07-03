// Per-chat diff summary for the Agent Hub subtitle. AIChatPanel
// publishes live; the hub hydrates from disk for background chats.

import { loadSessions } from "./chatHistory";
import {
  summarizeLastTurn,
  type SessionDiffSummary,
} from "./sessionDiffStats";

const diffByChat = new Map<string, SessionDiffSummary | null>();
const hydrated = new Set<string>();
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

export function publishChatDiff(
  chatId: string,
  summary: SessionDiffSummary | null,
): void {
  diffByChat.set(chatId, summary);
  hydrated.add(chatId);
  notify();
}

export function getChatDiff(
  chatId: string,
): SessionDiffSummary | null | undefined {
  if (!diffByChat.has(chatId)) return undefined;
  return diffByChat.get(chatId) ?? null;
}

/** Load from chat history when the hub first sees a chat. */
export function hydrateChatDiff(
  chatId: string,
  wsId: string,
  sessionId: string,
): void {
  if (hydrated.has(chatId)) return;
  hydrated.add(chatId);
  const session = loadSessions(wsId).find((s) => s.id === sessionId);
  diffByChat.set(
    chatId,
    session ? summarizeLastTurn(session.messages) : null,
  );
  notify();
}

export function clearChatDiff(chatId: string): void {
  const had = diffByChat.delete(chatId) || hydrated.delete(chatId);
  if (!had) return;
  notify();
}

export function subscribeChatDiff(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export type { SessionDiffSummary };
