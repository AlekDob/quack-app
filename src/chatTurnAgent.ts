import type { ChatMessage } from "./ai";

/**
 * Agent id frozen for the in-flight assistant turn.
 * `undefined` = no live turn (composer may change freely).
 * `null` = Jack. `string` = preset id (Milo / Nora / …).
 */
export type TurnAgentId = string | null | undefined;

/**
 * Identity for the streaming bubble / turn commit.
 * Mid-turn composer switches update `livePresetId` only — the in-progress
 * message must keep the agent that owned the send (feature 062).
 */
export function streamingBubbleAgentId(
  frozenTurnAgentId: TurnAgentId,
  livePresetId: string | null,
): string | null {
  return frozenTurnAgentId !== undefined ? frozenTurnAgentId : livePresetId;
}

/**
 * Which agent owns a committed assistant row.
 * `null` on the message = Jack (explicit). `undefined` = legacy / stripped
 * row — fall back to the session's active preset so switching into a Milo
 * chat doesn't paint every old bubble as Jack.
 */
export function resolveMessageAgentId(
  messageAgentId: string | null | undefined,
  sessionPresetId: string | null,
): string | null {
  return messageAgentId !== undefined ? messageAgentId : sessionPresetId;
}

/** Stamp missing `agentId` on assistant rows from the session preset. */
export function backfillAssistantAgentIds(
  messages: ChatMessage[],
  sessionPresetId: string | null,
): ChatMessage[] {
  let changed = false;
  const out = messages.map((m) => {
    if (m.role !== "assistant" || m.agentId !== undefined) return m;
    changed = true;
    return { ...m, agentId: sessionPresetId };
  });
  return changed ? out : messages;
}

/**
 * Disk/RAM `presetId` → session agent. Omitted field means Jack (`null`),
 * same as paintSession / openSession (`found.presetId ?? null`).
 */
export function sessionAgentFromStored(
  storedPresetId: string | undefined,
): string | null {
  return storedPresetId ?? null;
}

/**
 * Pass-the-ball / Tab switch: composer may flip while a turn streams.
 * Commit + bubble must keep `frozenAtSend`; only idle UI follows `live`.
 */
export function displayAgentForAssistantRow(opts: {
  messageAgentId: string | null | undefined;
  sessionPresetId: string | null;
  turnFrozenId: TurnAgentId;
  isStreamingBubble: boolean;
}): string | null {
  if (opts.isStreamingBubble) {
    return streamingBubbleAgentId(opts.turnFrozenId, opts.sessionPresetId);
  }
  return resolveMessageAgentId(opts.messageAgentId, opts.sessionPresetId);
}
