---
type: feature-doc
project: quack-desktop
stack: Tauri + React
created: 2026-07-20
startDate: 2026-07-20
endDate:
last_verified: 2026-07-31
status: active
tags: [agent-mode, terminal, context-panel, cursor-style, status-bar, plan-mode, resize, collapsed]
related:
  [
    001-ai-session-library.md,
    038-compose-review.md,
    052-claude-code-login-ux.md,
    061-plan-mode-tab.md,
    081-chat-switch-chrome-freeze.md,
    088-plan-milo-handoff.md,
    documentation/bugs/008-plan-buyin-cross-session.md,
  ]
---

## Agent Context Panels

**Purpose:** Cursor-style pluggable right column in Agent Mode — Changes / Files /
on-demand Plan plus project-scoped Terminal tabs via a `+` add-view menu; StatusBar
panel/terminal commands target this column when Agent Mode is on. Column width is
user-resizable and persisted. **Default: collapsed to an icon rail** (expand on demand).

**Stack:** Tauri 2 + React 19 / TypeScript

### Tasks
- [x] Feature doc + CLAUDE.md KB entry
- [x] `AgentAddViewMenu` (`+` → Terminal / Browser disabled)
- [x] Tab strip: Changes | Files | per-terminal tabs + close
- [x] `AgentTerminalPanel`: `TerminalCore` host only (no nested list rail)
- [x] Wire `addTerminal` / `closeTerminal` / active selection (project scope)
- [x] CSS (strip overflow, menu) — tokens only
- [x] Drop nested “N Terminals” rail — top tabs + `+` only
- [x] StatusBar panel / Ctrl+J / Ctrl+` / New Terminal → `agentContextNav` in Agent Mode
- [x] Claude Sign in banner → open Agent Mode terminal tab (`terminal.claude_login`)
- [x] On-demand Plan tab when ExitPlanMode buy-in is pending (`061` / `088`)
- [x] Drag-resize column width (default 480, persist `lcp.agent.contextWidth`) — 2026-07-24
- [x] Plan tab / buy-in scoped to active Quack `chatId` (bug `008`) — 2026-07-24
- [x] Collapsed-by-default icon rail (`lcp.agent.contextCollapsed`) — 2026-07-31
- [x] **Docs tab**: `.md`/`.mmd` touched in the chat stream → row click opens the md drawer — 2026-07-31
- [ ] Browser panel (deferred)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/AgentModeShell.tsx` | Hosts `.vsplit` + `AgentContextColumn`; owns width state |
| Component | `src/components/AgentContextColumn.tsx` | Tab strip + Changes/Files/Plan/Terminal; `+` menu; close terminals; `width` prop |
| Component | `src/components/AgentDocsPanel.tsx` | Docs list rows → `openWorkspaceDocPath` (md/feature drawer) |
| Store/State | `src/chatDocsStore.ts` | `collectChatDocs` / `publishChatDocs` / `getChatDocs` / `subscribeChatDocs` |
| Test | `src/chatDocsStore.test.ts` | Extension filter, read-vs-write dedupe, notify dedupe |
| Component | `src/components/AIChatPanel.tsx` | Publishes docs on every `messages` change (same effect as `publishChatDiff`) |
| Component | `src/components/AgentAddViewMenu.tsx` | `+` popover: Terminal / Browser (disabled + “Soon”) |
| Component | `src/components/AgentTerminalPanel.tsx` | Mounts all project `TerminalCore`s; toggles `visible` |
| Component | `src/components/PlanPane.tsx` | `AgentPlanPane` + `presentPlanReady` (Agent vs IDE routing) |
| Component | `src/components/TerminalCore.tsx` | Existing xterm + PTY (reused) |
| Component | `src/components/StatusBar.tsx` | Panel icon active when Agent terminal view open |
| Service | `src/actions.ts` | `view.toggle_panel` / `terminal.toggle` / `terminal.new_bottom` Agent Mode branch |
| Store/State | `src/agentContextNav.ts` | Active panel per ws + collapsed rail + focus/toggle/new helpers |
| Test | `src/agentContextCollapse.test.ts` | Default collapsed + expand/toggle |
| Store/State | `src/agentContextWidth.ts` | `get/set/clampAgentContextWidth` — `lcp.agent.contextWidth` |
| Test | `src/agentContextWidth.test.ts` | Clamp bounds |
| Store/State | `src/planBuyInStore.ts` | Pending ExitPlanMode → Plan tab visibility (**per `chatId`**) |
| Store/State | `src/store.ts` | `terminals`, `addTerminal`, `closeTerminal`, `termKey` |
| Config | `src/App.css` | `.agent-context`, `.agent-context-vsplit`, `.agent-context-*`, `.agent-term-*` |

### Docs tab (`.md` / `.mmd` in stream)
| Aspect | Behavior |
|---|---|
| Source | Every assistant `tool_call` path (`pathOf`) ending in `.md`/`.mmd` — reads **and** writes |
| Visibility | Tab + rail icon appear only while the active chat has ≥1 doc; falls back to Changes otherwise |
| Live | `AIChatPanel` publishes on each `messages` change → appears mid-stream |
| Row click | `openWorkspaceDocPath(wsId, root, path)` — feature docs → FeatureDocDrawer, others → `openFileInDrawer` (Agent Mode) |
| `edited` badge | A write tool (`Edit`/`Write`/`MultiEdit`/…) anywhere in the chat wins over a read-only mention |
| Lifetime | RAM per `chatId` (like `planBuyInStore`) — reload clears the list |

### Data Flow
`+` / StatusBar New Terminal → `addTerminal(wsId)` → `WorkspaceData.terminals` → tab `term:id` → `AgentTerminalPanel` → `TerminalCore` → `ipc.pty` / `pty.rs`

