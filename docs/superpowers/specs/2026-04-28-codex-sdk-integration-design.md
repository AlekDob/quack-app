---
type: spec
project: quack-app
created: 2026-04-28
status: draft
tags: [codex, openai, agent-backend, multi-backend, oauth]
---

# Codex SDK Integration — Design Spec

## 1. Goal

Add OpenAI's Codex CLI as a **second agent backend** alongside the existing Claude Code (Anthropic Agent SDK). Users select Claude or Codex per session at creation time. Both backends share the same Quack UI, brain, MCP, slash commands, subagents, and stamina tracking — only the underlying agent runtime changes.

The primary user value: unlock Quack for developers who already pay for ChatGPT Plus/Pro/Business/Edu/Enterprise (no Claude subscription required), and offer choice between two best-in-class coding agents.

## 2. Non-Goals

- Switching backend mid-conversation (immutable per session).
- Multi-backend in a single message (no "ask both, compare answers").
- Replacing Claude as default — Claude stays the primary backend for new users.
- Migrating existing Claude sessions to Codex (history format incompatible, would lose context).
- Implementing OAuth client ourselves — we delegate to `codex login` subprocess.
- Performance benchmarking or stress testing as part of this release.

## 3. Architecture

### High-level

```
                     ┌──────────────────────────────┐
                     │         React UI             │
                     │  (Chat / Stamina / Brain)    │
                     └──────────────┬───────────────┘
                                    │ QuackAgentEvent
                                    │ (formato unificato)
                     ┌──────────────▼───────────────┐
                     │   Event Translator (Rust)    │
                     │  Claude format ↔ unified     │
                     │  Codex format  ↔ unified     │
                     └──────┬───────────────┬───────┘
                            │               │
              ┌─────────────▼─┐         ┌───▼──────────────┐
              │ ClaudeBackend │         │  CodexBackend    │
              │  (trait impl) │         │   (trait impl)   │
              └───────┬───────┘         └────────┬─────────┘
                      │                          │
                      ▼                          ▼
            stream-daemon.js               codex exec --json
            (Node, persistente)            (subprocess Rust,
            Claude Agent SDK                spawn-per-query
                                            con resume by id)
```

### Trait `AgentBackend`

New file `src-tauri/src/agents/backend.rs`:

```rust
#[async_trait]
trait AgentBackend: Send + Sync {
    async fn start_session(&self, params: StartSessionParams) -> Result<BackendSessionHandle>;
    async fn send_message(&self, session: &BackendSessionHandle, msg: UserMessage) -> Result<()>;
    async fn resume_session(&self, backend_session_id: &str) -> Result<BackendSessionHandle>;
    async fn cancel(&self, session: &BackendSessionHandle) -> Result<()>;
    fn auth_status(&self) -> AuthStatus;
    fn kind(&self) -> AgentBackendKind;
}

enum AgentBackendKind { Claude, Codex }
```

Two implementations:
- `ClaudeBackend` — thin wrapper around the existing `stream-daemon.js` invocation logic. **Zero behavior change** for Claude sessions.
- `CodexBackend` — direct spawn of `codex exec --json` from Rust using `tokio::process::Command`. No Node daemon.

**Asymmetry rationale:** Claude requires a Node daemon because the Anthropic Agent SDK is a Node library. Codex is a self-contained binary with native session management (`codex resume <id>`), so spawning per query is simpler and idiomatic. Forcing symmetry would be over-engineering.

### Event Translator

New file `src-tauri/src/agents/events.rs`:

```rust
enum QuackAgentEvent {
    SessionStarted { backend_session_id: String, model: String, backend: AgentBackendKind },
    TextDelta { content: String },
    ToolCallStart { id: String, name: String, args: serde_json::Value },
    ToolCallEnd { id: String, output: String, error: Option<String> },
    Usage { input_tokens: u64, output_tokens: u64, cached_tokens: u64, cost_usd: Option<f64> },
    PermissionRequest { tool: String, args: serde_json::Value, request_id: String },
    Error { code: String, message: String, recoverable: bool },
    SessionEnded { reason: EndReason },
}
```

The React UI consumes this enum agnostically — no `if backend === 'codex'` branches in chat/stamina/brain code, except a small `[Claude]` / `[Codex]` badge in sidebar and chat header.

#### Event mapping table

