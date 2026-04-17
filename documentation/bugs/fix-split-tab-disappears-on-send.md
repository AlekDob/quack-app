---
type: gotcha
project: quack-app
created: 2026-04-10
last_verified: 2026-04-10
tags: [split-view, tabs, useEffect, race-condition, terminal-status]
---

# Split tab disappears when sending a message

## Symptom

When in split view (right pane showing a code-editor tab from File Explorer),
sending a chat message causes the right pane content to vanish. The divider
stays visible but the content is blank. Also happens when any terminal status
update occurs (loading state change, stream start/end).

## Root Cause

Two-stage chain reaction:

1. `sendMessageForAgent` calls `setChatLoadingMap` → triggers a `useEffect`
   that updates `terminals` (status idle→busy) → `activeTerminal` useMemo
   recalculates with a new reference.

2. A tab management `useEffect` depends on `[activeId, activeTerminal]`.
   When `activeTerminal` changes (even without `activeId` changing), the
   effect rebuilds the entire `tabs` array from
   `chatTab + tabsByTerminal.get(activeId) + specialTabs`.

3. `code-editor` tabs (from File Explorer) are NOT saved in `tabsByTerminal`
   (which only stores `type === 'file'` tabs) and are NOT in `specialTabTypes`.
   They get dropped from the rebuilt `tabs` array.

4. `splitTabId` still points to the dropped tab ID, but
   `tabs.find(t => t.id === splitTabId)` returns `undefined` → right pane
   renders `null`.

## Fix

Guarded the full tab rebuild to only execute when `activeId` actually changes
(agent switch). When only `activeTerminal` changes (status update, label
rename), the effect now only updates the chat tab's label and color — no tab
array reconstruction.

```typescript
const isAgentSwitch = previousId !== activeId;
if (isAgentSwitch) {
  // Full tab save/restore logic (agent switching)
} else {
  // Only update chat tab label/color
  setTabs(prevTabs => prevTabs.map(t =>
    t.id === 'chat'
      ? { ...t, label: activeTerminal?.label || 'Chat', color: activeTerminal?.color }
      : t
  ));
}
```

## File

`src/App.tsx` — tab management useEffect (search for
`Brain: fix-split-tab-disappears-on-send`)

## Lesson

Effects with derived-state dependencies (`activeTerminal` from `useMemo`)
fire on every upstream change, not just meaningful ones. Guard destructive
operations (full array rebuilds) behind explicit identity checks.
