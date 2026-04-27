---
type: bug
project: quack-app
created: 2026-04-27
last_verified: 2026-04-27
tags: [session, race-condition, zustand, sessionStore, AgentSessionList, dormant-agent]
---

# Fix: New Session from Dormant Agent Disappears (Race Condition)

## Symptom

Clicking a dormant agent → "New Session" modal opens → user types a title → presses Enter → modal disappears → **no session is created** (from the user's POV the session never opens).

The user logs revealed:

```
[sessionStore] loadSessions: previous=324, loaded=323
[sessionStore] loadSessions: previous=324, loaded=323
[unifiedAgentStorage] Saved 324 sessions
[sessionStore] Created session: "session-...." "test"
[App] Session clicked: "session-...."
[App] Session not found: "session-...."   ← bug
```

The session WAS persisted to disk (`Saved 324 sessions`), but the in-memory Zustand `sessions` array did not contain it when `handleSessionClick` ran.

## Root Cause

Race condition between `createSession` and `loadSessions`:

1. `createSession` (`sessionStore.ts`) does `set({ sessions: [...current, newSession] })` synchronously, then `await saveAgentSessions(sessions)`.
2. While the `await` is in flight, the UI re-renders. A previously dormant agent now has a non-done session → it transitions to "active" → React mounts a fresh `AgentSessionList` for that agent.
3. `AgentSessionList` had an on-mount `useEffect(() => { loadSessions(); }, [loadSessions])`.
4. The concurrent `loadSessions` reads the Tauri Store cache (which still reflects the disk pre-save), gets 323 sessions, and `set({ sessions: 323 })` — **wiping the just-created session from React state**.
5. `await saveAgentSessions` finishes; `sessionWriteLock.markWrite()` is called too late.
6. `createSession` returns the new session, `setNewSessionModalAgentId(null)` closes the modal, and `onSessionClick(newSession.id)` runs `useSessionStore.getState().sessions.find(...)` → **not found** → returns early → no navigation.

The `sessionWriteLock` already existed but only guarded `store.reload()` inside `loadAgentSessions`. The final `set({ sessions })` in the store-level `loadSessions` was unguarded.

## Fix

Two complementary changes:

1. **`src/components/AgentSessionList.tsx`** — removed the on-mount `loadSessions()`. Sessions are already loaded at boot (`App.tsx`) and refreshed by `sessions-updated` listeners; the per-mount call only added a race surface.
2. **`src/stores/sessionStore.ts`**:
   - `loadSessions` now bails out early when `sessionWriteLock.shouldSkipReload()` is true.
   - `createSession` / `updateSession` / `deleteSession` / `markDone` mark the lock **before** the `await save` (and again after) so concurrent reloads observe the lock during the entire critical section.

## Test

`src/tests/sessionStoreRaceCondition.test.ts` — three regression tests:
- `preserves a freshly created session when loadSessions runs concurrently with stale disk data` — fails without the fix.
- `loadSessions still proceeds when no write is in flight` — guards against over-aggressive skipping.
- `loadSessions is skipped while the write lock is hot` — exercises the guard directly.

## How to recognise it again

If users report "I create a session and it doesn't open" or "the modal disappears but nothing happens", check the console for the pattern:

```
[sessionStore] loadSessions: previous=N, loaded=N-1
[sessionStore] Created session: ...
[App] Session clicked: ...
[App] Session not found: ...
```

The mismatch between `previous` and `loaded` in `loadSessions` is the fingerprint — memory had more than disk because the just-saved session hadn't reached disk yet (or wasn't visible in the Tauri Store cache).

## Brain breadcrumbs

`// Brain: fix-session-create-race-load-overwrite` is placed above:
- the guard in `sessionStore.loadSessions`
- the relocated `markWrite()` in `createSession` / `updateSession` / `deleteSession` / `markDone`
- the comment block in `AgentSessionList.tsx` that explains why no on-mount loadSessions exists.
