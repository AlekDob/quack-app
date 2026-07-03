// Shared model-discovery cache for every AIChatPanel instance. One fetch
// serves all open chats; explicit invalidation + TTL keep lists fresh when
// providers change.

import { ping } from "./ai";
import {
  invalidateClaudeCodeCache,
  listAllCloudModels,
  listAllModels,
} from "./providers";
import type { ProviderModel } from "./providers/types";

export interface ModelDiscoverySnapshot {
  allModels: ProviderModel[];
  cloudCatalog: ProviderModel[];
  claudeCodeAvailable: boolean;
  cursorCliAvailable: boolean;
  openCodeAvailable: boolean;
  ollamaUp: boolean;
  fetchedAt: number;
}

const TTL_MS = 60_000;

let cache: ModelDiscoverySnapshot | null = null;
let inflight: Promise<ModelDiscoverySnapshot> | null = null;
let cloudInflight: Promise<ProviderModel[]> | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function isFresh(snap: ModelDiscoverySnapshot): boolean {
  return Date.now() - snap.fetchedAt < TTL_MS;
}

async function fetchSnapshot(force: boolean): Promise<ModelDiscoverySnapshot> {
  if (force) invalidateClaudeCodeCache();
  const [aggregate, ollamaUp] = await Promise.all([
    listAllModels().catch(() => [] as ProviderModel[]),
    ping().catch(() => false),
  ]);
  const claudeCodeAvailable = aggregate.some(
    (m) => m.providerId === "claude-code",
  );
  // Cursor/OpenCode still expose a default row when the CLI is missing —
  // probe availability separately (listAllModels already checked CC + Ollama).
  const providersMod = await import("./providers");
  const [cursorAvail, ocAvail] = await Promise.all([
    providersMod
      .getProvider("cursor-cli")
      .isAvailable()
      .catch(() => false),
    providersMod
      .getProvider("opencode-cli")
      .isAvailable()
      .catch(() => false),
  ]);
  return {
    allModels: aggregate,
    cloudCatalog: [],
    claudeCodeAvailable,
    cursorCliAvailable: cursorAvail,
    openCodeAvailable: ocAvail,
    ollamaUp,
    fetchedAt: Date.now(),
  };
}

/** Drop cached discovery — next ensure() refetches. Call on API-key edits. */
export function invalidateModelDiscovery(): void {
  cache = null;
  cloudInflight = null;
  notify();
}

export function getModelDiscovery(): ModelDiscoverySnapshot | null {
  return cache;
}

export function subscribeModelDiscovery(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function mergeProviderModels(
  prev: ProviderModel[],
  fresh: ProviderModel[],
  providerId: ProviderModel["providerId"],
): ProviderModel[] {
  if (fresh.length === 0) return prev;
  const rest = prev.filter((m) => m.providerId !== providerId);
  return [...rest, ...fresh];
}

/** Merge lazy CLI catalogs (picker/browser open) into the shared cache. */
export function mergeLiveCliModelsIntoDiscovery(
  ocModels: ProviderModel[],
  cursorModels: ProviderModel[],
): void {
  if (!cache) return;
  if (ocModels.length > 0) {
    cache = {
      ...cache,
      allModels: mergeProviderModels(cache.allModels, ocModels, "opencode-cli"),
      cloudCatalog: mergeProviderModels(
        cache.cloudCatalog,
        ocModels,
        "opencode-cli",
      ),
    };
  }
  if (cursorModels.length > 0) {
    cache = {
      ...cache,
      allModels: mergeProviderModels(
        cache.allModels,
        cursorModels,
        "cursor-cli",
      ),
      cloudCatalog: mergeProviderModels(
        cache.cloudCatalog,
        cursorModels,
        "cursor-cli",
      ),
    };
  }
  notify();
}

export async function ensureModelDiscovery(options?: {
  force?: boolean;
}): Promise<ModelDiscoverySnapshot> {
  const force = options?.force ?? false;
  if (!force && cache && isFresh(cache)) return cache;
  if (!force && inflight) return inflight;
  inflight = fetchSnapshot(force)
    .then((snap) => {
      cache = snap;
      inflight = null;
      notify();
      return snap;
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

/** Full cloud catalog for Model Browser — deferred until first open. */
export async function ensureCloudCatalog(): Promise<ProviderModel[]> {
  if (cache?.cloudCatalog.length) return cache.cloudCatalog;
  if (cloudInflight) return cloudInflight;
  cloudInflight = listAllCloudModels()
    .then((catalog) => {
      if (cache) {
        cache = { ...cache, cloudCatalog: catalog };
        notify();
      }
      cloudInflight = null;
      return catalog;
    })
    .catch((err) => {
      cloudInflight = null;
      throw err;
    });
  return cloudInflight;
}

/** Warm discovery during splash — overlaps with workspace hydration. */
export function prefetchModelDiscovery(): void {
  void ensureModelDiscovery({ force: false });
}
