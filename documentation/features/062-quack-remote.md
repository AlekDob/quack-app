---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18 + TypeScript)
created: 2026-04-17
last_verified: 2026-05-25
tags: [quack-remote, remote-api, rest-api, websocket, mobile-dashboard, team-delegation, automation, agent-to-agent, task-hub-mirror, session-live-state]
---

## Quack Remote API
**Purpose:** REST + WebSocket API (port 6768) that exposes Quack agents, sessions, and automation jobs to external clients, agent-to-agent delegation (`@team`), the mobile PWA dashboard, the `quack-remote` skill, and automation triggers.
**Stack:** Axum (Rust) + Tauri v2 + React 18 + Service Worker (PWA). Cross-references feature `025-team-delegation-footer` and `047-plan-delegate-remote`.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | src-tauri/src/remote_api.rs | `create_api_router`, `delegate_plan_to_agent`, `init_uptime`, `read_agents_storage`, `ApiState`, `ApiError`, `ApiResult`, `err`, **`SessionLiveEntry`, `SessionLiveStateMap`, `notify_session_streaming`, `notify_session_pending_question`, `notify_session_message`, `handle_project_colors`** — all `/api/*` handlers (status, agents, sessions, jobs, execute, ordering, groups, messages, avatars, **project-colors**) + Bearer auth inline |
| Service | src-tauri/src/remote_api_terminal.rs | `handle_create_terminal`, `handle_list_terminals`, `handle_get_terminal`, `handle_write_terminal`, `handle_terminal_output`, `handle_close_terminal`, `TerminalListChangedPayload` — `/api/terminals*` handlers for remote terminal management (create visible PTY terminals, write commands, read output ring buffer) |
| Service | src-tauri/src/remote_auth.rs | `RemoteAuthState` (Arc<RwLock> token + enabled), `generate_token()` — 32-char hex Bearer token lifecycle |
| Config | src-tauri/src/remote_config.rs | `RemoteConfig { enabled, token, port }`, `load_config`, `save_config`, `get_remote_config`, `set_remote_enabled`, `regenerate_remote_token`, `get_local_ip`, `get_local_hostname` — persists `quack-remote.json` via Tauri Store |
| Service | src-tauri/src/remote_ws.rs | `WsBroadcast`, `WsEvent` (AgentStatus/SessionCreated/SessionCompleted/JobFired/JobCompleted **+ SessionStreaming / PendingQuestion / MessageAdded / SessionUpdated**), `WsState`, `handle_ws_upgrade` — `/ws?token=xxx` real-time push to mobile/external clients |
| Hook | src/hooks/useRemoteLiveStateSync.ts | Mirrors `chatStore` (chatLoadingMap, pendingQuestionsMap, last assistant message) into the Rust `SessionLiveStateMap` via three `notify_*` Tauri commands (debounced 150ms per session). Skips when remote API disabled. |
| Service | src-tauri/src/remote_api_teams.rs | `create_team_routes`, `RemoteTeam`, `RemoteTeamMember` — `/api/teams*` multi-agent orchestration with 500ms staggered `remote-execute` emits and live status sync |
| Route/Page | src-tauri/src/remote_dashboard.rs | `create_dashboard_router` — serves `/dashboard/*` PWA (HTML/JS/CSS/manifest/sw.js/icons) embedded via `include_str!`/`include_bytes!`, injects token via `%%INJECT_TOKEN%%` placeholder |
| Config | src-tauri/static/index.html, app.js, style.css, manifest.json, sw.js | Static PWA assets bundled into the Rust binary |
| Service | src/services/remoteApi.ts | `notifyLeadAgent(leadSessionId, session)`, `fetchRemoteAgents()`, `executeRemoteTask(params)` — frontend HTTP client for same-machine remote calls |
| Component | src/components/settings/categories/RemoteApiSettings.tsx | React settings panel: toggle enable, regenerate token, copy token/URL/dashboard URL, show LAN IP + `.local` hostname |
| Component | src/components/TeamDelegationPopover.tsx | UI for selecting teammates + task, invokes `executeRemoteTask` with `leadSessionId` to trigger `@team` delegation |
| Component | src/components/PlanWidget.tsx | Calls `delegate_plan_to_agent` Tauri command to route plans via `remote-execute` (no HTTP/CORS) |
| Route/Page | src/App.tsx (listeners) | `remote-execute` listener (line ~5773) creates sessions with `[Remote]`/`[Team]` title prefix, propagates `leadSessionId`; `remote-send-message` pushes external input into active session |
| Model/Type | src/types.ts | `RemoteApiConfig { enabled, token, port }` — mirrors Rust `RemoteConfig` |
| Config | src-tauri/templates/skills/quack-remote.md | Built-in skill spec (v1.0.0) — instructs Claude Code agents how to read `quack-remote.json`, list agents, POST `/api/execute` with `leadSessionId` |
| Config | src-tauri/src/lib.rs (L75-79, L620, L883-996, L1377-1382) | Module declarations, `RemoteAuthState` registration, router composition (`legacy + /api + /ws + /dashboard`), bind `0.0.0.0` vs `127.0.0.1`, dev port+1 offset, command registration |

