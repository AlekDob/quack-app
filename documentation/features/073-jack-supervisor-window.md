---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18) + Claude Agent SDK
created: 2026-05-27
last_verified: 2026-05-27
tags: [jack, supervisor, meta-agent, multi-window, cross-project, multi-session, ws7]
---

## Jack Supervisor Window
**Purpose:** Dedicated Tauri window above all projects where Jack acts as a meta-agent / project manager. Cross-project visibility on every agent live in Quack, full chat capability via SDK streaming, multi-session sidebar, settings integration. Replaces the per-project sidebar entry — Jack is now a singleton system-level supervisor accessible via tray menu, toolbar button, or Cmd+Shift+J.
**Stack:** Rust/Tauri (window creation), React 18 + TypeScript (UI), Zustand (state), Claude Agent SDK (chat backend), Tauri Store (session persistence)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Rust | `src-tauri/src/jack_window.rs` | `open_jack_window` Tauri command, `JACK_WINDOW_LABEL` constant, macOS overlay titlebar, 1000x700 default, 800x600 min |
| Rust | `src-tauri/src/lib.rs` | Registers `jack_window` module, adds `open_jack_window` to invoke_handler, "Open Jack" entry in tray menu |
| Entry | `jack.html` | Vite entry point — empty shell, mounts `<JackApp />` via `jack.tsx` |
| Entry | `src/jack.tsx` | React entry, applies accent color from `settings-storage` on mount, renders `<JackApp />` |
| Config | `vite.config.ts` | `jack: resolve(rootDir, 'jack.html')` in rollupOptions.input |
| Component | `src/components/jack/JackApp.tsx` | Root layout — flex-row: `JackSessionsSidebar` \| (drag region 38px + chat). Calls `useJackAgentRefresh()`, loads sessions on mount, debounced auto-save (600ms), final save on close, accent-color event listener |
| Component | `src/components/jack/JackSessionsSidebar.tsx` | 220px wide left sidebar — Jack avatar + role header (paddingTop 38 for traffic lights), "+ Nuova chat" button, sessions list with auto-title, relative time ("ora", "5m fa", "2h fa"), delete × on hover |
| Component | `src/components/jack/JackChat.tsx` | Chat panel — renders user messages as orange bubbles, assistant ClaudeEvents via real `<StreamMessage>` (full fidelity: tool_use, thinking, AskUserQuestion). Per-session "sta pensando" indicator + Stop button gated by `isThisSessionStreaming`. Input disabled with tooltip when another session is streaming |
| Hook | `src/hooks/useJackChat.ts` | SDK streaming chat hook — captures `sessionId` at sendMessage start, uses `appendToSession(sessionId, ...)` for both user msg and stream events (cross-session safety), sets `streamingSessionId` for UI gating, captures sdkSessionId from events for multi-turn continuation. `permissionMode: 'bypass'` (full tool access), MAX_CONTEXT_CHARS 50_000 |
| Hook | `src/hooks/useJackWindow.ts` | Window lifecycle — `openJackWindow`, `closeJackWindow`, `toggleJackWindow`. Persists position/size to Tauri Store `jack-settings.json`, listens `jack-activation-requested` event |
| Hook | `src/hooks/useJackAgentRefresh.ts` | Data-loading hook (no UI) — reads `quack-agents.json` + `.quack-repo-order.dat`, builds `JackAgentSnapshot[]` + `JackProjectSnapshot[]`, listens `sessions-updated` + `external-terminal-status` for refresh, writes to jackStore |
| Store | `src/stores/jackStore.ts` | Zustand — `sessions: JackSession[]`, `activeSessionId`, `streamingSessionId` (per-session UI gating), `agents`, `projects`. Actions: `createSession`, `selectSession`, `deleteSession`, `renameSession`, `appendToSession(id, item)`, `setSdkSessionId`, `setStreamingSessionId` |
| Service | `src/services/jackPersonalityService.ts` | Constants: `JACK_AGENT_ID = 'jack-supervisor'`, `JACK_EVENT_NAME`, `JACK_AVATAR = 'duck23.jpeg'`, `JACK_SKILLS = ['quack-remote', 'whiteboard', 'project-ops']`. `buildJackSystemPrompt(agents, projects)` injects cross-project context |
| Service | `src/services/jackSessionsStorage.ts` | Persistence — `loadJackSessions()`, `saveJackSessions()` via Tauri Store `jack-sessions.json`. Trims `MAX_TIMELINE_PER_SESSION = 500` (keeps newest), singleton storePromise |
| Settings | `src/components/settings/categories/JackSettings.tsx` | Settings panel page — model selector (`jackModel` falls back to `claude.model`), Cmd+Shift+J shortcut display, permissions info (Bypass) |
| Settings | `src/components/settings/SettingsSidebar.tsx` | Adds `'jack'` to `SettingsCategory` union + categories array (between agent-modes and second-brain) |
| Settings | `src/components/settings/SettingsIcon.tsx` | Briefcase SVG icon for `'jack'` category |
| Settings | `src/components/settings/UnifiedSettings.tsx` | Imports `JackSettings`, adds case `'jack'` to renderCategory |
| Store | `src/stores/settingsStore.ts` | Adds `jackModel: string` to `ClaudeSettings` (empty = use global model, Zustand persist merge handles existing state) |
| Toolbar | `src/components/ActionIcons.tsx` | Briefcase button between Whiteboard and Automation, calls `onJackClick` (which is `toggleJackWindow`) |
| Service | `src/services/shortcutsStorage.ts` | Adds `toggleJack: Cmd+Shift+J` to DEFAULT_SHORTCUTS |
| Types | `src/types.ts` | Adds `'toggleJack'` to `ShortcutActionId` union |
| App | `src/App.tsx` | Calls `useJackWindow()`, passes `toggleJack` to `useGlobalKeyboardShortcuts`, passes `onJackClick={toggleJackWindow}` to `ActionIcons` |