| `QuackAgentEvent` | Claude SDK source | Codex `--json` source (TBD via spike) |
|---|---|---|
| `SessionStarted` | `system.init` | `thread.created` (or first event) |
| `TextDelta` | `stream_event.content_block_delta.text` | `message.delta` or `response.output_text.delta` |
| `ToolCallStart` | `assistant.tool_use` block | `tool.start` |
| `ToolCallEnd` | `user.tool_result` block | `tool.end` (with stdout/stderr) |
| `Usage` | `assistant.usage` (per-step) | `completion.done.usage` |
| `PermissionRequest` | `permission_request` | sandbox approval event |
| `Error` | `error` | `error` |

The exact Codex event names will be **verified during the Milestone 0 spike** before any production code is written.

#### Tool name normalization

Codex uses different names for equivalent tools. A single function in `events.rs`:

```rust
fn normalize_tool_name(backend: AgentBackendKind, raw: &str) -> &str {
    match (backend, raw) {
        (Codex, "apply_patch") => "Edit",
        (Codex, "shell") => "Bash",
        (Codex, "view") => "Read",
        // ... extended during spike
        _ => raw,
    }
}
```

Tool icons and "files modified" counters work cross-backend without duplication.

#### Token semantics

- Anthropic returns `cache_read_input_tokens` + `cache_creation_input_tokens`. OpenAI returns `cached_tokens` only.
- **Stamina bar** uses `input + output` aggregates → backend-agnostic, no change.
- **TokenUsageModal** renders a per-backend breakdown with native fields (no lossy translation).
- Translator emits per-step usage (not cumulative). React aggregates as it already does for Claude.

## 4. Data Model

Extension of the existing `Session` type in `src/types.ts`:

```ts
type AgentBackendKind = 'claude' | 'codex';

interface Session {
  id: string;
  agentId: string;
  // ... existing fields
  backend: AgentBackendKind;              // NEW — immutable after create
  backendSessionId?: string;               // NEW — native Codex/Claude session id for resume
  backendAuthMethod?: 'oauth' | 'apikey';  // NEW — Codex only, ignored by Claude
}
```

**Persistence:** `backend` is added to the existing session JSON files in `~/Library/Application Support/com.quack.app/sessions/<id>.json`.

**Migration:** sessions without the field default to `'claude'` at load. Zero breaking change for existing sessions.

**Selection UX (modal "New Session"):**
- Toggle at top: `Backend: [● Claude Code  ○ Codex]`.
- Below the Codex option: auth status indicator (`Signed in as ChatGPT Plus` / `API key configured` / `Not configured →`).
- If Codex selected without auth → CTA "Setup Codex auth" opens Settings → Codex pane.
- Default: last backend used for that project (per-project preference in `settingsStore`).

## 5. Authentication

Codex stores tokens in `~/.codex/auth.json` (or OS keyring) with automatic refresh handled by the Codex CLI itself.

### OAuth ChatGPT flow

We delegate to the `codex login` subprocess — **no custom OAuth implementation**:

1. User clicks "Sign in with ChatGPT" in Settings → Codex.
2. Quack spawns `codex login` as a subprocess.
3. Codex opens the system browser autonomously and starts a localhost callback listener.
4. Quack shows a loader modal: "Complete login in your browser…".
5. Quack uses `notify` crate to watch `~/.codex/auth.json` for write events.
6. On detection → close modal, refresh auth status badge.

**Pro:** zero OAuth/PKCE code to maintain, native to Codex flow, recognizes existing terminal logins.

### API key

UI in `Settings → Backends → Codex`:

```
API Key:    [sk-........................] [Test]
            Status: ✓ Valid (last checked 2m ago)

OAuth:      [● Sign in with ChatGPT]
            Currently signed in as: alek@xxx (ChatGPT Plus)
            [Sign out]
```

Storage: macOS Keychain via `keyring` crate (already used for Anthropic key). **Never** in `~/.codex/auth.json` or localStorage.

### Resolution at session start

When launching a Codex session:
1. If user prefers OAuth → check `~/.codex/auth.json` exists and token valid. If expired → trigger Codex auto-refresh. If refresh fails → modal "Re-login required".
2. If user prefers API key → set `OPENAI_API_KEY=<from_keychain>` env var on the `codex exec` subprocess.
3. If both configured → user preference (radio in Settings).

### Live status updates