### Data Flow

External client → HTTP Bearer → `Axum /api/*` → `ApiState::check_auth` → handler → `app.emit("remote-execute" | "remote-send-message" | "automation-fire-job")` → React listener in App.tsx → `useSessionStore.createSession` → Claude SDK daemon

Agent-to-agent (`@team`): Lead session → `quack-remote` skill → `curl POST /api/execute { leadSessionId }` → `handle_execute` → emits `remote-execute` → App.tsx creates `[Team]`-prefixed session → child runs → `notifyLeadAgent` → `POST /api/sessions/{leadId}/send` → `remote-send-message` event → lead receives completion message

Plan delegation: `PlanWidget` → `invoke('delegate_plan_to_agent')` → `remote_api::delegate_plan_to_agent` → emits `remote-execute` (source=`plan-delegate`) — bypasses HTTP entirely

WebSocket push: `lib.rs` event listeners → `WsBroadcast::send(WsEvent)` → `tokio::broadcast` → `/ws` subscribers (mobile PWA) → JSON frame

Mobile dashboard: Browser → `GET /dashboard?token=xxx` → token injected into HTML → `app.js` polls `/api/*` + subscribes to `/ws` → Service Worker caches assets

Real-time agent status: `AgentStatusMap` (RwLock<HashMap<agent_id, status>>) written by `handle_execute`/`handle_send_message`/`handle_status_update` → read by `handle_list_agents` (live status preferred over disk)

