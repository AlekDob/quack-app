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
  openai: "OpenAI",
  anthropic: "Anthropic",
};

/** Agentic CLI platforms that own a separate server-side session id. */
export const AGENTIC_PLATFORM_IDS: ProviderId[] = [
  "claude-code",
  "cursor-cli",
];

/** Legacy OpenCode pin — drop treated as unpinned (transcript stays readable). */
const RETIRED_OPENCODE = "opencode-cli";

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
 * Retired OpenCode pins return null so the user picks Claude Code / Cursor.
 */
export function resolvePinnedPlatform(
  session: Pick<
    ChatSession,
    "pinnedProviderId" | "model" | "messages" | "providerSessionIds"
  >,
): ProviderId | null {
  const pin = session.pinnedProviderId as string | undefined;
  if (pin === RETIRED_OPENCODE) return null;
  if (session.pinnedProviderId) return session.pinnedProviderId;
  if (!chatHasStarted(session)) return null;
  const fromModel = parseQualifiedModel(session.model ?? "");
  if (fromModel && isAgenticProviderId(fromModel.providerId)) {
    return fromModel.providerId;
  }
  // Legacy model string may still be "opencode-cli:…" — treat as unpinned.
  if ((session.model ?? "").startsWith(`${RETIRED_OPENCODE}:`)) return null;
  for (const id of AGENTIC_PLATFORM_IDS) {
    if (session.providerSessionIds?.[id]) return id;
  }
  return null;
}
