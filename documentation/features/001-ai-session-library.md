---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-16
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
| Component | `src/components/AIChatsRail.tsx` | Cross-project Agent Hub: status groups, archived preview+search, diff subtitles, Customizations footer when expanded → `009-agent-hub.md` |
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
- **Transcript load/save:** boot `hydrateChatStore(wsId, warmLiveIds)` loads the
  index + live bodies; DONE stay cold until open (`ensureSessionLoaded`) — see
  `043`. `AIChatPanel` ↔ `chatHistory.ts` via `descriptor.sessionId`; disk flush
  + flush on switch; composer via `patchSession` (`040`)
- **Live tasks:** `AIChatPanel` `publishTasks(chatId, todos)` → `aiTaskStore` → `AgentTasks` in `AgentModeShell`
- **Reorder:** drag in `AIChatsRail` → `reorderAIChat` rewrites `createdAt` (sort key, no separate order list)

### Key Functions
- `loadSession(wsId, id) → ChatSession | undefined` — warm cache only
- `ensureSessionLoaded(wsId, id) → Promise<ChatSession | undefined>` — disk on miss
- `loadSessions(wsId) → ChatSession[]` — warm rows only (newest-first among warm)
- `saveSession(wsId, session) → boolean` — atomic write one session + update index (max 30)
- `patchSession(wsId, id, partial) → boolean` — merge fields without clobbering omitted keys
- `deriveTitle(messages) → string` — first user line, truncated to 60 chars
- `modelBadge(model) → {short, className, full}` — provider → chip; **DUPLICATED** in `AIChatsRail.tsx` and `AgentModeShell.tsx` (extract to shared module)
- `publishTasks(chatId, items|null)` — publish/clear a session's checklist into `aiTaskStore`
- `AIChatHost({chatId, container, visible, doneAt?, archivedAt?})` — portals `AIChatPanel` into the active pane; lazy-mount on first `visible`; **live** chats stay sticky when hidden (multitask); **DONE/archived** unload when hidden (`chatHostMount.ts`). Only rendered when workspace `isActive` (see `031-model-discovery-cache.md`). Hidden live tabs use **visibility stacking** (`.ai-tab-host.is-visible`), not `display:none` — see `064-agent-hub-drawer-and-chat-tab-switch.md`.

### State
- `ws.aiChats`: `Record<id, AIChatDescriptor>` — open sessions (global, persisted)
- `ChatSession.providerSessionIds`: `Partial<Record<ProviderId, string>>` — per-provider server session for resume (CC/Cursor/OpenCode); legacy `claudeSessionId` kept in sync. **UI:** copy + terminal bridge in chat header — see `044-provider-session-bridge.md`
- `ChatSession.ccEffort` / `ccPermMode` / `ccThinking` / `composer`: per-session Claude Code knobs + composer draft (feature 040; legacy rows without fields → medium + Ask, not global)
- `selectedByWs`: `Record<wsId, chatId>` — which session fills the center column in Agent Mode (component)
- runtime run-state (`streaming`, `runningTools`, `activeToolLabels{status}`, `abortRef`): **local to `AIChatPanel`** (component) — not yet surfaced per-session in the lists

### Gotcha — mount asymmetry (editor vs agent mode)
- **Editor mode** (`WorkspaceShell.tsx` `AIChatHost` + `FileTabHost`): one host per open chat / visited file tab; **live** panels stay mounted after first show (**`visibility:hidden`** when inactive, not `display:none`). **DONE/archived** chat hosts unmount when hidden and drop their transcript body from RAM. File editors are no longer torn down when switching to an AI tab — Monaco `layout()` on `paneVisible`. See `064-agent-hub-drawer-and-chat-tab-switch.md`.
- **Agent mode** (`AgentModeShell.tsx` `AgentChatHost`): same policy — live chats sticky for multitask; DONE unload when not selected (`shouldKeepChatHostMounted`). Same-project switches skip the chat veil; cross-workspace still use it (`chatSwitch.ts`).
- Consequence: per-session live status (see `decisions/001-agent-status-indicators.md`) can use mounted **live** background panels. Cross-workspace status uses `AgentHubWatcher` + `agentStatusStore`.
- **Stop / Esc:** each mounted panel has its own `abortRef` and composer Stop button; hidden hosts use `visibility:hidden` + `pointer-events:none` so clicks can't hit background tabs. Hosts pass `chatVisible` into `AIChatPanel` so the global Esc shortcut only stops the **visible** session during multitask (`022` § Stop, `046`).
- Full policy + lazy hydrate: `076-chat-lazy-hydrate-done-unload.md`.

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
| `doneAt` | `number?` | Manual "done" — shown in Done group (`009`) |
| `archivedAt` | `number?` | Manual archive — hidden from live groups; preview in Archived section (`009`) |

### Config
- `MAX_SESSIONS`: 30 transcripts per workspace (`chat_store.rs` / `chatHistory.ts`)
- Disk paths: `~/Library/Application Support/codetta/chats/{wsId}/{sessionId}.json`
- Legacy `localStorage` keys auto-migrated on first hydrate (see `043`)
- Audit: `node scripts/audit-chat-persistence.mjs` (localStorage only — disk inspect manually until script updated)
