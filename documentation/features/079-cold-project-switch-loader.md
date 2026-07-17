---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-17
last_verified: 2026-07-17
tags: [workspace-switch, loader, perceived-performance, workspace-colors, veil, branding]
---

## Cold project-switch loader

**Purpose:** Mask the cold-mount lag when switching INTO a project that isn't
"warm" (Monaco widget creation + file-tree `list_dir`) with a full-window wash
tinted in that project's own color — so the wait reads as an intentional,
branded transition instead of a jank. Warm projects (last 3, `workspaceWarmSet`)
switch instantly and show nothing. Perceived-performance only: no work is
blocked. Sibling of `075-chat-switch-loader.md` (chat/session veil).

**Stack:** module-level pub/sub loader store + a single root-mounted overlay
component; color from `workspaceColors.ts`; end-signal shared with the
switch-perf editors-ready hook.

### Files

| Type | Path | Role |
|---|---|---|
| Loader store | `src/workspaceSwitchLoader.ts` | `beginWorkspaceLoad` / `endWorkspaceLoad`, grace + min-floor + cap timing, pub/sub |
| Overlay | `src/components/WorkspaceSwitchVeil.tsx` | Full-window tinted veil (badge + name), fade in/out; mounted once at app root (`App.tsx`) |
| Begin trigger | `src/store.ts` → `setActiveWorkspace` | Calls `beginWorkspaceLoad(id)` only when `prevId && !isWorkspaceWarm(id)` (a real, cold switch) |
| End trigger | `src/components/WorkspaceShell.tsx` | `endWorkspaceLoad(wsId)` when the incoming shell's editors are ready |
| Color | `src/workspaceColors.ts` | `getWorkspaceColor(wsId)?.hex` → CSS var `--ws-load-color` |
| Styles | `src/App.css` | `.ws-switch-veil*` — gradient wash, badge pulse, reduced-motion |
| Instrumentation | `src/switchPerf.ts` | Dev-only `[switch-perf]` phase timing (shares the editors-ready signal) |

### Data flow

```
setActiveWorkspace(id)
  → markSwitchStart(id)                         (switchPerf)
  → prevId && !isWorkspaceWarm(id) ?            (cold switch only)
        beginWorkspaceLoad(id)                  (start timers, not yet visible)
  → activeId = id → shells re-render
  → incoming WorkspaceShell mounts heavy UI (Monaco/tree)
  → editorsReady (useWorkspaceHeavyMount, 2× rAF)
        → logSwitchPhase("editors ready", wsId)
        → endWorkspaceLoad(wsId)                (fade out after MIN floor)
```

### Timing (`workspaceSwitchLoader.ts`)

| Constant | Value | Why |
|---|---|---|
| `SHOW_DELAY_MS` | 90 | Reveal only if the mount is actually slow — fast cold switches never flash a loader |
| `MIN_VISIBLE_MS` | 320 | Once revealed, keep it briefly so it doesn't blink out |
| `CAP_MS` | 2500 | Safety: drop even if `editors ready` never signals |

`endWorkspaceLoad` before reveal → drops instantly (no flash). After reveal →
fades out once `MIN_VISIBLE_MS` from reveal has elapsed.

### Visual (`App.css`)

- Base is the theme `--bg` so the veil **masks** the incoming content; a
  `radial-gradient` in `color-mix(--ws-load-color 26%)` over it gives the
  project-colored wash. Uncolored projects fall back to neutral `--accent`.
- Centered `.ws-switch-veil-inner`: colored **initials badge** (same rule as the
  activity-bar icon — `CO`, `VI`, `GG`) + project name, soft `wsSwitchPulse`
  shadow. `translateY + scale` rise-in on `.is-shown`.
- `z-index: 400`, `pointer-events: none` (never traps input). Theme-aware via
  `--bg`/`--fg`/`color-mix`. `prefers-reduced-motion` disables the transitions.

### Gotchas

- **Warm-skip is the whole point:** begin is gated on `!isWorkspaceWarm(id)`,
  read BEFORE the switch (the warm set updates in the mount hook's effect,
  after). So a project you just left is still "warm" → instant, no loader.
- **Initial activation skipped** (`prevId` null) — the splash (`032`) owns first
  paint; the loader is for switches only.
- **End needs editors-ready**, which fires even when the project has no file tab
  open (the hook sets `editorsReady` regardless); the `CAP` covers the rest.

### Verify

1. Switch to a project NOT among the last 3 used → colored full-window wash with
   its badge, fading out as it mounts.
2. Switch back to it immediately → instant, no loader (warm).
3. A tiny cold project (mounts < ~90ms) → no flash (SHOW_DELAY).
4. Reduced-motion on → veil still masks, no animation.

### Related

| Doc | Link |
|---|---|
| Chat/session switch loader (sibling) | `075-chat-switch-loader.md` |
| Switch performance (memo, warm-LRU) | `058-workspace-switch-performance.md` |
| Per-project colors | `002-workspace-colors.md` |
| Diary | `documentation/diary/2026-07-17.md` |
