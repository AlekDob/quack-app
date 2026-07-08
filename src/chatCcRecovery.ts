import type { ChatSession } from "./chatHistory";
import { saveSession } from "./chatHistory";
import {
  needsProviderHydration,
  recoverSessionFromProvider,
} from "./chatProviderRecovery";

/** @deprecated Use needsProviderHydration(session, "claude-code") */
export function needsCcHydration(session: ChatSession): boolean {
  return needsProviderHydration(session, "claude-code");
}

/** Pull the CC on-disk JSONL when the Quack row is thinner. */
export async function recoverSessionFromCc(
  root: string,
  session: ChatSession,
): Promise<ChatSession | null> {
  return recoverSessionFromProvider(root, session, "claude-code");
}

export function persistRecoveredSession(
  wsId: string,
  session: ChatSession,
): boolean {
  return saveSession(wsId, session);
}
