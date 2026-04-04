---
type: feature-doc
project: quack-app
stack: Tauri v2 (Rust + React 18 + TypeScript)
created: 2026-04-04
last_verified: 2026-04-04
tags: [terminal, pty, xterm, native-terminal, popout-window]
---

## Terminal
**Purpose:** Embedded PTY terminal system with multi-instance management, native terminal app launching, project-grouped terminals, and popout window support.
**Stack:** Rust (portable-pty) + React 18 + XTerm.js + Zustand + Tauri v2

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | src-tauri/src/terminal.rs | PTY session registry, spawn/write/resize/close/list Tauri commands, port detection |
| Service | src-tauri/src/native_terminal.rs | Launch native terminal apps (iTerm, Warp, etc.) via AppleScript, detect installed apps |
| Store/State | src/stores/terminalStore.ts | `useTerminalStore` — terminals, nativeTerminals, projectTerminals, activeIds, manualProjects |
| Service | src/services/terminalStorage.ts | Persistent storage via Tauri Store plugin (`quack-terminals.json`), migration helpers |
| Service | src/contexts/TerminalContext.tsx | `TerminalContext` — legacy React context for terminal CRUD, event listeners, agent terminals |
| Component | src/components/terminal/TerminalMain.tsx | `TerminalMain` — multi-instance container, renders all terminals but shows active only |
| Component | src/components/terminal/TerminalInstance.tsx | `TerminalInstance` — single XTerm wrapper with search/filter/clear keyboard shortcuts |
| Service | src/components/terminal/useTerminal.ts | `useTerminal` hook — XTerm.js lifecycle, Tauri event listeners, resize observer, filter mode |
| Config | src/components/terminal/TerminalThemes.ts | 10 terminal color themes (dracula, tokyo-night, one-dark, catppuccin-mocha, etc.) |
| Component | src/components/terminal/TerminalSearchBar.tsx | `TerminalSearchBar` — XTerm SearchAddon UI with case-sensitive toggle |
| Component | src/components/terminal/TerminalFilterBar.tsx | `TerminalFilterBar` — line-level grep filter with debounced input and match count |
| Component | src/components/TerminalView.tsx | `TerminalView` — older multi-terminal renderer used in main app window |
| Component | src/components/TerminalWindow.tsx | `TerminalWindow` — embedded terminal panel grouped by project path |
| Component | src/components/TerminalWindowApp.tsx | `TerminalWindowApp` — standalone popout window for project terminal management |
| Component | src/components/TerminalDrawer.tsx | `TerminalDrawer` — slide-out drawer for single terminal + toolbar |
| Component | src/components/StandaloneTerminal.tsx | `StandaloneTerminal` — independent terminal window from URL params |
| Component | src/components/TerminalTabs.tsx | `TerminalTabs` — tab bar with color indicators and close buttons |
| Component | src/components/TerminalGroup.tsx | `TerminalGroup` — collapsible group of terminals by cwd, drag-and-drop support |
| Component | src/components/TerminalSidebar.tsx | `TerminalSidebar` — sidebar listing all terminals with project grouping |
| Component | src/components/TerminalSidebarPanel.tsx | `TerminalSidebarPanel` — sidebar for TerminalWindow, grouped by project path |
| Component | src/components/TerminalActivityBar.tsx | `TerminalActivityBar` — status dot, busy/idle indicator, avatar display |
| Component | src/components/TerminalToolBar.tsx | `TerminalToolBar` — quick-launch bar (Claude Code, Factory AI, saved commands) |
| Component | src/components/TerminalQuickActions.tsx | `TerminalQuickActions` — quick action buttons for terminal helper/Claude/Factory/Codex |
| Component | src/components/TerminalIcon.tsx | `TerminalIcon` — SVG terminal icon component |
| Component | src/components/TerminalWindowButton.tsx | Button to open/create terminal windows |
| Component | src/components/TerminalWindowsPanel.tsx | `TerminalWindowsPanel` — manages multiple terminal drawers |
| Component | src/components/ProjectTerminalItem.tsx | `ProjectTerminalItem` — single terminal row in project sidebar |
| Component | src/components/settings/categories/TerminalSettings.tsx | `TerminalSettings` — default shell selection |
| Component | src/components/NewTerminalModal.tsx | Modal dialog for creating new terminals |
| Component | src/components/AddNativeTerminalModal.tsx | Modal for adding native terminal app references |
| Component | src/components/AddTerminalWindowModal.tsx | Modal for adding terminal windows |
| Service | src/hooks/useTerminalWindowManager.ts | `useTerminalWindowManager` — open/close standalone Tauri terminal window, pass projects + commands |
| Service | src/hooks/useTerminalWindows.ts | `useTerminalWindows` — create WebviewWindow for standalone terminal with PTY backend |
| Service | src/utils/terminalUtils.ts | `TERMINAL_COLORS`, `ANSI_REGEX`, `PROMPT_REGEX`, `normalizeKey`, `slugify` |
| Route/Page | src/terminal-entry.tsx | Entry point for embedded terminal webview |
| Route/Page | src/terminal-window-entry.tsx | Entry point for popout terminal webview window |
| Test | src/tests/terminalUtils.test.ts | Unit tests for terminal utility functions |
| Test | src/tests/projectTerminalItem.test.ts | Tests for ProjectTerminalItem component |

