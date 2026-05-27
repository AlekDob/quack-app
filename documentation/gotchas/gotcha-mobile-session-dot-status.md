---
type: gotcha
project: quack-app
created: 2026-03-01
last_verified: 2026-05-26
tags: [remote-api, mobile-dashboard, session-status, dot-color, task-hub]
---
# Gotcha: Mobile Session Dot Color Depends on Agent Status, Not Session Status

## Problem

Session `status` field (`in_progress`, `done`, `todo`) does NOT indicate whether the agent is actively working. A session with `status: 'in_progress'` simply means "open/not completed" — the agent may have finished responding hours ago.

Mapping `in_progress` → yellow/working dot causes ALL open sessions to show as "working", which is wrong.

## Mac Behavior (Reference)

The Mac app (`AgentSessionItem.tsx`) uses 4 real-time signals, NOT the session status field:

| Priority | Signal | Color | Meaning |
|----------|--------|-------|---------|
| 1 | `hasPendingQuestion` | Purple #a855f7 | AskUserQuestion pending |
| 2 | `isLoading` (streaming) | Amber #f59e0b | Agent actively working |
| 3 | `hasUnread` (last msg from assistant) | Green #22c55e | Agent responded, waiting for user |
| 4 | Empty chat | Gray #6b7280 | No conversation |

## Mobile Solution

The mobile dashboard can't detect streaming state, but CAN use the **agent status** as a proxy:

```js
function getSessionDotClass(agentStatus, isNewest) {
  const agentBusy = agentStatus === 'running' || agentStatus === 'busy';
  if (agentBusy && isNewest) return 'working';
  return 'ready';
}
```

- Agent `idle` → ALL its sessions show green (ready)
- Agent `busy/running` → only the newest session shows amber (working), rest green

## Browser Caching Gotcha

Dashboard JS/CSS are embedded via `include_str!()` in the Rust binary. Safari iOS (especially PWA mode) caches aggressively. Without `Cache-Control: no-store` on JS/CSS responses, the browser may serve stale code even after a Rust rebuild. This was the root cause of "yellow dots persisting" — the browser was serving the OLD JS that mapped `in_progress → working`.

Fix: `remote_dashboard.rs` now serves JS/CSS with `Cache-Control: no-store`.

## Agent Status Not Persisted to Disk

**Critical**: The `quack-agents.json` file does NOT contain agent status. `UnifiedAgent` has no `status` field — only `id`, `name`, `projectPath`, etc. The Mac app tracks busy/idle in React in-memory state, not on disk.

**Fix**: `AGENT_STATUS` global static (`AgentStatusMap = Arc<RwLock<HashMap<String, String>>>`) in `lib.rs` — updated from THREE sources:

1. **`handle_status_update`** (`POST /terminal/status`) — external hook for non-Quack terminals
2. **`daemon_stdout_reader`** in `claude_cli.rs` — daemon mode SDK streaming (most common path)
3. **`send_message_via_sdk_streaming_legacy`** in `claude_cli.rs` — fallback per-process mode

Both (2) and (3) detect `assistant` events → "busy" and `result` events → "idle".

The initial implementation only had source (1), but **nobody calls `/terminal/status`** for Quack's internal agents. The daemon and legacy streaming paths go through `claude_cli.rs`, not the hook endpoint. This was why the map was always empty and agents showed as "idle".

## Instant Updates via WebSocket (Not Just Polling)

REST polling every 30s is too slow — if a message completes in <30s, the dot stays green the entire time. The mobile dashboard also supports WebSocket for real-time updates.

**Fix**: Emit `external-terminal-status` Tauri event from daemon/legacy/streaming paths whenever agent status changes. The existing WS broadcast listener in `lib.rs` picks this up and sends `WsEvent::AgentStatus` to connected mobile clients.

```rust
// In daemon_stdout_reader / legacy streaming / send_message_via_sdk_streaming
let _ = app_handle.emit("external-terminal-status", serde_json::json!({
    "id": agent_id, "status": "busy" // or "idle"
}));
```

