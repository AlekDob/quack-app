# Tasks Sidebar Section

**Status**: ✅ Implemented
**Version**: Added in v0.3.1
**Component**: `src/components/TasksSidebarSection.tsx`

## Overview

The Tasks Sidebar Section provides a dedicated "Tasks" grouping in the terminal sidebar, showing all active tasks independently from agents. This gives users a centralized view of their active work items without having to drill into specific agents.

## Features

### Task Display
- **Collapsible Section**: Toggle visibility with arrow icon
- **Task Count Badge**: Shows number of active tasks
- **Mini Avatars**: Each task displays the assigned agent's avatar
- **Status Indicators**: Color-coded dots show task state
- **Title Truncation**: Long titles are truncated to 35 characters

### Filtering
- **Active Only**: Shows only TODO and IN_PROGRESS tasks (excludes DONE)
- **Project Scoping**: Optionally filter by current project path
- **Smart Filtering**: If no project specified, shows all active tasks

### Task States

Tasks display different status colors based on their state:

| Color | State | Description |
|-------|-------|-------------|
| Gray (#6b7280) | TODO | Not yet started |
| Blue (#3b82f6) | Cold | In progress but no messages |
| Green (#22c55e) | Ready | Waiting for user input |
| Orange (#f59e0b) | Working | Processing/loading |

### Visual Design

```
└── Tasks (collapsible)
    ├── [mini-avatar] Auto Memory Search... 🟢
    ├── [mini-avatar] Forked Execution... 🟡 (in progress)
    └── [mini-avatar] Skill Hot-Reload... 🟢
```

## Architecture

### Component Props

```typescript
interface TasksSidebarSectionProps {
  tasks: KanbanTask[];              // All active tasks
  activeTaskId: string | null;      // Currently selected task
  onOpenTaskTab: (task: KanbanTask) => void;  // Open task chat
  chatSessions?: Map<string, ChatMessage[]>;  // For status
  chatLoadingMap?: Map<string, boolean>;      // Loading state
  currentProjectPath?: string;      // Optional project filter
}
```

### Integration Points

1. **Terminal Sidebar** (`TerminalSidebar.tsx`)
   - Passes active tasks from kanbanStore
   - Determines current project from active terminal
   - Handles task tab opening

2. **Kanban Store** (`kanbanStore.ts`)
   - Source of truth for all tasks
   - Provides task filtering methods
   - Manages task state transitions

3. **Avatar System**
   - Uses same avatar utilities as agent cards
   - Supports custom avatars
   - Fallback to letter initials

## Implementation Details

### Status Color Calculation

```typescript
function getTaskStatusColor(
  task: KanbanTask,
  messages: ChatMessage[],
  isLoading: boolean
): string {
  const isTodo = task.status === 'todo';
  const isCold = isAgentTask && !hasMessages && !isTodo;
  const isReady = isAgentTask && hasMessages && !isLoading && !isDormant;

  if (isTodo) return '#6b7280';      // Gray
  if (isCold) return '#3b82f6';      // Blue
  if (isReady) return '#22c55e';     // Green
  return '#f59e0b';                  // Orange (working)
}
```

### Project Filtering Logic

```typescript
// If currentProjectPath is provided, filter by project
// If not provided, show ALL active tasks (global view)
const activeTasks = useMemo(() => {
  return tasks.filter(task => {
    if (task.status === 'done') return false;
    if (!currentProjectPath) return true;
    return task.projectPath === currentProjectPath;
  });
}, [tasks, currentProjectPath]);
```

## User Interactions

### Click Task
Opens the task's chat tab, switching to the assigned agent if necessary.

### Collapse/Expand
Click section header to toggle visibility. State is local (not persisted).

### Hover Effects
Tasks highlight on hover with increased opacity and border color.

## Styling

Uses inline styles for dynamic coloring based on agent color:
- Background: `${agentColor}15` (normal) → `${agentColor}35` (selected)
- Border: `${agentColor}33` (normal) → `${agentColor}` (selected)
- Box-shadow: None (normal) → `0 0 8px ${agentColor}55` (selected)

## Testing

Full test coverage in `TasksSidebarSection.test.tsx`:
- ✅ Renders section with correct task count
- ✅ Filters out done tasks
- ✅ Filters tasks by current project path
- ✅ Shows all active tasks when no project filter
- ✅ Highlights selected task
- ✅ Calls onOpenTaskTab when clicked
- ✅ Toggles collapse state
- ✅ Does not render when no active tasks
- ✅ Displays correct status colors
- ✅ Renders mini avatars correctly
- ✅ Truncates long task titles

Run tests: `npm test -- TasksSidebarSection.test.tsx`

## Accessibility

- Semantic HTML structure
- Keyboard navigation (inherited from parent)
- Clear visual states (hover, selected)
- Color + icon status indicators

## Performance Considerations

- `useMemo` for task filtering (recalculates only when deps change)
- Mini avatars (20x20px) reduce memory footprint
- Conditional rendering - section hidden when no active tasks
- No unnecessary re-renders with React.memo (could be added if needed)

## Future Enhancements

Potential improvements:
1. **Drag & Drop**: Reorder tasks in sidebar
2. **Context Menu**: Right-click for quick actions
3. **Search/Filter**: Search tasks by title
4. **Sort Options**: By status, date, priority
5. **Persistence**: Remember collapse state
6. **Task Groups**: Group by status or agent
7. **Progress Bars**: Show task completion percentage
8. **Keyboard Shortcuts**: Quick navigation through tasks

## Related Components

- `RepositoryGroup.tsx` - Shows tasks under agents
- `KanbanBoard.tsx` - Visual task board
- `TaskContextMenu.tsx` - Task right-click menu
- `kanbanStore.ts` - Task state management

## Files Modified

1. **Created**:
   - `src/components/TasksSidebarSection.tsx` - Main component
   - `src/components/TasksSidebarSection.test.tsx` - Unit tests
   - `docs/05-features/tasks-sidebar-section.md` - This documentation

2. **Modified**:
   - `src/components/TerminalSidebar.tsx` - Integrated new section

## Migration Notes

No breaking changes - this is a new feature that complements existing task display under agents.

Tasks continue to show under individual agents in RepositoryGroup, and now ALSO appear in this centralized Tasks section.

## Usage Example

```tsx
<TasksSidebarSection
  tasks={agentTasks}
  activeTaskId={activeTaskId}
  onOpenTaskTab={onOpenTaskTab}
  chatSessions={chatSessions}
  chatLoadingMap={chatLoadingMap}
  currentProjectPath="/Users/user/project/quack-app"
/>
```

## Visual Reference

**Collapsed State**:
```
▾ TASKS (3)
```

**Expanded State**:
```
▾ TASKS (3)
  [🦆] Implement auth system 🟢
  [🦆] Fix layout bug 🟡
  [🦆] Add tests ⚫
```

## FAQ

**Q: Why show tasks here AND under agents?**
A: Different use cases. Under agents = agent-centric view. Tasks section = task-centric view. Users can choose their preferred workflow.

**Q: Can I hide this section?**
A: Currently no, but it auto-hides when there are no active tasks. Persistence could be added.

**Q: What happens if a task has no assigned agent?**
A: The component handles this gracefully with a fallback letter avatar.

**Q: How is "current project" determined?**
A: From the active terminal's CWD or the first repository in the sidebar.

---

**Last Updated**: 2026-01-08
**Author**: Agent Jack Copy (via Claude Code)