### Data Flow

```
[User] → [Tray "Open Jack" / Cmd+Shift+J / Toolbar briefcase]
                                  ↓
                    [useJackWindow.toggleJackWindow]
                                  ↓
                  [invoke('open_jack_window') Tauri cmd]
                                  ↓
                   [jack.html → src/jack.tsx → JackApp]
                                  ↓
        ┌─────────────────────────┴─────────────────────────┐
        ↓                                                   ↓
[JackSessionsSidebar]                              [JackChat (active session)]
        ↓                                                   ↓
[useJackStore.selectSession]                       [useJackChat.sendMessage]
                                                            ↓
                                              [capture sessionId locally]
                                                            ↓
                                          [appendToSession(sessionId, userMsg)]
                                                            ↓
                                         [setStreamingSessionId(sessionId)]
                                                            ↓
                              [invoke('send_message_via_sdk_streaming') agentId='jack-supervisor']
                                                            ↓
                                          [Rust SDK bridge → Claude Agent SDK]
                                                            ↓
                                     [stream events → Tauri event 'claude-event:jack-supervisor']
                                                            ↓
                                   [listener filters by sessionKey, captures sdkSessionId]
                                                            ↓
                                         [appendToSession(sessionId, event)]
                                                            ↓
                              [JackChat reads activeSession.timeline → <StreamMessage>]
                                                            ↓
                                       [finally: setStreamingSessionId(null)]
```

Cross-project agent data flow:

```
[useJackAgentRefresh] → [Tauri Store quack-agents.json + .quack-repo-order.dat]
                              ↓
                  [build JackAgentSnapshot[] + JackProjectSnapshot[]]
                              ↓
                  [useJackStore.setAgents / setProjects]
                              ↓
              [useJackChat reads via optionsRef, injects in buildJackSystemPrompt]
```

### Key Functions

- `JackApp() -> JSX` — root layout, sessions load/save lifecycle, accent color listener
- `JackChat() -> JSX` — chat rendering with per-session streaming UI gating (`isThisSessionStreaming`)
- `JackSessionsSidebar() -> JSX` — sessions list with new chat button
- `useJackChat({ agents, projects }) -> { isStreaming, error, sendMessage, stopStreaming }` — SDK streaming with cross-session safety
- `useJackWindow() -> { isOpen, openJackWindow, closeJackWindow, toggleJackWindow }` — window lifecycle
- `useJackAgentRefresh() -> void` — cross-project agent data loader (event-driven)
- `useJackStore()` — Zustand store with sessions + per-session streaming state
- `buildJackSystemPrompt(agents, projects) -> string` — system context with cross-project snapshot
- `loadJackSessions() -> Promise<JackSession[]>` / `saveJackSessions(sessions) -> Promise<void>` — Tauri Store persistence
- `appendToSession(sessionId, item) -> void` — Brain: fix-jack-multisession-events-wrong-session — appends to SPECIFIC session, not active

