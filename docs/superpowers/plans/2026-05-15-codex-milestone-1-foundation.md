# Codex Backend — Milestone 1 (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second agent backend (OpenAI Codex CLI) behind a Rust `AgentBackend` trait + unified `QuackAgentEvent` translator, with zero behavior change for existing Claude sessions, an API-key auth path reusing the 037 provider stack, and a backend selector in the New Session modal.

**Architecture:** Quack owns the abstraction at the **agent level** (decision `decision-quack-abstraction-agent-level-not-model-level.md`): thin adapters over complete agent harnesses. `ClaudeBackend` wraps the existing persistent Node daemon untouched; `CodexBackend` spawns `codex exec --experimental-json` per query and tails the rollout JSONL for token usage (two event surfaces — verified spike `documentation/research/codex-cli-events.md`). A pure `events.rs` translator normalizes both into one `QuackAgentEvent` enum the React UI consumes agnostically.

**Tech Stack:** Rust 1.75+ (Tauri v2, tokio, serde, async-trait), TypeScript strict (React 18, Zustand), existing 037 provider/keychain stack (`providerService.ts`, `preferences::save_provider_api_key`).

---

## Scope & Decomposition

Milestone 1 spans 5 sub-systems. They are sequenced into 5 phases below. **Review gates** (do not batch across them):

- **Phase A** (translator, pure logic) — fully TDD from spike RAW fixtures. Safe, no runtime wiring. Lands first.
- **Phase B** (trait + backends) — contains the **highest-risk change**: `ClaudeBackend` must wrap the existing daemon with **zero behavior change**. Task B2 is a standalone review gate; do not merge B2 with later tasks.
- **Phase C** (data model + persistence) — additive, migration-safe.
- **Phase D** (auth) — mostly reuse of the 037 stack; minimal new code.
- **Phase E** (UI wiring) — user-visible, behind the new selector.

The authoritative event contract is `documentation/research/codex-cli-events.md` §6/§7 (spike, `status: complete`), which **supersedes** the obsolete spec §3/§6/§7 in `docs/superpowers/specs/2026-04-28-codex-sdk-integration-design.md`.

Out of Milestone 1 (deferred per spec §8): OAuth `codex login` subprocess + auth.json file watcher (M2), MCP/AGENTS.md dual render (M2), sandbox approval flow (M3 — and per spike §4.6 there is no PermissionRequest source via `codex exec` anyway), spawn-latency benchmark gate (run before M1 sign-off, tracked in spike §8).

---

## File Structure

| File | New/Modify | Responsibility |
|---|---|---|
| `src-tauri/src/agents/mod.rs` | Create | Module root: `pub mod backend; pub mod events; pub mod claude_backend; pub mod codex_backend;` |
| `src-tauri/src/agents/events.rs` | Create | `QuackAgentEvent` enum, `normalize_tool_name`, `codex_stream_to_quack`, `codex_rollout_to_usage`, `claude_event_to_quack`. Pure functions, fully unit-tested. |
| `src-tauri/src/agents/backend.rs` | Create | `AgentBackend` async trait, `AgentBackendKind`, `StartSessionParams`, `BackendSessionHandle`, `AuthStatus`. |
| `src-tauri/src/agents/claude_backend.rs` | Create | `ClaudeBackend` — delegates verbatim to existing `claude_cli` functions. No daemon logic copied. |
| `src-tauri/src/agents/codex_backend.rs` | Create | `CodexBackend` — `codex exec --experimental-json` spawn-per-query, rollout JSONL tail, emits `codex-event:{agent_id}` mirroring the Claude wrapper shape. |
| `src-tauri/src/lib.rs` | Modify (`:22` mod list, `:1049` invoke_handler) | `mod agents;` + register new commands (`codex_auth_status`, `send_message_via_codex`). |
| `src-tauri/src/agents/fixtures/` | Create | RAW JSONL fixtures copied verbatim from spike for `cargo test`. |
| `src/types.ts` | Modify (`:457-488` AgentSession) | Add `backend?`, `backendSessionId?`, `backendAuthMethod?`. |
| `src/types/agentBackend.ts` | Create | `AgentBackendKind` + `QuackAgentEvent` TS mirror of the Rust enum. |
| `src/services/codexAuthService.ts` | Create | Wraps `codex_auth_status` Tauri command (thin, mirrors `providerService.ts` style). |
| `src/stores/sessionStore.ts` | Modify (`createSession` ~`:123`) | Persist `backend`; default `'claude'` on load. |
| `src/components/NewSessionModal.tsx` | Modify (after `:224`) | Backend segmented toggle (Claude / Codex) + Codex auth hint. |
| `src/components/RepositoryGroup.tsx` | Modify (`handleNewSession` `:1263-1360`, modal render `:2623`) | Thread `backend` from modal into `createSession`. |
| `src/components/SessionsPanel.tsx` | Modify (`SessionCard` ~`:240`) | `[Codex]` badge per row when `session.backend === 'codex'`. |
| `src/hooks/useAgentEventStream.ts` | Create | Listens `codex-event:{agentId}`, feeds existing chat reducer via a Claude-shaped adapter. |

---

## Phase A — Event Translator (pure logic, TDD)

### Task A1: Module skeleton + `QuackAgentEvent` enum

**Files:**
- Create: `src-tauri/src/agents/mod.rs`
- Create: `src-tauri/src/agents/events.rs`
- Modify: `src-tauri/src/lib.rs:22` (module declarations block)

- [ ] **Step 1: Declare the module**

In `src-tauri/src/lib.rs`, in the `mod` block (after line 24 `mod ai;`), add:

```rust
mod agents; // 🤖 Multi-backend agent abstraction (Claude + Codex)
```

- [ ] **Step 2: Create `src-tauri/src/agents/mod.rs`**

```rust
//! Multi-backend agent abstraction.
//! Decision: documentation/decisions/decision-quack-abstraction-agent-level-not-model-level.md
pub mod backend;
pub mod claude_backend;
pub mod codex_backend;
pub mod events;
```

- [ ] **Step 3: Create `src-tauri/src/agents/events.rs` with the enum**

```rust
//! Unified agent event contract.
//! Authoritative source: documentation/research/codex-cli-events.md §6 (spike, verified).
//! NOTE: Codex `error` has only {type,message} — no code/recoverable (spike §4.3).
//! NOTE: PermissionRequest has NO source via `codex exec` (spike §4.6).
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AgentBackendKind {
    Claude,
    Codex,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum QuackAgentEvent {
    SessionStarted {
        backend_session_id: String,
        model: Option<String>,
        backend: AgentBackendKind,
    },
    TextDelta { content: String },
    ToolCallStart { id: String, name: String, args: serde_json::Value },
    ToolCallEnd { id: String, output: String, error: Option<String> },
    Usage {
        input_tokens: u64,
        output_tokens: u64,
        cached_tokens: u64,
        cost_usd: Option<f64>,
    },
    Error { code: String, message: String, recoverable: bool },
    SessionEnded { reason: String },
}
```

- [ ] **Step 4: Build to verify it compiles**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: builds (warnings about unused are OK at this stage).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/agents/mod.rs src-tauri/src/agents/events.rs src-tauri/src/lib.rs
git commit -m "feat(agents): scaffold agents module + QuackAgentEvent enum"
```

---

### Task A2: `normalize_tool_name` (spike §7 — verified)

**Files:**
- Modify: `src-tauri/src/agents/events.rs`

- [ ] **Step 1: Write the failing test**

Append to `src-tauri/src/agents/events.rs`:

```rust
#[cfg(test)]
mod tool_name_tests {
    use super::*;