### Key Functions
- `create_api_router(app, auth, agent_status) → Router` — builds all `/api/*` routes with shared `ApiState`
- `check_auth(headers: &HeaderMap) → Result<(), (StatusCode, Json<ApiError>)>` — validates `Authorization: Bearer` against `RemoteAuthState`
- `handle_execute(headers, State, Json<ExecuteRequest>) → ApiResult<ExecuteResponse>` — generates `session-{uuid}`, marks agent busy, emits `remote-execute` with `leadSessionId`, returns `sessionId`
- `handle_send_message(headers, State, Path<sessionId>, Json<SendMessageRequest>) → ApiResult<Value>` — emits `remote-send-message` so frontend injects prompt into existing session
- `handle_session_messages(headers, State, Path, Query<MessagesQuery>) → Response` — paginated (`limit`/`offset` from end) chat message reader; `x-total-count` header
- `handle_fire_job(headers, State, Path<jobId>) → ApiResult<Value>` — emits `automation-fire-job` to trigger scheduled job immediately
- `handle_toggle_job(headers, State, Path<jobId>) → ApiResult<Value>` — flips `enabled` flag in `quack-automations.json`
- `delegate_plan_to_agent(app, agent_id, prompt, lead_session_id?, project_path?) → Result<String, String>` — Tauri command for in-process delegation (no HTTP/CORS)
- `handle_ws_upgrade(State, Query<WsQuery>, WebSocketUpgrade) → impl IntoResponse` — validates token from query string, upgrades to WebSocket, forwards broadcast events
- `handle_create_team(headers, State, Json<CreateTeamRequest>) → ApiResult<RemoteTeam>` — builds members, staggers `remote-execute` 500ms apart, emits `team-created`
- `spawn_staggered_launch(app, members: Vec<RemoteTeamMember>) → void` — async loop with 500ms delay to avoid `pendingAutoStartRef` React race
- `resolve_member_status(member, sessions?) → String` — maps session status to team-member status (`running`/`completed`/`failed`)
- `generate_token() → String` — 32-char lowercase hex from `rand::thread_rng()`
- `get_remote_config(app) → Result<RemoteConfig, String>` — loads config, applies `port+1` in `debug_assertions`
- `set_remote_enabled(app, enabled: bool) → Result<RemoteConfig, String>` — persists and updates `RemoteAuthState` at runtime
- `get_local_ip_address() → Option<String>` — UDP trick (connect to 8.8.8.8:80) to determine outgoing LAN IP
- `executeRemoteTask({ agentId, prompt, leadSessionId?, projectPath?, model? }) → Promise<{ success, sessionId?, error? }>` — frontend helper, POSTs to `127.0.0.1:{port}/api/execute`
- `notifyLeadAgent(leadSessionId: string, session: AgentSession) → Promise<void>` — formats `[Team Complete]` message and POSTs to `/api/sessions/{leadId}/send`
- `fetchRemoteAgents() → Promise<Array<Agent>>` — GET `/api/agents` with Bearer header
- `handle_dashboard(Query<DashboardQuery>) → Html<String>` — injects `?token=` into static HTML via `%%INJECT_TOKEN%%` replace

### State
- `RemoteAuthState.token`: `Arc<RwLock<Option<String>>>` — active Bearer token (global)
- `RemoteAuthState.enabled`: `Arc<RwLock<bool>>` — runtime remote-enabled flag (global)
- `AgentStatusMap`: `Arc<RwLock<HashMap<String, String>>>` — live agent status map, reads win over disk (global)
- `SessionLiveStateMap`: `Arc<RwLock<HashMap<String, SessionLiveEntry>>>` — per-session live state mirror (`isStreaming`, `pendingQuestionCount`, `lastMessageRole`, `lastMessageStatus`, `lastActivityMs`) populated by desktop `useRemoteLiveStateSync` hook (global). Powers PWA Task Hub priority computation.
- `WsBroadcast.tx`: `tokio::broadcast::Sender<WsEvent>` — capacity 64, cloned into axum state + telegram subscribers (global)
- `START_TIME`: `OnceLock<Instant>` — server uptime reference (global)
- `config`: `RemoteApiConfig | null` — React state in `RemoteApiSettings` (component)
- `selected: Set<string>`, `task: string` — `TeamDelegationPopover` teammate selection (component)
- `quack-remote.json` — `{ enabled, token, port }` persisted via Tauri Store (global disk)
- `quack-remote-teams.json` — `RemoteTeam[]` persisted via Tauri Store (global disk)
- `quack-automations.json` — `{ jobs: [...] }` shared with automation layer (global disk)
- `quack-agents.json` — agents + sessions, read directly as JSON (global disk)

### External Dependencies
- `axum` 0.7 — HTTP + WebSocket server
- `tokio` — async runtime + `broadcast::channel`
- `tauri-plugin-store` — `.dat`/JSON persistence
- `tauri::Emitter` — cross-thread event bus (`remote-execute`, `remote-send-message`, `automation-fire-job`, `team-created`, `sessions-updated`, `automation-jobs-updated`)
- `reqwest` (implicit via frontend `fetch`) — HTTP client
- `rand`, `uuid`, `chrono`, `hostname`, `dirs` — token/id/timestamp/env helpers

