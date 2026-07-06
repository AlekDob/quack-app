import type { ChatMessage } from "./ai";
import type { ProviderId } from "./providers/types";
import type { ChatComposerDraft } from "./composerDraft";
import { getJson, setJson, remove, getString } from "./localStore";

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
}

const LEGACY_KEY = (wsId: string) => `lcp.ollama.history.${wsId}`;
const INDEX_KEY = (wsId: string) => `lcp.ollama.history.${wsId}.__idx__`;
const SESSION_KEY = (wsId: string, sessionId: string) =>
  `lcp.ollama.history.${wsId}.s.${sessionId}`;
const MAX_SESSIONS = 30;

const migratedWs = new Set<string>();

interface SessionIndex {
  ids: string[];
}

function isValidSession(s: unknown): s is ChatSession {
  if (!s || typeof s !== "object") return false;
  const o = s as Record<string, unknown>;
  return (
    typeof o.id === "string" &&
    typeof o.title === "string" &&
    Array.isArray(o.messages) &&
    typeof o.updatedAt === "number"
  );
}

function isValidIndex(v: unknown): v is SessionIndex {
  return (
    !!v &&
    typeof v === "object" &&
    Array.isArray((v as SessionIndex).ids)
  );
}

function readIndex(wsId: string): SessionIndex {
  return getJson(INDEX_KEY(wsId), { ids: [] }, isValidIndex);
}

function writeIndex(wsId: string, ids: string[]): void {
  setJson(INDEX_KEY(wsId), { ids });
}

/** One-time: split the legacy monolithic array into per-session keys. */
function migrateLegacyIfNeeded(wsId: string): void {
  if (migratedWs.has(wsId)) return;
  migratedWs.add(wsId);
  if (getString(LEGACY_KEY(wsId)) === null) return;

  const legacy = getJson<unknown[]>(LEGACY_KEY(wsId), [], Array.isArray);
  const valid = legacy.filter(isValidSession);
  for (const s of valid) {
    setJson(SESSION_KEY(wsId, s.id), s);
  }
  const ids = [...valid]
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map((s) => s.id)
    .slice(0, MAX_SESSIONS);
  writeIndex(wsId, ids);
  for (const s of valid) {
    if (!ids.includes(s.id)) remove(SESSION_KEY(wsId, s.id));
  }
  remove(LEGACY_KEY(wsId));
}

export function loadSession(
  wsId: string,
  sessionId: string,
): ChatSession | undefined {
  migrateLegacyIfNeeded(wsId);
  const s = getJson(SESSION_KEY(wsId, sessionId), null, isValidSession);
  return s ?? undefined;
}

export function loadSessions(wsId: string): ChatSession[] {
  migrateLegacyIfNeeded(wsId);
  return readIndex(wsId)
    .ids.map((id) => loadSession(wsId, id))
    .filter((s): s is ChatSession => !!s);
}

/** Atomic per-session write — safe when multiple chats save in parallel. */
export function saveSession(wsId: string, session: ChatSession): boolean {
  migrateLegacyIfNeeded(wsId);
  const ok = setJson(SESSION_KEY(wsId, session.id), session);
  if (!ok) return false;

  const prev = readIndex(wsId).ids;
  const ids = [
    session.id,
    ...prev.filter((id) => id !== session.id),
  ].slice(0, MAX_SESSIONS);
  const evicted = prev.filter((id) => !ids.includes(id));
  for (const id of evicted) remove(SESSION_KEY(wsId, id));
  writeIndex(wsId, ids);
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
  migrateLegacyIfNeeded(wsId);
  remove(SESSION_KEY(wsId, id));
  writeIndex(
    wsId,
    readIndex(wsId).ids.filter((x) => x !== id),
  );
}

export function newSessionId(): string {
  return "c_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function deriveTitle(messages: ChatMessage[]): string {
  const first = messages.find((m) => m.role === "user")?.content ?? "";
  const trimmed = first.trim().split("\n")[0] ?? "";
  return trimmed.length > 60 ? trimmed.slice(0, 57) + "…" : trimmed || "Untitled";
}
