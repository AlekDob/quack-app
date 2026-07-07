import type { ChatMessage } from "./ai";
import type { ChatSession } from "./chatHistory";
import { saveSession } from "./chatHistory";
import { claudeCode as claudeCodeIpc, type LoadedMessage } from "./ipc";

/** True when Quack saved user turns but lost assistant rows (common after
 *  switch-during-stream or pre-043 save races). CC jsonl may still hold
 *  the full thread via providerSessionIds. */
export function needsCcHydration(session: ChatSession): boolean {
  const ccId =
    session.providerSessionIds?.["claude-code"] ?? session.claudeSessionId;
  if (!ccId) return false;
  const users = session.messages.filter((m) => m.role === "user").length;
  const assistants = session.messages.filter((m) => m.role === "assistant")
    .length;
  return users > 0 && assistants < users;
}

function toChatMessages(loaded: LoadedMessage[]): ChatMessage[] {
  return loaded.map((m) => ({
    role: m.role,
    content: m.content,
    tool_calls: m.tool_calls,
    tool_results: m.tool_results,
  }));
}

/** Pull the CC on-disk JSONL when the Quack row is thinner. */
export async function recoverSessionFromCc(
  root: string,
  session: ChatSession,
): Promise<ChatSession | null> {
  if (!needsCcHydration(session)) return null;
  const ccId =
    session.providerSessionIds?.["claude-code"] ?? session.claudeSessionId;
  if (!ccId) return null;
  try {
    const loaded = await claudeCodeIpc.loadSession(root, ccId);
    if (loaded.length <= session.messages.length) return null;
    return {
      ...session,
      messages: toChatMessages(loaded),
      updatedAt: Date.now(),
    };
  } catch {
    return null;
  }
}

export function persistRecoveredSession(
  wsId: string,
  session: ChatSession,
): boolean {
  return saveSession(wsId, session);
}
