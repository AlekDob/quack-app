---
type: bug_fix
project: quack-app
created: 2026-04-07
last_verified: 2026-04-08
tags: [react, closure, zustand, streaming, session]
---
# Fix: Delayed Agent Message Stale Closure

## Problem

When an agent session finished streaming, the completion handler updated `messageCount` using a stale value of `chatSessions` captured by the `useCallback` closure. Because streaming can take seconds (or minutes), the `chatSessions` Map captured at callback creation time was outdated by the time the `.then()` handler ran — new messages added during streaming were not reflected.

This caused `messageCount` to regress to the value it had when the callback was created, effectively "forgetting" messages that arrived during the stream. The Remote API polling and session persistence relied on `messageCount`, so downstream consumers saw incorrect progress.

## Root Cause

Classic React stale closure: `useCallback` captures `chatSessions` at creation time. During a long-running streaming response, React state updates (new messages appended via `setChatSessions`) produce new Map references, but the callback still holds the old one. When the stream completes and the `.then()` block reads `chatSessions.get(messageKey).length`, it gets the stale count.

```
t=0   useCallback captures chatSessions (8 messages)
t=1   stream starts, new messages arrive → state: 9 messages
t=2   stream continues → state: 10 messages
t=3   stream completes → .then() reads captured chatSessions → 8 messages ❌
      updateSession({ messageCount: 8 }) → regression overwrites 10!
```

## Fix Attempt 1 (INSUFFICIENT): chatSessionsRef

Replaced `chatSessions.get()` with `chatSessionsRef.current.get()`. The ref is synced via `useEffect`, which runs *after* React renders. This still races with the completion handler — the ref can be one render behind.

## Fix Attempt 2 (CORRECT): Max of store + ref

The `useSessionMessageSync` hook writes the correct messageCount to `sessionStore` (Zustand). The completion handler now reads from **both** the store and the ref, taking the max:

```typescript
const storeSession = useSessionStore.getState().sessions.find(s => s.id === messageKey);
const storeCount = storeSession?.messageCount ?? 0;
const refCount = (chatSessionsRef.current.get(messageKey) ?? []).length;
const messageCount = Math.max(storeCount, refCount);
```

This handles all scenarios:
- **Active session**: `useSessionMessageSync` already wrote correct count to store → store wins
- **Background session**: hook didn't fire (only syncs activeSessionId) → ref is best available
- **Both stale**: max ensures we never regress below what either source reports

## Key Insight

The general pattern: **never overwrite a monotonically-increasing value without checking the current state first.** messageCount should never decrease during normal operation, so `Math.max()` is a safe monotonic guard. This avoids the entire class of stale-closure / stale-ref timing bugs.

## Debug Log

The completion handler now logs both sources:
```
[SESSION-FIX] Saved claudeSessionId abc... messageCount=10 (store=10, ref=8)
```
If `ref < store`, it confirms the ref was stale but the store had the right value.

## Related Files

- `src/App.tsx` — lines ~3030-3051 (fix site), ~1097 (ref declaration), ~1195-1198 (sync effect)
- `src/hooks/useSessionMessageSync.ts` — the correct source of truth for active sessions
- `src/stores/sessionStore.ts` — `updateSession()` uses spread merge (`{ ...session, ...updates }`)
