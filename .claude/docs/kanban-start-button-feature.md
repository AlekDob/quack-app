# Kanban Start Button Feature

**Date**: 2026-01-06
**Status**: Completed

## Overview

Added a "Start" button to TODO tasks in the Kanban board that allows users to quickly start working on a task with a single click.

## Behavior

When the Start button is clicked on a TODO task:
1. Task is moved to `in_progress` status
2. Chat tab opens automatically
3. Initial prompt (from `task.prompt`) is sent to the AI

## Implementation Details

### Files Modified

1. **KanbanCard.tsx** (`src/components/kanban/KanbanCard.tsx:249-262`)
   - Added `onStart` prop
   - Rendered Start button only for agent tasks with `status === 'todo'`

2. **KanbanColumn.tsx** (`src/components/kanban/KanbanColumn.tsx:70,99,419`)
   - Added `onTaskStart` prop
   - Passed to KanbanCard's `onStart` prop

3. **KanbanView.tsx** (`src/components/kanban/KanbanView.tsx:313-329,577`)
   - Implemented `handleStartTask` function
   - Passed to TODO column

4. **KanbanView.css** (`src/components/kanban/KanbanView.css:1512-1541`)
   - Added styles for `.kanban-card-start`

### Component Flow

```
KanbanView (handleStartTask)
    └── KanbanColumn (onTaskStart)
            └── KanbanCard (onStart)
```

### handleStartTask Logic

```typescript
const handleStartTask = useCallback(async (task: KanbanTask) => {
  // 1. Move task to in_progress
  await moveTask(task.id, 'in_progress');

  // 2. Open task in new tab
  if (onOpenTaskTab) {
    onOpenTaskTab(task);
  }

  // 3. Send the initial prompt after a short delay
  if (task.prompt) {
    setTimeout(() => {
      onSendMessage(task.id, task.prompt);
    }, 100);
  }
}, [moveTask, onOpenTaskTab, onSendMessage]);
```

## UI/UX

- Button appears on hover in the card header
- Green color (#22c55e) with play icon
- Text: "Start"
- Hover effect: slightly brighter green
- Active: scale(0.95) for click feedback

## Notes

- The Start button does NOT appear in the KanbanPopoutView because it doesn't have access to the sendMessage functionality
- The 100ms delay before sending the prompt ensures the chat tab is fully initialized
