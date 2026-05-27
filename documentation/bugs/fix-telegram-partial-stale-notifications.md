---
type: bug
project: quack-app
created: 2026-05-26
last_verified: 2026-05-26
tags: [telegram, notifications, race-condition, dedup]
---

# Fix: Telegram notifications partial messages + stale duplicates

## Symptoms

1. **Partial messages**: Telegram notification shows an intermediate agent message (e.g. "Let me check that file") instead of the final response.
2. **Stale duplicates**: A second notification arrives seconds later with old/identical content even though the agent's actual output is different.

## Root Cause

### Partial messages
`get_session_summary()` read the JSONL session file and found the last `assistant` role entry. In agentic loops with tool calls, the last `assistant` event often contains only tool_use blocks with brief text — the actual final summary lives in the SDK's `Result` event `result` field, which was ignored.

### Duplicates
Two independent sources emit `AgentStatus { status: "idle" }`:
- **Daemon stream**: `claude_cli.rs` emits on `"result"` event
- **Hook endpoint**: `lib.rs:handle_status_update` receives POST from SDK Stop hook

Both go through `WsBroadcast` → notification bridge. The debounce map only prevents duplicate sends within the 3-second window per agent_id, but if the agent_ids from the two sources differ (id vs label fallback) or the second event arrives after the first notification was already sent, a duplicate fires.

## Fix

1. **`claude_cli.rs`**: Store `Result.result` text in new `AGENT_LAST_RESULT` static map (agent_id → result text) when the "result" stream event arrives.

2. **`telegram_notifications.rs`**: New `get_session_summary_with_result()` checks `AGENT_LAST_RESULT` first (consumes the entry), falls back to JSONL only if not available.

3. **Dedup**: `LAST_SENT` map tracks last notification timestamp per agent_id. Notifications within 30 seconds of the previous one for the same agent are suppressed.

## Files Changed

- `src-tauri/src/claude_cli.rs` — `AGENT_LAST_RESULT` static + populate on result event
- `src-tauri/src/telegram_notifications.rs` — `LAST_SENT` dedup + `get_session_summary_with_result()`