### Config
- `REMOTE_STORE`: `quack-remote.json` filename (constant)
- `REMOTE_KEY`: `remote` key inside the Tauri Store (constant)
- `TEAMS_STORE`: `quack-remote-teams.json` — persisted teams
- `TEAMS_KEY`: `teams`
- `default_port`: `6768` (prod); dev mode uses `6769` via `+1` offset
- `bind_addr`: `0.0.0.0` when `enabled=true`, else `127.0.0.1`
- Token: 32-char hex, generated on first load if missing
- App data dir: `~/Library/Application Support/com.quack.terminal` (macOS) · `%APPDATA%\com.quack.terminal` (Windows) · `~/.local/share/com.quack.terminal` (Linux)

### REST Endpoints
| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/status | version, uptime, agent/session counts, remote flag |
| GET | /api/agents | list agents (live status from `AgentStatusMap`) |
| GET | /api/agents/:id | full agent JSON |
| GET | /api/sessions | list sessions |
| GET | /api/sessions/:id | session detail |
| DELETE | /api/sessions/:id | remove from storage + delete Claude session file |
| GET | /api/sessions/:id/messages?limit=&offset= | paginated chat transcript |
| POST | /api/sessions/:id/send | inject message (emits `remote-send-message`) |
| GET | /api/jobs | list automation jobs |
| POST | /api/jobs | create job |
| PUT | /api/jobs/:id | update job |
| DELETE | /api/jobs/:id | delete job |
| POST | /api/jobs/:id/fire | trigger job now |
| POST | /api/jobs/:id/toggle | flip enabled |
| POST | /api/execute | launch prompt on agent (optional `leadSessionId` → `[Team]` session) |
| GET | /api/ordering | repo order + colors + per-repo agent order |
| GET | /api/groups | list project groups |
| GET | /api/project-colors | map `projectPath → hex` (custom from `.quack-repo-order.dat` + deterministic fallback) |
| GET | /api/teams | list teams |
| POST | /api/teams | create team (staggered launch) |
| GET | /api/teams/:id | get team (auto-syncs member status) |
| DELETE | /api/teams/:id | disband team |
| GET | /api/avatars/:filename | serve duck avatar (sanitized .png/.jpeg) |
| POST | /api/terminals | create visible terminal (PTY + xterm.js), auto-focuses Terminal Window |
| GET | /api/terminals | list all terminal sessions |
| GET | /api/terminals/:id | single terminal info |
| POST | /api/terminals/:id/write | write data/command to terminal PTY |
| GET | /api/terminals/:id/output?lines=&strip_ansi= | read last N lines from output ring buffer |
| DELETE | /api/terminals/:id | close terminal + kill PTY process |
| GET | /ws?token= | WebSocket push (AgentStatus/SessionCreated/SessionCompleted/JobFired/JobCompleted/TerminalCreated/TerminalOutput/TerminalClosed) |
| GET | /dashboard/ | PWA shell with `?token=` injection |
| GET | /dashboard/{app.js,style.css,manifest.json,sw.js,icon-*.png} | embedded static assets |

### Cross-References
- Feature `025-team-delegation-footer` — UI entry point that drives `/api/execute` with `leadSessionId`
- Feature `047-plan-delegate-remote` — plan→agent delegation via `delegate_plan_to_agent` Tauri command
- Pattern `pattern-remote-api-architecture.md`
- Pattern `pattern-team-delegation-footer.md`
- Decision `decision-quack-remote-api-mobile-dashboard.md`
- Gotcha `gotcha-remote-execute-needs-react-listener.md`
- Gotcha `gotcha-remote-dashboard-ip-changes.md`
- Gotcha `gotcha-mobile-session-dot-status.md`
- Gotcha `gotcha-tauri-store-dat-files-plain-json.md`
- Gotcha `gotcha-axum-nest-state-types.md`
- Bug `fix-remote-team-session-tracking.md`
