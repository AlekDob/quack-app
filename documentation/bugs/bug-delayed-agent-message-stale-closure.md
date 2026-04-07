---
type: bug_fix
project: quack-app
created: 2026-04-07
last_verified: 2026-04-07
tags: [react, closure, zustand, streaming, session]
---
# Fix: Delayed Agent Message Stale Closure

## Problem

When an agent session finished streaming, the completion handler updated `messageCount` using a stale value of `chatSessions` captured by the `useCallback` closure. Because streaming can take seconds (or minutes), the `chatSessions` Map captured at callback creation time was outdated by the time the `.then()` handler ran — new messages added during streaming were not reflected.

This caused `messageCount` to regress to the value it had when the callback was created, effectively "forgetting" messages that arrived during the stream. The Remote API polling and session persistence relied on `messageCount`, so downstream consumers saw incorrect progress.

## Root Cause

Classic React stale closure: `useCallback` captures `chatSessions` at creation time. During a long-running streaming response, React state updates (new messages appended via `setChatSessions`) produce new Map references, but the callback still holds the old one. When the stream completes and the `.then()` block reads `chatSessions.get(messageKey).length`, it gets the stale count.

```
t=0   useCallback captures chatSessions (3 messages)
t=1   stream starts, new messages arrive → state: 5 messages
t=2   stream continues → state: 8 messages
t=3   stream completes → .then() reads captured chatSessions → 3 messages ❌
      updateSession({ messageCount: 3 }) → regression!
```

## Solution

Replace the closure read with a ref read. A `chatSessionsRef` (`useRef`) is kept in sync with `chatSessions` via a `useEffect`, providing synchronous access to the latest value without re-creating the callback.

```typescript
// Before (stale):
const finalMessages = chatSessions.get(messageKey) ?? [];

// After (fixed):
const finalMessages = chatSessionsRef.current.get(messageKey) ?? [];
```

The ref is synced in a dedicated effect:

```typescript
const chatSessionsRef = useRef<Map<string, ChatMessage[]>>(new Map());

useEffect(() => {
  chatSessionsRef.current = chatSessions;
}, [chatSessions]);
```

## Key Insight

Any `useCallback` that runs asynchronously after a delay (streaming `.then()`, `setTimeout`, event listeners) will capture stale state. The fix pattern is:

1. Create a `useRef` mirror of the state value
2. Keep it in sync via `useEffect`
3. Read from `ref.current` inside the async path

This is the same pattern used in `ChatInput.tsx` (attachmentsRef), `TerminalSidebar.tsx` (favorites), and `RepositoryGroup.tsx` (rendered order). The codebase marks these with comments like `// Use ref to avoid stale closure`.

**Caveat**: `chatSessionsRef` may be one render behind since the sync effect runs after paint. For cases where exact-latest state is critical (e.g., session backup), use a functional state updater (`setChatSessions(current => { ... })`) instead — this reads the true latest value from React's internal queue.

## Related Files

- `src/App.tsx` — lines ~1097 (ref declaration), ~1195-1198 (sync effect), ~3022-3025 (fix site)
- `src/components/ChatInput.tsx` — same pattern for `attachmentsRef`