**Change-detection guard**: Only emit when status actually changes (avoids WS flooding on repeated `assistant` events during streaming):

```rust
let changed = if let Ok(mut map) = crate::AGENT_STATUS.write() {
    map.insert(agent_id.clone(), "busy".to_string()).as_deref() != Some("busy")
} else { false };
if changed { /* emit */ }
```

The mobile JS already handled `agent_status` WS events and calls `render()` on status change — no JS changes needed for this fix.

## Immediate Busy on Message Send

There's a gap between "message sent to SDK" and "first `assistant` event received". During this gap, the agent appears idle.

**Fix**: Mark agent `busy` immediately when:
1. `handle_execute` in `remote_api.rs` (mobile execute button)
2. `handle_send_message` in `remote_api.rs` (mobile send message)
3. `send_message_via_sdk_streaming` in `claude_cli.rs` (function entry)

## Chat View Must Use Agent Status Too (2026-03-03)

The chat view (opened when tapping a session) had a separate problem: it used `session.status` via `isSessionActive()` for the typing indicator, and showed a `ws-dot` (WebSocket connected = always green) instead of the agent status dot. This caused:

1. **Green dot in chat** when agent was busy (ws-dot shows connection, not activity)
2. **No typing indicator** because `isSessionActive()` + last-message check is unreliable
3. **Stale status** because `startAutoRefresh()` skips when `state.chatSession` is set

**Fix** (DRY approach):
- `isAgentBusy(agentId)` — single source of truth helper, used by both list and chat
- Chat header: replaced `ws-dot` with `session-dot` using `getSessionDotClass(agent.status, true)`
- Typing indicator: `isAgentBusy(s.agentId)` instead of `isSessionActive(s)`
- `pollChatMessages()` now also fetches `/api/agents` to keep agent status fresh during chat view

## Key Insight

`session.status` ≠ real-time activity. Use `agent.status` to determine if work is happening NOW — but only if the status comes from the in-memory `AGENT_STATUS` global, not from disk.

## Same Trap Inside PWA Task Hub `computePriority` (2026-05-26)

The PWA Task Hub had the same disk-status bug at a *second* layer: `computePriority(session)` in `src-tauri/static/app.js` was classifying every session with `s.status === 'in_progress'` into P2 ("Working") even when:

- `s.isStreaming` was false (live-state mirror never observed it)
- `s.lastMessageStatus` was not `'streaming'`
- the agent itself was idle

Result: any session never explicitly closed on disk stuck in WORKING forever, with a green ready-dot next to it (because `getSessionDotClass` correctly read the idle agent). User-visible incoherence: green border + green dot + label "Working".

**Fix**: `computePriority(s, agentStatus)` now requires *either* `liveStreaming` (`isStreaming` / `lastMessageStatus==='streaming'`) *or* `agentBusy` (status `busy`/`running`) to return P2. Otherwise it falls through to P3 (assistant-complete) or P4 (Other). Disk `in_progress` alone is no longer trusted.

Both call sites (`computeTaskHubBadge`, `renderTaskHub`) now resolve `agent?.status` and pass it through.

## Files

- `src-tauri/src/lib.rs` — `AGENT_STATUS` global static definition
- `src-tauri/src/claude_cli.rs` — `daemon_stdout_reader` and legacy streaming (write to map)
- `src-tauri/src/remote_api.rs` — `handle_list_agents` (read from map)
- `src-tauri/static/app.js` — `isAgentBusy()`, `getSessionDotClass()`, `renderChat()`, `pollChatMessages()`
- `src-tauri/static/style.css` — `.session-dot.working`, `.session-dot.ready` classes
- `src-tauri/src/remote_dashboard.rs` — Cache-Control headers on JS/CSS
- `src/components/AgentSessionItem.tsx` — Mac reference implementation (`getActivityDotColor`)
- `src-tauri/src/lib.rs` — WS broadcast listener for `external-terminal-status` Tauri event