### Data Flow
- **Embedded terminal:** UI → `invoke('create_terminal')` → Rust `terminal.rs` (PTY spawn via `portable_pty`) → Tauri event `terminal-data-{id}` → XTerm.js `write()`
- **User input:** XTerm.js `onData` → `invoke('write_to_terminal')` → Rust PTY writer → shell process
- **Resize:** ResizeObserver → FitAddon → `invoke('resize_terminal')` → Rust PTY `resize()`
- **Native terminal:** UI → `invoke('open_native_terminal')` → Rust `native_terminal.rs` → AppleScript → macOS terminal app
- **Port detection:** Rust PTY output → `detect_port_from_output()` regex → `TerminalInfo.detected_port`
- **Persistence:** `TerminalInfo[]` → `terminalStorage.saveTerminalsToStorage()` → Tauri Store (`quack-terminals.json`)
- **Popout window:** `useTerminalWindowManager.openTerminalWindow()` → `WebviewWindow(terminal.html)` → `TerminalWindowApp`

### Key Functions
**Rust (terminal.rs)**
- `create_terminal(app, id?, label?, color?, cwd?, working_on?, avatar?, branch?) → TerminalInfo` — spawn PTY session with shell
- `write_to_terminal(id, data) → void` — write bytes to PTY master
- `resize_terminal(id, rows, cols) → void` — resize PTY dimensions
- `close_terminal(id) → void` — kill child process and remove session
- `list_terminals() → Vec<TerminalInfo>` — list all active terminal sessions
- `get_active_processes() → Vec<ProcessInfo>` — list terminals with detected ports
- `update_terminal(id, label?, color?, cwd?, working_on?, avatar?, branch?) → TerminalInfo` — update session metadata
- `set_terminal_color(id, color) → TerminalInfo` — change terminal color
- `terminal_exists(id) → bool` — check if session exists
- `detect_port_from_output(text) → Option<u16>` — regex-based port extraction from output

**Rust (native_terminal.rs)**
- `open_native_terminal(name, directory?, app?, command?) → NativeTerminalResult` — launch external terminal via AppleScript
- `get_installed_terminal_apps() → Vec<TerminalApp>` — scan for installed terminal applications

**TypeScript (useTerminal hook)**
- `useTerminal(options: UseTerminalOptions) → UseTerminalReturn` — XTerm lifecycle, Tauri listeners, search/filter/clear

**TypeScript (terminalStorage)**
- `saveTerminalsToStorage(terminals) → void` — persist terminal metadata to Tauri Store
- `loadTerminalsFromStorage() → TerminalMetadata[]` — load with corruption detection
- `loadActiveAgentsWithData() → SavedAgent[]` — load active agents from `.quack/active-agents.json`

### State
- `terminals`: TerminalInfo[] — all PTY terminal sessions (global)
- `activeId`: string | null — currently selected terminal in main view (global)
- `nativeTerminals`: NativeTerminal[] — external terminal app references (global)
- `projectTerminals`: ProjectTerminal[] — project-scoped terminals for TerminalWindow (global)
- `activeProjectTerminalId`: string | null — active terminal in TerminalWindow (global)
- `manualProjects`: ManualProject[] — manually added project paths in Terminal Window (global)
- `isFiltering`: boolean — line-level filter mode active (component)
- `filterMatchCount`: number — lines matching current filter (component)

### External Dependencies
- `portable-pty`: PTY process spawning and management (Rust)
- `@xterm/xterm`: Terminal emulator widget (v5+)
- `@xterm/addon-fit`: Auto-resize terminal to container
- `@xterm/addon-web-links`: Clickable URLs in terminal output
- `@xterm/addon-search`: In-terminal text search
- `@xterm/addon-serialize`: Serialize terminal buffer for filter mode
- `@tauri-apps/plugin-store`: Persistent JSON storage for terminal metadata
- `posthog-js`: Analytics tracking for terminal creation events

### Config
- `quack-terminals.json`: persisted terminal metadata (Tauri Store .dat file)
- Default shell: configurable via Settings > Terminal > Default Shell (`list_available_shells` / `set_default_shell`)
- Default theme: `tokyo-night` (hardcoded default in TerminalInstance)
- Terminal colors: 7-9 color palette defined in `terminalUtils.ts` and `TerminalWindowApp.tsx`
- Supported native apps: Terminal.app, iTerm, Warp, WezTerm, Hyper, Alacritty, Kitty, Tabby, Termius
