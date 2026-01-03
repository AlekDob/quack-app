# Task Context Menu

**Feature:** Right-click context menu for Kanban tasks in the sidebar

**Status:** Implemented
**Date:** 2026-01-03

## Overview

Added a context menu to agent task items in the Terminal Sidebar, accessible via right-click. This provides quick actions to manage tasks without opening the full Kanban view.

## Features

### Menu Options

1. **Mark as Done** - Moves task to 'done' status
   - Only shown for tasks NOT in 'done' status
   - Uses checkmark icon (✓)
   - Shows success toast after completion

2. **Delete Task** - Permanently removes task
   - Shown for all tasks regardless of status
   - Uses trash icon (🗑️)
   - Styled with danger color (red)
   - Shows success toast after deletion

### User Experience

- **Trigger:** Right-click on `.agent-task-item` in sidebar
- **Position:** Menu appears at cursor position
- **Dismiss:** Click outside menu or press Escape key
- **Style:** Dark theme with glassmorphism effect, consistent with app design

## Implementation

### Components

#### TaskContextMenu.tsx
New component for rendering the context menu.

**Props:**
```typescript
interface TaskContextMenuProps {
  position: { x: number; y: number };
  task: KanbanTask;
  onMarkDone: () => void;
  onDelete: () => void;
  onClose: () => void;
}
```

**Features:**
- Click-outside detection to close menu
- Escape key handler
- Conditional rendering of "Mark as Done" based on task status
- Danger styling for delete action

#### RepositoryGroup.tsx
Modified to integrate context menu functionality.

**Changes:**
- Added `TaskContextMenu` import
- Added `useKanbanStore` hook for task operations
- Added state: `taskContextMenu` to track menu visibility and position
- Added handlers:
  - `handleTaskContextMenu` - Opens menu on right-click
  - `handleTaskMarkDone` - Moves task to done
  - `handleTaskDelete` - Deletes task
  - `handleTaskContextMenuClose` - Closes menu
- Added `onContextMenu` event to `.agent-task-item` div
- Rendered `TaskContextMenu` component when active

### State Management

**Kanban Store Integration:**
```typescript
const { moveTask, deleteTask } = useKanbanStore();
```

Uses existing store methods to ensure consistency with other Kanban operations.

### Styling

**CSS Classes Used:**
- `.context-menu` - Container with glassmorphism
- `.context-menu-item` - Individual menu options
- `.context-menu-item-danger` - Red styling for delete
- `.context-menu-separator` - Divider between sections

**Animation:**
- `contextMenuIn` - Fade + scale animation on open
- Smooth transitions on hover

## Testing

**Test File:** `src/tests/taskContextMenu.test.tsx`

**Test Coverage:**
1. ✓ Renders menu at correct position
2. ✓ Shows "Mark as Done" for non-done tasks
3. ✓ Hides "Mark as Done" for done tasks
4. ✓ Always shows "Delete Task" option
5. ✓ Calls handlers correctly on click
6. ✓ Closes on outside click
7. ✓ Closes on Escape key

**Test Results:** 8/8 passing

## User Flow

1. User right-clicks on a task in the sidebar
2. Context menu appears at cursor position
3. User selects an option:
   - **Mark as Done:** Task moves to done column, success toast shown
   - **Delete Task:** Task removed, success toast shown
4. Menu closes automatically after action
5. UI updates reflect changes immediately

## Integration Points

- **Kanban Store:** Uses `moveTask` and `deleteTask` actions
- **Toast Notifications:** Shows success messages via `sonner`
- **Sidebar UI:** Integrated into `RepositoryGroup` component
- **Task Selection:** Respects active task highlighting

## Files Modified

- `src/components/TaskContextMenu.tsx` (new)
- `src/components/RepositoryGroup.tsx` (modified)
- `src/tests/taskContextMenu.test.tsx` (new)

## Future Enhancements

Potential additions:
- "Edit Task" option to open task editor
- "Assign to Agent" submenu for reassignment
- "Move to..." submenu for status changes (todo/in_progress/done)
- "View Details" to open task in Kanban view
- Keyboard shortcuts for menu actions

## Related Documentation

- [Kanban Board](./kanban-board.md) - Main Kanban feature
- [Architecture](../01-architecture.md) - Overall system design
- [Testing Guide](../03-testing/README.md) - Testing approach
