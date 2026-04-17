---
type: feature-doc
project: quack-app
stack: Tauri v2 + React 18 + TypeScript
created: 2026-04-09
last_verified: 2026-04-09
tags: [pip, picture-in-picture, agents, multi-window, always-on-top]
---

## PiP Window (Picture-in-Picture)
**Purpose:** Floating always-on-top mini-window showing active agent sessions with real-time status, click-to-focus, and persistent geometry.
**Stack:** Tauri v2 WebviewWindow, React 18, Zustand, tauri-plugin-store

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Route/Page | `pip.html` | HTML entry point for the PiP webview (separate from main app); defines `pipSpin` and `pipPulse` CSS keyframes |
| Route/Page | `src/pip.tsx` | React root mount for PiP window; applies accent color from `settings-storage` localStorage before render |
| Component | `src/components/PipWindow.tsx` | Main PiP UI: draggable titlebar, scrollable agent list grouped by status (Working/Completed/Idle), footer with working count. Uses `var(--accent-color)` for title and badge. No border radius. |
| Component | `src/components/PipAgentCard.tsx` | Single agent row: avatar, status dot, name, project, last message, relative time; `React.memo` with custom comparator (status+lastMessage+lastActivity+agentName); module-level style constants |
| Service | `src/hooks/usePipWindow.ts` | Hook managing PiP lifecycle: open/close/toggle/show/hide, agent updates, geometry persistence. Listeners registered with `[]` deps + storeRef for lazy store access (Brain: 005-performance-critical-refactor) |
| Model/Type | `src/types.ts` | `PipAgentState`, `PipAgentStatus`, `PipWindowState` |
| Config | `src/App.css` | `.sidebar-footer-pip-active` accent highlight |
| Component | `src/components/TerminalSidebar.tsx` | PiP toggle button in sidebar footer (props: `onTogglePip`, `isPipOpen`) |
| Component | `src/components/TerminalSidebar.tsx` | PiP toggle button in sidebar-header-top (props: `onTogglePip`, `isPipOpen`); same `action-icon` pattern as favorites star |
| Component | `src/App.tsx` | PiP integration: agent state sync from sessionStore (debounced 500ms), Settings toggle listener, tray menu listener, click-to-focus handler. PiP is always closed on startup — user opens manually. |

### Data Flow
```
agentSessions (sessionStore) → App.tsx useEffect → maps to PipAgentState[] → updatePipAgents() → Tauri emit('pip-agents-update') → PipWindow listen → setAgents → groupedAgents (priority sort, lastActivity DESC) → PipAgentCard[]
PipAgentCard onClick → emit('pip-agent-clicked', {agentId, sessionId}) → App.tsx listen → handleSessionClick(sessionId) → session activation + chat focus + personality inject + main window focus
PipAgentCard contextMenu → PipWindow context menu → emit('pip-session-mark-done' | 'pip-session-delete' | 'pip-session-rename') → App.tsx listen → sessionStore action
PipWindow beforeunload → emit('pip-window-closing') → usePipWindow listen → Store.save(geometry)
Settings toggle → CustomEvent('pip-setting-changed') → App.tsx listener → open/closePipWindow
Tray menu → Tauri event('open-pip-window') → App.tsx listener → togglePipWindow
PiP is always closed on startup — user opens manually via sidebar button or Settings toggle
```

