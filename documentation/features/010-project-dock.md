---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-06
tags: [dock, floating-window, always-on-top, badge, notifications, agent-status, multi-window, macos]
---

## Floating Project Dock

**Purpose:** A small **always-on-top** companion window — a rounded pill of per-project circles — that stays visible on every macOS Space even when the main window is behind other apps, so Alek sees which project's agents need him and jumps straight there. Plus the **native macOS Dock-icon badge** (red counter) showing total chats needing attention, visible even when the app isn't focused. Companion to the in-app Agent Hub (`009-agent-hub.md`).
**Stack:** Second Tauri `WebviewWindow` (label `dock`), React 19, Tauri events for cross-window state, `set_badge_count`.

### What it shows

A strip (horizontal or vertical): a drag grip (dotted handle) · Jack avatar (`/jack.jpeg`, circular) · an **orientation toggle** (⟲) · separator · one circle per open workspace. Each circle = project color + initials; an attention **ring** for the most urgent state (purple = needs-input, green = ready) and a **counter badge**. Click a circle → bring the main window forward and jump to that project's most urgent chat (needs-input → ready → most recent).

### Architecture — main produces, dock renders

The Dock is a separate webview (separate JS context), so it can't read the main window's stores. The main window is the single producer:
- **`AgentHubWatcher`** (main) calls `emitDockSummary()` after each recompute and on permission events → emits the `dock:summary` Tauri event (per-project `{wsId, name, colorHex, ready, needsInput}`) and sets the native badge via the `set_dock_badge` Rust command. `emitDockSummary` wraps the compute in try/catch so a status-compute error can never kill the watcher's poll loop.
- **`DockWindow`** listens to `dock:summary`, renders, and on mount emits `dock:request` so the main window pushes the current state immediately.
- **Click** → `DockWindow` emits `dock:focus-project` (wsId) and focuses the main window; the main window's bridge (`App.tsx`) does `setActiveWorkspace` + `focusAIChat(urgent)`.

Counter semantics: `computeDockProjects` counts via the SAME `resolveDisplayStatus` the Agent Hub uses (`ready` + `needs-input`), so a project that reads "Ready" in the hub shows its badge here too — they're always consistent. (Earlier it counted only live records and missed resting-ready chats.)

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
| Quit teardown (close Dock webview) | `src/appQuit.ts`, `src/dock.ts` (`closeDock`) |
| Window perms (dock label + show/position/always-on-top + **destroy**) | `src-tauri/capabilities/default.json` |
| Transparent window enablement | `src-tauri/tauri.conf.json` `app.macOSPrivateApi: true` + Cargo feature `macos-private-api` |
| Dock styles | `src/App.css` (`.dock-*`) |

### Orientation (horizontal ⇄ vertical)

The **⟲ toggle button** flips the dock between horizontal and vertical (circles stacked); persisted in `lcp.dock.orient`. (Earlier this was auto-detected from screen-edge proximity on drag — removed as fiddly/surprising in favour of the explicit button.) On orientation or project-count change the window is resized to fit exactly via `setSize(windowSizeFor(orient, n))` (constants must match the `.dock-*` CSS), and the projects strip replays a short `dock-reflow` entry animation (keyed by orientation). `.dock-projects` uses `overflow: visible` (NOT scroll) so the hover scale + attention ring/badge are never clipped — the window is sized to the count instead. **Self-heal:** if `setSize` is rejected (the `allow-set-size` capability isn't live until tauri restarts), orientation reverts to horizontal so the dock can't end up an invisible vertical pill in a wide-short window.

### Window config + recovery

`new WebviewWindow("dock", { width:440, height:104, decorations:false, transparent:true, alwaysOnTop:true, visibleOnAllWorkspaces:true, skipTaskbar:true, resizable:false, focus:false })` then resized to fit. Position persisted to localStorage (`lcp.dock.pos`) on move; `onScreenPos()` discards a stale off-screen position (re-centres). Enabled pref `lcp.dock.enabled` (default on). Auto-opens on boot. **Recovery:** if a `dock` window already exists (e.g. survived a reload in a broken/off-screen/wrong-sized state), `openDock` recovers it in place — reset to horizontal, default size, on-screen position, show/focus — instead of just show/focus.

### Gotchas

- **Transparent window on macOS needs `macOSPrivateApi: true`** in `tauri.conf.json` + the `macos-private-api` Cargo feature on `tauri`. Not App-Store-safe (private API) — fine for direct distribution.
- **`set_badge_count` lives on `WebviewWindow`/`Window`, not `AppHandle`** (tauri 2.x). The command grabs the `main` window and sets it; macOS maps it to the app icon.
- **The producer is the main window's JS.** If the main window is hidden/minimized/on another Space the watcher keeps running (dock stays live). If the main window is fully CLOSED, the watcher stops and the dock freezes (badge/summary stop updating) — acceptable v1; a self-sufficient dock watcher would be phase 2.
- Same shared-bundle pattern as the terminal popout (`index.html?dock=1`); the dock pulls the full app JS — fine, mirrors popout.
- **A separate window survives a main-window reload** (Cmd+R) but NOT a full `tauri dev` restart. A window left in a broken state (failed vertical resize → invisible/off-screen) reappears on reload; `openDock`'s recovery fixes it in place, and a full restart clears it entirely.
- **`allow-set-size` / `allow-set-position` need a `tauri dev` restart** to take effect — until then orientation/resize/recovery silently no-op (the self-heal keeps the dock horizontal-and-visible).
- Requires a full `tauri dev` restart to pick up: the new commands, capabilities, window label, notification plugin, and `macOSPrivateApi` (Rust/config changes, not HMR).
- **Quit must destroy the Dock window.** `WebviewWindow.close()` on secondary webviews maps to `destroy` in Tauri 2 release builds. Without `core:window:allow-destroy` in `capabilities/default.json`, ⌘Q logs `window.destroy not allowed` and the app stays open. `appQuit.ts` closes Dock + popouts before the main window.
