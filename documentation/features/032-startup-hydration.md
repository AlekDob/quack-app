---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-03
last_verified: 2026-07-11
tags: [startup, splash, hydrate, workspace, performance, parallel-load]
---

## Startup & Workspace Hydration
**Purpose:** Boot sequence from app launch to interactive UI: splash gate, workspace index restore, parallel project open, and overlapping model-discovery prefetch.
**Stack:** `App.tsx` splash gate, Zustand `store.hydrate()`, Rust `workspace.rs` persistence

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/App.tsx` | Splash min 700 ms + `hydrated` gate; `prefetchModelDiscovery()` ∥ `hydrate()` |
| Component | `src/components/Splash.tsx` | Brand splash while booting |
| Store | `src/store.ts` | `hydrate()`, `loadWorkspaceFromDisk()`, `hydrateProgress` |
| Service (Rust) | `src-tauri/src/workspace.rs` | `workspaces.json` index + per-workspace `state.json` |
| Store | `src/chatStoreCache.ts` | `hydrateChatStore(wsId)` — disk chat transcripts + legacy migrate (`043`) |
| Store | `src/modelDiscoveryStore.ts` | `prefetchModelDiscovery()` — see `031-model-discovery-cache.md` |

### Data Flow
**Boot:** `MainApp` mount → `bootstrapTheme` + `startFsBusOnce` + `installNativeMenu` → `prefetchModelDiscovery()` ∥ `hydrate()` → splash until `hydrated && splashMinElapsed(700ms)` → render shell

**Hydrate:** `wsApi.load()` index → `ptyApi.listSessions()` live PTYs → `Promise.all(requestedOpen.map(loadWorkspaceFromDisk))` → `Promise.all(survivingIds.map(hydrateChatStore))` (chat transcripts from disk + legacy migrate) → merge `loaded` + `openIds` + `activeId` → `hydrated: true`

**Per workspace disk load:** `loadState` → normalize layout + aiChats + terminals → parallel `readFile` for open editor tabs → prune dead tabs → return `WorkspaceData`

**Post-hydrate UI:** active `WorkspaceShell` mounts; inactive shells `display:none` but stay mounted (Monaco DOM-move gotcha — see `012-workspace-reorder.md`); only active workspace mounts `AIChatHost` rows; **heavy surfaces** (sidebar, Monaco, tab portals) tear down on blur via `useWorkspaceHeavyMount` — see `058-workspace-switch-performance.md`

### Key Functions
- `hydrate() → Promise<void>` — full boot restore; parallel workspace opens
- `loadWorkspaceFromDisk(meta, liveSessionIds) → WorkspaceData` — layout + files + terminal filter
- `prefetchModelDiscovery() → void` — overlap provider probe with hydration (031)
- `splashMinElapsed` — 700 ms latch independent of hydration speed

### State
- `hydrated`: boolean — splash gate (global)
- `hydrateProgress`: `{ phase, current, total }` — splash progress text (global)
- `openIds` / `activeId` / `loaded` — restored from disk index (global)

### Gotchas
- **Parallel workspace open:** multiple projects restore concurrently; progress text may jump (last-finishing workspace wins the bar).
- **Splash minimum:** fast SSD + one workspace still waits ~700 ms for brand display — intentional; prefetch uses that window.
- **Inactive workspace weight:** shell DOM + tab bar stay mounted for Monaco stability and terminal containers; sidebar/Monaco/tab portals **unmount** when backgrounded (`058-workspace-switch-performance.md`). Chat side panel stays for multitask; usage polls gated to `activeId`.
- **Corrupt index:** unreadable `workspaces.json` resets to empty index with toast — app no longer stuck on splash forever.
