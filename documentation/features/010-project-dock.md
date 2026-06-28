---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-06-28
tags: [dock, floating-window, always-on-top, badge, notifications, agent-status, multi-window, macos]
---

## Floating Project Dock

**Purpose:** A small **always-on-top** companion window — a rounded pill of per-project circles — that stays visible on every macOS Space even when the main window is behind other apps, so Alek sees which project's agents need him and jumps straight there. Plus the **native macOS Dock-icon badge** (red counter) showing total chats needing attention, visible even when the app isn't focused. Companion to the in-app Agent Hub (`009-agent-hub.md`).
**Stack:** Second Tauri `WebviewWindow` (label `dock`), React 19, Tauri events for cross-window state, `set_badge_count`.

### What it shows

A horizontal strip: a drag grip (dotted handle) · Jack avatar (`/jack.jpeg`, circular) · separator · one circle per open workspace. Each circle = project color + initials; an attention **ring** for the most urgent state (purple = needs-input, green = ready) and a **counter badge** (needs-input + ready). Click a circle → bring the main window forward and jump to that project's most urgent chat (needs-input → ready → most recent).

### Architecture — main produces, dock renders

The Dock is a separate webview (separate JS context), so it can't read the main window's stores. The main window is the single producer:
- **`AgentHubWatcher`** (main) calls `emitDockSummary()` after each recompute and on permission events → emits the `dock:summary` Tauri event (per-project `{wsId, name, colorHex, ready, needsInput}`) and sets the native badge via the `set_dock_badge` Rust command.
- **`DockWindow`** listens to `dock:summary`, renders, and on mount emits `dock:request` so the main window pushes the current state immediately.
- **Click** → `DockWindow` emits `dock:focus-project` (wsId) and focuses the main window; the main window's bridge (`App.tsx`) does `setActiveWorkspace` + `focusAIChat(urgent)`.

Counter semantics: "ready"/"needs-input" here mean **actionable** — a live status record that's still unseen — NOT the hub's resting "ready" baseline. So the badge reflects "things waiting for you", not every chat (`computeDockProjects` in `dockSummary.ts`).

### Key files

| Concern | File |
|---|---|
| Window lifecycle (open/close/toggle, position persistence, enabled pref) | `src/dock.ts` |
| Dock UI (circles, badges, drag, theme sync, click→focus) | `src/components/DockWindow.tsx` |
| Shared contract + summary compute + badge | `src/dockSummary.ts` |
| Producer hooks (`emitDockSummary` calls) | `src/components/AgentHubWatcher.tsx` |
| Routing (`?dock=1` → `<DockWindow/>`), auto-open, focus bridge | `src/App.tsx` (`IS_DOCK`) |
| Toggle command (`view.toggle_dock`, Ctrl+Shift+D) | `src/actions.ts` |
| Native badge command | `src-tauri/src/lib.rs` → `set_dock_badge` (uses `WebviewWindow::set_badge_count`) |
| Window perms (dock label + show/position/always-on-top) | `src-tauri/capabilities/default.json` |
| Transparent window enablement | `src-tauri/tauri.conf.json` `app.macOSPrivateApi: true` + Cargo feature `macos-private-api` |
| Dock styles | `src/App.css` (`.dock-*`) |

### Window config

`new WebviewWindow("dock", { width:400, height:72, decorations:false, transparent:true, alwaysOnTop:true, visibleOnAllWorkspaces:true, skipTaskbar:true, resizable:false, focus:false })`. Position persisted to localStorage (`lcp.dock.pos`) on move; enabled pref `lcp.dock.enabled` (default on). Auto-opens on boot.

### Gotchas

- **Transparent window on macOS needs `macOSPrivateApi: true`** in `tauri.conf.json` + the `macos-private-api` Cargo feature on `tauri`. Not App-Store-safe (private API) — fine for direct distribution.
- **`set_badge_count` lives on `WebviewWindow`/`Window`, not `AppHandle`** (tauri 2.x). The command grabs the `main` window and sets it; macOS maps it to the app icon.
- **The producer is the main window's JS.** If the main window is hidden/minimized/on another Space the watcher keeps running (dock stays live). If the main window is fully CLOSED, the watcher stops and the dock freezes (badge/summary stop updating) — acceptable v1; a self-sufficient dock watcher would be phase 2.
- Same shared-bundle pattern as the terminal popout (`index.html?dock=1`); the dock pulls the full app JS — fine, mirrors popout.
- Requires a full `tauri dev` restart to pick up: the new command, capability, window label, notification plugin, and `macOSPrivateApi` (Rust/config changes, not HMR).
