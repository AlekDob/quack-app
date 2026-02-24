---
type: gotcha
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [remote-api, tauri-events, execute, react-listener]
---

# Gotcha: remote-execute / remote-send-message Need React Listeners

## Symptom

Mobile dashboard shows "Agent executing!" toast, Rust log shows `🚀 [Remote API] Execute: agent=xxx`, but nothing actually happens in Quack. The agent never starts.

## Root Cause

`app.emit("remote-execute", ...)` in Rust successfully emits the event, but NO React component listens for it. The event is lost silently — Tauri doesn't warn about unhandled events.

## Fix

Add listeners in `App.tsx` inside the global `useEffect` that handles `session-auto-start`, `open-ai-settings`, etc.:

```typescript
const unlistenRemoteExecutePromise = listen<{
  sessionId: string;
  agentId: string;
  prompt: string;
  // ...
}>("remote-execute", async (event) => {
  // 1. Find terminal via terminalsRef
  // 2. createSession via sessionStore
  // 3. setActiveId + setActiveSessionIdExclusive
  // 4. pendingAutoStartRef for auto-send
});
```

Use the same `pendingAutoStartRef` pattern as `session-auto-start` (WhatsApp) — do NOT try to call `sendMessageForAgent` directly, as the React state may not be ready yet.

## Rule

**Every `app.emit()` in Rust MUST have a corresponding `listen()` in React.** When adding new Tauri events:
1. Add the emit in Rust
2. Add the listener in App.tsx (same useEffect as other global listeners)
3. Add the unlisten in the cleanup return
4. Test end-to-end — the Rust log confirming the emit is NOT enough

## Files

- `src-tauri/src/remote_api.rs` — emits `remote-execute` and `remote-send-message`
- `src/App.tsx` — listeners (search for `unlistenRemoteExecutePromise`)
