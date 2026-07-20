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
const bodyLoads = new Map<string, Promise<ChatSession | undefined>>();
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

function bodyKey(wsId: string, sessionId: string): string {
  return `${wsId}:${sessionId}`;
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

/** Coalesce parallel flushes per session — streaming + composer used to fire
 *  overlapping `chat_store_save` invokes; a fixed `.codetta-tmp` then raced. */
const pendingDisk = new Map<string, ChatSession>();
const flushingDisk = new Set<string>();

function diskKey(wsId: string, sessionId: string): string {
  return `${wsId}\0${sessionId}`;
}

async function persistSession(wsId: string, session: ChatSession): Promise<boolean> {
  // `npm run dev` (Vite-only) has no Rust backend — keep the in-memory cache
  // and skip disk. Don't toast "Chat not saved" in that mode.
  if (typeof window !== "undefined" && !("__TAURI_INTERNALS__" in window)) {
    return true;
  }
  const key = diskKey(wsId, session.id);
  const prev = getCachedSession(wsId, session.id);
  const safe = preferRicherSession(prev, session);
  pendingDisk.set(key, safe);
  if (flushingDisk.has(key)) return true;
  flushingDisk.add(key);
  let ok = true;
  try {
    while (pendingDisk.has(key)) {
      const next = pendingDisk.get(key)!;
      pendingDisk.delete(key);
      try {
        await invoke("chat_store_save", { wsId, session: next });
      } catch (e) {
        ok = false;
        console.error("[chatStore] chat_store_save failed", wsId, next.id, e);
        onSaveFailed?.();
      }
    }
  } finally {
    flushingDisk.delete(key);
  }
  return ok;
}

/** Wait for in-flight disk writes (optionally one workspace). */
export async function awaitChatDiskFlushes(wsId?: string): Promise<void> {
  const prefix = wsId ? `${wsId}\0` : null;
  for (let i = 0; i < 100; i++) {
    let busy = false;
    for (const key of flushingDisk) {
      if (!prefix || key.startsWith(prefix)) {
        busy = true;
        break;
      }
    }
    if (!busy) {
      for (const key of pendingDisk.keys()) {
        if (!prefix || key.startsWith(prefix)) {
          busy = true;
          break;
        }
      }
    }
    if (!busy) return;
    await new Promise((r) => setTimeout(r, 16));
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

function rememberSession(cache: WsCache, session: ChatSession): void {
  cache.sessions.set(session.id, session);
  if (!cache.index.includes(session.id)) {
    cache.index = [session.id, ...cache.index].slice(0, MAX_SESSIONS);
  }
}

async function loadSessionBody(
  wsId: string,
  sessionId: string,
): Promise<ChatSession | undefined> {
  const hit = getCachedSession(wsId, sessionId);
  if (hit) return hit;
  const key = bodyKey(wsId, sessionId);
  const inflight = bodyLoads.get(key);
  if (inflight) return inflight;
  const p = (async () => {
    try {
      const raw = await invoke<unknown | null>("chat_store_load", {
        wsId,
        sessionId,
      });
      if (!isValidSession(raw)) return undefined;
      const cache = getCache(wsId);
      const merged = preferRicherSession(cache.sessions.get(sessionId), raw);
      rememberSession(cache, merged);
      return merged;
    } catch (e) {
      console.warn("[chatStore] session load failed", sessionId, e);
      return undefined;
    } finally {
      bodyLoads.delete(key);
    }
  })();
  bodyLoads.set(key, p);
  return p;
}

/**
 * Hydrate session index from disk (bodies stay cold). Optionally warm-load
 * live chat ids so open panels have transcripts without waiting.
 */
export async function hydrateChatStore(
  wsId: string,
  warmIds?: string[],
): Promise<void> {
  const cache = getCache(wsId);
  if (!cache.hydrated) {
    if (cache.hydrating) {
      await cache.hydrating;
    } else {
      cache.hydrating = (async () => {
        try {
          const snap = await invoke<{
            ids: string[];
            sessions: ChatSession[];
          }>("chat_store_load_workspace", { wsId });
          cache.index = snap.ids;
          // Compat: older backends may still return full bodies.
          for (const s of snap.sessions ?? []) {
            if (isValidSession(s)) cache.sessions.set(s.id, s);
          }
          if (snap.ids.length === 0) {
            await migrateFromLocalStorage(wsId, cache);
          }
          cache.hydrated = true;
        } catch (e) {
          console.warn(
            "[chatStore] disk hydrate failed, falling back to localStorage",
            e,
          );
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
      await cache.hydrating;
    }
  }
  if (warmIds && warmIds.length > 0) {
    await Promise.all(warmIds.map((id) => loadSessionBody(wsId, id)));
  }
}

/** Load one transcript into the cache.
 *  `force: true` drops the RAM body first so project remount re-reads disk. */
export async function ensureSessionLoaded(
  wsId: string,
  sessionId: string,
  opts?: { force?: boolean },
): Promise<ChatSession | undefined> {
  if (!getCache(wsId).hydrated) await hydrateChatStore(wsId);
  if (opts?.force) dropCachedSessionBody(wsId, sessionId);
  return loadSessionBody(wsId, sessionId);
}

/** Drop transcript body from RAM; keep id in the index for reopen. */
export function dropCachedSessionBody(wsId: string, sessionId: string): void {
  getCache(wsId).sessions.delete(sessionId);
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

/** Session ids known on disk (index), including cold bodies. */
export function getCachedSessionIds(wsId: string): string[] {
  return [...getCache(wsId).index];
}

export function putCachedSession(wsId: string, session: ChatSession): void {
  const cache = getCache(wsId);
  const prev = cache.sessions.get(session.id);
  const next = preferRicherSession(prev, session);
  cache.sessions.set(session.id, next);
  cache.index = [
    session.id,
    ...cache.index.filter((id) => id !== session.id),
  ].slice(0, MAX_SESSIONS);
  const evicted = [...cache.sessions.keys()].filter(
    (id) => !cache.index.includes(id),
  );
  for (const id of evicted) cache.sessions.delete(id);
}

/** Prefer a real title over the empty/Untitled placeholder. */
export function preferSessionTitle(prev: string, next: string): string {
  const p = prev.trim();
  const n = next.trim();
  if (!n || n === "Untitled") return p || n || "Untitled";
  if (!p || p === "Untitled") return n;
  return n;
}

/** Keep richer message lists — composer unmount patches must not wipe transcripts. */
export function preferRicherSession(
  prev: ChatSession | undefined,
  next: ChatSession,
): ChatSession {
  if (!prev) return next;
  const title = preferSessionTitle(prev.title, next.title);
  if (next.messages.length >= prev.messages.length) {
    return title === next.title ? next : { ...next, title };
  }
  console.warn(
    "[chatStore] refuse shrink",
    next.id,
    `${prev.messages.length}→${next.messages.length}`,
  );
  return { ...next, messages: prev.messages, title };
}

/** Drop all warm bodies for a workspace (keep index) — remount reloads disk. */
export function dropAllCachedBodies(wsId: string): void {
  getCache(wsId).sessions.clear();
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
