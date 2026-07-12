---
type: feature-doc
project: codetta
stack: Tauri (Rust + React/TypeScript)
created: 2026-07-12
last_verified: 2026-07-12
tags: [agent-mode, tasks, todo, sidebar, checklist]
---

## Agent Tasks Checklist
**Purpose:** Cursor-style collapsible checklist of the active agent's live TodoWrite/TaskCreate items, shown below the sessions list in the Agent Mode sidebar.
**Stack:** React 19 + TypeScript

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Store/State | src/aiTaskStore.ts | Module-level pub/sub map (`tasksByChat`, keyed by chatId), not Zustand — transient per-session UI state |
| Component | src/components/AgentModeShell.tsx | `AgentTasks({ chatId })` — collapsed/expanded checklist, rendered under the sessions rail |
| Component | src/components/AIChatPanel.tsx | Publishes the live checklist via `publishTasks(aiChatId, todos)` as TodoWrite/TaskCreate stream events arrive |
| Component | src/components/Icon.tsx | Icon glyphs used: `check-circle`, `arrow-down-circle`, `circle`, `chevron-up`, `chevron-down` |
| Config | src/App.css | `.agent-tasks*` rules (`.agent-tasks-head` clickable button w/ hover `bg-hi`, `.agent-tasks-current`, `.agent-tasks-head-trail`, `.agent-tasks-list`, `.agent-task`) |

### Data Flow
Claude Code CLI stream (TodoWrite/TaskCreate/TaskUpdate tool events) → `AIChatPanel` accumulates todos → `publishTasks(chatId, items)` → `aiTaskStore` module map + listener notify → `AgentModeShell.AgentTasks` (`subscribeTasks` + `getTasks(chatId)`) → collapsed/expanded checklist UI

### Key Functions
- `publishTasks(chatId: string, items: AiTaskItem[] | null) → void` — AIChatPanel writes the current checklist; empty/null clears the entry
- `clearTasks(chatId: string) → void` — drops a chat's tasks entirely (e.g. session closed)
- `getTasks(chatId: string | null | undefined) → AiTaskItem[]` — read-only snapshot for a chat
- `subscribeTasks(cb: () => void) → () => void` — register a re-render listener, returns unsubscribe
- `AgentTasks({ chatId: string | null }) → JSX.Element | null` — renders nothing when the dedup'd task list is empty

### State
- `expanded`: boolean — collapsed/expanded toggle, resets to `false` on `chatId` change (component)
- `tasksByChat`: Map<string, AiTaskItem[]> — live checklist per chat id (global, module-level in `aiTaskStore.ts`)

### Behavior Notes
- Collapsed by default; auto-collapses again whenever `chatId` changes (`useEffect(() => setExpanded(false), [chatId])`) so a new chat never inherits the previous one's expanded state.
- Duplicate tasks (same `content` emitted by both TaskCreate and TodoWrite) are collapsed client-side, keeping the furthest-along status (`pending` < `in_progress` < `completed`).
- Collapsed head shows: current task (`in_progress` first, else next `pending`, else last item) with `activeForm` text if present, a `done/total` count pill, and a chevron.
- Expanded view lists every task: `completed` → strikethrough + green check-circle; `in_progress` → bold + accent arrow-down-circle; `pending` → hollow circle.
- Entire head row (`.agent-tasks-head`) is a `<button>` toggling `expanded`; whole component returns `null` when there are no tasks for the chat.

### Related
- Not to be confused with `009-agent-hub.md` (`AIChatsRail` cross-project sessions hub) — that's the adjacent sessions list this checklist sits below, not the same concept.
- Rendered inside `AgentModeShell` at the sessions rail (`<AgentTasks chatId={activeChatId} />`).
