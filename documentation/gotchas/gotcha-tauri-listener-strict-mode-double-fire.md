---
type: gotcha
project: quack-app
created: 2026-02-27
last_verified: 2026-02-27
tags: [tauri-events, react, strict-mode, race-condition, dedup]
---

# Gotcha: React Strict Mode Double-Fires Async Tauri Listeners

## Symptom

A Tauri event listener in `App.tsx` fires twice for a single event. The agent initializes two sessions, sends the prompt twice, and the user sees duplicate "System Initialized" blocks.

## Root Cause

React Strict Mode (dev) mounts → unmounts → remounts components. With `tauri-api/event.listen()`:

1. First mount registers listener A
2. Unmount triggers cleanup — but `listen()` returns a Promise, so `unlisten` is async
3. Second mount registers listener B
4. **Both A and B are active** until the async cleanup of A resolves

When a Tauri event fires in this window, both callbacks execute.

## Why `useRef` Guards Fail

The obvious fix — checking a ref before proceeding — doesn't work when the callback is async:

```typescript
// BROKEN: both callbacks enter before either sets the ref
listen("remote-execute", async (event) => {
  if (pendingAutoStartRef.current?.sessionId === event.payload.sessionId) return; // both pass: ref is null
  const session = await createSession(...); // async gap
  pendingAutoStartRef.current = { sessionId: session.id }; // too late, both already past the guard
});
```

Both callbacks check the ref simultaneously (it's still `null`), both pass, both create sessions.

## Fix: Synchronous Set Guard

Use a `Set` ref that's checked and updated **synchronously before any async work**:

```typescript
const handledRemoteSessionIds = useRef(new Set<string>());

listen("remote-execute", async (event) => {
  const { sessionId } = event.payload;
  // Synchronous guard — works even if two callbacks enter same tick
  if (handledRemoteSessionIds.current.has(sessionId)) return;
  handledRemoteSessionIds.current.add(sessionId); // blocks the duplicate immediately

  const session = await createSession(...); // now only one callback proceeds
});
```

The `Set.add()` is synchronous, so even if both callbacks enter in the same microtask, the second one sees the ID already in the Set.

## Rule

**For any Tauri `listen()` callback that does async work, use a synchronous dedup guard (Set or flag) BEFORE the first `await`.** A ref-based check after async work is too late.

## Applies To

Any `listen()` in a `useEffect` where the callback contains `await`:
- `remote-execute` (session creation)
- `remote-send-message` (message sending)
- `session-auto-start` (WhatsApp/automation triggers)

## Files

- `src/App.tsx` — `handledRemoteSessionIds` ref + dedup guard in `remote-execute` listener
