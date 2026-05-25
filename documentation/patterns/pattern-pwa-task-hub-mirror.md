---
type: pattern
project: quack-app
created: 2026-05-25
last_verified: 2026-05-25
tags: [pattern, pwa, remote-api, websocket, live-state-mirror, task-hub, mobile]
---

# Pattern: PWA Task Hub Mirror

## Problem

The desktop Task Hub (`TaskHubView.tsx`) computes per-session priority from **in-memory React state** (`chatStore.chatLoadingMap`, `pendingQuestionsMap`, `chatSessions`). Mobile clients (the Quack Remote PWA at `/dashboard/`) need to render the same 4-priority view in real time, but those maps are **never persisted** and **never exposed** by any REST endpoint. Polling `/api/sessions` only gives disk state (status, createdAt) — not enough to deduce "is this session actively streaming?" or "is the agent waiting for an `AskUserQuestion` answer?".

## Solution: three-leg mirror

```
React chatStore (truth)
  │  diff + debounce in a hook
  ▼
Tauri command (notify_*)
  │
  ▼
Rust SessionLiveStateMap (mirror)  ◄── also read by REST handlers to enrich SessionSummary
  │  broadcast
  ▼
WsEvent → /ws subscribers
  ▼
PWA patches sessions in place + re-renders
```

The frontend is the **source of truth** because that's where chat events actually happen. The backend is a **passive mirror** that exists only so HTTP/WS clients can observe the state without round-tripping a hidden tab.

## When to use

Use this pattern when **all four** are true:

1. You have UI state that lives only in the **frontend** (Zustand/Redux/React state).
2. An **external client** (PWA, CLI, another agent) needs to observe that state.
3. The state is **volatile** (resetting on hot reload is acceptable).
4. You don't want to refactor the frontend store into a persistent backend store (too invasive, would slow desktop UX).

Do **not** use this for state the backend already owns (agent status, session disk state, automation jobs) — go direct.

## Implementation recipe

### Backend: live-state map + Tauri commands + WS variants

```rust
// remote_api.rs
#[derive(Default, Clone, Serialize)]
pub struct SessionLiveEntry {
    pub is_streaming: bool,
    pub pending_question_count: u32,
    pub last_message_role: Option<String>,
    pub last_message_status: Option<String>,
    pub last_activity_ms: i64,
}
pub type SessionLiveStateMap = Arc<RwLock<HashMap<String, SessionLiveEntry>>>;

#[tauri::command]
pub fn notify_session_streaming(
    state: tauri::State<'_, SessionLiveStateMap>,
    broadcast: tauri::State<'_, WsBroadcast>,
    session_id: String, is_streaming: bool, agent_id: Option<String>,
) -> Result<(), String> {
    update(&state, &session_id, |e| e.is_streaming = is_streaming);
    broadcast.send(WsEvent::SessionStreaming { session_id, agent_id, is_streaming });
    Ok(())
}
```

```rust
// remote_ws.rs
WsEvent::SessionStreaming { session_id, agent_id, is_streaming }
WsEvent::PendingQuestion  { session_id, agent_id, count }
WsEvent::MessageAdded     { session_id, agent_id, role, status, timestamp }
WsEvent::SessionUpdated   { session_id, updated_at, last_message_role?, last_message_status? }
```

Wire in `lib.rs`:
```rust
let session_live: SessionLiveStateMap =
    Arc::new(RwLock::new(HashMap::new()));
app.manage(session_live.clone());
let api_router = create_api_router(app, auth, agent_status, session_live, ws_broadcast);
// generate_handler![..., notify_session_streaming, ..._pending_question, ..._message]
```

### Frontend: minimal hook

```ts
// src/hooks/useRemoteLiveStateSync.ts
useEffect(() => {
  const compute = () => {
    const st = useChatStore.getState();
    for (const id of allSessionIds(st)) {
      const next = snapshot(st, id);
      const prev = cache.get(id);
      if (deepEqual(prev, next)) continue;
      debounce(id, 150, () => fireDiff(prev, next, id));
      cache.set(id, next);
    }
  };
  compute();
  return useChatStore.subscribe(compute);
}, []);
```

Key rules:
- **Per-session debounce** (150ms): chat events come in bursts (one per token).
- **Diff before invoke**: only fire `notify_session_streaming` when `isStreaming` actually changed.
- **Gate on remote-enabled**: skip the whole loop if `RemoteApiConfig.enabled === false`.
- **Mount globally** (`App.tsx`), never inside a component that can unmount.

### PWA: patch in place, fall back to polling

```js
function handleWsEvent(e) {
  switch (e.type) {
    case 'session_streaming': patchSession(e.sessionId, { isStreaming: e.isStreaming }); break;
    case 'pending_question':  patchSession(e.sessionId, { pendingQuestionCount: e.count }); break;
    // ...
  }
}
function patchSession(id, patch) {
  const idx = state.sessions.findIndex(s => s.id === id);
  if (idx === -1) return loadData();    // unknown session → catch-up fetch
  state.sessions[idx] = { ...state.sessions[idx], ...patch };
  render();
}
// WS down >10s → setInterval(loadData, 5000); WS reconnect → clear + loadData
```

## Pitfalls

- **State drift after hot reload**: the frontend's in-memory maps reset, so `SessionLiveStateMap` will be stale until a chat event re-fires. Mitigation: clear stale entries server-side after some TTL (not implemented yet — current trade-off favors simplicity).
- **Multi-window desktop**: if the user opens Quack in two windows, both fire `notify_*`. Last write wins. Acceptable since both windows observe the same `chatStore`.
- **WS dead but socket open**: TCP keep-alive doesn't catch every cellular drop. Fallback polling at 5s is the safety net.
- **`agentId` lookup**: include `agentId` in the WS payload so the PWA can attribute the event without re-resolving from `state.sessions` (which may not contain the session yet).
- **Don't compute priority server-side**: keep the priority computation in the PWA's JS, mirrored from the desktop helper. Server-side `priority` would force lockstep deployments and lose flexibility for other clients.

## Related

- Feature `054-task-hub-view` — desktop counterpart.
- Feature `068-pwa-task-hub-mobile` — concrete PWA implementation of this pattern.
- Feature `062-quack-remote` — host REST/WS framework.
- Pattern `pattern-remote-api-architecture` — the broader Axum + WS architecture this builds on.