### State

- `sessions: JackSession[]` — every Jack chat session, persisted in `jack-sessions.json` (jackStore)
- `activeSessionId: string | null` — currently selected session in UI (jackStore)
- `streamingSessionId: string | null` — session currently receiving SDK stream (gates "sta pensando" + Stop UI) (jackStore)
- `agents: JackAgentSnapshot[]` — live snapshot of all agents across all projects (jackStore)
- `projects: JackProjectSnapshot[]` — live snapshot of all projects with color + agent count (jackStore)
- `isStreaming: boolean` — global hook-level streaming flag, prevents concurrent sends (useJackChat)
- `jackModel: string` — Jack-specific model override (settingsStore.claude), empty = use global

### External Dependencies

- Tauri invoke commands: `open_jack_window`, `send_message_via_sdk_streaming`, `abort_sdk_stream`
- Tauri events listened: `claude-event:jack-supervisor` (SDK stream events), `accent-color-changed`, `sessions-updated`, `external-terminal-status`, `jack-activation-requested`
- Tauri events emitted: `jack-window-closing` (with position + size for restore)
- Tauri Store: `jack-sessions.json` (sessions + timeline), `jack-settings.json` (window pos/size), reads `quack-agents.json` + `.quack-repo-order.dat`
- Claude Agent SDK: streaming with `permissionMode: 'bypass'`, sdkSessionId for multi-turn continuation
- Reused components: `StreamMessage` (full event rendering), `AgentAvatar` (Jack profile)

### Config

- Default avatar: `duck23.jpeg` (preset for everyone)
- Default skills injected in system prompt: `quack-remote`, `whiteboard`, `project-ops`
- Default shortcut: `Cmd+Shift+J` (Mac) / `Ctrl+Shift+J` (Windows/Linux) — fallback in absence of native double-Option (Phase 2)
- Max timeline items per session: 500 (oldest trimmed on save)
- Max prompt context chars: 50_000
- Window: 1000x700 default, 800x600 min, resizable, macOS overlay titlebar

### UX Notes

- **Multi-stream constraint**: only one Jack session can stream at a time. Sending in session B while A streams is blocked at hook level (`isStreamingRef.current`). The Invia button on inactive sessions stays visible but is disabled with tooltip "Un'altra sessione sta streamando, aspetta..."
- **Per-session UI gating**: "sta pensando" indicator and Stop button only show on the session that's actually streaming. Implemented via `streamingSessionId` in jackStore + `isThisSessionStreaming` derived value in JackChat
- **Cross-session safety**: `appendToSession(sessionId, ...)` always writes to the originating session. The user can switch sessions or create a new chat during streaming without corrupting state
- **Auto-title**: first user message becomes the session title (trimmed to 50 chars)
- **Persistence**: sessions auto-saved 600ms after any change, final save on window close
- **macOS traffic lights**: sidebar header has `paddingTop: 38` to clear the overlay titlebar buttons

### Related

- Phase 2 (Option+Option hotkey): pending — `jack_hotkey.rs` with `CGEventTap` (Mac) + `SetWindowsHookExW` (Windows)
- Phase 3 (Control Center): pending — `JackControlCenter.tsx` dashboard with delegate-to-agent, fire-job, focus-session actions
- Phase 4 (Server-hosted): deferred — Jack as standalone Node.js consuming Remote API
- Workstream: `documentation/workstreams/07-jack-supervisor-agent.md`
- Bug entry: `documentation/bugs/fix-jack-multisession-events-wrong-session.md` (cross-session event leak + indicator leak)
- Plan: `~/.claude/plans/skill-project-ops-stavo-pensando-encapsulated-hejlsberg.md`
