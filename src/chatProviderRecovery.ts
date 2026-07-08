import type { ChatMessage } from "./ai";
import type { ChatSession } from "./chatHistory";
import { saveSession } from "./chatHistory";
import type { ProviderId } from "./providers/types";
import { readProviderSessionIds } from "./providerSession";
import { providerSessions } from "./ipc";

const AGENTIC: ProviderId[] = ["claude-code", "cursor-cli", "opencode-cli"];

/** True when Quack saved user turns but lost assistant rows. */
export function needsProviderHydration(
  session: ChatSession,
  provider: ProviderId,
): boolean {
  const ids = readProviderSessionIds(session);
  const cliId = ids[provider];
  if (!cliId) return false;
  const users = session.messages.filter((m) => m.role === "user").length;
  const assistants = session.messages.filter((m) => m.role === "assistant")
    .length;
  return users > 0 && assistants < users;
}

function toChatMessages(
  loaded: Awaited<ReturnType<typeof providerSessions.loadSession>>,
): ChatMessage[] {
  return loaded.map((m) => ({
    role: m.role as ChatMessage["role"],
    content: m.content,
    tool_calls: m.tool_calls,
    tool_results: m.tool_results,
  }));
}

/** Pull on-disk CLI transcript when the Quack row is thinner. */
export async function recoverSessionFromProvider(
  root: string,
  session: ChatSession,
  provider: ProviderId,
): Promise<ChatSession | null> {
  if (!AGENTIC.includes(provider)) return null;
  if (!needsProviderHydration(session, provider)) return null;
  const cliId = readProviderSessionIds(session)[provider];
  if (!cliId) return null;
  if (provider === "opencode-cli") return null;
  try {
    const loaded = await providerSessions.loadSession(root, provider, cliId);
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

/** Try every linked agentic provider — first richer transcript wins. */
export async function recoverSessionFromAnyProvider(
  root: string,
  session: ChatSession,
): Promise<{ session: ChatSession; provider: ProviderId } | null> {
  const ids = readProviderSessionIds(session);
  for (const provider of AGENTIC) {
    if (!ids[provider]) continue;
    const recovered = await recoverSessionFromProvider(root, session, provider);
    if (recovered) return { session: recovered, provider };
  }
  return null;
}

export function persistRecoveredSession(
  wsId: string,
  session: ChatSession,
): boolean {
  return saveSession(wsId, session);
}
