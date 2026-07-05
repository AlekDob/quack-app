import type { ChatSession } from "./chatHistory";
import { loadSessions, saveSession } from "./chatHistory";

/** Ephemeral composer UI restored when returning to a chat session. */
export interface ChatComposerDraft {
  input?: string;
  queue?: string[];
  attachTree?: boolean;
  attachTerminal?: boolean;
  attachedAgents?: string[];
  /** Disk paths only — thumbnails rebuilt on restore. */
  attachedImages?: Array<{ id: string; path: string; name: string }>;
}

function isEmptyDraft(d: ChatComposerDraft): boolean {
  return (
    !d.input &&
    !d.queue?.length &&
    !d.attachTree &&
    !d.attachTerminal &&
    !d.attachedAgents?.length &&
    !d.attachedImages?.length
  );
}

export function draftFromSession(
  session: ChatSession | undefined,
): ChatComposerDraft {
  return session?.composer ?? {};
}

export function mergeComposerDraft(
  wsId: string,
  sessionId: string,
  draft: ChatComposerDraft,
): void {
  const found = loadSessions(wsId).find((s) => s.id === sessionId);
  const composer = isEmptyDraft(draft) ? undefined : draft;
  if (!found) {
    saveSession(wsId, {
      id: sessionId,
      title: "Untitled",
      messages: [],
      updatedAt: Date.now(),
      composer,
    });
    return;
  }
  saveSession(wsId, { ...found, composer, updatedAt: Date.now() });
}
