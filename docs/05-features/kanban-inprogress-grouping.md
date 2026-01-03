# Kanban In Progress Column Status Grouping

## Overview

The In Progress column in the Kanban board now groups tasks by their status, making it easier to see which tasks are ready for review and which are still actively being worked on.

## Layout

```
┌─ In Progress (4) ─────────────┐
│                               │
│  ● READY (1)                  │  ← Green indicator, at top
│  ┌─────────────────────────┐  │
│  │ Improve: macOS Store... │  │
│  │ ● Ready                 │  │
│  └─────────────────────────┘  │
│                               │
│  ◐ WORKING (3)                │  ← Orange indicator
│  ┌─────────────────────────┐  │
│  │ Mini-Kanban Panel...    │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │ Fix: Kanban Chat...     │  │
│  └─────────────────────────┘  │
│  ┌─────────────────────────┐  │
│  │ Improve: MCP Kanban...  │  │
│  └─────────────────────────┘  │
└───────────────────────────────┘
```

## Status Groups

### READY (Green)
Tasks that have finished their active work phase and are awaiting review/action. A task is considered "ready" when:

1. **Is an agent task** (type is `'agent'` or undefined)
2. **Has messages** in the chat session
3. **Not currently loading/streaming** (AI is not actively responding)
4. **Not dormant** (has at least one user message in the conversation)

Ready tasks appear at the TOP of the In Progress column with a pulsing green indicator.

### WORKING (Orange)
Tasks that are actively being processed. This includes:

1. **Agent tasks currently streaming** (loading = true)
2. **Agent tasks without user interaction yet** (dormant)
3. **Shell tasks** (always considered working when in progress)
4. **Watch tasks** (always considered working when in progress)

Working tasks appear BELOW the ready group with an orange pulsing indicator.

## Implementation Details

### Files Modified

- `src/components/kanban/KanbanColumn.tsx` - Added grouping logic
- `src/components/kanban/KanbanView.css` - Added status group styles

### Key Logic

The grouping happens inside `KanbanColumn.tsx` because it requires access to runtime chat state:

```typescript
// Determine if an agent task is "ready"
function isTaskReady(
  task: KanbanTask,
  isLoading: boolean,
  hasMessages: boolean,
  isDormant: boolean
): boolean {
  const isAgentTask = (task.type || 'agent') === 'agent';
  return isAgentTask && hasMessages && !isLoading && !isDormant;
}
```

The `useMemo` hook groups tasks into two buckets based on their ready status:

```typescript
const inProgressGroups = useMemo(() => {
  if (id !== 'in_progress' || tasks.length === 0) return [];

  const ready: TaskWithState[] = [];
  const working: TaskWithState[] = [];

  tasks.forEach((task) => {
    // ... calculate isLoading, hasMessages, isDormant from chat state

    if (isTaskReady(task, isLoading, hasMessages, isDormant)) {
      ready.push(taskWithState);
    } else {
      working.push(taskWithState);
    }
  });

  // Ready group always comes first (at top)
  return [
    ...(ready.length > 0 ? [{ bucket: 'ready', label: 'READY', tasks: ready }] : []),
    ...(working.length > 0 ? [{ bucket: 'working', label: 'WORKING', tasks: working }] : []),
  ];
}, [id, tasks, chatLoadingMap, chatSessions, shellOutputs]);
```

### CSS Classes

| Class | Description |
|-------|-------------|
| `.kanban-status-group` | Container for a status group |
| `.kanban-status-group--ready` | Modifier for ready group |
| `.kanban-status-group--working` | Modifier for working group |
| `.kanban-status-group-header` | Sticky header with label and count |
| `.kanban-status-indicator` | Status dot indicator |
| `.kanban-status-indicator--ready` | Green pulsing dot |
| `.kanban-status-indicator--working` | Orange pulsing dot |
| `.kanban-status-group-label` | Group label (READY/WORKING) |
| `.kanban-status-group-count` | Task count badge |

## Tests

Tests are located in `src/tests/kanbanInProgressGrouping.test.ts` covering:

- `isTaskReady` function for all task types
- Grouping logic with various scenarios
- Correct ordering (READY always first)
- Edge cases (empty lists, missing chat data)

Run tests with:
```bash
npm test -- --run kanbanInProgressGrouping
```

## Future Improvements

- [ ] Collapsible groups (optional)
- [ ] User preference to disable grouping
- [ ] Additional status types (e.g., "Blocked", "Needs Input")
