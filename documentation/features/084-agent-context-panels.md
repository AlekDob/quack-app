---
type: feature-doc
project: quack-desktop
stack: Tauri + React
created: 2026-07-20
startDate: 2026-07-20
endDate:
last_verified: 2026-07-20
status: active
tags: [agent-mode, terminal, context-panel, cursor-style, status-bar]
related: [001-ai-session-library.md, 038-compose-review.md, 052-claude-code-login-ux.md, 081-chat-switch-chrome-freeze.md]
---

## Agent Context Panels
**Purpose:** Cursor-style pluggable right column in Agent Mode — Changes / Files plus project-scoped Terminal tabs via a `+` add-view menu; StatusBar panel/terminal commands target this column when Agent Mode is on.
**Stack:** Tauri 2 + React 19 / TypeScript

### Tasks
- [x] Feature doc + CLAUDE.md KB entry
- [x] `AgentAddViewMenu` (`+` → Terminal / Browser disabled)
- [x] Tab strip: Changes | Files | per-terminal tabs + close
- [x] `AgentTerminalPanel`: `TerminalCore` host only (no nested list rail)
- [x] Wire `addTerminal` / `closeTerminal` / active selection (project scope)
- [x] CSS (strip overflow, terminal widen, menu) — tokens only
- [x] Drop nested “N Terminals” rail — top tabs + `+` only
- [x] StatusBar panel / Ctrl+J / Ctrl+` / New Terminal → `agentContextNav` in Agent Mode
- [x] Claude Sign in banner → open Agent Mode terminal tab (`terminal.claude_login`)
- [ ] Browser panel (deferred)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/AgentModeShell.tsx` | Hosts `AgentContextColumn` in the right column |
| Component | `src/components/AgentContextColumn.tsx` | Tab strip + Changes/Files/Terminal; `+` menu; close terminals |
| Component | `src/components/AgentAddViewMenu.tsx` | `+` popover: Terminal / Browser (disabled + “Soon”) |
| Component | `src/components/AgentTerminalPanel.tsx` | Mounts all project `TerminalCore`s; toggles `visible` |
| Component | `src/components/TerminalCore.tsx` | Existing xterm + PTY (reused) |
| Component | `src/components/StatusBar.tsx` | Panel icon active when Agent terminal view open |
| Service | `src/actions.ts` | `view.toggle_panel` / `terminal.toggle` / `terminal.new_bottom` Agent Mode branch |
| Store/State | `src/agentContextNav.ts` | Active panel per ws + focus/toggle/new helpers |
| Store/State | `src/store.ts` | `terminals`, `addTerminal`, `closeTerminal`, `termKey` |
| Config | `src/App.css` | `.agent-context-*`, `.agent-term-*`, `.agent-add-view-menu` |

### Data Flow
`+` / StatusBar New Terminal → `addTerminal(wsId)` → `WorkspaceData.terminals` → tab `term:id` → `AgentTerminalPanel` → `TerminalCore` → `ipc.pty` / `pty.rs`

StatusBar panel / Ctrl+J / Ctrl+` → `toggleAgentTerminal(wsId)` → `agentContextNav` panel flip (term ↔ Changes)

### Key Functions
- `addTerminal(wsId, location?, shell?) → string` — create project terminal descriptor + IDE bottom layout tab
- `closeTerminal(wsId, id) → void` — kill PTY + drop descriptor
- `setAgentContextPanel(wsId, panel) → void` — select Changes / Files / `term:id`
- `toggleAgentTerminal(wsId) → void` — if on terminal → Changes; else focus/create terminal
- `newAgentTerminal(wsId) → void` — `addTerminal` + select new tab
- `focusAgentTerminal(wsId) → void` — select last (or create) project terminal
- `AgentAddViewMenu({ open, anchor, onClose, onAddTerminal }) → JSX` — add-view menu
- `AgentTerminalPanel({ wsId, root, activeTermId, onCreate }) → JSX` — xterm host only

### State
- `panelByWs`: `Map<wsId, AgentContextPanel>` — selected right-column view (`agentContextNav`, session memory)
- `ws.terminals`: `Record<string, TerminalDescriptor>` — project-scoped PTYs (workspace `state.json`)

### Behavior Notes
- Top strip: always Changes + Files; one closable tab per open project terminal; `+` adds views.
- No nested “N Terminals” rail — switch/close only via top tabs (simpler / one source of UI).
- Agent Mode mounts `TerminalCore` (IDE `WorkspaceShell` unmounted); all terms stay mounted, `visible` toggled.
- Leaving Agent Mode remounts IDE bottom terminals; re-attach via `ptyId` + scrollback replay.
- StatusBar panel icon highlights when Agent terminal tab is active; title becomes “Toggle Terminal”.
- Claude **Sign in** banner (`terminal.claude_login`) in Agent Mode selects the new Claude Code terminal tab so `/login` is interactive in the right column (IDE still uses the taller bottom panel).
- Browser row in `+` menu is disabled until a later feature.
