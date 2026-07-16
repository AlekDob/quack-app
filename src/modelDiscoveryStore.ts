// Shared model-discovery cache for every AIChatPanel instance. One fetch
// serves all open chats; explicit invalidation + TTL keep lists fresh when
// providers change. Disk snapshot + stale-while-revalidate keep the picker
// instant on reopen and across app restarts.

import { getJson, setJson } from "./localStore";
import { ping } from "./ai";
import {
  invalidateClaudeCodeCache,
  listAllCloudModels,
  listFastModels,
  claudeCodePickerModels,
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
const DISK_KEY = "lcp.modelDiscovery.v1";

let cache: ModelDiscoverySnapshot | null = hydrateDisk();
let inflight: Promise<ModelDiscoverySnapshot> | null = null;
let cloudInflight: Promise<ProviderModel[]> | null = null;
let liveCliInflight: Promise<void> | null = null;
let ccCliInflight: Promise<void> | null = null;
/** False while cloudCatalog only has lazy CLI slices from the picker. */
let cloudCatalogComplete = false;
const listeners = new Set<() => void>();

function notify() {
  for (const l of listeners) l();
}

function isFresh(snap: ModelDiscoverySnapshot): boolean {
  return Date.now() - snap.fetchedAt < TTL_MS;
}

function modelKey(m: ProviderModel): string {
  return `${m.providerId}:${m.modelId}`;
}

function isDiskSnap(v: unknown): v is ModelDiscoverySnapshot {
  if (!v || typeof v !== "object") return false;
  const o = v as ModelDiscoverySnapshot;
  return (
    Array.isArray(o.allModels) &&
    typeof o.fetchedAt === "number" &&
    typeof o.claudeCodeAvailable === "boolean"
  );
}

function hydrateDisk(): ModelDiscoverySnapshot | null {
  return getJson<ModelDiscoverySnapshot | null>(DISK_KEY, null, isDiskSnap);
}

function persistDisk(snap: ModelDiscoverySnapshot): void {
  setJson(DISK_KEY, snap);
}

function applyCache(snap: ModelDiscoverySnapshot): ModelDiscoverySnapshot {
  cache = snap;
  persistDisk(snap);
  notify();
  return snap;
}

function mergeWithHints(
  fastModels: ProviderModel[],
  hints: ModelDiscoverySnapshot | null,
  ollamaUp: boolean,
): ModelDiscoverySnapshot {
  const byKey = new Map<string, ProviderModel>();
  for (const m of fastModels) byKey.set(modelKey(m), m);
  if (hints) {
    for (const m of hints.allModels) {
      if (m.providerId === "cursor-cli" || m.providerId === "opencode-cli" || m.providerId === "claude-code") {
        byKey.set(modelKey(m), m);
      }
    }
  }
  for (const m of claudeCodePickerModels()) {
    byKey.set(modelKey(m), m);
  }
  const allModels = [...byKey.values()];
  const claudeCodeAvailable =
    hints?.claudeCodeAvailable ??
    allModels.some((m) => m.providerId === "claude-code");
  return {
    allModels,
    cloudCatalog: cloudCatalogComplete && hints ? hints.cloudCatalog : [],
    claudeCodeAvailable,
    cursorCliAvailable: hints?.cursorCliAvailable ?? false,
    openCodeAvailable: hints?.openCodeAvailable ?? false,
    ollamaUp,
    fetchedAt: Date.now(),
  };
}

async function probeClaudeAvailability(): Promise<boolean> {
  const providersMod = await import("./providers");
  return providersMod
    .getProvider("claude-code")
    .isAvailable()
    .catch(() => false);
}

async function probeCliAvailability(
  snap: ModelDiscoverySnapshot,
): Promise<ModelDiscoverySnapshot> {
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
  if (
    cursorAvail === snap.cursorCliAvailable &&
    ocAvail === snap.openCodeAvailable
  ) {
    return snap;
  }
  return {
    ...snap,
    cursorCliAvailable: cursorAvail,
    openCodeAvailable: ocAvail,
    fetchedAt: Date.now(),
  };
}

async function fetchSnapshot(
  force: boolean,
  hints: ModelDiscoverySnapshot | null,
): Promise<ModelDiscoverySnapshot> {
  if (force) invalidateClaudeCodeCache();
  const [fastModels, ollamaUp] = await Promise.all([
    listFastModels().catch(() => [] as ProviderModel[]),
    ping().catch(() => false),
  ]);
  let snap = mergeWithHints(fastModels, hints, ollamaUp);
  void probeCliAvailability(snap).then((probed) => {
    if (
      probed.cursorCliAvailable === snap.cursorCliAvailable &&
      probed.openCodeAvailable === snap.openCodeAvailable
    ) {
      return;
    }
    if (cache) {
      applyCache({ ...cache, ...probed, fetchedAt: Date.now() });
    }
  });
  void probeClaudeAvailability().then((claudeAvail) => {
    if (!cache) return;
    const models = claudeAvail
      ? cache.allModels
      : cache.allModels.filter((m) => m.providerId !== "claude-code");
    if (
      cache.claudeCodeAvailable === claudeAvail &&
      models.length === cache.allModels.length
    ) {
      return;
    }
    applyCache({
      ...cache,
      allModels: models,
      claudeCodeAvailable: claudeAvail,
      fetchedAt: Date.now(),
    });
  });
  return snap;
}

function startRevalidate(force: boolean): void {
  if (inflight) return;
  const hints = cache;
  notify();
  inflight = fetchSnapshot(force, hints)
    .then((snap) => {
      inflight = null;
      return applyCache(snap);
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
}

/** Drop cached discovery — next ensure() refetches. Call on API-key edits. */
export function invalidateModelDiscovery(): void {
  cache = null;
  cloudInflight = null;
  cloudCatalogComplete = false;
  try {
    localStorage.removeItem(DISK_KEY);
  } catch {
    /* ignore */
  }
  notify();
}

export function getModelDiscovery(): ModelDiscoverySnapshot | null {
  return cache;
}

export function isLiveCliCatalogInflight(): boolean {
  return liveCliInflight !== null;
}

export function isModelDiscoveryInflight(): boolean {
  return inflight !== null;
}

/** True while picker catalogs are still being probed or refreshed. */
export function isPickerCatalogLoading(): boolean {
  return inflight !== null || liveCliInflight !== null || ccCliInflight !== null;
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
  ccModels: ProviderModel[] = [],
): void {
  if (!cache) return;
  if (ocModels.length > 0) {
    cache = {
      ...cache,
      allModels: mergeProviderModels(cache.allModels, ocModels, "opencode-cli"),
    };
    if (cloudCatalogComplete) {
      cache = {
        ...cache,
        cloudCatalog: mergeProviderModels(
          cache.cloudCatalog,
          ocModels,
          "opencode-cli",
        ),
      };
    }
  }
  if (cursorModels.length > 0) {
    cache = {
      ...cache,
      allModels: mergeProviderModels(
        cache.allModels,
        cursorModels,
        "cursor-cli",
      ),
    };
    if (cloudCatalogComplete) {
      cache = {
        ...cache,
        cloudCatalog: mergeProviderModels(
          cache.cloudCatalog,
          cursorModels,
          "cursor-cli",
        ),
      };
    }
  }
  if (ccModels.length > 0) {
    cache = {
      ...cache,
      allModels: mergeProviderModels(cache.allModels, ccModels, "claude-code"),
    };
    if (cloudCatalogComplete) {
      cache = {
        ...cache,
        cloudCatalog: mergeProviderModels(
          cache.cloudCatalog,
          ccModels,
          "claude-code",
        ),
      };
    }
  }
  persistDisk(cache);
  notify();
}

export async function ensureModelDiscovery(options?: {
  force?: boolean;
}): Promise<ModelDiscoverySnapshot> {
  const force = options?.force ?? false;
  if (!force && cache && isFresh(cache)) return cache;

  // Stale-while-revalidate: never block the picker on a cold re-probe.
  if (!force && cache) {
    startRevalidate(false);
    return cache;
  }

  if (!force && inflight) return inflight;

  notify();
  inflight = fetchSnapshot(force, cache)
    .then((snap) => {
      inflight = null;
      return applyCache(snap);
    })
    .catch((err) => {
      inflight = null;
      throw err;
    });
  return inflight;
}

/** Full cloud catalog for Model Browser — deferred until first open. */
export async function ensureCloudCatalog(): Promise<ProviderModel[]> {
  if (cloudCatalogComplete && cache) return cache.cloudCatalog;
  if (cloudInflight) return cloudInflight;
  cloudInflight = listAllCloudModels()
    .then((catalog) => {
      if (cache) {
        let merged = catalog;
        for (const pid of ["opencode-cli", "cursor-cli", "claude-code"] as const) {
          const live = cache!.allModels.filter((m) => m.providerId === pid);
          if (live.length > 0) merged = mergeProviderModels(merged, live, pid);
        }
        cache = { ...cache, cloudCatalog: merged };
        cloudCatalogComplete = true;
        persistDisk(cache);
        notify();
      }
      cloudInflight = null;
      return cache?.cloudCatalog ?? catalog;
    })
    .catch((err) => {
      cloudInflight = null;
      throw err;
    });
  return cloudInflight;
}

async function warmLiveCliCatalogs(force = false): Promise<void> {
  let snap = getModelDiscovery();
  if (!snap) {
    // First run (no disk snapshot yet): wait for the base discovery fetch
    // so we know which CLIs are available, instead of silently skipping
    // the CC/Cursor/OpenCode warm-up (which used to leave the picker
    // loader stuck off on the very first open).
    snap = await ensureModelDiscovery({ force: false });
  }
  const wantCc = snap.claudeCodeAvailable;
  const wantCursor = snap.cursorCliAvailable;
  const wantOc = snap.openCodeAvailable;
  if (wantCc) void warmCcCatalog(force);
  if (!wantCursor && !wantOc) return;
  if (!force && liveCliInflight) return liveCliInflight;

  liveCliInflight = (async () => {
    try {
      const [{ refreshOpenCodeModelsLive }, { refreshCursorModelsLive }] =
        await Promise.all([
          import("./providers/openCode"),
          import("./providers/cursorCode"),
        ]);
      const [ocModels, cursorModels] = await Promise.all([
        wantOc
          ? refreshOpenCodeModelsLive(force).catch(
              () => [] as ProviderModel[],
            )
          : Promise.resolve([] as ProviderModel[]),
        wantCursor
          ? refreshCursorModelsLive(force).catch(
              () => [] as ProviderModel[],
            )
          : Promise.resolve([] as ProviderModel[]),
      ]);
      if (ocModels.length > 0 || cursorModels.length > 0) {
        mergeLiveCliModelsIntoDiscovery(ocModels, cursorModels);
      }
    } finally {
      liveCliInflight = null;
      notify();
    }
  })();

  notify();
  return liveCliInflight;
}

function warmCcCatalog(force: boolean): void {
  if (!force && ccCliInflight) return;
  ccCliInflight = (async () => {
    try {
      const { refreshClaudeCodeModelsLive } = await import(
        "./providers/claudeCode"
      );
      const ccModels = await refreshClaudeCodeModelsLive(force).catch(
        () => [] as ProviderModel[],
      );
      if (ccModels.length > 0) {
        mergeLiveCliModelsIntoDiscovery([], [], ccModels);
      }
    } catch {
      /* keep fallback catalog */
    } finally {
      ccCliInflight = null;
      notify();
    }
  })();
  notify();
}

/** Hover / picker open — never blocks UI; uses disk + in-memory cache first. */
export function warmPickerCatalogs(): void {
  void import("./providers/claudeCode");
  void import("./providers/openCode");
  void import("./providers/cursorCode");
  void ensureModelDiscovery({ force: false });
  void warmLiveCliCatalogs(false);
}

/** Warm discovery during splash — overlaps with workspace hydration. */
export function prefetchModelDiscovery(): void {
  warmPickerCatalogs();
}