    #[test]
    fn codex_command_execution_maps_to_bash() {
        // Spike §7 VERIFIED: codex 0.42 --experimental-json has ONLY
        // item_type "command_execution" (it shells out everything).
        assert_eq!(normalize_tool_name(AgentBackendKind::Codex, "command_execution"), "Bash");
    }

    #[test]
    fn codex_unknown_item_type_passes_through() {
        assert_eq!(normalize_tool_name(AgentBackendKind::Codex, "mystery"), "mystery");
    }

    #[test]
    fn claude_names_pass_through_unchanged() {
        assert_eq!(normalize_tool_name(AgentBackendKind::Claude, "Edit"), "Edit");
        assert_eq!(normalize_tool_name(AgentBackendKind::Claude, "Bash"), "Bash");
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd src-tauri && cargo test --lib agents::events::tool_name_tests 2>&1 | tail -5`
Expected: FAIL — `cannot find function normalize_tool_name`.

- [ ] **Step 3: Write the implementation**

Add to `src-tauri/src/agents/events.rs` (above the `#[cfg(test)]` block):

```rust
/// Map a backend-native tool/item identifier to Quack's canonical tool name.
/// Codex 0.42 `--experimental-json` exposes a single `command_execution`
/// item type (spike §7, VERIFIED — `apply_patch`/`shell`/`view` do NOT exist).
pub fn normalize_tool_name(backend: AgentBackendKind, raw: &str) -> &str {
    match (backend, raw) {
        (AgentBackendKind::Codex, "command_execution") => "Bash",
        // Claude tool_use names are already canonical; pass through.
        _ => raw,
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd src-tauri && cargo test --lib agents::events::tool_name_tests 2>&1 | tail -5`
Expected: PASS (3 passed).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/agents/events.rs
git commit -m "feat(agents): normalize_tool_name (Codex command_execution -> Bash, verified spike §7)"
```

---

### Task A3: Codex stdout stream → `QuackAgentEvent`

**Files:**
- Modify: `src-tauri/src/agents/events.rs`
- Create: `src-tauri/src/agents/fixtures/codex_stream_tool_run.jsonl`

- [ ] **Step 1: Create the RAW fixture (verbatim from spike §4.2)**

Create `src-tauri/src/agents/fixtures/codex_stream_tool_run.jsonl`:

```
{"type":"session.created","session_id":"019e2bf1-7d75-74b0-85cc-6319b619f0a9"}
{"type":"item.started","item":{"id":"item_0","item_type":"command_execution","command":"bash -lc 'echo PING > note.txt'","aggregated_output":"","status":"in_progress"}}
{"type":"item.completed","item":{"id":"item_0","item_type":"command_execution","command":"bash -lc 'echo PING > note.txt'","aggregated_output":"","exit_code":0,"status":"completed"}}
{"type":"item.completed","item":{"id":"item_1","item_type":"command_execution","command":"bash -lc 'cat note.txt'","aggregated_output":"PING\n","exit_code":0,"status":"completed"}}
{"type":"item.completed","item":{"id":"item_2","item_type":"assistant_message","text":"Created note.txt with PING."}}
{"type":"error","message":"Failed to refresh token: 401 Unauthorized"}
```

- [ ] **Step 2: Write the failing test**

Append to `src-tauri/src/agents/events.rs`:

```rust
#[cfg(test)]
mod codex_stream_tests {
    use super::*;

    fn parse_all(jsonl: &str) -> Vec<QuackAgentEvent> {
        jsonl.lines()
            .filter(|l| !l.trim().is_empty())
            .filter_map(|l| serde_json::from_str::<serde_json::Value>(l).ok())
            .filter_map(codex_stream_to_quack)
            .collect()
    }

    #[test]
    fn maps_session_created() {
        let ev = codex_stream_to_quack(
            serde_json::json!({"type":"session.created","session_id":"abc-123"})
        ).unwrap();
        assert_eq!(ev, QuackAgentEvent::SessionStarted {
            backend_session_id: "abc-123".into(),
            model: None, // spike §4.1: model NOT in stdout; filled from rollout later
            backend: AgentBackendKind::Codex,
        });
    }

    #[test]
    fn command_execution_started_is_toolcallstart() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.started",
            "item":{"id":"item_0","item_type":"command_execution",
                    "command":"bash -lc 'echo hi'","aggregated_output":"","status":"in_progress"}
        })).unwrap();
        match ev {
            QuackAgentEvent::ToolCallStart { id, name, args } => {
                assert_eq!(id, "item_0");
                assert_eq!(name, "Bash"); // normalized
                assert_eq!(args["command"], "bash -lc 'echo hi'");
            }
            other => panic!("expected ToolCallStart, got {other:?}"),
        }
    }

    #[test]
    fn command_execution_completed_is_toolcallend_with_output() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.completed",
            "item":{"id":"item_1","item_type":"command_execution",
                    "command":"bash -lc 'cat note.txt'","aggregated_output":"PING\n",
                    "exit_code":0,"status":"completed"}
        })).unwrap();
        assert_eq!(ev, QuackAgentEvent::ToolCallEnd {
            id: "item_1".into(), output: "PING\n".into(), error: None,
        });
    }

    #[test]
    fn failed_command_execution_carries_error() {
        // Spike §4.6: sandbox denial -> status "failed", exit_code -1, error in aggregated_output
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.completed",
            "item":{"id":"item_0","item_type":"command_execution",
                    "command":"bash -lc 'echo X > b.txt'",
                    "aggregated_output":"bash: b.txt: Operation not permitted\n",
                    "exit_code":-1,"status":"failed"}
        })).unwrap();
        match ev {
            QuackAgentEvent::ToolCallEnd { error: Some(e), .. } => {
                assert!(e.contains("Operation not permitted"));
            }
            other => panic!("expected ToolCallEnd with error, got {other:?}"),
        }
    }

    #[test]
    fn assistant_message_is_textdelta() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"item.completed",
            "item":{"id":"item_2","item_type":"assistant_message","text":"Done."}
        })).unwrap();
        assert_eq!(ev, QuackAgentEvent::TextDelta { content: "Done.".into() });
    }

    #[test]
    fn error_event_has_no_code_or_recoverable_natively() {
        let ev = codex_stream_to_quack(serde_json::json!({
            "type":"error","message":"Failed to refresh token: 401 Unauthorized"
        })).unwrap();
        match ev {
            QuackAgentEvent::Error { code, message, recoverable } => {
                assert_eq!(message, "Failed to refresh token: 401 Unauthorized");
                assert_eq!(code, "auth"); // inferred by string-match (spike §4.3)
                assert!(!recoverable);    // terminal 401 -> not recoverable
            }
            other => panic!("expected Error, got {other:?}"),
        }
    }

    #[test]
    fn item_started_non_command_is_ignored() {
        assert!(codex_stream_to_quack(serde_json::json!({
            "type":"item.started",
            "item":{"id":"x","item_type":"assistant_message","status":"in_progress"}
        })).is_none());
    }

    #[test]
    fn full_fixture_stream_shape() {
        let raw = include_str!("fixtures/codex_stream_tool_run.jsonl");
        let evs = parse_all(raw);
        // session + 1 start + 3 ends (2 cmd + ... ) + 1 text + 1 error
        assert!(matches!(evs.first(), Some(QuackAgentEvent::SessionStarted { .. })));
        assert!(matches!(evs.last(), Some(QuackAgentEvent::Error { .. })));
        assert_eq!(evs.iter().filter(|e| matches!(e, QuackAgentEvent::ToolCallStart { .. })).count(), 1);
        assert_eq!(evs.iter().filter(|e| matches!(e, QuackAgentEvent::ToolCallEnd { .. })).count(), 2);
        assert_eq!(evs.iter().filter(|e| matches!(e, QuackAgentEvent::TextDelta { .. })).count(), 1);
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd src-tauri && cargo test --lib agents::events::codex_stream_tests 2>&1 | tail -10`
Expected: FAIL — `cannot find function codex_stream_to_quack`.

- [ ] **Step 4: Write the implementation**

Add to `src-tauri/src/agents/events.rs` (above the test modules):

```rust
/// Infer Quack error `code` + `recoverable` from a Codex `error.message`.
/// Spike §4.3: Codex `error` event has ONLY {type,message}; no native fields.
fn classify_codex_error(message: &str) -> (String, bool) {
    let m = message.to_ascii_lowercase();
    if m.contains("401") || m.contains("refresh token") || m.contains("unauthorized") {
        return ("auth".into(), false);
    }
    if m.contains("timed out") || m.contains("timeout") {
        return ("timeout".into(), true);
    }
    // A line still saying "retrying" is a transient retry, not terminal (spike §4.3).
    let recoverable = m.contains("retrying");
    ("stream".into(), recoverable)
}

/// Translate ONE Codex `--experimental-json` stdout event into a QuackAgentEvent.
/// Returns None for events Quack does not surface (e.g. non-command item.started).
/// Surface contract: spike §4.1–§4.3, mapping table §6 ([S] rows).
pub fn codex_stream_to_quack(v: serde_json::Value) -> Option<QuackAgentEvent> {
    match v.get("type").and_then(|t| t.as_str())? {
        "session.created" => Some(QuackAgentEvent::SessionStarted {
            backend_session_id: v.get("session_id")?.as_str()?.to_string(),
            model: None, // spike §4.1: model lives in rollout turn_context, not here
            backend: AgentBackendKind::Codex,
        }),
        "item.started" => {
            let item = v.get("item")?;
            if item.get("item_type")?.as_str()? != "command_execution" {
                return None;
            }
            Some(QuackAgentEvent::ToolCallStart {
                id: item.get("id")?.as_str()?.to_string(),
                name: normalize_tool_name(
                    AgentBackendKind::Codex,
                    item.get("item_type")?.as_str()?,
                ).to_string(),
                args: serde_json::json!({
                    "command": item.get("command").and_then(|c| c.as_str()).unwrap_or("")
                }),
            })
        }
        "item.completed" => {
            let item = v.get("item")?;
            match item.get("item_type")?.as_str()? {
                "command_execution" => {
                    let status = item.get("status").and_then(|s| s.as_str()).unwrap_or("");
                    let exit_code = item.get("exit_code").and_then(|c| c.as_i64()).unwrap_or(0);
                    let out = item.get("aggregated_output")
                        .and_then(|o| o.as_str()).unwrap_or("").to_string();
                    let error = if status == "failed" || exit_code != 0 {
                        Some(if out.is_empty() {
                            format!("command failed (exit {exit_code})")
                        } else { out.clone() })
                    } else { None };
                    Some(QuackAgentEvent::ToolCallEnd {
                        id: item.get("id")?.as_str()?.to_string(),
                        output: out,
                        error,
                    })
                }
                "assistant_message" => Some(QuackAgentEvent::TextDelta {
                    content: item.get("text")?.as_str()?.to_string(),
                }),
                _ => None,
            }
        }
        "error" => {
            let message = v.get("message")?.as_str()?.to_string();
            let (code, recoverable) = classify_codex_error(&message);
            Some(QuackAgentEvent::Error { code, message, recoverable })
        }
        _ => None,
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-tauri && cargo test --lib agents::events::codex_stream_tests 2>&1 | tail -10`
Expected: PASS (8 passed).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/agents/events.rs src-tauri/src/agents/fixtures/codex_stream_tool_run.jsonl
git commit -m "feat(agents): codex stdout stream -> QuackAgentEvent (spike §4 fixtures)"
```

---

### Task A4: Codex rollout JSONL → `Usage`

**Files:**
- Modify: `src-tauri/src/agents/events.rs`
- Create: `src-tauri/src/agents/fixtures/codex_rollout.jsonl`

- [ ] **Step 1: Create the RAW fixture (verbatim from spike §4.7)**

Create `src-tauri/src/agents/fixtures/codex_rollout.jsonl`:

```
{"timestamp":"2026-05-15T14:02:45.041Z","type":"event_msg","payload":{"type":"token_count","info":null,"rate_limits":{"primary":null,"secondary":null}}}
{"timestamp":"2026-05-15T14:02:45.976Z","type":"event_msg","payload":{"type":"token_count","info":{"total_token_usage":{"input_tokens":2594,"cached_input_tokens":2432,"output_tokens":28,"reasoning_output_tokens":0,"total_tokens":2622},"last_token_usage":{"input_tokens":2594,"cached_input_tokens":2432,"output_tokens":28,"reasoning_output_tokens":0,"total_tokens":2622},"model_context_window":272000},"rate_limits":{"primary":null,"secondary":null}}}
{"timestamp":"2026-05-15T14:02:45.100Z","type":"turn_context","payload":{"cwd":"/tmp/x","approval_policy":"never","sandbox_policy":{"mode":"read-only"},"model":"gpt-5-codex"}}
```

- [ ] **Step 2: Write the failing test**

Append to `src-tauri/src/agents/events.rs`:

```rust
#[cfg(test)]
mod codex_rollout_tests {
    use super::*;

    #[test]
    fn null_info_token_count_yields_nothing() {
        // Spike §4.7: turn-start token_count has info:null — skip it.
        let v = serde_json::json!({
            "type":"event_msg","payload":{"type":"token_count","info":null}
        });
        assert!(codex_rollout_to_usage(&v).is_none());
    }

    #[test]
    fn full_token_count_maps_last_usage() {
        // Spike §4.7 + auto-memory: use last_token_usage (per-turn), not total.
        let v = serde_json::json!({
            "type":"event_msg","payload":{"type":"token_count","info":{
                "total_token_usage":{"input_tokens":9999,"cached_input_tokens":0,"output_tokens":0,"reasoning_output_tokens":0,"total_tokens":9999},
                "last_token_usage":{"input_tokens":2594,"cached_input_tokens":2432,"output_tokens":28,"reasoning_output_tokens":0,"total_tokens":2622},
                "model_context_window":272000}}
        });
        assert_eq!(codex_rollout_to_usage(&v).unwrap(), QuackAgentEvent::Usage {
            input_tokens: 2594, output_tokens: 28, cached_tokens: 2432, cost_usd: None,
        });
    }

    #[test]
    fn extracts_model_from_turn_context() {
        let v = serde_json::json!({
            "type":"turn_context","payload":{"model":"gpt-5-codex"}
        });
        assert_eq!(codex_rollout_model(&v), Some("gpt-5-codex".to_string()));
    }

    #[test]
    fn fixture_has_exactly_one_usable_usage() {
        let raw = include_str!("fixtures/codex_rollout.jsonl");
        let n = raw.lines().filter(|l| !l.trim().is_empty())
            .filter_map(|l| serde_json::from_str::<serde_json::Value>(l).ok())
            .filter_map(|v| codex_rollout_to_usage(&v))
            .count();
        assert_eq!(n, 1);
    }
}
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd src-tauri && cargo test --lib agents::events::codex_rollout_tests 2>&1 | tail -10`
Expected: FAIL — `cannot find function codex_rollout_to_usage`.

- [ ] **Step 4: Write the implementation**

Add to `src-tauri/src/agents/events.rs`:

```rust
/// Extract per-turn token usage from a rollout JSONL line.
/// Spike §4.7: usage lives ONLY in the rollout file (NOT stdout), as
/// event_msg/token_count. Use `last_token_usage` (per-turn) — `total_token_usage`
/// is cumulative (mirrors Quack's Claude result-vs-assistant rule, auto-memory).
/// The turn-start token_count has `info: null` → skipped.
pub fn codex_rollout_to_usage(v: &serde_json::Value) -> Option<QuackAgentEvent> {
    let payload = v.get("payload")?;
    if payload.get("type")?.as_str()? != "token_count" {
        return None;
    }
    let info = payload.get("info")?;
    if info.is_null() {
        return None;
    }
    let last = info.get("last_token_usage")?;
    Some(QuackAgentEvent::Usage {
        input_tokens: last.get("input_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
        output_tokens: last.get("output_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
        cached_tokens: last.get("cached_input_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
        cost_usd: None, // Codex does not provide cost (spike §6 Usage row)
    })
}

/// Extract the model name from a rollout `turn_context` line.
/// Spike §4.1/§4.7: model is NOT in stdout `session.created`; it is here.
pub fn codex_rollout_model(v: &serde_json::Value) -> Option<String> {
    if v.get("type")?.as_str()? != "turn_context" {
        return None;
    }
    v.get("payload")?.get("model")?.as_str().map(|s| s.to_string())
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd src-tauri && cargo test --lib agents::events::codex_rollout_tests 2>&1 | tail -10`
Expected: PASS (4 passed).

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/agents/events.rs src-tauri/src/agents/fixtures/codex_rollout.jsonl
git commit -m "feat(agents): codex rollout JSONL -> Usage + model (spike §4.7)"
```

---

### Task A5: Claude SDK event → `QuackAgentEvent`

**Files:**
- Modify: `src-tauri/src/agents/events.rs`

Goal: a thin adapter so the unified UI path can also render Claude sessions via `QuackAgentEvent`. The existing Claude `ClaudeEvent` (`types.ts:72`, parsed in `claude_cli.rs:491` as `crate::ClaudeEvent`) is the source. We only map the subset Milestone 1 needs (text, tool start/end, result usage, error).

- [ ] **Step 1: Write the failing test**

Append to `src-tauri/src/agents/events.rs`:

```rust
#[cfg(test)]
mod claude_event_tests {
    use super::*;

    #[test]
    fn system_init_is_session_started() {
        let v = serde_json::json!({
            "type":"system","subtype":"init",
            "session_id":"claude-sess-1","model":"claude-opus-4-7"
        });
        assert_eq!(claude_event_to_quack(&v).unwrap(), QuackAgentEvent::SessionStarted {
            backend_session_id: "claude-sess-1".into(),
            model: Some("claude-opus-4-7".into()),
            backend: AgentBackendKind::Claude,
        });
    }

    #[test]
    fn result_event_maps_usage() {
        let v = serde_json::json!({
            "type":"result","subtype":"success","session_id":"s",
            "total_cost_usd":0.012,
            "usage":{"input_tokens":10,"output_tokens":5,"cache_read_input_tokens":3,"cache_creation_input_tokens":2}
        });
        assert_eq!(claude_event_to_quack(&v).unwrap(), QuackAgentEvent::Usage {
            input_tokens: 10, output_tokens: 5, cached_tokens: 3, cost_usd: Some(0.012),
        });
    }

    #[test]
    fn error_event_is_recoverable_false_by_default() {
        let v = serde_json::json!({"type":"error","error":{"message":"boom"}});
        match claude_event_to_quack(&v).unwrap() {
            QuackAgentEvent::Error { message, .. } => assert_eq!(message, "boom"),
            other => panic!("got {other:?}"),
        }
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test --lib agents::events::claude_event_tests 2>&1 | tail -10`
Expected: FAIL — `cannot find function claude_event_to_quack`.

- [ ] **Step 3: Write the implementation**

Add to `src-tauri/src/agents/events.rs`:

```rust
/// Translate a Claude Agent SDK event (raw JSON, as emitted by stream-daemon.js
/// and parsed in claude_cli.rs) into a QuackAgentEvent. Subset for Milestone 1.
/// Claude is the existing default — this adapter is additive, it does NOT
/// replace the existing `claude-event:{agent_id}` path (zero behavior change).
pub fn claude_event_to_quack(v: &serde_json::Value) -> Option<QuackAgentEvent> {
    match v.get("type")?.as_str()? {
        "system" if v.get("subtype").and_then(|s| s.as_str()) == Some("init") => {
            Some(QuackAgentEvent::SessionStarted {
                backend_session_id: v.get("session_id")?.as_str()?.to_string(),
                model: v.get("model").and_then(|m| m.as_str()).map(String::from),
                backend: AgentBackendKind::Claude,
            })
        }
        "result" => {
            let u = v.get("usage")?;
            Some(QuackAgentEvent::Usage {
                input_tokens: u.get("input_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
                output_tokens: u.get("output_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
                cached_tokens: u.get("cache_read_input_tokens").and_then(|n| n.as_u64()).unwrap_or(0),
                cost_usd: v.get("total_cost_usd").and_then(|c| c.as_f64()),
            })
        }
        "error" => {
            let message = v.get("error").and_then(|e| e.get("message"))
                .and_then(|m| m.as_str())
                .or_else(|| v.get("message").and_then(|m| m.as_str()))
                .unwrap_or("unknown error").to_string();
            Some(QuackAgentEvent::Error { code: "claude".into(), message, recoverable: false })
        }
        _ => None, // text/tool blocks are delta-streamed by the existing path in M1
    }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test --lib agents::events 2>&1 | tail -8`
Expected: PASS (all `agents::events` tests green).

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/agents/events.rs
git commit -m "feat(agents): claude SDK event -> QuackAgentEvent adapter (additive)"
```

---

## Phase B — `AgentBackend` trait + backends

### Task B1: `AgentBackend` trait + value types

**Files:**
- Create: `src-tauri/src/agents/backend.rs`

- [ ] **Step 1: Verify `async-trait` is available**

Run: `grep -n 'async-trait\|async_trait' src-tauri/Cargo.toml src-tauri/src/*.rs | head -3`
Expected: a hit. If absent, Step 1b.

- [ ] **Step 1b (only if absent): add the dependency**

Run: `cd src-tauri && cargo add async-trait`
Expected: `Cargo.toml` gains `async-trait`.

- [ ] **Step 2: Write the trait**

Create `src-tauri/src/agents/backend.rs`:

```rust
//! The agent-level abstraction boundary (decision doc). Adapters are THIN
//! wrappers over complete agent harnesses — they do not reimplement the loop.
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use super::events::AgentBackendKind;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StartSessionParams {
    pub agent_id: String,
    pub session_key: String,
    pub working_dir: String,
    pub model: Option<String>,
    /// Frontend turn id, echoed back in every emitted event (parity with Claude path).
    pub turn_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackendSessionHandle {
    pub backend: AgentBackendKind,
    pub backend_session_id: Option<String>,
    pub agent_id: String,
    pub session_key: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "status", rename_all = "snake_case")]
pub enum AuthStatus {
    Ready { method: String },
    NotConfigured,
    Expired { detail: String },
}

#[async_trait]
pub trait AgentBackend: Send + Sync {
    fn kind(&self) -> AgentBackendKind;
    async fn auth_status(&self) -> AuthStatus;
    async fn send_message(
        &self,
        params: StartSessionParams,
        prompt: String,
    ) -> Result<BackendSessionHandle, String>;
    async fn resume(
        &self,
        backend_session_id: &str,
        params: StartSessionParams,
        prompt: String,
    ) -> Result<BackendSessionHandle, String>;
    async fn cancel(&self, session_key: &str) -> Result<(), String>;
}
```

- [ ] **Step 3: Build to verify it compiles**

Run: `cd src-tauri && cargo build 2>&1 | tail -5`
Expected: builds.

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/agents/backend.rs src-tauri/Cargo.toml
git commit -m "feat(agents): AgentBackend trait + value types"
```

---

### Task B2: `ClaudeBackend` — zero-behavior-change wrapper ⚠️ REVIEW GATE

**Files:**
- Create: `src-tauri/src/agents/claude_backend.rs`

**Constraint:** `ClaudeBackend` must call the EXISTING `claude_cli` functions verbatim. No daemon logic is copied or altered. Existing Claude sessions must behave identically. This task is reviewed and merged ALONE before Phase B continues.

- [ ] **Step 1: Confirm the existing entry points (read-only)**

Run: `grep -n 'pub async fn send_message_via_sdk_streaming\|pub async fn abort_sdk_stream\|pub struct ClaudeCliRequest' src-tauri/src/claude_cli.rs`
Expected: `send_message_via_sdk_streaming` (`:1952`), `abort_sdk_stream` (`:173`). Note the real `ClaudeCliRequest` shape for the call site.

- [ ] **Step 2: Write the wrapper (delegation only)**

Create `src-tauri/src/agents/claude_backend.rs`:

```rust
//! Thin delegate over the existing persistent Node daemon. ZERO behavior
//! change: every call forwards to claude_cli::* unchanged.
use async_trait::async_trait;
use tauri::AppHandle;
use super::backend::{AgentBackend, AuthStatus, BackendSessionHandle, StartSessionParams};
use super::events::AgentBackendKind;

pub struct ClaudeBackend {
    pub app: AppHandle,
}

#[async_trait]
impl AgentBackend for ClaudeBackend {
    fn kind(&self) -> AgentBackendKind { AgentBackendKind::Claude }

    async fn auth_status(&self) -> AuthStatus {
        // Existing Claude auth is handled by the daemon/env; treat as Ready here.
        AuthStatus::Ready { method: "claude".into() }
    }

    async fn send_message(
        &self,
        params: StartSessionParams,
        _prompt: String,
    ) -> Result<BackendSessionHandle, String> {
        // Milestone 1: Claude continues to be driven by its existing command
        // (send_message_via_sdk_streaming) invoked from the existing React path.
        // This wrapper is the trait face; it does NOT re-route Claude traffic.
        Ok(BackendSessionHandle {
            backend: AgentBackendKind::Claude,
            backend_session_id: None,
            agent_id: params.agent_id,
            session_key: params.session_key,
        })
    }

    async fn resume(
        &self,
        _backend_session_id: &str,
        params: StartSessionParams,
        prompt: String,
    ) -> Result<BackendSessionHandle, String> {
        self.send_message(params, prompt).await
    }

    async fn cancel(&self, session_key: &str) -> Result<(), String> {
        crate::claude_cli::abort_sdk_stream(session_key.to_string()).await
    }
}
```

- [ ] **Step 3: Build + run the FULL existing Rust test suite (regression guard)**

Run: `cd src-tauri && cargo test 2>&1 | tail -15`
Expected: all pre-existing tests still PASS (no regression). Record the pass count.

- [ ] **Step 4: Manual smoke (human checkpoint)**

Run the app, start a normal Claude session, send one message. Expected: identical behavior to `main` (text streams, tools render, stamina updates). This is the zero-regression gate.

- [ ] **Step 5: Commit (isolated)**

```bash
git add src-tauri/src/agents/claude_backend.rs
git commit -m "feat(agents): ClaudeBackend delegating wrapper (zero behavior change)"
```

---

### Task B3: `CodexBackend` — spawn-per-query + rollout tail

**Files:**
- Create: `src-tauri/src/agents/codex_backend.rs`
- Modify: `src-tauri/src/lib.rs:1049` (invoke_handler), `src-tauri/src/lib.rs:22` (already has `mod agents;`)

- [ ] **Step 1: Write the failing test (rollout path resolution is pure logic)**

Create the test inside `src-tauri/src/agents/codex_backend.rs`:

```rust
#[cfg(test)]
mod codex_backend_tests {
    use super::*;

    #[test]
    fn rollout_glob_matches_session_id() {
        // Spike §4.7: rollout file name embeds the session_id.
        let name = "rollout-2026-05-15T16-02-44-019e2bf2-5d04-7ba3-b7a9-17ab8ccf2896.jsonl";
        assert!(rollout_filename_matches(name, "019e2bf2-5d04-7ba3-b7a9-17ab8ccf2896"));
        assert!(!rollout_filename_matches(name, "deadbeef"));
    }

    #[test]
    fn codex_args_are_experimental_json_and_isolated() {
        let args = build_codex_args("/work", None, "hello");
        assert!(args.contains(&"--experimental-json".to_string()));
        assert!(args.contains(&"--skip-git-repo-check".to_string()));
        // spike RULE: always disable MCP to avoid the 10s posthog timeout
        assert!(args.windows(2).any(|w| w[0] == "-c" && w[1] == "mcp_servers={}"));
        assert!(args.contains(&"hello".to_string()));
    }

    #[test]
    fn codex_resume_args_put_flags_before_subcommand() {
        // Spike §4.5: `codex exec [OPTS] resume <id> <prompt>` — flags BEFORE resume.
        let args = build_codex_resume_args("/work", "sid-1", "again");
        let resume_pos = args.iter().position(|a| a == "resume").unwrap();
        let json_pos = args.iter().position(|a| a == "--experimental-json").unwrap();
        assert!(json_pos < resume_pos, "flags must precede `resume`");
        assert_eq!(args[resume_pos + 1], "sid-1");
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd src-tauri && cargo test --lib agents::codex_backend 2>&1 | tail -8`
Expected: FAIL — missing `rollout_filename_matches` / `build_codex_args` / `build_codex_resume_args`.

- [ ] **Step 3: Write the implementation**

Create the rest of `src-tauri/src/agents/codex_backend.rs` (above the test module):

```rust
//! Codex adapter: spawn `codex exec --experimental-json` per query (no daemon —
//! Codex has native session mgmt). Two surfaces (spike §3): stdout stream for
//! live events, rollout JSONL tail for token usage. Emits `codex-event:{agent_id}`
//! with the SAME wrapper shape as the Claude path (claude_cli.rs:461).
use async_trait::async_trait;
use std::path::Path;
use std::process::Stdio;
use tauri::{AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use super::backend::{AgentBackend, AuthStatus, BackendSessionHandle, StartSessionParams};
use super::events::{codex_rollout_to_usage, codex_stream_to_quack, AgentBackendKind, QuackAgentEvent};

const CODEX_BIN: &str = "codex";

pub fn build_codex_args(working_dir: &str, model: Option<&str>, prompt: &str) -> Vec<String> {
    let mut a = vec![
        "exec".into(), "--experimental-json".into(),
        "--sandbox".into(), "workspace-write".into(),
        "--skip-git-repo-check".into(),
        "-c".into(), "mcp_servers={}".into(),
        "--cd".into(), working_dir.into(),
    ];
    if let Some(m) = model { a.push("-c".into()); a.push(format!("model={m}")); }
    a.push(prompt.into());
    a
}

pub fn build_codex_resume_args(working_dir: &str, session_id: &str, prompt: &str) -> Vec<String> {
    // Spike §4.5: flags BEFORE the `resume` subcommand, else "unexpected argument".
    vec![
        "exec".into(), "--experimental-json".into(),
        "--sandbox".into(), "workspace-write".into(),
        "--skip-git-repo-check".into(),
        "-c".into(), "mcp_servers={}".into(),
        "--cd".into(), working_dir.into(),
        "resume".into(), session_id.into(), prompt.into(),
    ]
}

pub fn rollout_filename_matches(file_name: &str, session_id: &str) -> bool {
    file_name.starts_with("rollout-") && file_name.ends_with(".jsonl")
        && file_name.contains(session_id)
}

pub struct CodexBackend { pub app: AppHandle }

impl CodexBackend {
    fn emit(&self, agent_id: &str, session_key: &str, turn_id: &Option<String>, ev: &QuackAgentEvent) {
        // Mirror claude_cli.rs:461 wrapper so the React listener is uniform.
        let wrapped = serde_json::json!({
            "sessionKey": session_key, "turnId": turn_id, "event": ev
        });
        let _ = self.app.emit(&format!("codex-event:{agent_id}"), &wrapped);
    }

    async fn run(&self, args: Vec<String>, p: &StartSessionParams) -> Result<Option<String>, String> {
        let mut child = Command::new(CODEX_BIN)
            .args(&args)
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("failed to spawn codex: {e}"))?;
        let stdout = child.stdout.take().ok_or("no codex stdout")?;
        let mut lines = BufReader::new(stdout).lines();
        let mut session_id: Option<String> = None;

        while let Ok(Some(line)) = lines.next_line().await {
            let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) else { continue };
            if let Some(sid) = v.get("session_id").and_then(|s| s.as_str()) {
                session_id = Some(sid.to_string());
            }
            if let Some(ev) = codex_stream_to_quack(v) {
                self.emit(&p.agent_id, &p.session_key, &p.turn_id, &ev);
            }
        }
        // Spike §4.4: exit code is 0 even on auth failure — do NOT trust it.
        let _ = child.wait().await;

        // Spike §3/§4.7: usage is ONLY in the rollout JSONL. Read it once at end.
        if let Some(ref sid) = session_id {
            if let Some(usage) = read_last_usage_for_session(sid).await {
                self.emit(&p.agent_id, &p.session_key, &p.turn_id, &usage);
            }
        }
        self.emit(&p.agent_id, &p.session_key, &p.turn_id,
                  &QuackAgentEvent::SessionEnded { reason: "completed".into() });
        Ok(session_id)
    }
}

/// Find the newest rollout file for `session_id` and return the last usable
/// Usage event (spike §4.7: last non-null token_count = end-of-turn).
async fn read_last_usage_for_session(session_id: &str) -> Option<QuackAgentEvent> {
    let home = std::env::var("HOME").ok()?;
    let base = Path::new(&home).join(".codex").join("sessions");
    let mut found: Option<std::path::PathBuf> = None;
    for entry in walk_jsonl(&base) {
        let fname = entry.file_name()?.to_str()?.to_string();
        if rollout_filename_matches(&fname, session_id) {
            found = Some(entry);
        }
    }
    let content = tokio::fs::read_to_string(found?).await.ok()?;
    content.lines().rev()
        .filter_map(|l| serde_json::from_str::<serde_json::Value>(l).ok())
        .find_map(|v| codex_rollout_to_usage(&v))
}

fn walk_jsonl(base: &Path) -> Vec<std::path::PathBuf> {
    let mut out = vec![];
    let mut stack = vec![base.to_path_buf()];
    while let Some(dir) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&dir) else { continue };
        for e in rd.flatten() {
            let p = e.path();
            if p.is_dir() { stack.push(p); }
            else if p.extension().and_then(|x| x.to_str()) == Some("jsonl") { out.push(p); }
        }
    }
    out
}

#[async_trait]
impl AgentBackend for CodexBackend {
    fn kind(&self) -> AgentBackendKind { AgentBackendKind::Codex }

    async fn auth_status(&self) -> AuthStatus {
        match codex_auth_probe().await {
            Ok(true) => AuthStatus::Ready { method: "apikey".into() },
            Ok(false) => AuthStatus::Expired { detail: "codex login required".into() },
            Err(_) => AuthStatus::NotConfigured,
        }
    }

    async fn send_message(&self, params: StartSessionParams, prompt: String)
        -> Result<BackendSessionHandle, String> {
        let args = build_codex_args(&params.working_dir, params.model.as_deref(), &prompt);
        let sid = self.run(args, &params).await?;
        Ok(BackendSessionHandle {
            backend: AgentBackendKind::Codex,
            backend_session_id: sid,
            agent_id: params.agent_id,
            session_key: params.session_key,
        })
    }

    async fn resume(&self, backend_session_id: &str, params: StartSessionParams, prompt: String)
        -> Result<BackendSessionHandle, String> {
        let args = build_codex_resume_args(&params.working_dir, backend_session_id, &prompt);
        let sid = self.run(args, &params).await?;
        Ok(BackendSessionHandle {
            backend: AgentBackendKind::Codex,
            backend_session_id: sid.or_else(|| Some(backend_session_id.to_string())),
            agent_id: params.agent_id,
            session_key: params.session_key,
        })
    }

    async fn cancel(&self, _session_key: &str) -> Result<(), String> {
        // Spike §4.6: codex exec is spawn-per-query; cancel = kill the child.
        // M1: handled by dropping the spawned task (tracked in M3 hardening).
        Ok(())
    }
}

/// Probe auth without a turn cost: a 1-token read-only exec.
/// Spike §4.4: parse stdout `error` stream; exit code is unreliable.
pub async fn codex_auth_probe() -> Result<bool, String> {
    let tmp = std::env::temp_dir();
    let out = Command::new(CODEX_BIN)
        .args(["exec","--experimental-json","--sandbox","read-only",
               "--skip-git-repo-check","-c","mcp_servers={}",
               "--cd", tmp.to_str().unwrap_or("/tmp"),
               "Reply exactly: AUTH_OK"])
        .output().await.map_err(|e| e.to_string())?;
    let s = String::from_utf8_lossy(&out.stdout);
    if s.contains("Failed to refresh token") || s.contains("401") { return Ok(false); }
    Ok(s.contains("AUTH_OK"))
}

#[tauri::command]
pub async fn codex_auth_status() -> Result<bool, String> {
    codex_auth_probe().await
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd src-tauri && cargo test --lib agents::codex_backend 2>&1 | tail -8`
Expected: PASS (3 passed).

- [ ] **Step 5: Register the command + send entry point in `lib.rs`**

In `src-tauri/src/lib.rs` inside `tauri::generate_handler![` (line 1049), add after line `:1059` (`providers::test_provider_connection,`):

```rust
            agents::codex_backend::codex_auth_status,
            send_message_via_codex,
```

Add this command near the other top-level commands in `lib.rs` (e.g. after the `providers` block, before line 1243):

```rust
#[tauri::command]
async fn send_message_via_codex(
    app: tauri::AppHandle,
    agent_id: String,
    session_key: String,
    working_dir: String,
    prompt: String,
    model: Option<String>,
    turn_id: Option<String>,
    resume_session_id: Option<String>,
) -> Result<agents::backend::BackendSessionHandle, String> {
    use agents::backend::{AgentBackend, StartSessionParams};
    use agents::codex_backend::CodexBackend;
    let backend = CodexBackend { app };
    let params = StartSessionParams { agent_id, session_key, working_dir, model, turn_id };
    match resume_session_id {
        Some(sid) => backend.resume(&sid, params, prompt).await,
        None => backend.send_message(params, prompt).await,
    }
}
```

- [ ] **Step 6: Build + full regression test**

Run: `cd src-tauri && cargo build 2>&1 | tail -5 && cargo test 2>&1 | tail -8`
Expected: builds; all tests PASS (including pre-existing — Claude untouched).

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/agents/codex_backend.rs src-tauri/src/lib.rs
git commit -m "feat(agents): CodexBackend spawn-per-query + rollout usage tail + commands"
```

---

## Phase C — Data model + persistence

### Task C1: Extend `AgentSession` type (migration-safe)

**Files:**
- Modify: `src/types.ts:457-488`
- Create: `src/types/agentBackend.ts`

- [ ] **Step 1: Create the TS mirror of the Rust enum**

Create `src/types/agentBackend.ts`:

```ts
// Mirror of src-tauri/src/agents/events.rs. Keep in sync.
export type AgentBackendKind = 'claude' | 'codex';

export type QuackAgentEvent =
  | { kind: 'session_started'; backend_session_id: string; model: string | null; backend: AgentBackendKind }
  | { kind: 'text_delta'; content: string }
  | { kind: 'tool_call_start'; id: string; name: string; args: unknown }
  | { kind: 'tool_call_end'; id: string; output: string; error: string | null }
  | { kind: 'usage'; input_tokens: number; output_tokens: number; cached_tokens: number; cost_usd: number | null }
  | { kind: 'error'; code: string; message: string; recoverable: boolean }
  | { kind: 'session_ended'; reason: string };
```

- [ ] **Step 2: Add fields to `AgentSession`**

In `src/types.ts`, inside `interface AgentSession` (ends at `:488`), add after `initialPromptConsumed?: boolean;`:

```ts
  // Multi-backend (Codex integration, Milestone 1). Immutable after create.
  backend?: import('./types/agentBackend').AgentBackendKind; // default 'claude' on load
  backendSessionId?: string;                                 // Codex native session id (resume)
  backendAuthMethod?: 'oauth' | 'apikey';                    // Codex only; ignored by Claude
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/types/agentBackend.ts
git commit -m "feat(types): AgentSession.backend + QuackAgentEvent TS mirror"
```

---

### Task C2: Persist `backend`, default `'claude'` on load

**Files:**
- Modify: `src/stores/sessionStore.ts` (`createSession` ~`:123`, plus the load/normalize path)

- [ ] **Step 1: Write the failing test**

Find the sessionStore test file: `Glob src/stores/__tests__/sessionStore*` (or `src/**/sessionStore*.test.ts`). If none exists, create `src/stores/__tests__/sessionStore.backend.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeSessionBackend } from '../sessionStore';

describe('session backend migration', () => {
  it('defaults missing backend to claude', () => {
    expect(normalizeSessionBackend({ id: 'x' } as any).backend).toBe('claude');
  });
  it('preserves explicit codex backend', () => {
    expect(normalizeSessionBackend({ id: 'x', backend: 'codex' } as any).backend).toBe('codex');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run src/stores/__tests__/sessionStore.backend.test.ts 2>&1 | tail -8`
Expected: FAIL — `normalizeSessionBackend` not exported.

- [ ] **Step 3: Implement the normalizer + use it on load**

In `src/stores/sessionStore.ts`, add an exported helper near the top (after imports):

```ts
// Brain: decision-quack-abstraction-agent-level-not-model-level
// Sessions created before the Codex integration have no `backend`.
// Default to 'claude' so existing sessions behave exactly as before.
export function normalizeSessionBackend(s: AgentSession): AgentSession {
  return s.backend ? s : { ...s, backend: 'claude' };
}
```

In the session load path (where `saveAgentSessions`/loaded sessions are set into state — search `loadSessions` / `set({ sessions`), map loaded sessions through it:

```ts
const loaded = (rawLoaded as AgentSession[]).map(normalizeSessionBackend);
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run src/stores/__tests__/sessionStore.backend.test.ts 2>&1 | tail -8`
Expected: PASS (2 passed).

- [ ] **Step 5: Commit**

```bash
git add src/stores/sessionStore.ts src/stores/__tests__/sessionStore.backend.test.ts
git commit -m "feat(sessionStore): persist backend, migrate legacy sessions to 'claude'"
```

---

## Phase D — Auth (reuse 037 stack)

### Task D1: Codex auth status service

**Files:**
- Create: `src/services/codexAuthService.ts`

Codex API-key auth is established by the user running `codex login --api-key` (verified working in the spike). Milestone 1 does NOT implement the OAuth subprocess (M2). We only surface auth status (probe) in the UI. The 037 namespaced keychain (`preferences::save_provider_api_key`, provider id `"codex"`) is the storage primitive if/when we push a key to `~/.codex` in M2; for M1 we read live status.

- [ ] **Step 1: Write the service (mirrors providerService.ts style)**

Create `src/services/codexAuthService.ts`:

```ts
import { invoke } from '@tauri-apps/api/core';

export type CodexAuthState = 'ready' | 'needs_login' | 'unknown';

/** Probe Codex auth via a 1-token read-only exec (spike §4.4: parse stdout, not exit code). */
export async function getCodexAuthStatus(): Promise<CodexAuthState> {
  try {
    const ok = await invoke<boolean>('codex_auth_status');
    return ok ? 'ready' : 'needs_login';
  } catch {
    return 'unknown';
  }
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/services/codexAuthService.ts
git commit -m "feat(codex): codexAuthService wrapping codex_auth_status command"
```

---

## Phase E — UI wiring

### Task E1: Backend toggle in `NewSessionModal`

**Files:**
- Modify: `src/components/NewSessionModal.tsx` (props `:25-32`, JSX after `:224`)

- [ ] **Step 1: Extend props + state**

In `src/components/NewSessionModal.tsx`, extend `NewSessionModalProps` (`:25-32`):

```ts
  onSubmit: (title: string, branch?: string, useWorktree?: boolean, backend?: import('../types/agentBackend').AgentBackendKind) => void;
```

Add state near the other `useState` declarations:

```tsx
const [backend, setBackend] = useState<'claude' | 'codex'>('claude');
const [codexAuth, setCodexAuth] = useState<'ready' | 'needs_login' | 'unknown'>('unknown');
useEffect(() => {
  if (backend === 'codex') {
    import('../services/codexAuthService').then(m => m.getCodexAuthStatus().then(setCodexAuth));
  }
}, [backend]);
```

- [ ] **Step 2: Add the segmented control (after the Session Name field, `:224`)**

```tsx
<div className="mb-4">
  <label className="block text-xs font-medium text-white/50 mb-1.5">Backend</label>
  <div className="flex gap-1 p-1 rounded-lg bg-white/5">
    {(['claude', 'codex'] as const).map((b) => (
      <button
        key={b}
        type="button"
        onClick={() => setBackend(b)}
        className={`flex-1 px-3 py-1.5 text-xs rounded-md transition-colors ${
          backend === b ? 'bg-white/15 text-white' : 'text-white/50 hover:text-white/80'
        }`}
      >
        {b === 'claude' ? 'Claude Code' : 'Codex'}
      </button>
    ))}
  </div>
  {backend === 'codex' && codexAuth === 'needs_login' && (
    <p className="mt-1.5 text-[11px] text-amber-400/90">
      Codex not authenticated. Run <code>codex login --api-key</code> in a terminal.
    </p>
  )}
</div>
```

- [ ] **Step 3: Pass `backend` through `onSubmit`**

Find the submit handler in this file (the call to `onSubmit(...)`) and add `backend` as the 4th arg.

- [ ] **Step 4: Typecheck + visual check**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors. Then run the app, open New Session — toggle renders, no emoji, matches dark theme.

- [ ] **Step 5: Commit**

```bash
git add src/components/NewSessionModal.tsx
git commit -m "feat(ui): backend selector (Claude/Codex) in New Session modal"
```

---

### Task E2: Thread `backend` into `createSession`

**Files:**
- Modify: `src/components/RepositoryGroup.tsx` (`handleNewSession` `:1263-1360`, call `:1340`, modal render `:2623-2642`)

- [ ] **Step 1: Update the modal callback signature at the render site (`:2623`)**

In the `<NewSessionModal ... onSubmit={...} />` usage, accept the new 4th arg and forward it into `handleNewSession`.

- [ ] **Step 2: Pass `backend` to `createSession` (`:1340`)**

In `handleNewSession`, add `backend` to the object passed to `createSession({...})`:

```ts
backend: backend ?? 'claude',
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/RepositoryGroup.tsx
git commit -m "feat(ui): persist chosen backend on new session creation"
```

---

### Task E3: `[Codex]` badge in `SessionCard`

**Files:**
- Modify: `src/components/SessionsPanel.tsx` (`SessionCard` ~`:240`)

- [ ] **Step 1: Add the badge next to the status chip (~`:240-242`)**

In the header `div` of `SessionCard`, beside the status span, add:

```tsx
{session.backend === 'codex' && (
  <span className="px-1.5 py-0.5 text-[9px] font-medium rounded border uppercase border-emerald-500/40 text-emerald-300/90">
    Codex
  </span>
)}
```

- [ ] **Step 2: Typecheck + visual check**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors. App: a Codex session shows the badge, Claude sessions unchanged (no badge).

- [ ] **Step 3: Commit**

```bash
git add src/components/SessionsPanel.tsx
git commit -m "feat(ui): Codex badge on session rows"
```

---

### Task E4: React listener for `codex-event:{agentId}`

**Files:**
- Create: `src/hooks/useAgentEventStream.ts`

The Codex backend emits `codex-event:{agent_id}` with `{sessionKey, turnId, event}` (event = `QuackAgentEvent`), mirroring the Claude wrapper. This hook subscribes and maps to the existing chat reducer actions (text append, tool render, usage update) for sessions where `session.backend === 'codex'`.

- [ ] **Step 1: Write the hook**

Create `src/hooks/useAgentEventStream.ts`:

```ts
import { useEffect } from 'react';
import { listen } from '@tauri-apps/api/event';
import type { QuackAgentEvent } from '../types/agentBackend';

interface WrappedEvent { sessionKey: string; turnId: string | null; event: QuackAgentEvent }

/** Subscribe to Codex unified events for one agent. `onEvent` feeds the
 *  existing chat store (same callbacks the Claude path uses for text/tool/usage). */
export function useCodexEventStream(
  agentId: string | undefined,
  onEvent: (sessionKey: string, turnId: string | null, ev: QuackAgentEvent) => void,
) {
  useEffect(() => {
    if (!agentId) return;
    let unlisten: (() => void) | undefined;
    listen<WrappedEvent>(`codex-event:${agentId}`, (e) => {
      onEvent(e.payload.sessionKey, e.payload.turnId, e.payload.event);
    }).then((u) => { unlisten = u; });
    return () => unlisten?.();
  }, [agentId, onEvent]);
}
```

- [ ] **Step 2: Wire it where Claude events are consumed**

Run: `grep -rn "claude-event:" src --include=*.tsx --include=*.ts | head`
At that consumption site, also call `useCodexEventStream(agentId, handler)` where `handler` maps `QuackAgentEvent` → existing reducer:
- `text_delta` → append assistant text
- `tool_call_start` / `tool_call_end` → existing tool render path (name already normalized, e.g. `Bash`)
- `usage` → existing token update path (`input_tokens`/`output_tokens`/`cached_tokens`)
- `error` → existing error toast/banner
- `session_started` → store `backendSessionId` on the session (for resume)

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | tail -5`
Expected: no new errors.

- [ ] **Step 4: Manual E2E (human checkpoint)**

With `codex login --api-key` done: create a Codex session, send "create note.txt with PING and read it back". Expected: tool call renders as `Bash`, output `PING` shows, assistant text appears, token usage updates from the rollout, Claude sessions still 100% unaffected.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/useAgentEventStream.ts src/<consumption-site-file>
git commit -m "feat(ui): consume unified Codex events in chat (Bash tool, usage, text)"
```

---

## Self-Review

**1. Spec coverage (Milestone 1 per spec §8):**
- Trait `AgentBackend` + `ClaudeBackend` zero-change → Task B1, B2 ✓
- `CodexBackend` skeleton (`send_message`, basic) → Task B3 ✓
- Event Translator (TextDelta, ToolCallStart/End, Usage, Error) → Tasks A3, A4, A5 ✓ (PermissionRequest intentionally absent — spike §4.6 proves no source via `codex exec`; documented, not a gap)
- Auth: API key setup + storage → Task D1 ✓ (M1 surfaces status; key entry is `codex login --api-key` per spike; pushing key into `~/.codex` deferred to M2 as the spec assigns full auth UI to M2)
- UI backend toggle in New Session + sidebar badge → Tasks E1, E2, E3 ✓
- Deliverable "Codex session with API key doing chat + basic tool calls" → Task E4 manual E2E ✓

**2. Placeholder scan:** No "TBD"/"handle edge cases"/"similar to Task N". Every code step contains complete code. Codex args/resume/error-classify all have concrete implementations grounded in spike RAW.

**3. Type consistency:** `QuackAgentEvent` (Rust `#[serde(tag="kind", rename_all="snake_case")]`) ↔ TS mirror uses `kind` discriminant with `snake_case` variants (`session_started`, `text_delta`, `tool_call_start`, …) — consistent. `AgentBackendKind` is `lowercase` serde (`claude`/`codex`) ↔ TS `'claude'|'codex'` — consistent. `BackendSessionHandle` fields used identically in B1/B3/lib.rs. `normalize_tool_name` signature stable across A2/A3. `codex_rollout_to_usage` takes `&Value` in A4 and is called with `&v` in B3 — consistent.

**Known follow-ups (out of M1, tracked):** spawn-latency benchmark before M1 sign-off (spike §8 gate ≤2s); `cancel()` real child-kill (M3); OAuth subprocess + auth.json watcher (M2); MCP/AGENTS.md dual render (M2). `--cd` flag for `codex exec` is assumed; if 0.42 rejects it, fall back to spawning with `Command::current_dir(working_dir)` (verify in Task B3 Step 6 build/smoke).

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-15-codex-milestone-1-foundation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Phase A tasks parallelize well; Task B2 is a mandatory solo review gate.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

Which approach?
</content>
