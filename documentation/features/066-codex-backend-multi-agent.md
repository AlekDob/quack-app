---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-05-16
last_verified: 2026-05-17
tags: [codex, multi-backend, agent-abstraction, quack-agent-event, openai-codex, m1, m1.5, skills, slash-commands, agents-md]
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

### M1 RE-TARGET → codex-cli 0.130 (2026-05-18) — SUPERSEDES 0.42 specifics above
M1 was built/verified on a Homebrew-stale `codex 0.42`; **broken on current 0.130**. Re-targeted (zero Claude regression: `QuackAgentEvent` contract unchanged, `claude_event_tests` byte-identical, cargo 39p/2f = only the 2 pre-existing fails, adapter TS 20/20).

| 0.42 (stale rows above) | 0.130 (current) |
|---|---|
| `--experimental-json` | **`--json`** |
| stdin inherited | **`Stdio::null()`** (else `exec` hangs on "Reading additional input from stdin…") |
| `session.created`/`session_id` | `thread.started`/**`thread_id`** |
| `item_type`/`assistant_message` | **`item.type`**/`agent_message`; +`turn.started/completed`, `collab_tool_call`, `mcp_tool_call` |
| usage via rollout-JSONL tail | **in-stream** `turn.completed.usage` → `codex_rollout_*`, `read_last_usage_for_session`, `walk_jsonl` **deleted** |

Fixtures regenerated RAW from live 0.130 (`codex_stream_tool_run.jsonl`, `codex_subagent.jsonl`, `codex_skill_discovery.jsonl`). `events.rs` adds `codex_tool_identity`/`codex_aux_tool_output` (subagent/MCP → tool calls). **Subagents WORK in codex 0.130 `exec`** (`.codex/agents/*.toml`) — the earlier "subagent Claude-only" claim is RETRACTED. Authoritative: `documentation/research/codex-exec-capability-matrix.md` (version-pinned). Residual: live GUI smoke on 0.130 not yet done.

### M1.5 — Codex UX parity (personality / slash commands / skills)
Parity via Quack-owned prompt/file composition (NOT harness reimplementation). Personality→AGENTS.md + slash/skill composer are version-independent (survived the 0.130 re-target untouched).

| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src-tauri/src/personality.rs` | `build_agent_header()` pure (shared CLAUDE.md+AGENTS.md → byte-identical persona); `inject_personality_to_agents_md` command; `write_personality_doc()`; 2 golden tests (parity + idempotency) |
| Service | `src-tauri/src/lib.rs` | registers `inject_personality_to_agents_md` |
| Util | `src/utils/agentPersonality.ts` | `injectAgentPersonalityAgentsMd()` — Codex twin of `injectAgentPersonality`, best-effort |
| Util | `src/utils/codexPromptComposer.ts` | `composeCodexPrompt()` / `expandSlashCommands()` — `/cmd`→`<command-context>` + `<available-skills>` index for `selectedSkills`; bypasses openai/codex#3641 |
| Test | `src/utils/__tests__/codexPromptComposer.test.ts` | 6 unit tests (pure expansion logic) |
| Route/Page | `src/App.tsx` | `backend === 'codex'` branch: `injectAgentPersonalityAgentsMd` + `composeCodexPrompt` before `send_message_via_codex` (Claude path never imports either) |

**Parity behavior:** Codex session now (a) writes persona into `AGENTS.md` in the working dir (same mechanism as CLAUDE.md injection — Codex reads it natively); (b) gets working slash commands the native `codex exec` lacks; (c) gets an injected index of the agent's *selected* skills (Codex `cat`s the SKILL.md by path = progressive disclosure w/o bloat). Autonomous skill discovery stays Claude-only; **subagents are NOT** (0.130 has them natively — retracted, see re-target section).
**M1.5 deferred:** live GUI smoke (command+skill on real Codex session); M2 decision inject full SKILL.md body vs index by real token cost.

### M1.5b — Codex model picker
Codex CLI has no model-discovery endpoint and availability is OpenAI-account-gated, so the picker is a **curated list anchored to textual evidence + a free-text override** (not an invented list). Passing `codex exec -c model=<id>` is a Codex knob (like `--sandbox`) — does NOT violate the agent-level decision (no model-selection reimplementation). Additive + `isCodexSession`-gated → zero Claude regression (tsc clean, TS adapter 20/20 unchanged, Rust untouched: `build_codex_args` already took `Option<model>`).

| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Constant | `src/constants/codexModels.ts` | `CURATED_CODEX_MODELS` (`gpt-5-codex` default, `gpt-5`, `gpt-5.5`, `o3`), `CODEX_DEFAULT_MODEL` |
| Store | `src/stores/settingsStore.ts` | `codexModel` field + `setCodexModel` + persisted (settings-storage v13, additive — no migration) |
| Component | `src/components/ChatSettingsMenu.tsx` | Codex panel: curated `<select>` + override `<input>`; trigger summary shows `Codex · <model>` |
| Wiring | `UnifiedActionBar.tsx` → `ChatView.tsx` → `App.tsx` | optional `codexModel`/`onCodexModelChange` in `SettingsProps`; App Codex branch sends `useSettingsStore.getState().codexModel || null` |
