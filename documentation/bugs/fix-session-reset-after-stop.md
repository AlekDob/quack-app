---
type: gotcha
project: quack-app
created: 2026-03-03
last_verified: 2026-03-03
tags: [session, stop, resume, claudeSessionId, streaming]
---
# Session resets to zero after Stop + new message

## Symptom
When the user clicks **Stop** during an active session (any permission mode: Build, Debug, Plan) and then sends a new message, the session **reinitializes from scratch** instead of resuming the previous conversation. All previous context is lost.

## Root Cause
Two separate tracking paths for `claudeSessionId`:

1. **`useClaudeChat.ts`** (ref): `claudeSessionId.current` — updated during streaming from `system/init` event (line ~463)
2. **`App.tsx`** (session store): `session.claudeSessionId` — updated **only after successful completion** (line ~2600)

The main send path (`sendMessageForAgent` in App.tsx) reads from the **session store**, not the ref. When the user aborts before completion:
- The `invoke('send_message_via_sdk_streaming')` promise never resolves
- Line 2600 (`updateSession(messageKey, { claudeSessionId: response.session_id })`) never executes
- Session store keeps `claudeSessionId: undefined`
- Next message reads `undefined` → creates a NEW SDK session

## Fix
Save `claudeSessionId` to session store **immediately** when the `system/init` event arrives in `handleClaudeEvent` (App.tsx). This event fires at the very start of streaming, well before any abort could happen.

```ts
// In handleClaudeEvent, after the isResumed tagging:
if (evt.type === 'system' && evt.subtype === 'init' && evt.session_id) {
  const { updateSession: updateSessionNow } = useSessionStore.getState();
  updateSessionNow(messageKey, { claudeSessionId: evt.session_id });
}
```

The completion-time save at line ~2600 still runs (idempotent — writes the same value), acting as a safety net.

## Files Changed
- `src/App.tsx` — `handleClaudeEvent` function, after system/init isResumed tagging
