import { invoke } from "@tauri-apps/api/core";
import type { ChatSession } from "./chatHistory";
import type { ProviderId } from "./providers/types";
import { getJson, remove, getString, setJson } from "./localStore";

const MAX_SESSIONS = 30;
const LEGACY_KEY = (wsId: string) => `lcp.ollama.history.${wsId}`;
const LEGACY_INDEX_KEY = (wsId: string) => `lcp.ollama.history.${wsId}.__idx__`;
const LEGACY_SESSION_KEY = (wsId: string, sessionId: string) =>
  `lcp.ollama.history.${wsId}.s.${sessionId}`;

interface WsCache {
  hydrated: boolean;
  hydrating: Promise<void> | null;
  sessions: Map<string, ChatSession>;
  index: string[];
}

const caches = new Map<string, WsCache>();
let onSaveFailed: (() => void) | null = null;

export function registerChatSaveFailed(cb: () => void): void {
  onSaveFailed = cb;
}

function getCache(wsId: string): WsCache {
  let c = caches.get(wsId);
  if (!c) {
    c = { hydrated: false, hydrating: null, sessions: new Map(), index: [] };
    caches.set(wsId, c);
  }
  return c;
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

function loadLegacySessions(wsId: string): ChatSession[] {
  const legacyKey = LEGACY_KEY(wsId);
  if (getString(legacyKey) !== null) {
    const legacy = getJson<unknown[]>(legacyKey, [], Array.isArray);
    return legacy.filter(isValidSession);
  }
  const idx = getJson<{ ids: string[] }>(
    LEGACY_INDEX_KEY(wsId),
    { ids: [] },
    (v): v is { ids: string[] } =>
      !!v && typeof v === "object" && Array.isArray((v as { ids: string[] }).ids),
  );
  const out: ChatSession[] = [];
  for (const id of idx.ids) {
    const s = getJson(LEGACY_SESSION_KEY(wsId, id), null, isValidSession);
    if (s) out.push(s);
  }
  return out;
}

function clearLegacyStorage(wsId: string): void {
  const idx = getJson<{ ids: string[] }>(
    LEGACY_INDEX_KEY(wsId),
    { ids: [] },
    (v): v is { ids: string[] } =>
      !!v && typeof v === "object" && Array.isArray((v as { ids: string[] }).ids),
  );
  for (const id of idx.ids) {
    remove(LEGACY_SESSION_KEY(wsId, id));
  }
  remove(LEGACY_INDEX_KEY(wsId));
  remove(LEGACY_KEY(wsId));
}

async function persistSession(wsId: string, session: ChatSession): Promise<boolean> {
  try {
    await invoke("chat_store_save", { wsId, session });
    return true;
  } catch {
    onSaveFailed?.();
    return false;
  }
}

async function migrateFromLocalStorage(wsId: string, cache: WsCache): Promise<void> {
  const legacy = loadLegacySessions(wsId);
  if (legacy.length === 0) return;
  const sorted = [...legacy].sort((a, b) => b.updatedAt - a.updatedAt);
  for (const s of sorted.slice(0, MAX_SESSIONS)) {
    cache.sessions.set(s.id, s);
    await persistSession(wsId, s);
  }
  cache.index = sorted.slice(0, MAX_SESSIONS).map((s) => s.id);
  clearLegacyStorage(wsId);
}

/** Hydrate in-memory cache from disk (call once per workspace at boot). */
export async function hydrateChatStore(wsId: string): Promise<void> {
  const cache = getCache(wsId);
  if (cache.hydrated) return;
  if (cache.hydrating) return cache.hydrating;
  cache.hydrating = (async () => {
    try {
      const snap = await invoke<{
        ids: string[];
        sessions: ChatSession[];
      }>("chat_store_load_workspace", { wsId });
      if (snap.sessions.length > 0) {
        for (const s of snap.sessions) {
          if (isValidSession(s)) cache.sessions.set(s.id, s);
        }
        cache.index = snap.ids;
      } else {
        await migrateFromLocalStorage(wsId, cache);
      }
      cache.hydrated = true;
    } catch (e) {
      console.warn("[chatStore] disk hydrate failed, falling back to localStorage", e);
      const legacy = loadLegacySessions(wsId);
      for (const s of legacy) cache.sessions.set(s.id, s);
      cache.index = [...legacy]
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .map((s) => s.id)
        .slice(0, MAX_SESSIONS);
      cache.hydrated = true;
    } finally {
      cache.hydrating = null;
    }
  })();
  return cache.hydrating;
}

export function isChatStoreHydrated(wsId: string): boolean {
  return getCache(wsId).hydrated;
}

export function getCachedSession(
  wsId: string,
  sessionId: string,
): ChatSession | undefined {
  return getCache(wsId).sessions.get(sessionId);
}

export function getCachedSessions(wsId: string): ChatSession[] {
  const cache = getCache(wsId);
  return cache.index
    .map((id) => cache.sessions.get(id))
    .filter((s): s is ChatSession => !!s);
}

export function putCachedSession(wsId: string, session: ChatSession): void {
  const cache = getCache(wsId);
  cache.sessions.set(session.id, session);
  cache.index = [
    session.id,
    ...cache.index.filter((id) => id !== session.id),
  ].slice(0, MAX_SESSIONS);
  const evicted = [...cache.sessions.keys()].filter(
    (id) => !cache.index.includes(id),
  );
  for (const id of evicted) cache.sessions.delete(id);
}

export function removeCachedSession(wsId: string, sessionId: string): void {
  const cache = getCache(wsId);
  cache.sessions.delete(sessionId);
  cache.index = cache.index.filter((id) => id !== sessionId);
}

export async function flushSessionToDisk(
  wsId: string,
  session: ChatSession,
): Promise<boolean> {
  putCachedSession(wsId, session);
  return persistSession(wsId, session);
}

export async function deleteSessionOnDisk(
  wsId: string,
  sessionId: string,
): Promise<void> {
  removeCachedSession(wsId, sessionId);
  try {
    await invoke("chat_store_delete", { wsId, sessionId });
  } catch (e) {
    console.warn("[chatStore] delete failed", e);
  }
}

export interface ProviderLink {
  ws_id: string;
  quack_session_id: string;
  title: string;
}

export async function lookupProviderLink(
  provider: ProviderId,
  cliSessionId: string,
): Promise<ProviderLink | null> {
  try {
    return await invoke<ProviderLink | null>("chat_store_lookup_link", {
      provider,
      cliSessionId,
    });
  } catch {
    return null;
  }
}

/** Fallback when cache is cold — keeps Vite-only dev usable. */
export function legacySaveToLocalStorage(
  wsId: string,
  session: ChatSession,
): boolean {
  return setJson(LEGACY_SESSION_KEY(wsId, session.id), session);
}
