import type { ChatSession } from "./chatHistory";
import { loadSession, patchSession } from "./chatHistory";
import type { QueuedComposerMessage } from "./composerQueue";

import type { AttachedBrainHit } from "./brainMention";

/** Ephemeral composer UI restored when returning to a chat session. */
export interface ChatComposerDraft {
  input?: string;
  queue?: QueuedComposerMessage[];
  attachTree?: boolean;
  attachTerminal?: boolean;
  attachedAgents?: string[];
  attachedBrainHits?: AttachedBrainHit[];
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
    !d.attachedBrainHits?.length &&
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
  const existing = loadSession(wsId, sessionId);
  if (draftEqual(existing?.composer, composer)) return true;
  return patchSession(wsId, sessionId, { composer });
}

function draftEqual(
  a: ChatComposerDraft | undefined,
  b: ChatComposerDraft | undefined,
): boolean {
  if (a === b) return true;
  if (!a && !b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
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
