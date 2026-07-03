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
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function isFresh(snap: ModelDiscoverySnapshot): boolean {
  return Date.now() - snap.fetchedAt < TTL_MS;
}

async function fetchSnapshot(): Promise<ModelDiscoverySnapshot> {
  invalidateClaudeCodeCache();
  const providersMod = await import("./providers");
  const [aggregate, cloudCatalog, ccAvail, cursorAvail, ocAvail] =
    await Promise.all([
      listAllModels().catch(() => [] as ProviderModel[]),
      listAllCloudModels().catch(() => [] as ProviderModel[]),
      providersMod
        .getProvider("claude-code")
        .isAvailable()
        .catch(() => false),
      providersMod
        .getProvider("cursor-cli")
        .isAvailable()
        .catch(() => false),
      providersMod
        .getProvider("opencode-cli")
        .isAvailable()
        .catch(() => false),
    ]);
  const ollamaUp = await ping().catch(() => false);
  return {
    allModels: aggregate,
    cloudCatalog,
    claudeCodeAvailable: ccAvail,
    cursorCliAvailable: cursorAvail,
    openCodeAvailable: ocAvail,
    ollamaUp,
    fetchedAt: Date.now(),
  };
}

/** Drop cached discovery — next ensure() refetches. Call on API-key edits. */
export function invalidateModelDiscovery(): void {
  cache = null;
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
  inflight = fetchSnapshot()
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
