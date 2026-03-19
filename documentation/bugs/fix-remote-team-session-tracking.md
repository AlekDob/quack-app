---
type: bug
project: quack-app
created: 2026-03-19
last_verified: 2026-03-19
tags: [remote-api, team, session-tracking, messageCount, session-first]
---

# Bug: Remote Team Manager Can't Detect Delegated Task Completion

## Symptom

When a manager agent (e.g., Agent Jack) delegates a task to another agent (e.g., Agent Swift) via `POST /api/execute`, the manager polls `GET /api/sessions/:id` but always sees `messageCount: 0` and `status: 'in_progress'` — even after the delegated agent completes the work.

The manager concludes the worker is "stuck" and suggests checking for permission approvals, when in reality the task is already done.

## Root Causes (3 bugs)

### 1. `useSessionMessageSync` uses wrong key for chatSessions lookup

**File**: `src/hooks/useSessionMessageSync.ts:37`

```typescript
// BUG: chatSessions is keyed by session.id in SESSION-FIRST architecture
const agentMessages = chatSessions.get(session.agentId) || [];
// Should be:
const sessionMessages = chatSessions.get(activeSessionId) || [];
```

After the SESSION-FIRST migration, `chatSessions` is keyed by `session.id` (e.g., `session-abc123`), not by `agentId`. The hook was never updated, so it always finds 0 messages and never syncs `messageCount`.

### 2. `sendMessageForAgent` doesn't save messageCount on completion

**File**: `src/App.tsx:2747`

```typescript
// BUG: Only saves claudeSessionId, not messageCount or status
await updateSession(messageKey, {
  claudeSessionId: response.session_id,
  updatedAt: Date.now(),
  // Missing: messageCount, status
});
```

Compare with `sendMessageForTargetAgent` (line 3418) which correctly saves `messageCount: (updatedSession?.messageCount || 0) + 2`.

### 3. No auto-completion of session status

Sessions created via remote execute stay `status: 'in_progress'` forever. The only way to mark them `done` is manual user action (UI button click).

## Fix

1. **`useSessionMessageSync`**: Changed `chatSessions.get(session.agentId)` → `chatSessions.get(activeSessionId)` to match SESSION-FIRST key pattern.

2. **`sendMessageForAgent` completion**: Added `messageCount`, `status: 'done'`, and `completedAt` to the `updateSession` call after the response is received.

## Impact

- Remote API polling now correctly shows `messageCount > 0` and `status: 'done'` after a session completes
- Team managers can detect when delegated work is finished
- Mobile dashboard also benefits (session dot turns green on completion)

## Files

- `src/hooks/useSessionMessageSync.ts` — fixed chatSessions key lookup
- `src/App.tsx` — added messageCount + status save on completion (line ~2747)
