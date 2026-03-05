---
type: gotcha
project: quack-app
created: 2026-03-05
last_verified: 2026-03-05
tags: [office, tabs, specialTabTypes, navigation, race-condition]
---
# Office/Automation view snaps back to Chat after 1-2 seconds

## Symptom
Opening the Office (or Automation) tab works momentarily, but after 1-2 seconds the view resets to the Chat tab automatically.

## Root Cause
Three separate `specialTabTypes` arrays in `App.tsx` control which tabs are preserved across agent/terminal switches. These arrays were missing `'office'` and `'automation'`.

When an agent switch or terminal update effect fires (triggered by `activeId` or `activeTerminal` change), the code checks:
```ts
const isSpecialTabActive = specialTabTypes.some(type =>
  activeTabId.includes(type) || activeTabId === 'kanban-board'
);
if (!isSpecialTabActive) {
  setActiveTabId('chat'); // <-- This resets the Office view!
}
```

Since `'office'` was not in `specialTabTypes`, `isSpecialTabActive` was `false`, and the effect would call `setActiveTabId('chat')`.

## The Three Arrays
1. **~line 1850** — Filters agent-specific tabs when saving per-agent tab state
2. **~line 1870** — Preserves special tabs when restoring tabs for new active agent
3. **~line 10220** — Preserves special tabs during terminal switch tab reconstruction

All three must stay in sync. Any new global tab type (not agent-specific) must be added to all three.

## Fix
Added `'office'` and `'automation'` to all three `specialTabTypes` arrays.

## Trigger
Any event that changes `activeId` or `activeTerminal` (e.g., agent selection in sidebar, new session creation, terminal status update) while Office/Automation tab is active.

## Prevention
When adding a new singleton tab type (like Kanban, Office, Automation), always add its `type` string to ALL `specialTabTypes` arrays in App.tsx. Search for `specialTabTypes` to find them all.