Tauri event `codex:auth-changed` emitted when:
- `~/.codex/auth.json` modified (login/logout from terminal)
- API key updated in Settings
- Token refresh failed

UI listens and updates the badge in real time.

## 6. Memory, Brain, MCP

### Memory files (CLAUDE.md ↔ AGENTS.md)

Codex uses `AGENTS.md` (repo root + `~/.codex/AGENTS.md` global). Claude uses `CLAUDE.md`. Two files = two sources of truth that diverge.

**Strategy: single source + symlink.**
- User keeps writing in `CLAUDE.md`.
- Quack auto-creates `AGENTS.md` as a **symlink** to `CLAUDE.md` on first Codex session in a repo.
- Manager in `src-tauri/src/agents/memory_sync.rs`. Windows fallback: hard link or copy + watcher (symlinks require admin).
- Default: `AGENTS.md` versioned in git for reproducibility (gitignore optional via setting).

**Edge case:** existing `AGENTS.md` differs → dialog "Existing AGENTS.md found. [Merge / Keep existing / Use Quack-managed]".

### Brain integration

Quack's Brain (`documentation/` + `~/.quack/brain/`) is read **by the agent itself** via tools, not by the system:
- Claude: tool `Read` reads `documentation/*.md`, MCP `quack-brain` for semantic queries.
- Codex: tool `view` (normalized to `Read`) reads the same files. Same MCP server.

**Zero new code for Brain integration.** AGENTS.md (symlink of CLAUDE.md) already references the Brain.

Code `// Brain: <slug>` breadcrumbs are plain text → both backends see them.

Brain hooks (`~/.quack/hooks/brain/`) are Quack-side, backend-agnostic.

### MCP integration

Codex reads MCP from `~/.codex/config.toml`:

```toml
[mcp_servers.quack-brain]
command = "node"
args = ["/path/to/quack-brain-mcp.js"]
env = { ... }
```

Claude reads MCP from `~/.claude.json` (similar JSON format).

**Strategy: source-of-truth in Quack, render to both.**
- Quack already manages MCP in Settings UI with its own storage.
- New `mcp_renderer.rs` with two functions: `render_claude_json()` (existing logic) + `render_codex_toml()` (new, ~150 LOC using `toml` crate).
- On any MCP add/remove → both files regenerated.
- Sync at app startup + on MCP list change.

## 7. Slash Commands and Subagents

### Slash commands

Claude SDK has no documented CLI flag for system prompt injection on Codex side. Quack's custom slash commands (`/code`, `/feature`, `/bug`, `/whiteboard`) work today via **client-side expansion** in React: the slash text is replaced with an inflated user message containing the skill content + arguments + project context, then sent as a regular user message.

**Strategy: keep client-side expansion identical for both backends.**
- Same expansion logic in React.
- Resulting "fat" user message goes to either backend transparently.
- No dependency on system-prompt CLI flags → Codex gap neutralized.

**Limitation:** slash commands that require backend-specific capabilities (e.g., `/loop` doing Claude-side scheduling) stay Claude-only. UI shows a `Claude-only` badge in the command palette when the active session is Codex.

### Subagents

Quack has custom agent types in `~/.claude/agents/*.md` (e.g., `code-reviewer`, `Explore`). Claude spawns them via the SDK `Agent` tool. Codex has native subagents (presumed convention `~/.codex/agents/*.md` — to verify in spike).

**Strategy: dual render, like MCP.**
- Source-of-truth: Quack registry in Settings.
- `subagent_renderer.rs` produces both `~/.claude/agents/<name>.md` and `~/.codex/agents/<name>.md`.
- Effort: low, two markdown writers.

## 8. Roadmap (4 milestones, 7-9 weeks total)

### Milestone 0 — Spike (1 week)

- Reverse-engineer the schema of `codex exec --json` events on a test repo.
- Validate the event mapping table (section 3).
- Measure spawn-per-query overhead vs daemon Node.
- Test OAuth flow + file watcher on `~/.codex/auth.json`.
- **Deliverable:** `documentation/research/codex-cli-events.md` with verified schema + decision: spawn-per-query confirmed or pivot to daemon.

**Gate:** if performance is poor (>2s overhead per query) → reconsider architecture before production code.

### Milestone 1 — Foundation (3 weeks)

