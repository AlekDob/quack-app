---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-08
tags: [sessions, ai-chat, library, agent-mode, sidebar-rail, chat-history, workspace, zustand, persistence]
---

## AI Session Library
**Purpose:** The list of AI chat sessions ("agents") per workspace and their persistence. Surfaced in two places — the right-side rail (editor mode) and the sessions list (Agent Mode). Each session is an open AI conversation that can read/edit the workspace. Historical transcripts persist on disk via Rust — see `043-chat-transcript-persistence.md`.
**Stack:** React 19, TypeScript strict, Zustand, Tauri v2 invoke, disk-backed `chat_store.rs`

### Three distinct concepts (do not conflate)
| Concept | What it is | Where it lives | Persistence |
|---------|-----------|----------------|-------------|
| Workspace | An open project/folder | `store.ts` (`recent`, `openIds`, `activeId`, `loaded`) | Rust `workspace.rs` → `workspaces.json` + per-ws `state.json` |
| AIChatDescriptor | An OPEN chat (a live agent) shown in the lists | `WorkspaceData.aiChats` | inside the workspace `state.json` |
| ChatSession | The HISTORICAL transcript of one chat | `chatHistory.ts` + `chatStoreCache.ts` | Rust `chat_store.rs` → `~/Library/Application Support/codetta/chats/{wsId}/` |

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/AIChatsRail.tsx` | Cross-project Agent Hub (editor mode): status groups, diff subtitles, Customizations footer when expanded |
| Component | `src/components/AgentModeShell.tsx` | Agent-mode layout: workspace rail + sessions list + live Tasks + Customizations |
| Component | `src/components/AgentCustomizations.tsx` | Shared Customizations footer menu → `CustomizationsModal` (feature 036) |
| Component | `src/components/WorkspacePicker.tsx` | Library entry / recent-workspaces picker on first run |
| Component | `src/components/AIChatPanel.tsx` | The chat panel itself; owns runtime state (streaming, tools, todos) per session |
| Store/State | `src/store.ts` | `AIChatDescriptor`, `WorkspaceData.aiChats`, `addAIChat`, `closeAIChat`, `reorderAIChat` |
| Store/State | `src/aiTaskStore.ts` | Module-level task store keyed by chatId; `publishTasks`/`getTasks`/`subscribeTasks` |
| Service | `src/chatHistory.ts` | `ChatSession` + sync load/save API (cache-backed) |
| Service | `src/chatStoreCache.ts` | Hydrate from disk, legacy localStorage migrate, async flush |
| Service | `src/chatProviderRecovery.ts` | Thin-row recovery from CLI on-disk transcripts |
| Service | `src/chatPersistFlush.ts` | Flush registry — all mounted panels save before chat switch |
| Service | `src/composerDraft.ts` | `ChatComposerDraft`, `mergeComposerDraft`, `mergeSessionKnobs` — via `patchSession` |
| Service | `src/providerSession.ts` | `providerSessionIds` read/write; legacy `claudeSessionId` migration |
| Service | `src/providerSessionChrome.tsx` | Session id chip + multi-provider linked-title maps (feature 044) |
| Service | `src/providerSessionTerminal.ts` | `claude --resume` in bottom PTY (feature 044) |
| Model/Type | `src/ai.ts` | `ChatMessage`, `ToolCall`, `ChatStreamEvent` (streaming contract) |
| Service (Rust) | `src-tauri/src/workspace.rs` | `WorkspaceMeta`, `WorkspacesIndex`, load/save workspace state |
| Service (Rust) | `src-tauri/src/chat_store.rs` | Disk-backed `ChatSession` rows + `provider-links.json` |
| Service (Rust) | `src-tauri/src/provider_sessions.rs` | Unified CLI session list/load (CC, Cursor, OpenCode) |
| Service | `src/ipc.ts` | `workspaces.load/save/loadState/saveState` IPC bridge |

### Data Flow
- **Open a session:** `addAIChat(wsId)` → new `AIChatDescriptor` in `ws.aiChats` (createdAt = max+1) → persisted in `state.json` → appears in both lists
- **Render the lists:** `Object.values(ws.aiChats).sort(by createdAt)` → `AIChatsRail` (editor) / `AgentModeShell` sessions (agent)
- **Per-chat badge:** `chat.model` → `modelBadge()` → 2-char provider chip (CC/CU/OC/Cl/AI/OL)
- **Transcript load/save:** boot `hydrateChatStore(wsId)` → `AIChatPanel` ↔ `chatHistory.ts` via `descriptor.sessionId`; disk flush + flush on switch (`043`); composer via `patchSession` (`040`)
- **Live tasks:** `AIChatPanel` `publishTasks(chatId, todos)` → `aiTaskStore` → `AgentTasks` in `AgentModeShell`
- **Reorder:** drag in `AIChatsRail` → `reorderAIChat` rewrites `createdAt` (sort key, no separate order list)

### Key Functions
- `loadSession(wsId, id) → ChatSession | undefined` — single transcript row
- `loadSessions(wsId) → ChatSession[]` — all rows for workspace, sorted newest-first
- `saveSession(wsId, session) → boolean` — atomic write one session + update index (max 30)
- `patchSession(wsId, id, partial) → boolean` — merge fields without clobbering omitted keys
- `deriveTitle(messages) → string` — first user line, truncated to 60 chars
- `modelBadge(model) → {short, className, full}` — provider → chip; **DUPLICATED** in `AIChatsRail.tsx` and `AgentModeShell.tsx` (extract to shared module)
- `publishTasks(chatId, items|null)` — publish/clear a session's checklist into `aiTaskStore`
- `AIChatHost({chatId, container, visible})` — portals `AIChatPanel` into the active pane; lazy-mount on first `visible`; only rendered when workspace `isActive` (see `031-model-discovery-cache.md`)

### State
- `ws.aiChats`: `Record<id, AIChatDescriptor>` — open sessions (global, persisted)
- `ChatSession.providerSessionIds`: `Partial<Record<ProviderId, string>>` — per-provider server session for resume (CC/Cursor/OpenCode); legacy `claudeSessionId` kept in sync. **UI:** copy + terminal bridge in chat header — see `044-provider-session-bridge.md`
- `ChatSession.ccEffort` / `ccPermMode` / `ccThinking` / `composer`: per-session Claude Code knobs + composer draft (feature 040; legacy rows without fields → medium + Ask, not global)
- `selectedByWs`: `Record<wsId, chatId>` — which session fills the center column in Agent Mode (component)
- runtime run-state (`streaming`, `runningTools`, `activeToolLabels{status}`, `abortRef`): **local to `AIChatPanel`** (component) — not yet surfaced per-session in the lists

### Gotcha — mount asymmetry (editor vs agent mode)
- **Editor mode** (`WorkspaceShell.tsx` `AIChatHost`): one host per `aiChats` descriptor; panels stay mounted after first show (`display:none` when hidden). Background tabs can stream and **save in parallel** — requires per-session storage (`043`).
- **Agent mode** (`AgentModeShell.tsx` `AgentChatHost`): same pattern — **all open chats** mount one `AIChatPanel` each, toggled with CSS; `pulseChatSwitch` + `flushAllChatPersist` runs before the veil.
- Consequence: any per-session live status (see `decisions/001-agent-status-indicators.md`) can use mounted background panels. Cross-workspace status uses `AgentHubWatcher` + `agentStatusStore`.
- **Stop / Esc:** each mounted panel has its own `abortRef` and composer Stop button; hidden hosts use `display:none` (editor) or `pointer-events:none` (agent mode) so clicks can't hit background tabs. Hosts pass `chatVisible` into `AIChatPanel` so the global Esc shortcut only stops the **visible** session during multitask (`022` § Stop, `046`).

### AIChatDescriptor
| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Chat id (`c_...`), also the lists' React key |
| `title` | `string` | Tab/list label |
| `sessionId` | `string` | Transcript id used by `chatHistory.ts` |
| `createdAt` | `number` | Creation time; doubles as sort key (drag-reorder rewrites it) |
| `model` | `string?` | Last qualified model id (`claude-code:default`, `openai:gpt-4o`, ...) |
| `ccEffort` | `string?` | Claude Code effort; legacy rows without it restore **medium** |
| `ccPermMode` | `string \| null?` | Permission mode for this chat |
| `ccThinking` | `boolean \| null?` | Extended thinking knob |
| `composer` | `ChatComposerDraft?` | Draft input, queue, attach toggles, staged images |

### Config
- `MAX_SESSIONS`: 30 transcripts per workspace (`chat_store.rs` / `chatHistory.ts`)
- Disk paths: `~/Library/Application Support/codetta/chats/{wsId}/{sessionId}.json`
- Legacy `localStorage` keys auto-migrated on first hydrate (see `043`)
- Audit: `node scripts/audit-chat-persistence.mjs` (localStorage only — disk inspect manually until script updated)
