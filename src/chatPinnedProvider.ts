import type { ChatSession } from "./chatHistory";
import {
  isAgenticProviderId,
  parseQualifiedModel,
  type ProviderId,
} from "./providers/types";

const PLATFORM_LABELS: Record<ProviderId, string> = {
  ollama: "Ollama",
  "claude-code": "Claude Code",
  "cursor-cli": "Cursor CLI",
  "opencode-cli": "OpenCode",
  openai: "OpenAI",
  anthropic: "Anthropic",
};

/** Agentic CLI platforms that own a separate server-side session id. */
export const AGENTIC_PLATFORM_IDS: ProviderId[] = [
  "claude-code",
  "cursor-cli",
  "opencode-cli",
];

export function platformLabel(id: ProviderId): string {
  return PLATFORM_LABELS[id] ?? id;
}

/** True once the chat has at least one user turn (conversation started). */
export function chatHasStarted(session: Pick<ChatSession, "messages">): boolean {
  return session.messages.some((m) => m.role === "user");
}

/**
 * Platform pinned for this chat — set on first agentic send, or inferred
 * from legacy sessions that already have messages + an agentic model.
 */
export function resolvePinnedPlatform(
  session: Pick<
    ChatSession,
    "pinnedProviderId" | "model" | "messages" | "providerSessionIds"
  >,
): ProviderId | null {
  if (session.pinnedProviderId) return session.pinnedProviderId;
  if (!chatHasStarted(session)) return null;
  const fromModel = parseQualifiedModel(session.model ?? "");
  if (fromModel && isAgenticProviderId(fromModel.providerId)) {
    return fromModel.providerId;
  }
  for (const id of AGENTIC_PLATFORM_IDS) {
    if (session.providerSessionIds?.[id]) return id;
  }
  return null;
}
