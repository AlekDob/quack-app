# Kanban Done Column Date Grouping

## Feature Overview

Tasks in the Done column are now grouped by completion date with visual headers.

**Date**: 2026-01-02
**Type**: UI Enhancement
**Status**: Completed

## Changes Summary

### 1. New Utility: `src/utils/kanbanDateGrouping.ts`

Date grouping utility with the following exports:

- `getDateBucket(timestamp, now)` - Returns bucket type: `'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'older'`
- `getDateBucketLabel(bucket, locale)` - Returns localized label (Italian/English)
- `groupTasksByCompletionDate(tasks, locale)` - Groups tasks into `DateGroup[]`
- `formatCompletionDate(timestamp, locale)` - Formats date as "2 Gen 2026"
- `getTotalTaskCount(groups)` - Returns total count across groups

### 2. Store Update: `src/stores/kanbanStore.ts`

Added reset logic for `completedAt` when task moves OUT of done status:

```typescript
// Reset completedAt when task moves OUT of done status
if (task.status === 'done' && newStatus !== 'done') {
  updates.completedAt = undefined;
}
```

### 3. MCP Server Update: `src-tauri/node-sdk/kanban-mcp-server.js`

Same reset logic added to `kanban_move_task` tool:

```javascript
// Reset completedAt when task moves OUT of done status
if (previousStatus === 'done' && args.newStatus !== 'done') {
  task.completedAt = undefined;
}
```

### 4. Component Update: `src/components/kanban/KanbanColumn.tsx`

- Added `useMemo` for date grouping (only for Done column)
- Conditional rendering: grouped view for Done, flat list for TODO/In Progress
- Each group renders header + cards

### 5. CSS Update: `src/components/kanban/KanbanView.css`

New styles for date groups:

- `.kanban-date-group` - Container with flex column
- `.kanban-date-group-header` - Sticky header with gradient background
- `.kanban-date-group-label` - Green uppercase label
- `.kanban-date-group-count` - Badge with task count
- Separator line between groups

## Behavior

| Action | completedAt |
|--------|-------------|
| Task moves to `done` | Set to `Date.now()` |
| Task moves from `done` to `in_progress` | Reset to `undefined` |
| Task moves from `done` to `todo` | Reset to `undefined` |
| Task re-completed (done again) | Set to new `Date.now()` |

## Visual Output

```
DONE
━━━━━━━━━━━━━━━━
OGGI [2]
  ◆ Fix login bug
  ◆ Add dark mode
────────────────
IERI [1]
  ◆ Refactor API
────────────────
QUESTA SETTIMANA [1]
  ◆ Update dependencies
────────────────
PRECEDENTI [1]
  ◆ Initial setup
```

## Tests

23 tests in `src/tests/kanbanDateGrouping.test.ts`:

- `getDateBucket` - 6 tests (today, yesterday, thisWeek, lastWeek, older, midnight boundary)
- `getDateBucketLabel` - 3 tests (Italian, English, unknown locale)
- `formatCompletionDate` - 2 tests (Italian, English)
- `groupTasksByCompletionDate` - 8 tests (grouping, sorting, empty buckets, localization)
- `getTotalTaskCount` - 2 tests
- Edge cases - 3 tests (midnight, very old, future timestamps)

## Files Modified

1. `src/utils/kanbanDateGrouping.ts` - NEW
2. `src/stores/kanbanStore.ts` - Added reset logic
3. `src-tauri/node-sdk/kanban-mcp-server.js` - Added reset logic
4. `src/components/kanban/KanbanColumn.tsx` - Date grouping UI
5. `src/components/kanban/KanbanView.css` - Date group styles
6. `src/tests/kanbanDateGrouping.test.ts` - NEW (23 tests)

## Acceptance Criteria

- [x] Campo `completedAt` aggiunto a `KanbanTask` (already existed)
- [x] `completedAt` settato quando task va in done
- [x] `completedAt` nullificato quando task esce da done
- [x] Colonna Done mostra task raggruppati per data
- [x] Header date leggibili ("Oggi", "Ieri", "Questa Settimana", etc.)
- [x] Test passano (23/23)
- [x] MCP tool aggiornato