- Trait `AgentBackend` + `ClaudeBackend` (refactor wrapping the existing daemon, **zero behavior change**).
- `CodexBackend` skeleton: `start_session`, basic `send_message`.
- Event Translator with `TextDelta`, `ToolCallStart`, `ToolCallEnd`, `Usage`, `Error`.
- Auth: API key setup in Settings + Keychain storage.
- UI: backend toggle in "New Session" modal, badge in sidebar.
- **Deliverable:** Codex session with API key doing chat + basic tool calls.

**Gate:** internal dogfooding 3 days. Real-project usage by Alek.

### Milestone 2 — Feature parity (2-3 weeks)

- Full OAuth ChatGPT flow (`codex login` subprocess + file watcher).
- AGENTS.md symlink + Windows fallback.
- MCP renderer dual (`config.toml` + `claude.json`) with auto-sync.
- Subagent renderer dual.
- Slash commands client-side expansion validated cross-backend.
- Stamina bar + TokenUsageModal with per-backend view.
- Brain integration verified (reading `documentation/`).

**Gate:** E2E test of main slash commands (`/code`, `/feature`, `/whiteboard`) on both backends.

### Milestone 3 — Polish + release (1-2 weeks)

- Permission requests Codex (sandbox approval flow).
- Session resume/fork via `codex resume <id>`.
- Auth edge cases (expired token, refresh failed, no internet).
- Opt-in telemetry: `backend_used` event for adoption metrics.
- User docs: `documentation/guide/codex-backend/` (overview, setup, troubleshooting).
- Release notes + email announcement (pattern `assets/release-*-email.html`).

## 9. Risk Register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Codex `--json` event schema differs from assumed | High | Milestone 0 spike (1 week), adjust mapping table before writing CodexBackend |
| OAuth token refresh fails silently | Medium | File watcher on `auth.json`, re-login dialog, dedicated logging |
| AGENTS.md symlink breaks on Windows | Medium | Fallback to copy + watcher that re-syncs on CLAUDE.md change |
| MCP server compatibility (Codex TOML stricter) | Medium | TOML validation at render time, test with current MCPs (quack-brain, code-intel) |
| Tool name mismatch breaks icons/counters | Low | Mapping table, fallback to raw name, E2E tests |
| Codex doesn't support tool concurrency like Claude | Low | Sequential by default, parallelization in Phase 2 |
| Spawn-per-query Codex slower than daemon | Low | Measured in spike; if >2s overhead → consider codex-daemon Node |

## 10. Testing Strategy

| Layer | What to test | Tool |
|---|---|---|
| Event Translator (Rust) | Mapping events Claude→unified and Codex→unified | `cargo test` with JSON fixtures recorded in spike |
| AgentBackend trait | Identical contract Claude vs Codex | Shared trait test |
| Auth flow | OAuth login mock, API key validation, refresh | Integration test with mock OpenAI |
| Symlink/MCP renderer | Generated files correct on macOS/Linux/Windows | Snapshot test |
| Slash expansion | Same slash → same final prompt | Vitest in `src/` |
| E2E | Full Codex session: login → chat → tool call → resume | Manual checklist `documentation/guide/codex-backend/test-plan.md` |

**Out of scope:** stress test, performance benchmark, adversarial sandbox escape.

## 11. Open Questions (to resolve in Milestone 0)

1. Exact JSON event schema of `codex exec --json` (event names, payload structure).
2. Codex subagent file convention (`~/.codex/agents/` confirmed?).
3. Permission request format from Codex sandbox (vs Claude's `permission_request`).
4. Codex behavior when MCP TOML has unknown fields (strict reject or ignore).
5. Whether `codex resume <id>` preserves MCP/AGENTS.md context or reloads from disk.

## 12. Success Criteria

- A user with only ChatGPT Plus (no Claude subscription) can complete the Quack onboarding and run a coding session end-to-end.
- A user with both subscriptions can switch backend per session without UI confusion.
- Stamina bar, brain access, MCP servers, custom slash commands work identically on both backends (modulo whitelist of Claude-only slashes).
- Zero regression for existing Claude users (their sessions load with `backend: 'claude'` and behave unchanged).
- Codex session startup latency ≤ 2× Claude session startup latency.

---

**Approval status:** awaiting user review.

**Next step:** after approval, invoke `writing-plans` skill to produce the implementation plan in `docs/superpowers/plans/`.
