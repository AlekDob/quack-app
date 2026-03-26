---
type: bug
project: quack-app
created: 2026-03-24
last_verified: 2026-03-24
tags: [changes-panel, file-edits, session, useMemo]
---

# Fix: Changes Panel showing only last turn's edits

## Symptom
The Changes panel in the sidebar shows only 3 files while Fork (Git client) shows 26 local changes from the same session. The panel intermittently loses track of file edits — "a volte sì a volte no".

## Root Cause
In `src/components/ChatView.tsx`, the `useMemo` that computes `currentFileEdits` only scanned the **last assistant message**:

```js
const lastAssistantMessage = [...messages]
  .reverse()
  .find(msg => msg.role === 'assistant');
```

The `handleEditsChange` callback in `App.tsx` merges edits incrementally, which works during live streaming. But this breaks when:

1. **Session restore**: All messages loaded at once → useMemo runs once → only last turn captured
2. **Tab switch / component remount**: useMemo recalculates from scratch → only last turn
3. **Session switch**: `useEffect` on `activeId` resets `modifiedFiles` to `new Map()` (App.tsx:1813-1816), then ChatView remounts and only captures the last turn

## Fix
Changed `useMemo` to iterate over **all** assistant messages instead of just the last one:

```js
const assistantMessages = messages.filter(msg => msg.role === 'assistant');
for (const assistantMessage of assistantMessages) { ... }
```

The `Map<string, FileEdit>` naturally deduplicates — later edits to the same file update the existing entry (editCount++, lineChanges accumulated).

## Files Changed
- `src/components/ChatView.tsx` — useMemo now scans all assistant messages

## Breadcrumb
`// Brain: fix-changes-panel-all-messages` in ChatView.tsx
