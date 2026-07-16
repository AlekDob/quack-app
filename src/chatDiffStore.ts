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
  // Dedupe: AIChatPanel republishes on every `messages` change, but notify()
  // re-renders the whole Agent Hub rail (every row + WorkHubBadge). Skip the
  // fan-out when the summary is unchanged. Summary is small ({added,removed,
  // files}), so a serialized compare is cheap and stable.
  const had = hydrated.has(chatId);
  const prev = diffByChat.get(chatId);
  diffByChat.set(chatId, summary);
  hydrated.add(chatId);
  if (had && sameDiff(prev ?? null, summary)) return;
  notify();
}

function sameDiff(
  a: SessionDiffSummary | null,
  b: SessionDiffSummary | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return (
    a.added === b.added &&
    a.removed === b.removed &&
    a.files.length === b.files.length &&
    a.files.every((f, i) => f === b.files[i])
  );
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
