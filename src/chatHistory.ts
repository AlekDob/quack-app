import type { ChatMessage } from "./ai";
import type { ProviderId } from "./providers/types";
import type { ChatComposerDraft } from "./composerDraft";
import {
  deleteSessionOnDisk,
  flushSessionToDisk,
  getCachedSession,
  getCachedSessions,
  getCachedSessionIds,
  legacySaveToLocalStorage,
  putCachedSession,
  removeCachedSession,
} from "./chatStoreCache";
import { remove } from "./localStore";

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  model?: string;
  updatedAt: number;
  providerSessionIds?: Partial<Record<ProviderId, string>>;
  claudeSessionId?: string;
  totalCostUsd?: number;
  ccEffort?: string;
  ccThinking?: boolean | null;
  ccPermMode?: string | null;
  composer?: ChatComposerDraft;
  /** First agentic platform used in this chat — locks the model picker (044). */
  pinnedProviderId?: ProviderId;
  /** Active preset shaping this session (built-in or custom) — not a
   *  subagent, no isolated context. See src/presets/. */
  presetId?: string;
}

const LEGACY_SESSION_KEY = (wsId: string, sessionId: string) =>
  `lcp.ollama.history.${wsId}.s.${sessionId}`;

export { hydrateChatStore, ensureSessionLoaded } from "./chatStoreCache";

export function loadSession(
  wsId: string,
  sessionId: string,
): ChatSession | undefined {
  return getCachedSession(wsId, sessionId);
}

export function loadSessions(wsId: string): ChatSession[] {
  return getCachedSessions(wsId);
}

export function listSessionIds(wsId: string): string[] {
  return getCachedSessionIds(wsId);
}

/** Atomic per-session write — disk-backed, no localStorage quota. */
export function saveSession(wsId: string, session: ChatSession): boolean {
  putCachedSession(wsId, session);
  void flushSessionToDisk(wsId, session);
  return true;
}

/** Merge fields without clobbering messages when absent from the patch. */
export function patchSession(
  wsId: string,
  sessionId: string,
  patch: Partial<Omit<ChatSession, "id">>,
): boolean {
  const existing = loadSession(wsId, sessionId);
  const base: ChatSession = existing ?? {
    id: sessionId,
    title: "Untitled",
    messages: [],
    updatedAt: Date.now(),
  };
  return saveSession(wsId, {
    ...base,
    ...patch,
    id: sessionId,
    updatedAt: Date.now(),
  });
}

export function deleteSession(wsId: string, id: string): void {
  removeCachedSession(wsId, id);
  remove(LEGACY_SESSION_KEY(wsId, id));
  void deleteSessionOnDisk(wsId, id);
}

export function newSessionId(): string {
  return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content ?? "";
  const trimmed = first.trim().split("\n")[0] ?? "";
  return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed || "Untitled";
}

/** Boot-time migration helper when disk hydrate races first save. */
export function saveSessionLegacyFallback(
  wsId: string,
  session: ChatSession,
): boolean {
  return legacySaveToLocalStorage(wsId, session);
}
