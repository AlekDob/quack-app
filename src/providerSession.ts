import type { ChatSession } from "./chatHistory";
import type { ProviderId } from "./providers/types";

/** Read persisted ids, migrating legacy `claudeSessionId` when needed. */
export function readProviderSessionIds(
  session: Pick<ChatSession, "providerSessionIds" | "claudeSessionId">,
): Partial<Record<ProviderId, string>> {
  const out: Partial<Record<ProviderId, string>> = {
    ...(session.providerSessionIds ?? {}),
  };
  if (!out["claude-code"] && session.claudeSessionId) {
    out["claude-code"] = session.claudeSessionId;
  }
  return out;
}

/** Shape for `saveSession` — keeps legacy `claudeSessionId` in sync. */
export function writeProviderSessionIds(
  ids: Partial<Record<ProviderId, string>>,
): Pick<ChatSession, "providerSessionIds" | "claudeSessionId"> {
  const providerSessionIds = { ...ids };
  const claudeSessionId = providerSessionIds["claude-code"];
  return { providerSessionIds, claudeSessionId };
}

export function setProviderSessionId(
  ids: Partial<Record<ProviderId, string>>,
  provider: ProviderId,
  id: string | undefined,
): Partial<Record<ProviderId, string>> {
  const next = { ...ids };
  if (id) next[provider] = id;
  else delete next[provider];
  return next;
}

/** Next wins per provider when set; prev fills gaps (thin remount must not wipe). */
export function mergeProviderSessionIds(
  prev: Partial<Record<ProviderId, string>>,
  next: Partial<Record<ProviderId, string>>,
): Partial<Record<ProviderId, string>> {
  const out: Partial<Record<ProviderId, string>> = { ...prev };
  for (const [k, v] of Object.entries(next) as [ProviderId, string][]) {
    if (v) out[k] = v;
  }
  return out;
}
