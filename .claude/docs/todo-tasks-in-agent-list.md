# TODO Tasks in Agent List Implementation

**Date**: 2026-01-06
**Feature**: Show TODO tasks in agent sidebar + auto-transition to in_progress

## Problem

Previously, only tasks with `status === 'in_progress'` were shown under agents in the sidebar. Tasks in TODO status were invisible, requiring users to open the Kanban board to see them.

## Solution

### 1. Extended Task Filtering

Changed the filter in `App.tsx` from:
```typescript
// OLD
const inProgressTasks = kanbanTasks.filter(t => t.status === 'in_progress');
```

To:
```typescript
// NEW
const agentTasks = kanbanTasks.filter(t => t.status !== 'done');
```

This includes both TODO and in_progress tasks, excluding only completed tasks.

### 2. Visual Differentiation

Added status color logic in `RepositoryGroup.tsx`:

| Task State | Color | Hex |
|------------|-------|-----|
| TODO (not started) | Gray | `#6b7280` |
| Cold (in_progress, no messages) | Blue | `#3b82f6` |
| Ready (response complete) | Green | `#22c55e` |
| Working (loading) | Orange | `#f59e0b` |

### 3. Auto-Transition

When user sends first message on a TODO task, it automatically transitions to in_progress:

```typescript
// In sendMessageForTargetAgent
if (kanbanTask && kanbanTask.status === 'todo') {
  const { moveTask } = useKanbanStore.getState();
  await moveTask(targetAgentId, 'in_progress');
}
```

## Files Modified

1. `src/App.tsx`:
   - Changed filter logic
   - Added auto-transition in `sendMessageForTargetAgent`

2. `src/components/TerminalSidebar.tsx`:
   - Renamed prop from `inProgressTasks` to `agentTasks`

3. `src/components/RepositoryGroup.tsx`:
   - Added `isTodo` state calculation
   - Updated `statusColor` calculation to include gray for TODO

## Testing

Test file: `src/tests/todoTasksInAgentList.test.ts`

14 tests covering:
- Task filtering (TODO + in_progress, exclude done)
- Status color calculation
- Auto-transition logic
- Edge cases (unassigned tasks, empty lists)

## Acceptance Criteria

- [x] TODO tasks visible in agent list under assigned agent
- [x] Different visual style for TODO (gray) vs in_progress (blue/green/orange)
- [x] Auto-transition to in_progress when user sends first message
- [x] Kanban board updates accordingly
- [x] No regression on existing in_progress task behavior
