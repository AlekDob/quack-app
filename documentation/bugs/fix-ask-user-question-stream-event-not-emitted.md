---
type: bug
project: quack-app
created: 2026-03-24
last_verified: 2026-03-24
tags: [daemon, ask-user-question, plan-approval, stream-event, ipc, regression]
---
# Fix: AskUserQuestion / PlanApproval answers lost — agent hangs after user responds

## Symptom
When the user answers an AskUserQuestion or approves a plan, the agent gets stuck.
The frontend shows "Answer sent successfully via stdin" but the agent never continues.

## Root Cause (two-part)

### Part 1: Stream event not re-emitted as Tauri event
The Rust daemon stdout reader handles SDK stream events at the `"event"` match arm.
It forwards ALL events as `claude-event:{agentId}` (for UI rendering), but only specifically
handles `"assistant"` and `"result"` event types. When the SDK emits `ask_user_question` or
`plan_approval_request` as stream events, they fall through to `_ => {}` — the Rust code
does NOT re-emit them as `ask-user-question` / `plan-approval-request` Tauri events.

The separate `"ask_user_question"` handler (at the outer match level) only fires when the
daemon's `canUseTool` callback sends a top-level message. If `canUseTool` is not called
(e.g., `bypassPermissions` mode or SDK behavior change), this path never fires.

### Part 2: Answer routing ignores query location
`answer_user_question()` checks if the daemon process exists and routes the answer there.
But when a daemon query fails and falls back to legacy per-process mode, the query runs
in the legacy process while the daemon process still exists. The answer goes to the daemon
(which has no matching `pendingRequest`) and gets silently lost.

**Diag evidence** (`~/.quack/daemon-diag.log`):
```
RESPONSE on stdin: requestId=req_1774370212365_to21ekm, pendingKeys=[]
handleResponse: found=false, pendingKeys=[], activeQueries=[]
❌ NOT FOUND
```

## Fix

### claude_cli.rs — daemon event handler (line ~540)
Added `ask_user_question` and `plan_approval_request` cases to the event_type match:
- Emit `ask-user-question` / `plan-approval-request` Tauri events from stream events
- Pause query timeout (`waiting_for_user = true`)
- This ensures the frontend gets the event even when `canUseTool` is not called

### claude_cli.rs — answer_user_question (line ~3012)
Before routing to daemon, check `DAEMON_QUERIES` for a matching active query:
- If match found → route to daemon (as before)
- If NO match → fall back to legacy `send_to_process`
- This prevents answers from being lost when query ran through legacy fallback

### stream-daemon.js — diagnostic logging
Added `diag()` calls at:
- `handleQuery` start (confirms query goes through daemon)
- Stream event detection for `ask_user_question` / `plan_approval_request`
- Logs whether `canUseTool` was called (checks `pendingRequests.size`)

## Brain breadcrumbs
- `claude_cli.rs`: `// Brain: fix-ask-user-question-stream-event-not-emitted`
- `stream-daemon.js`: `// Brain: fix-ask-user-question-stream-event-not-emitted`

## Files changed
- `src-tauri/src/claude_cli.rs`
- `src-tauri/node-sdk/stream-daemon.js`
