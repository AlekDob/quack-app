---
type: bug
project: quack-app
created: 2026-03-03
last_verified: 2026-03-03
tags: [automation, session, title, race-condition, tauri-store]
---

# Automation Sessions Created with "Untitled" Title

## Symptom

Automation jobs (cron or manual fire) create sessions correctly, but the sessions appear as "Untitled" in the sidebar instead of `[Auto] <job name>`.

## Root Cause

Race condition between `store.reload()` and `store.save()` in the Tauri Store plugin:

1. `createSession()` calls `store.set(sessions)` → sets data in Tauri Store's in-memory cache
2. `store.save()` flushes to disk (async)
3. **Before save completes**, `loadAgentSessions()` fires (from polling) and calls `store.reload()`
4. `store.reload()` reads stale disk data (without the new session's title/status) and overwrites the in-memory cache
5. Next `store.save()` writes the stale data to disk — title and status are permanently lost

The `sessionWriteLock` mechanism existed with both `markWrite()` and `shouldSkipReload()` methods, but `shouldSkipReload()` was **never called** anywhere. The write lock was defined but not wired into the reload path.

## Evidence

Disk data (`quack-agents.json`) showed 3 automation sessions missing the `title` field entirely and 2 also missing `status`. All other sessions (created via UI, remote, etc.) had correct data.

## Fix (2026-03-03)

### Layer 1: Wire up the write lock (root cause)
In `loadAgentSessions()`, check `sessionWriteLock.shouldSkipReload()` before calling `store.reload()`. During the 500ms debounce window after a write, skip the reload to prevent stale disk data from overwriting in-memory state.

### Layer 2: Defense-in-depth in updateSession
If `title` or `status` is lost during a merge (`{...session, ...updates}`), restore from the original session object. Logs a warning when this happens.

### Layer 3: Warning in saveAgentSessions
Before persisting to disk, log a warning if any session is missing required fields. Catches future race conditions before they corrupt disk data.

### Circular dependency fix
Extracted `sessionWriteLock` to its own file (`src/stores/sessionWriteLock.ts`) because:
- `sessionStore.ts` imports from `unifiedAgentStorage.ts` (for load/save)
- `unifiedAgentStorage.ts` needed `sessionWriteLock` — importing from `sessionStore.ts` would create a cycle

## Files

- `src/stores/sessionWriteLock.ts` — extracted write lock module (NEW)
- `src/stores/sessionStore.ts` — re-exports `sessionWriteLock`, defense-in-depth in `updateSession`
- `src/services/unifiedAgentStorage.ts` — `shouldSkipReload()` gate in `loadAgentSessions`, warning in `saveAgentSessions`

## Key Insight

The Tauri Store plugin's `store.reload()` reads from disk and replaces the entire in-memory cache. Any `store.set()` that hasn't been flushed via `store.save()` is silently lost. Always use a write lock to protect the window between set() and save() from concurrent reload() calls.