StatusBar panel / Ctrl+J / Ctrl+` → `toggleAgentTerminal(wsId)` → expand + focus terminal, or collapse rail if already on a terminal tab

ExitPlanMode buy-in → `presentPlanReady` → `focusAgentPlan(wsId)` (also **expands** the column) → on-demand **Plan** tab (`AgentPlanPane` full markdown) **only while `getPlanBuyIn({ chatId: activeChatId })` hits**. The Plan tab is the **sole** full-read surface; chat shows only the Milo chip (`088`), not a plan preview. Re-select Plan via the context column tabs after switching to Changes/Files/Terminal.

### Width / collapse
| Constant | Value |
|---|---|
| Default width | 480px (`AGENT_CONTEXT_DEFAULT_W`) |
| Min / Max | 280 / 720 |
| Width storage | `lcp.agent.contextWidth` via `localStore` |
| Collapsed default | `true` — icon rail until expanded (`lcp.agent.contextCollapsed`) |
| Handle | Left-edge `.vsplit.agent-context-vsplit` (mousedown + ArrowLeft/Right; Shift = 60px step) |

Inline `style={{ width, flexBasis }}` on `.agent-context` — no fixed CSS 320/420; Terminal no longer auto-widens separately.

### Key Functions
- `addTerminal(wsId, location?, shell?) → string` — create project terminal descriptor + IDE bottom layout tab
- `closeTerminal(wsId, id) → void` — kill PTY + drop descriptor
- `setAgentContextPanel(wsId, panel) → void` — select Changes / Files / Docs / Plan / `term:id` (selection only — does **not** expand the rail; fallback effects use this directly)
- `collectChatDocs(messages) → ChatDoc[]` — `.md`/`.mmd` paths from tool calls, deduped, write-wins
- `isAgentContextCollapsed() / setAgentContextCollapsed(bool) / toggleAgentContextCollapsed()` — global rail collapse
- `toggleAgentTerminal(wsId) → void` — if expanded on terminal → collapse; else expand + focus/create terminal
- `newAgentTerminal(wsId) → void` — `addTerminal` + expand + select new tab
- `focusAgentTerminal(wsId) → void` — expand + select last (or create) project terminal
- `focusAgentPlan(wsId) → void` — expand + select the Plan context tab
- `focusAgentFiles(wsId) / focusAgentChanges(wsId) / toggleAgentFiles(wsId)` — StatusBar Explorer / Git / Ctrl+B stand-ins (expand; Files toggle collapses when already on Files)
- `getAgentContextWidth() / setAgentContextWidth(w) / clampAgentContextWidth(w)` — persisted column width
- `presentPlanReady(...)` — Agent Mode → Plan tab; IDE → FeatureDocDrawer / `plan:` split
- `AgentAddViewMenu({ open, anchor, onClose, onAddTerminal }) → JSX` — add-view menu
- `AgentTerminalPanel({ wsId, root, activeTermId, onCreate }) → JSX` — xterm host only

### State
- `panelByWs`: `Map<wsId, AgentContextPanel>` — selected right-column view (`agentContextNav`, session memory)
- `collapsed`: global boolean — icon rail vs full column (`lcp.agent.contextCollapsed`, default `true`)
- `ws.terminals`: `Record<string, TerminalDescriptor>` — project-scoped PTYs (workspace `state.json`)
- `planBuyInStore` — drives Plan tab show/hide for the **active** chat only (`chatId`)
- `lcp.agent.contextWidth` — column width across Agent Mode sessions

### Behavior Notes
- Top strip: always Changes + Files; **Docs** appears only while the active chat touched a `.md`/`.mmd`; **Plan** appears only while ExitPlanMode buy-in is pending **for the active chat**; one closable tab per open project terminal; `+` adds views.
- Column starts **collapsed** (Cursor-style minimal right rail); any `focus*` / Plan buy-in expands it.
- Plan tab clears (and falls back to Changes) when Pass / Keep discussing settles buy-in, or when switching to a chat without a pending buy-in.
- No nested “N Terminals” rail — switch/close only via top tabs (simpler / one source of UI).
- Agent Mode mounts `TerminalCore` (IDE `WorkspaceShell` unmounted); all terms stay mounted, `visible` toggled.
- Leaving Agent Mode remounts IDE bottom terminals; re-attach via `ptyId` + scrollback replay.
- StatusBar panel icon highlights when Agent terminal tab is active; title becomes “Toggle Terminal”.
- StatusBar **Explorer / Source Control** map to Files / Changes tabs (`focusAgentFiles` / `focusAgentChanges`); Ctrl+B toggles Files ↔ collapsed rail. **Save / Auto-save / zoom** hide in Agent Mode (no IDE editor surface).
- Claude **Sign in** banner (`terminal.claude_login`) in Agent Mode selects the new Claude Code terminal tab so `/login` is interactive in the right column (IDE still uses the taller bottom panel).
- Browser row in `+` menu is disabled until a later feature.

### Gotchas (Plan tab)
- Plan tab visibility is **buy-in-driven**, not layout-persisted — reload while a plan is pending loses the tab (same RAM lifetime as `planBuyInStore`).
- Lookup is **per Quack chat id** (`planBuyInStore`); session id is a secondary key only. **No cwd fallback** — that leaked Plan ready across Agent Mode sessions (bug `008`).
- Selecting Plan while buy-in clears auto-falls back to Changes (no orphaned empty Plan selection).
- Pass-the-ball lives as a composer **chip** only (`088`) — the Plan tab is read-only markdown (no duplicate CTAs). Re-select the Plan tab from the context column after switching away.
