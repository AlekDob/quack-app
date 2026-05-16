---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-05-16
last_verified: 2026-05-16
tags: [codex, multi-backend, agent-abstraction, quack-agent-event, openai-codex, m1]
---

## Codex Backend — Multi-Backend Agent Abstraction (M1)

**Purpose:** Add OpenAI Codex CLI as a second agent backend behind a Rust `AgentBackend` trait + a unified `QuackAgentEvent` translator, with zero behavior change for existing Claude sessions, an end-to-end Codex chat path, and Codex-aware UI gating.
**Stack:** Rust 1.75+ (Tauri v2, tokio, serde, async-trait), TypeScript strict (React 18, Zustand)

**Scope:** M1 Foundation (Phases A–E) + E4 Step 2 chat wiring + Codex-aware chat-settings gating. OAuth `codex login`, MCP/AGENTS.md render, sandbox approval, real child-kill cancel are deferred to M2/M3.
**Decision:** Abstraction lives at the AGENT level, not model level — thin adapters over complete agent harnesses (`documentation/decisions/decision-quack-abstraction-agent-level-not-model-level.md`).
**Authoritative event contract:** `documentation/research/codex-cli-events.md` §6/§7 (verified spike) — supersedes obsolete spec.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src-tauri/src/agents/mod.rs` | Module root: `backend`, `events`, `claude_backend`, `codex_backend` |
| Service | `src-tauri/src/agents/events.rs` | Pure translator: `QuackAgentEvent`, `AgentBackendKind`, `normalize_tool_name`, `codex_stream_to_quack`, `codex_rollout_to_usage`, `codex_rollout_model`, `claude_event_to_quack`. 18+ unit tests, full TDD from RAW fixtures |
| Service | `src-tauri/src/agents/backend.rs` | `AgentBackend` async trait, `StartSessionParams`, `BackendSessionHandle`, `AuthStatus` |
| Service | `src-tauri/src/agents/claude_backend.rs` | `ClaudeBackend` — thin delegate to `claude_cli::*`, zero behavior change (review-gated B2) |
| Service | `src-tauri/src/agents/codex_backend.rs` | `CodexBackend` — `codex exec --experimental-json` spawn-per-query, rollout JSONL usage tail, emits `codex-event:{agent_id}`; commands `send_message_via_codex` *(in lib.rs)*, `codex_auth_status` |
| Config | `src-tauri/src/agents/fixtures/` | RAW JSONL fixtures verbatim from spike (`codex_stream_tool_run.jsonl`, `codex_rollout.jsonl`) |
| Service | `src-tauri/src/lib.rs` | `mod agents;` (`:24`); registers `send_message_via_codex` (`:614`), `codex_auth_status` |
| Model/Type | `src/types.ts` | `AgentSession.backend?`, `backendSessionId?`, `backendAuthMethod?` (`:488-491`) |
| Model/Type | `src/types/agentBackend.ts` | TS mirror of Rust enum: `AgentBackendKind`, `QuackAgentEvent` (kept in sync) |
| Util | `src/utils/codexEventAdapter.ts` | Pure `quackEventToClaudeEvents(ev, seq) → ClaudeEvent[]`; exhaustiveness `never` guard |
| Test | `src/utils/__tests__/codexEventAdapter.test.ts` | 14 adapter tests |
| Service | `src/services/codexAuthService.ts` | `getCodexAuthStatus()` wrapping `codex_auth_status` |
| Service | `src/hooks/useAgentEventStream.ts` | `useCodexEventStream(agentId, onEvent)` — `codex-event:{agentId}` listener |
| Store/State | `src/stores/sessionStore.ts` | `normalizeSessionBackend()` — legacy sessions default to `'claude'` on load (`:107`) |
| Component | `src/components/NewSessionModal.tsx` | Backend segmented toggle (Claude / Codex) + Codex auth hint |
| Component | `src/components/RepositoryGroup.tsx` | Threads `backend` from modal into `createSession` |
| Component | `src/components/SessionsPanel.tsx` | `Codex` badge on `SessionCard` when `backend === 'codex'` (`:241`) |
| Route/Page | `src/App.tsx` | Parallel `codex-event:{agentId}` listener (`:2644`) → adapter → existing `handleClaudeEvent`; Codex send-routing in `sendMessageForAgent` (`:3160`); seq/usage refs + `cleanupAgentData` teardown |
| Component | `src/components/ChatSettingsMenu.tsx` | `isCodexSession` gate: hides Claude provider/model/mode/effort controls, shows `Codex · gpt-5-codex` indicator (`:236-266`) |
| Component | `src/components/chat/UnifiedActionBar.tsx` | Threads `isCodexSession` into settings menu |
| Component | `src/components/ChatView.tsx` | Computes `isCodexSession` from active session backend |

### Data Flow
**Codex turn (send):** ChatView send → `sendMessageForAgent` (`backend==='codex'`) → `invoke('send_message_via_codex')` → `CodexBackend::send_message` → `codex exec --experimental-json` subprocess

**Codex events (receive):** codex stdout JSONL → `codex_stream_to_quack` → `QuackAgentEvent` → `emit('codex-event:{agent_id}')` → App.tsx parallel listener → `quackEventToClaudeEvents(ev, seq)` → `handleClaudeEvent` (existing reducer) → chat UI

**Codex token usage:** `~/.codex/sessions/Y/M/D/rollout-<ts>-<sid>.jsonl` tail → `codex_rollout_to_usage` (`last_token_usage`, per-turn) → `Usage` event → `codex-event` → adapter `mapUsage` → `ClaudeResultEvent`

**Claude path (unchanged):** Existing `claude-event:{agentId}` daemon path is byte-identical — Codex listener/routing is strictly additive.

### Key Functions
- `normalize_tool_name(backend, raw) → &str` — Codex `command_execution` → `Bash`; Claude names pass through (verified spike §7)
- `codex_stream_to_quack(v: Value) → Option<QuackAgentEvent>` — one stdout event → unified event; non-command `item.started` ignored
- `classify_codex_error(message) → (String, bool)` — synthesizes `code`/`recoverable` via string-match (401/refresh → `auth`/false)
- `codex_rollout_to_usage(v) → Option<QuackAgentEvent>` — per-turn `last_token_usage`; skips cumulative `total_token_usage` and null-`info`
- `codex_rollout_model(v) → Option<String>` — model from `turn_context` (not in stdout `session.created`)
- `claude_event_to_quack(v) → Option<QuackAgentEvent>` — additive Claude SDK adapter, does not replace `claude-event` path
- `build_codex_args(working_dir, model, prompt) → Vec<String>` — isolated args: `--experimental-json --sandbox workspace-write --skip-git-repo-check -c mcp_servers={}`
- `build_codex_resume_args(working_dir, session_id, prompt) → Vec<String>` — flags before `resume` subcommand
- `codex_auth_probe() → Result<bool, String>` — 1-token read-only exec; parses stdout (exit code unreliable, spike §4.4)
- `quackEventToClaudeEvents(ev, seq = 0) → ClaudeEvent[]` — pure QuackAgentEvent → ClaudeEvent[], `never` exhaustiveness guard
- `normalizeSessionBackend(s) → AgentSession` — defensive legacy migration, default `backend: 'claude'`
- `getCodexAuthStatus() → Promise<CodexAuthState>` — `ready` | `needs_login` | `unknown`
- `useCodexEventStream(agentId, onEvent) → void` — Codex unified event listener hook

### State
- `QuackAgentEvent`: enum — unified contract: `SessionStarted`/`TextDelta`/`ToolCallStart`/`ToolCallEnd`/`Usage`/`Error`/`SessionEnded` (global, Rust+TS mirror)
- `AgentBackendKind`: `'claude' | 'codex'` — backend discriminant (global)
- `AgentSession.backend`: AgentBackendKind — immutable after create, default `'claude'` on load (session)
- `AgentSession.backendSessionId`: string — Codex native session id for resume (session)
- `activeCodexListenersRef`: Map<agentId, unlisten> — parallel listeners, separate from Claude refs (component)
- `codexSeqCountersRef`: Map<agentId, number> — monotonic text_delta seq for dedupe (component)
- `codexLastUsageRef`: Map<sessionKey, usage> — latest in-flight usage snapshot, self-clears on terminal events (component)
- `AuthStatus`: enum — `Ready{method}` / `NotConfigured` / `Expired{detail}` (backend)

### External Dependencies
- OpenAI Codex CLI (`codex` binary, v0.42+) — `codex exec --experimental-json` spawn-per-query
- Codex rollout JSONL: `~/.codex/sessions/Y/M/D/rollout-<ts>-<sid>.jsonl` — token usage source
- Codex auth: `codex login --api-key` (M1 API-key path only; OAuth deferred to M2)
- `async-trait` 0.1.89 (new Rust dep for `AgentBackend`)
- Reuses 037 provider/keychain stack style (`providerService.ts`, `preferences::save_provider_api_key`)

### Config
- `--sandbox workspace-write` — Codex spawn sandbox mode (no PermissionRequest source via exec, spike §4.6)
- `-c mcp_servers={}` — isolates Codex from user `~/.codex/config.toml` MCP (broken MCP slows every exec)
- `gpt-5-codex` — Codex session model label in UI (Codex manages its own model; Claude model settings ignored)

### Known Limits (M1, deferred)
- `CodexBackend::cancel()` is a noop — real child-kill deferred to M3
- `walk_jsonl` uses sync `std::fs::read_dir` in async context — M3 hardening
- Turn lifecycle relies on backend always synthesizing `session_ended` after process wait; true watchdog/timeout deferred to M2
- 2 preexisting baseline test failures on main (`claude_usage`, `telegram_obfuscation`) — not regressions (`gotcha-preexisting-test-failures-main.md`)
- Human residual: E2E manual Codex chat, Claude smoke (B2 Step 4)
