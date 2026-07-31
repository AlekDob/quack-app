---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-03
last_verified: 2026-07-31
tags: [model-discovery, startup, cache, providers, ollama, claude-code, cursor-cli, performance, lazy-mount, disk-persist, stale-while-revalidate]
---

## Model Discovery Cache
**Purpose:** One shared, TTL-backed snapshot of provider availability + installed models for every `AIChatPanel`. Avoids re-probing all providers on each new chat tab or panel mount; prefetches during splash so the first composer is ready sooner.
**Stack:** Module-level pub/sub (`modelDiscoveryStore.ts`), React 19 consumers (`AIChatPanel`, `App.tsx`), `providers/*` fetch layer

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Store | `src/modelDiscoveryStore.ts` | `ensureModelDiscovery`, `ensureCloudCatalog`, `ensureLiveCliCatalogs`, `warmPickerCatalogs`, `prefetchModelDiscovery`, `invalidateModelDiscovery`, `mergeLiveCliModelsIntoDiscovery`, `subscribeModelDiscovery`, `getModelDiscovery` |
| Component | `src/components/AIChatPanel.tsx` | Subscribes to store; `refreshLiveCliModels` → `ensureLiveCliCatalogs`; lazy cloud on browser/manage open |
| Component | `src/components/WorkspaceShell.tsx` | `AIChatHost` lazy-mount + only active workspace mounts chat hosts |
| Component | `src/App.tsx` | `prefetchModelDiscovery()` in boot effect (parallel with `hydrate()`) |
| Store | `src/store.ts` | Parallel `Promise.all` workspace hydration during `hydrate()` |
| Service | `src/providers/keys.ts` | `setApiKey` → `invalidateModelDiscovery()` |
| Service | `src/providers/index.ts` | `listFastModels`, `listAllCloudModels`, `claudeCodePickerModels`, `invalidateCursorCliCache` |

### Data Flow
**Cold start (splash):** `App.tsx` boot → `prefetchModelDiscovery()` ∥ `store.hydrate()` → hydrate disk snapshot (`lcp.modelDiscovery.v1`) if present → `listFastModels()` (no CC CLI spawn) + `ping` + background CLI availability probes → cache + notify

**New chat / panel mount:** `AIChatPanel` mount → `getModelDiscovery()` hydrate UI instantly if warm → `ensureModelDiscovery({ force: false })` (cache hit or deduped inflight) → `applyDiscoverySnapshot`

**Force refresh:** user Refresh / Ollama poll / pull complete → `refresh({ force: true })` → invalidate CC + Cursor TS caches → await Cursor `probeCliAvailability` → full re-probe

**Cloud catalog (deferred):** `browserOpen` or `manageModelsOpen` → `ensureCloudCatalog()` → `listAllCloudModels()` → merge into cache → notify all panels

**Live CLI catalogs (deferred):** picker hover/open or Model Browser open → `ensureLiveCliCatalogs` / `warmLiveCliCatalogs` → await Cursor probe → `ccCliInflight` + `liveCliInflight` → `mergeLiveCliModelsIntoDiscovery` → notify

**API key edit:** Settings → `setApiKey` → `invalidateModelDiscovery()` → subscribers refetch or apply stale snapshot cleared

### Key Functions
- `prefetchModelDiscovery() → void` — fire-and-forget during splash; overlaps with workspace hydration
- `ensureModelDiscovery({ force? }) → ModelDiscoverySnapshot` — cache read / deduped inflight fetch / TTL 60s
- `ensureCloudCatalog() → ProviderModel[]` — lazy full cloud lists for Model Browser; gated by `cloudCatalogComplete` (not merely `cloudCatalog.length`)
- `ensureLiveCliCatalogs(force?) → Promise<void>` — awaitable CLI warm (Model Browser open / Refresh path)
- `warmPickerCatalogs() → void` — fire-and-forget import + soft discovery + `warmLiveCliCatalogs`
- `invalidateModelDiscovery() → void` — drop cache + cloud inflight; notify subscribers
- `mergeLiveCliModelsIntoDiscovery(cursor, cc?) → void` — merge lazy CLI lists into shared cache
- `listFastModels() → ProviderModel[]` — instant slice: API providers + `claudeCodePickerModels()` fallbacks; skips CC subprocess on cold path
- `subscribeModelDiscovery(cb) → unsubscribe` — all open panels stay in sync
- `applyDiscoverySnapshot(snap) → void` — `AIChatPanel` local state + model migration/selection
- `refresh({ showChecking?, force? }) → Promise<void>` — panel wrapper around `ensureModelDiscovery`

