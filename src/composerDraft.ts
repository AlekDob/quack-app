import type { ChatSession } from "./chatHistory";
import { patchSession } from "./chatHistory";

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
): boolean {
  const composer = isEmptyDraft(draft) ? undefined : draft;
  return patchSession(wsId, sessionId, { composer });
}

/** Persist Claude Code knobs (+ active preset) without touching messages / composer. */
export function mergeSessionKnobs(
  wsId: string,
  sessionId: string,
  knobs: {
    ccEffort?: string;
    ccThinking?: boolean | null;
    ccPermMode?: string | null;
    presetId?: string;
  },
): boolean {
  return patchSession(wsId, sessionId, knobs);
}
