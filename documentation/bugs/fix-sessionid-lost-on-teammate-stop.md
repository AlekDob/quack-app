---
type: bug_fix
created: 2026-02-12
tags: [teammates, sessions, react, state-management]
---

# SessionId Lost on Teammate Stop - Missing Parameter in updateTeammateStatus

## Problem

When a teammate completes work and stops, the `TeammateWidget` becomes non-clickable because the sessionId is cleared from the `teammateStatus` Map. This happens even after the first fix that prevented overwriting sessionId with undefined during status updates.

## Root Cause

In `App.tsx:1228`, the `agent_stopped` event handler was calling:

```typescript
updateTeammateStatus(agentEvt.agent_name, 'stopped')
```

This was missing the third parameter (`sessionId`), causing the function to overwrite the existing sessionId with `undefined` when updating the teammate's status to 'stopped'.

## Solution

Changed the call to explicitly pass the sessionId from the event:

```typescript
updateTeammateStatus(agentEvt.agent_name, 'stopped', agentEvt.session_id)
```

This preserves the sessionId in the `teammateStatus` Map throughout the entire teammate lifecycle, including when the teammate transitions to 'stopped' status.

## Why This Matters

- **Critical for clickability**: Without sessionId, the TeammateWidget cannot open the correct session when clicked
- **Lifecycle integrity**: SessionId must persist from teammate spawn → working → stopped
- **Related to teammate-stream-drilldown pattern**: The pattern requires sessionId to remain available for navigation

## Files Changed

- `src/App.tsx` (line 1228)

## Context

This is the second fix in the teammate sessionId handling flow. The first fix prevented overwrites during status updates, but this fix ensures that the 'stopped' event doesn't clear the sessionId when the function is called without the parameter.

## Verification

Tested by:
1. Starting a teammate
2. Letting it complete work and stop
3. Clicking on the stopped teammate widget
4. Confirming the correct session opens
