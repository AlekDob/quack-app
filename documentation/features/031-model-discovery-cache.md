---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-03
last_verified: 2026-07-11
tags: [model-discovery, startup, cache, providers, ollama, claude-code, cursor-cli, opencode-cli, performance, lazy-mount, disk-persist, stale-while-revalidate]
---

## Model Discovery Cache
**Purpose:** One shared, TTL-backed snapshot of provider availability + installed models for every `AIChatPanel`. Avoids re-probing all providers on each new chat tab or panel mount; prefetches during splash so the first composer is ready sooner.
**Stack:** Module-level pub/sub (`modelDiscoveryStore.ts`), React 19 consumers (`AIChatPanel`, `App.tsx`), `providers/*` fetch layer

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Store | `src/modelDiscoveryStore.ts` | `ensureModelDiscovery`, `ensureCloudCatalog`, `cloudCatalogComplete`, `prefetchModelDiscovery`, `invalidateModelDiscovery`, `mergeLiveCliModelsIntoDiscovery`, `subscribeModelDiscovery`, `getModelDiscovery` |
| Component | `src/components/AIChatPanel.tsx` | `pickerCloudModels` + `browserCloudModels`; subscribes to store; lazy cloud catalog on browser/manage open |
| Component | `src/components/WorkspaceShell.tsx` | `AIChatHost` lazy-mount + only active workspace mounts chat hosts |
| Component | `src/App.tsx` | `prefetchModelDiscovery()` in boot effect (parallel with `hydrate()`) |
| Store | `src/store.ts` | Parallel `Promise.all` workspace hydration during `hydrate()` |
| Service | `src/providers/keys.ts` | `setApiKey` → `invalidateModelDiscovery()` |
| Service | `src/providers/index.ts` | `listFastModels`, `listAllCloudModels`, `claudeCodePickerModels` (underlying probes) |

### Data Flow
**Cold start (splash):** `App.tsx` boot → `prefetchModelDiscovery()` ∥ `store.hydrate()` → hydrate disk snapshot (`lcp.modelDiscovery.v1`) if present → `listFastModels()` (no CC CLI spawn) + `ping` + background CLI availability probes → cache + notify

**New chat / panel mount:** `AIChatPanel` mount → `getModelDiscovery()` hydrate UI instantly if warm → `ensureModelDiscovery({ force: false })` (cache hit or deduped inflight) → `applyDiscoverySnapshot`

**Force refresh:** user Refresh / Ollama poll / pull complete / post-install timers → `refresh({ force: true })` → `invalidateClaudeCodeCache` inside fetch → full re-probe

**Cloud catalog (deferred):** `browserOpen` or `manageModelsOpen` → `ensureCloudCatalog()` → `listAllCloudModels()` → merge into cache → notify all panels

**Live CLI catalogs (deferred):** picker `onOpen` or browser open → `refreshLiveCliModels()` → `ccCliInflight` (CC) + `liveCliInflight` (OC+Cursor) → `mergeLiveCliModelsIntoDiscovery` → notify

**API key edit:** Settings → `setApiKey` → `invalidateModelDiscovery()` → subscribers refetch or apply stale snapshot cleared

### Key Functions
- `prefetchModelDiscovery() → void` — fire-and-forget during splash; overlaps with workspace hydration
- `ensureModelDiscovery({ force? }) → ModelDiscoverySnapshot` — cache read / deduped inflight fetch / TTL 60s
- `ensureCloudCatalog() → ProviderModel[]` — lazy full cloud lists for Model Browser; gated by `cloudCatalogComplete` (not merely `cloudCatalog.length`)
- `invalidateModelDiscovery() → void` — drop cache + cloud inflight; notify subscribers
- `mergeLiveCliModelsIntoDiscovery(oc, cursor, cc?) → void` — merge lazy CLI lists into shared cache
- `listFastModels() → ProviderModel[]` — instant slice: API providers + `claudeCodePickerModels()` fallbacks; skips CC subprocess on cold path
- `subscribeModelDiscovery(cb) → unsubscribe` — all open panels stay in sync
- `applyDiscoverySnapshot(snap) → void` — `AIChatPanel` local state + model migration/selection
- `refresh({ showChecking?, force? }) → Promise<void>` — panel wrapper around `ensureModelDiscovery`

### State
- `ModelDiscoverySnapshot`: `{ allModels, cloudCatalog, claudeCodeAvailable, cursorCliAvailable, openCodeAvailable, ollamaUp, fetchedAt }` — module-global cache + disk mirror
- `TTL_MS`: 60000 — soft staleness; `force: true` bypasses
- `DISK_KEY`: `lcp.modelDiscovery.v1` — localStorage snapshot for instant reopen across app restarts
- `inflight` / `cloudInflight` / `liveCliInflight` / `ccCliInflight`: dedupe concurrent fetches

### External Dependencies
- `listFastModels()` — instant provider slice without CC subprocess (`providers/index.ts`)
- `listAllCloudModels()` — curated cloud lists regardless of key (browser only)
- `ping()` — Ollama reachability (`ai.ts`)
- `invalidateClaudeCodeCache()` — only on `force` refresh (post-install detection)
- `refreshClaudeCodeModelsLive()` — full CC catalog (`059`)

### Config
- `lcp.modelDiscovery.v1`: last `ModelDiscoverySnapshot` (CLI model hints + availability flags)

### Gotchas
- **Startup lightweight fetch:** initial snapshot uses `listFastModels` — CC shows instant fallbacks until live refresh (`059`).
- **Disk stale-while-revalidate:** reopen merges disk hints with fresh fast models; live CLI refresh replaces CC/OC/Cursor rows when popover opens.
- **Picker-before-browser trap (fixed):** lazy OpenCode/Cursor merges used to write into `cloudCatalog` before the full fetch, so `ensureCloudCatalog()` early-returned and Claude Code showed "No models match" in the browser. Live CLI merges now touch `allModels` only until `cloudCatalogComplete`.
- **Claude availability:** background `probeClaudeAvailability()` on soft fetch; force refresh still invalidates CC cache.
- **Cursor/OpenCode default row:** unavailable CLIs still expose a default model id — availability flags need separate `isAvailable` probe.
- **New chat slowness (fixed):** was one full provider probe per `AIChatPanel` mount; now shared cache + lazy tab mount (see `001-ai-session-library.md` gotcha update).
- **Background workspace chats:** `AIChatHost` renders only when `isActive` workspace; switching project mounts hosts on first visit (cache usually warm).
- **Hidden chat tabs:** `AIChatHost` sets `mounted` on first `visible` — background tabs in the active workspace do not mount until selected (streams in hidden tabs won't run until shown — editor mode tradeoff).
- **Splash overlap:** 700 ms min splash (`App.tsx`) still gates UI; prefetch runs during that window so model probe overlaps hydration rather than blocking first paint after splash.
