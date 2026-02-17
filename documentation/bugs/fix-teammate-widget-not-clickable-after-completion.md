---
type: bug_fix
created: 2026-02-12
tags: [react, ui, teammates, state-management]
---

# TeammateWidget Not Clickable After Task Completion

## Problem

TeammateWidget becomes non-clickable after a task is marked as completed, preventing users from drilling down into the session stream to review the full execution history.

## Root Cause

`src/components/TeammateWidget.tsx:29` had incorrect `isClickable` logic:

```typescript
const isClickable = isStarting && !!sessionId && !!onDrillDown;
```

The `isStarting` dependency meant that once `status` changed to `"completed"`, the widget would no longer be clickable, even though the session stream data was still available and valuable to review.

## Solution

Removed the `isStarting` dependency from `isClickable` logic:

```typescript
const isClickable = !!sessionId && !!onDrillDown;
```

Additionally, added a visual hint for completed state (lines 141-149) to indicate the widget is clickable and will show execution history:

```typescript
{status === 'completed' && (
  <div className="text-xs text-zinc-500 mt-1">
    (click to view)
  </div>
)}
```

## Impact

- Users can now drill down into completed teammate sessions to review full execution logs
- Improves transparency and debuggability of multi-agent workflows
- Maintains existing click behavior for starting/idle states

## Files Changed

- `src/components/TeammateWidget.tsx` (line 29, lines 141-149)

## Verified

Tested that clicking on completed TeammateWidget properly triggers `onDrillDown` and navigates to session stream view.