### Key Functions
- `usePipWindow() → { isPipOpen, openPipWindow, closePipWindow, togglePipWindow, updatePipAgents, showPipWindow, hidePipWindow }` — full PiP lifecycle management
- `openPipWindow() → void` — creates Tauri WebviewWindow with saved geometry, alwaysOnTop, transparent, no decorations; deduplicates via `WebviewWindow.getAll()`
- `closePipWindow() → void` — closes Tauri WebviewWindow and resets state
- `togglePipWindow() → void` — open if closed, close if open
- `updatePipAgents(agents: PipAgentState[]) → void` — emits agent state array to PiP window via Tauri events (no-op if not open)
- `resolveAvatarUrl(avatar?: string) → string` — resolves duck avatar filename via `convertFileSrc`; falls back to `duck15.jpeg` for custom UUIDs
- `getStatusColor(status: PipAgentStatus) → string` — maps agent status to hex color for dot indicator
- `formatTime(timestamp?: number) → string` — relative time display (seconds/minutes/hours)
- `groupedAgents (useMemo)` — groups agents by status: Working (streaming/executing/thinking/error), Completed, Idle. Working group shown first. Within each group, sorted by `lastActivity` descending (most recent first).
- `handleCardContextMenu(e, agent) → void` — opens right-click context menu on agent card (Mark as Done, Rename, Delete)
- `handleMarkDone() → void` — emits `pip-session-mark-done` Tauri event to main app
- `handleDelete() → void` — emits `pip-session-delete` Tauri event to main app
- `handleRenameRequest() → void` — opens inline rename dialog in PiP window
- `handleRenameConfirm() → void` — emits `pip-session-rename` Tauri event with new title to main app

### State
- `agents`: PipAgentState[] — current agent list displayed in PiP (component, PipWindow)
- `isPipOpen`: boolean — whether PiP window is active (component, usePipWindow)
- `pipWindow`: WebviewWindow | null — reference to Tauri webview instance (component, usePipWindow)
- `store`: Store | null — tauri-plugin-store instance for geometry persistence (component, usePipWindow)
- `pip-window-state`: PipWindowState — persisted position/size geometry (session, tauri-plugin-store `pip-settings.json`)
- `pip-enabled`: boolean — Settings toggle state only, no longer auto-opens on startup (session, `.quack-ui-prefs.dat`)
- `isLoading`: boolean — true until first `pip-agents-update` received (component, PipWindow)
- `contextMenu`: `{ x, y, agent } | null` — active context menu position and target agent (component, PipWindow)
- `renameDialog`: `{ agentId, sessionId, currentTitle } | null` — active rename dialog state (component, PipWindow)
- `renameValue`: string — controlled input for rename (component, PipWindow)

### External Dependencies
- `@tauri-apps/api/webviewWindow`: WebviewWindow creation, getAll(), label-based deduplication
- `@tauri-apps/api/event`: cross-window event emit/listen (`pip-agents-update`, `pip-agent-clicked`, `pip-window-closing`, `pip-window-ready`, `open-pip-window`, `pip-session-mark-done`, `pip-session-delete`, `pip-session-rename`)
- `@tauri-apps/plugin-store`: geometry persistence across restarts (`pip-settings.json`)
- `@tauri-apps/api/core`: `convertFileSrc` for duck avatar asset URLs
- `@tauri-apps/api/window`: `getCurrentWindow` for drag, minimize, close, position/size read

### Config
- `PIP_WINDOW_LABEL`: `'pip-window'` — Tauri window label
- `STORE_KEY_PIP_STATE`: `'pip-window-state'` — store key for geometry
- Window defaults: 320x420, minWidth 260, minHeight 200, alwaysOnTop, transparent, no decorations
- Status grouping: Working (streaming/executing/thinking/error), Completed, Idle — working first
- Accent color: title and badge use `var(--accent-color)`, scrollbar uses `var(--accent-border)`. Applied in pip.tsx from localStorage `settings-storage`.
- No border radius on PiP window (borderRadius: 0)
- No emojis in PiP UI

### Cross-References
- **043-agent-sidebar** — PiP click-to-focus triggers `handleSessionClick()` which sets `activeSessionId`; `AgentSessionItem` auto-scrolls into view via `scrollIntoView({ behavior: 'smooth', block: 'center' })` when `isActive` becomes true from external activation (PiP, Kanban, etc.)
- **054-task-hub-view** — PiP context menu (Mark Done, Rename, Delete) uses the same Tauri event pattern; both views share the same mental model for session management

### Types
- `PipAgentStatus`: `'idle' | 'thinking' | 'streaming' | 'executing' | 'completed' | 'error'`
- `PipAgentState`: `{ agentId, agentName, projectName?, avatar?, color, sessionId?, status, lastMessage?, lastActivity?, toolsExecuted, currentTool?, progress?, error? }`
- `PipWindowState`: `{ agents: PipAgentState[], position?: {x, y}, size?: {width, height} }`
