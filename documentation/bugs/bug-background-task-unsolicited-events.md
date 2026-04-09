---
type: bug_fix
project: quack-app
created: 2026-04-09
last_verified: 2026-04-09
tags: [background-tasks, streaming, daemon, events, session-isolation]
---
# Fix: Background task events dropped after query completes

## Problem

When the Claude SDK runs a background task (via `run_in_background` tool), it continues emitting events **after** the main query has completed. These post-query events were silently dropped because:

1. **Rust backend** (`claude_cli.rs`): `DAEMON_QUERIES` entry was removed on `query_complete`, so subsequent events from the same `queryId` had no routing info (agent_id, session_key, app_handle).
2. **Frontend** (`App.tsx`): Events arriving without an active stream were buffered indefinitely, never displayed. The `turnId`-based rejection logic also blocked them since they carried the old completed turn's ID.

Result: the user saw the main response but never the background task output. The agent appeared to silently ignore `run_in_background` results.

## Solution

Three-layer fix across Rust backend and React frontend:

### 1. Rust: Keep query entry alive after completion

On `query_complete`, instead of removing the `DAEMON_QUERIES` entry, take the `completion_tx` oneshot (to unblock the awaiting Tauri command) but keep the entry with `completed_at = Some(Instant::now())`. Post-query events can still look up the entry for routing.

```rust
// query_complete handler (claude_cli.rs ~680)
if let Some(tx) = state.completion_tx.take() {
    let _ = tx.send(Ok(response));
}
state.completed_at = Some(std::time::Instant::now());
```

### 2. Rust: Tag post-query events as unsolicited

Events routed through a completed entry (or explicitly marked `unsolicited` by the daemon) get `effective_unsolicited = true`. Their `turnId` is set to `null` so the frontend doesn't reject them as stale.

```rust
let effective_unsolicited = is_unsolicited || is_completed;
// ...
"turnId": if effective_unsolicited { None } else { turn_id },
"unsolicited": effective_unsolicited
```

### 3. Frontend: Auto-create streaming placeholder for unsolicited events

When `handleClaudeEvent` receives an unsolicited event with no active stream, it creates a new assistant message placeholder with `metadata.isBackgroundTask = true` and routes the event into it. Loading state is managed separately: set on first unsolicited event, cleared on `result`.

```typescript
if (unsolicited && !activeStreamsRef.current.has(messageKey)) {
    // Auto-create placeholder for background task output
    const placeholder: ChatMessage = {
        id: `msg-${Date.now()}-assistant-bg-...`,
        role: 'assistant',
        content: '',
        status: 'streaming',
        events: [claudeEvent],
        metadata: { isBackgroundTask: true },
    };
    // ...
}
```

### 4. Cleanup: Stale entry eviction

Completed entries in `DAEMON_QUERIES` are cleaned up lazily: when a new query registers for the same agent, any previously completed entries for that agent are removed via `retain()`.

## Key Insight

The SDK daemon protocol is not strictly request-response. A single `queryId` can produce events in two phases: the main query turn, then zero or more background task turns. The Rust routing layer must keep the query context alive across both phases while still unblocking the Tauri command that awaits the main response.

## Related Files

| File | Role |
|------|------|
| `src-tauri/src/claude_cli.rs` | Daemon event routing, `DaemonQueryState.completed_at`, stale cleanup |
| `src/App.tsx` | `handleClaudeEvent` unsolicited branch, placeholder creation, loading state |
