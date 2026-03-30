---
type: bug
project: quack-app
created: 2026-03-29
last_verified: 2026-03-29
tags: [streaming, race-condition, event-buffer, daemon, rendering]
---

# Assistant response renders one turn late

## Symptom

In long conversations, the assistant's response to message N appears visually **below** user message N+1 instead of between user message N and N+1. The response to message N+1 is then invisible until message N+2 is sent, and so on. The pattern is intermittent: it can appear mid-conversation after many successful turns, persist for 4-5 messages, then resolve on its own.

Multiple users have reported this. It does not correlate with a specific model, permission mode, or provider.

## Key observations

- Only seen in **long conversations** (many messages accumulated).
- Intermittent: works, breaks for a few turns, works again — in the same session.
- The send button is properly guarded (`isStreaming` check + `sendingRef`), so concurrent `sendMessageForAgent` calls are ruled out.
- The assistant message placeholder is created correctly and events stream in during the turn. The issue is that the **rendered output lags by one turn**.

## Hypothesised root cause

A race condition between Tauri event delivery and `invoke` resolution, amplified by a non-atomic buffer clear in the frontend.

### The race in Rust (`daemon_stdout_reader`)

The daemon stdout reader processes lines sequentially:

1. **Event line** (`"type": "event"`): Calls `app_handle.emit("claude-event:...", event)` — fire-and-forget, queues the event on the WebView event loop.
2. **Completion line** (`"type": "query_complete"`): Calls `completion_tx.send(Ok(response))` — resolves the `invoke('send_message_via_sdk_streaming')` future on the frontend.

Both happen back-to-back in the same loop iteration. The `app.emit()` puts events on the WebView queue, while `completion_tx.send()` resolves the invoke promise. There is no guarantee that the WebView processes all queued events before the invoke promise resolves.

### The race in React (`App.tsx`)

When the invoke resolves, `sendMessageForAgent` sets the assistant message to `status: 'complete'` (line ~2751). If a trailing Tauri event arrives **after** this status change:

1. `handleClaudeEvent` runs inside `setChatSessions((prev) => ...)`.
2. It checks `lastMsg.status === 'streaming'` — but the message is now `'complete'`.
3. The event is **buffered** in `eventBufferRef` instead of applied (line ~1418).

On the next user message, `sendMessageForAgent`:

1. **Line 2608**: Clears the buffer synchronously — `eventBufferRef.current.delete(messageKey)`.
2. **Line 2612**: Queues `setChatSessions` to create the assistant placeholder.
3. **Inside the updater (line 2619)**: Re-reads the buffer to flush any events that arrived between placeholder creation and the first streaming event.

The problem: between step 1 (sync clear) and step 3 (async updater execution), more late events from the previous query can arrive and **re-populate the buffer**. The updater then applies these stale events to the **new** turn's assistant message, causing the previous turn's content to appear inside the new turn.

### Why it's intermittent

- The race window is very small (microseconds between `app.emit()` and `completion_tx.send()`).
- In short conversations, React re-renders are fast and events are processed before the invoke resolves.
- In long conversations, the DOM is large, React's reconciliation is slower, and the WebView event queue may process events out of order relative to promise resolution.
- GC pauses and memory pressure (documented in `fix-memory-leak-14gb-ram.md`) widen the race window.

## Diagnostic instrumentation

Commit `14ac59b` adds a ring buffer (`eventDiagnosticsRef`) that records the last 50 event handler calls. When `sendMessageForAgent` detects that the previous assistant message is not `'complete'` at send time, it dumps the ring buffer to the browser console with prefix `[BUG:LATE_RENDER]`.

Filter the WebView console on `BUG:LATE_RENDER` to capture the diagnostic data when the bug recurs.

## Recommended fix

Move the buffer clear **inside** the `setChatSessions` updater so it is atomic with the state read. Currently:

```javascript
// Line 2608 — SYNC, outside updater
eventBufferRef.current.delete(messageKey);

// Line 2612 — ASYNC updater
setChatSessions((prev) => {
  // Line 2619 — re-reads buffer (can be stale!)
  const bufferedEvents = eventBufferRef.current.get(messageKey) || [];
  // ...
});
```

Should become:

```javascript
// No buffer clear outside the updater

setChatSessions((prev) => {
  // Clear AND read atomically inside the updater
  const bufferedEvents = eventBufferRef.current.get(messageKey) || [];
  eventBufferRef.current.delete(messageKey);
  // ...
});
```

This ensures no late events can sneak into the buffer between the clear and the read. The updater function is the only place that consumes the buffer, so clearing it there is both correct and simpler.

Additionally, consider ignoring buffered events whose `queryId` doesn't match the current query, as a defence-in-depth measure against stale events from aborted or completed queries leaking into subsequent turns.

## Files involved

| File | Role |
|------|------|
| `src-tauri/src/claude_cli.rs` ~440-632 | Daemon stdout reader: emits events then resolves invoke |
| `src/App.tsx` ~1360-1420 | `handleClaudeEvent`: applies or buffers streaming events |
| `src/App.tsx` ~2608-2630 | `sendMessageForAgent`: clears buffer + creates placeholder |
| `src/App.tsx` ~2751 | Completion handler: sets message to `'complete'` |