### State
- `ModelDiscoverySnapshot`: `{ allModels, cloudCatalog, claudeCodeAvailable, cursorCliAvailable, ollamaUp, fetchedAt }` — module-global cache + disk mirror
- `TTL_MS`: 60000 — soft staleness; `force: true` bypasses
- `DISK_KEY`: `lcp.modelDiscovery.v1` — localStorage snapshot for instant reopen across app restarts
- `inflight` / `cloudInflight` / `liveCliInflight` / `ccCliInflight`: dedupe concurrent fetches

### External Dependencies
- `listFastModels()` — instant provider slice without CC subprocess (`providers/index.ts`)
- `listAllCloudModels()` — curated cloud lists regardless of key (browser only)
- `ping()` — Ollama reachability (`ai.ts`)
- `invalidateClaudeCodeCache()` / `invalidateCursorCliCache()` — both on `force` refresh
- `refreshClaudeCodeModelsLive()` / `refreshCursorModelsLive()` — full CLI catalogs (`059`, `026`)

### Config
- `lcp.modelDiscovery.v1`: last `ModelDiscoverySnapshot` (CLI model hints + availability flags)

### Gotchas
- **Startup lightweight fetch:** initial snapshot uses `listFastModels` — CC shows instant fallbacks until live refresh (`059`).
- **Disk stale-while-revalidate:** reopen merges disk hints with fresh fast models; live CLI refresh replaces CC/Cursor rows when popover opens. Missing `cursorCliAvailable` on old disk snaps defaults to `false`.
- **Picker-before-browser trap (fixed):** lazy CLI merges used to write into `cloudCatalog` before the full fetch, so `ensureCloudCatalog()` early-returned and Claude Code showed "No models match" in the browser. Live CLI merges now touch `allModels` only until `cloudCatalogComplete`.
- **Claude availability:** background `probeClaudeAvailability()` on soft fetch; force refresh still invalidates CC cache.
- **Cursor availability on force:** soft fetch keeps fire-and-forget probe; `force: true` **awaits** `probeCliAvailability` so Refresh cannot return a stale "CLI missing" snapshot (bug `009`).
- **Cursor default row:** unavailable CLI still exposes a default model id — UI `hasKey["cursor-cli"]` must use `cursorCliAvailable`, not model presence alone.
- **New chat slowness (fixed):** was one full provider probe per `AIChatPanel` mount; now shared cache + lazy tab mount (see `001-ai-session-library.md` gotcha update).
- **Background workspace chats:** `AIChatHost` renders only when `isActive` workspace; switching project mounts hosts on first visit (cache usually warm).
- **Hidden chat tabs:** `AIChatHost` sets `mounted` on first `visible` — background tabs in the active workspace do not mount until selected (streams in hidden tabs won't run until shown — editor mode tradeoff).
- **Splash overlap:** splash still gates UI; prefetch runs during that window so model probe overlaps hydration rather than blocking first paint after splash.
- **Stale `cursorCliAvailable` skipped the CLI warm-up (fixed 2026-07-27):** `warmLiveCliCatalogs` gated on `snap.cursorCliAvailable`, which starts `false` and is only corrected by a fire-and-forget `probeCliAvailability` call — opening the picker before that probe landed skipped the Cursor warm-up entirely. Fixed by `await`ing the probe before the gate. Paired with `listModels()` in `026`.
- **Model Browser early-return (fixed 2026-07-31):** `refreshLiveCliModels` used to bail when `snap.cursorCliAvailable` was false. Now delegates to `ensureLiveCliCatalogs` (same await-probe path). See bug `009` + Rust PATH fix in `026`.
