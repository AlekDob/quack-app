# Codex M1 — E4 Step 2 handoff (deferred)

Status: **deferred** (2026-05-15). Reason: wiring touches `App.tsx:2444-2650`
(Quack's central inline `claude-event` consumption), needs the two-stage
subagent review net (blocked by org usage limit during execution) AND the
mandatory manual GUI E2E (Step 4) which the agent cannot perform. Deferring is
the disciplined choice given the M1 #1 risk = zero Claude regression.

## What is ALREADY done (M1, on branch `038-codex-backend-m1`)

- A1–A5: pure `events.rs` translator (`QuackAgentEvent`, `codex_stream_to_quack`,
  `codex_rollout_to_usage`, `codex_rollout_model`, `claude_event_to_quack`,
  `normalize_tool_name`), 18 tests, TDD from RAW spike fixtures.
- B1 `AgentBackend` trait; B2 `ClaudeBackend` (zero-behavior-change gate PASSED);
  B3 `CodexBackend` spawn-per-query + rollout usage tail + `send_message_via_codex`
  / `codex_auth_status` commands. `cargo test` = 38 pass / 2 fail (the 2 are
  pre-existing baseline failures on `main`, not regressions).
- C1 `AgentSession.backend?` + TS `QuackAgentEvent` mirror; C2 `normalizeSessionBackend`
  (legacy → 'claude'), vitest 2/2.
- D1 `codexAuthService.ts`.
- E1 backend toggle in NewSessionModal (+ stale-closure fix); E2 thread `backend`
  → `createSession` (persisted); E3 Codex badge in SessionCard.
- E4 **Step 1 only**: `src/hooks/useAgentEventStream.ts` exporting
  `useCodexEventStream(agentId, onEvent)` — created, compiles, isolated, UNWIRED.
- Spike §8 gate: PASSED decisively (pure spawn+init = 0.02–0.04s, ≤2s).

## What E4 Step 2 must do

Backend already emits `codex-event:{agent_id}` with
`{ sessionKey, turnId, event: QuackAgentEvent }` (see
`src-tauri/src/agents/codex_backend.rs` `emit()`), mirroring the Claude wrapper.

Wire `useCodexEventStream` at the Codex-session chat consumption path so a
`session.backend === 'codex'` session renders via the SAME chat UI. Mapping
`QuackAgentEvent` → existing chat state:

| QuackAgentEvent.kind | Existing chat action (Claude parity) |
|---|---|
| `session_started` | persist `backendSessionId` on the session (enables Codex `resume`) |
| `text_delta` | append assistant text (whole text — Codex has no token deltas, spike §4.2) |
| `tool_call_start` | render tool start; `name` is already normalized (`Bash`) |
| `tool_call_end` | render tool result; `error` non-null ⇒ failed tool |
| `usage` | token-usage update path (`input_tokens`/`output_tokens`/`cached_tokens`) |
| `error` | existing error toast/banner (`message`; `code`/`recoverable` inferred) |
| `session_ended` | end-of-turn marker (synthesized; never trust process exit, spike §4.4) |

## SAFE-BY-CONSTRUCTION constraints for whoever resumes this

1. **Do NOT modify the existing `claude-event` consumption in `App.tsx:2444-2650`.**
   Add a NEW parallel subscription only. Claude sessions are never
   `backend==='codex'` and emit on a different channel — keep them provably
   untouched.
2. To reuse the existing state-update logic, the cleanest refactor is to
   EXTRACT the inline Claude `onEventReceived` body into a stable callback, then
   feed both paths. That refactor is itself a Claude-risk change → it REQUIRES
   the two-stage subagent review + the manual GUI E2E (do not skip).
3. After wiring: run the **mandatory manual E2E** (plan Task E4 Step 4): real
   Codex session, prompt "create note.txt with PING and read it back" — verify
   the `Bash` tool renders, output `PING`, assistant text, usage from rollout,
   AND that Claude sessions are byte-identical to before. Also the deferred
   Claude GUI smoke from Task B2 Step 4.
4. `cargo test` must stay 38/2 (same 2 names); `npx tsc --noEmit` clean.

## Commit so far

Branch `038-codex-backend-m1`, ~18 conventional commits A1→E4-Step1 + docs.
Resume point: this file. Next commit: `feat(ui): wire useCodexEventStream into chat (E4 Step 2)`.
