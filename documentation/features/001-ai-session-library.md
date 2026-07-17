---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-17
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
| Component | `src/components/AIChatsRail.tsx` | Cross-project Agent Hub: status groups, Done pile, Customizations → `009-agent-hub.md` |
| Component | `src/components/AgentModeShell.tsx` | Agent-mode layout: workspace rail + sessions list + live Tasks + Customizations |
| Component | `src/components/AgentCustomizations.tsx` | Shared Customizations footer menu → `CustomizationsModal` (feature 036) |
| Component | `src/components/WorkspacePicker.tsx` | Library entry / recent-workspaces picker on first run |
| Component | `src/components/AIChatPanel.tsx` | The chat panel itself; owns runtime state (streaming, tools, todos) per session |
| Component | `src/components/ChatEmptyState.tsx` | Empty tab hero — inline session name + starter grid |
| Component | `src/components/PaneNode.tsx` | Empty pane **New AI chat** → `addNewAIChat` |
| Store/State | `src/store.ts` | `AIChatDescriptor`, `aiChats`, `addAIChat`, `closeAIChat`, `setAIChatNamePending` |
| Store/State | `src/aiTaskStore.ts` | Module-level task store keyed by chatId |
| Service | `src/addNewAIChat.ts` | `addNewAIChat`, `ensureFocusedAIChat` — tabbed hub sessions only |
| Service | `src/aiBus.ts` | `requestAIPrompt` (`chatId` scopes to one host) |
| Service | `src/chatHistory.ts` | `ChatSession` + sync load/save API (cache-backed) |
| Service | `src/chatStoreCache.ts` | Hydrate from disk, legacy localStorage migrate, async flush |
| Service | `src/chatProviderRecovery.ts` | Thin-row recovery from CLI on-disk transcripts |
| Service | `src/chatPersistFlush.ts` | Flush registry — all mounted panels save before chat switch |
| Service | `src/composerDraft.ts` | `mergeComposerDraft`, `mergeSessionKnobs` — via `patchSession` |
| Service | `src/providerSession.ts` | `providerSessionIds` read/write; legacy `claudeSessionId` migration |
| Service | `src/providerSessionChrome.tsx` | Session id chip + multi-provider linked-title maps (feature 044) |
| Service | `src/providerSessionTerminal.ts` | `claude --resume` in bottom PTY (feature 044) |
| Model/Type | `src/ai.ts` | `ChatMessage`, `ToolCall`, `ChatStreamEvent` |
| Service (Rust) | `src-tauri/src/workspace.rs` | Workspace meta + `state.json` |
| Service (Rust) | `src-tauri/src/chat_store.rs` | Disk-backed sessions + `provider-links.json` |
| Service (Rust) | `src-tauri/src/provider_sessions.rs` | Unified CLI session list/load |
| Service | `src/ipc.ts` | Workspace / chat IPC bridge |

### Data Flow
- **Open a session:** `addNewAIChat(wsId)` → dismisses legacy `aiPanelVisible` → expands Agent Hub → `addAIChat` descriptor + layout tab → `focusAIChat` → `namePending` for inline naming. Persisted in `state.json` → appears in hub + Agent Mode lists.
- **Ask AI / editor actions:** `ensureFocusedAIChat(wsId)` focuses the active `ai:` tab or creates one, then `requestAIPrompt({ chatId, … })`. Never open the legacy right-side singleton panel.
- **Prompt bus:** `AIChatPanel` ignores events for other `chatId`s; unscoped events only hit the focused tabbed chat (sticky multitask hosts must not all ingest the same prompt).
- **Render the lists:** `Object.values(ws.aiChats).sort(by createdAt)` → `AIChatsRail` / `AgentModeShell`
- **Transcript load/save:** lazy hydrate — see `043` + `076`. Composer via `patchSession` (`040`)
- **Live tasks:** `publishTasks(chatId, todos)` → `aiTaskStore` → `AgentTasks`

### Key Functions
- `addNewAIChat(wsId, location?)` — create tab + hub row + inline name flag
- `ensureFocusedAIChat(wsId)` — focus active AI tab or `addNewAIChat`
- `loadSession` / `ensureSessionLoaded` / `saveSession` / `patchSession` — transcript API
- `AIChatHost` — portals panel; live sticky / DONE unload (`chatHostMount.ts`, `076`)

### State
- `ws.aiChats`: open session descriptors (persisted)
- `ChatSession.providerSessionIds` / knobs / composer — see `044`, `040`
- `selectedByWs` — Agent Mode center session (component-local)
- Runtime stream/tool state — local to `AIChatPanel`

### Gotcha — mount asymmetry (editor vs agent mode)
- **Editor / Agent Mode:** live chats sticky when hidden; DONE/archived unload when hidden. See `064`, `076`, `decisions/001-agent-status-indicators.md`.
- Esc Stop only on the visible host (`chatVisible`).

### Gotcha — legacy singleton AI panel
`WorkspaceShell` can still mount `AIChatPanel` **without** `aiChatId` when `layout.aiPanelVisible` (old right dock). That panel has **no** hub row / tab and used to receive every unscoped `requestAIPrompt`. Entry points must use `ensureFocusedAIChat` / `addNewAIChat` (which also force `aiPanelVisible` off). Do not reintroduce Ask AI → `setAIPanelVisible(true)`.

### Gotcha — project switch unmounts chat hosts
`AIChatHost` mounts only when `isActive`. Leaving a project tears them down.
Transcript durability on that path is owned by `043` (flush-before-flip +
never-shrink). Do not reintroduce `patchSession` empty-row invent.

### Gotcha — close tab vs Delete
`closeAIChat` drops the hub descriptor + tab but **keeps** the transcript file
on disk (orphan until ⟲ Sessions re-link). **Delete** removes disk + descriptor.
See `009`, `043`, `044`.

### Gotcha — new chat + switch veil
`addNewAIChat` pulses `veil: false`. That path must **clear** an in-flight switch pulse (`finish`), otherwise hosts stay `!is-visible` until CAP and the new tab looks missing. See `075-chat-switch-loader.md`.

### AIChatDescriptor
| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Chat id (`a_…`), lists' React key |
| `title` | `string` | Tab/list label |
| `sessionId` | `string` | Transcript id |
| `createdAt` | `number` | Sort key (drag-reorder rewrites) |
| `model` | `string?` | Last qualified model id |
| `ccEffort` / `ccPermMode` / `ccThinking` | knobs | Per-session CC settings |
| `composer` | `ChatComposerDraft?` | Draft / queue / images |
| `namePending` | `boolean?` | Fresh tab — focus inline name (one-shot) |
| `doneAt` / `archivedAt` | `number?` | Hub Done pile (`009`) |
| `workItemId` / `storyId` | `string?` | Works links (`054`, `068`) |

### Config
- `MAX_SESSIONS`: 30 transcripts per workspace
- Disk: `~/Library/Application Support/codetta/chats/{wsId}/`
- Legacy localStorage migrated on hydrate (`043`)
