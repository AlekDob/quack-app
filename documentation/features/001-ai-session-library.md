---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-01
tags: [sessions, ai-chat, library, agent-mode, sidebar-rail, chat-history, workspace, zustand, persistence]
---

## AI Session Library
**Purpose:** The list of AI chat sessions ("agents") per workspace and their persistence. Surfaced in two places — the right-side rail (editor mode) and the sessions list (Agent Mode). Each session is an open AI conversation that can read/edit the workspace. Historical transcripts persist separately to localStorage.
**Stack:** React 19, TypeScript strict, Zustand, Tauri v2 invoke, localStorage

### Three distinct concepts (do not conflate)
| Concept | What it is | Where it lives | Persistence |
|---------|-----------|----------------|-------------|
| Workspace | An open project/folder | `store.ts` (`recent`, `openIds`, `activeId`, `loaded`) | Rust `workspace.rs` → `workspaces.json` + per-ws `state.json` |
| AIChatDescriptor | An OPEN chat (a live agent) shown in the lists | `WorkspaceData.aiChats` | inside the workspace `state.json` |
| ChatSession | The HISTORICAL transcript of one chat | `chatHistory.ts` | localStorage `lcp.ollama.history.{wsId}` (max 30) |

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/AIChatsRail.tsx` | Right-side sessions rail (editor mode): list, drag-reorder, provider badge, open/close |
| Component | `src/components/AgentModeShell.tsx` | Agent-mode layout: workspace rail + sessions list + live Tasks + Customizations |
| Component | `src/components/WorkspacePicker.tsx` | Library entry / recent-workspaces picker on first run |
| Component | `src/components/AIChatPanel.tsx` | The chat panel itself; owns runtime state (streaming, tools, todos) per session |
| Store/State | `src/store.ts` | `AIChatDescriptor`, `WorkspaceData.aiChats`, `addAIChat`, `closeAIChat`, `reorderAIChat` |
| Store/State | `src/aiTaskStore.ts` | Module-level task store keyed by chatId; `publishTasks`/`getTasks`/`subscribeTasks` |
| Service | `src/chatHistory.ts` | `ChatSession` model + `loadSessions`/`saveSession`/`deleteSession`/`deriveTitle` |
| Service | `src/providerSession.ts` | `providerSessionIds` read/write; legacy `claudeSessionId` migration |
| Model/Type | `src/ai.ts` | `ChatMessage`, `ToolCall`, `ChatStreamEvent` (streaming contract) |
| Service (Rust) | `src-tauri/src/workspace.rs` | `WorkspaceMeta`, `WorkspacesIndex`, load/save workspace state |
| Service | `src/ipc.ts` | `workspaces.load/save/loadState/saveState` IPC bridge |

### Data Flow
- **Open a session:** `addAIChat(wsId)` → new `AIChatDescriptor` in `ws.aiChats` (createdAt = max+1) → persisted in `state.json` → appears in both lists
- **Render the lists:** `Object.values(ws.aiChats).sort(by createdAt)` → `AIChatsRail` (editor) / `AgentModeShell` sessions (agent)
- **Per-chat badge:** `chat.model` → `modelBadge()` → 2-char provider chip (CC/CU/OC/Cl/AI/OL)
- **Transcript load/save:** `AIChatPanel` ↔ `chatHistory.ts` via `descriptor.sessionId`; agent resume ids in `providerSessionIds` (see `028-opencode-bridge.md`)
- **Live tasks:** `AIChatPanel` `publishTasks(chatId, todos)` → `aiTaskStore` → `AgentTasks` in `AgentModeShell`
- **Reorder:** drag in `AIChatsRail` → `reorderAIChat` rewrites `createdAt` (sort key, no separate order list)

### Key Functions
- `loadSessions(wsId) → ChatSession[]` — read + validate + sort transcripts by `updatedAt` desc
- `saveSession(wsId, session) → void` — upsert, cap at `MAX_SESSIONS` (30)
- `deriveTitle(messages) → string` — first user line, truncated to 60 chars
- `modelBadge(model) → {short, className, full}` — provider → chip; **DUPLICATED** in `AIChatsRail.tsx` and `AgentModeShell.tsx` (extract to shared module)
- `publishTasks(chatId, items|null)` — publish/clear a session's checklist into `aiTaskStore`
- `AIChatHost({chatId, container, visible})` — keeps an `AIChatPanel` mounted, portals it into the active pane (editor mode only)

### State
- `ws.aiChats`: `Record<id, AIChatDescriptor>` — open sessions (global, persisted)
- `ChatSession.providerSessionIds`: `Partial<Record<ProviderId, string>>` — per-provider server session for resume (CC/Cursor/OpenCode); legacy `claudeSessionId` kept in sync
- `selectedByWs`: `Record<wsId, chatId>` — which session fills the center column in Agent Mode (component)
- runtime run-state (`streaming`, `runningTools`, `activeToolLabels{status}`, `abortRef`): **local to `AIChatPanel`** (component) — not yet surfaced per-session in the lists

### Gotcha — mount asymmetry (editor vs agent mode)
- **Editor mode** (`WorkspaceShell.tsx:407` `AIChatHost`): every chat keeps an `AIChatPanel` mounted (portal + `display:none`) → background agents keep streaming.
- **Agent mode** (`AgentModeShell.tsx:450`): only the selected session mounts an `AIChatPanel` (`key={wsId:activeChatId}`) → background agents are NOT mounted, cannot run or report status.
- Consequence: any per-session live status (see `decisions/001-agent-status-indicators.md`) needs background panels mounted in Agent Mode too, or it only ever reflects the active session.

### AIChatDescriptor
| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Chat id (`c_...`), also the lists' React key |
| `title` | `string` | Tab/list label |
| `sessionId` | `string` | Transcript id used by `chatHistory.ts` |
| `createdAt` | `number` | Creation time; doubles as sort key (drag-reorder rewrites it) |
| `model` | `string?` | Last qualified model id (`claude-code:default`, `openai:gpt-4o`, ...) |

### Config
- `MAX_SESSIONS`: 30 transcripts per workspace (`chatHistory.ts`)
- localStorage key: `lcp.ollama.history.{wsId}` (legacy prefix kept for back-compat)
