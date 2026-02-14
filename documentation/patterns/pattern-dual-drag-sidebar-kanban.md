---
type: pattern
project: quack-app
created: 2026-02-14
last_verified: 2026-02-14
tags: [dnd-kit, drag-and-drop, sidebar, kanban, cross-boundary, portal]
---

# Dual Drag: Sidebar + Kanban Cross-Boundary Pattern

## Overview

Quack has **two independent drag-and-drop systems** that coexist and interact through a cross-boundary bridge. Agents can be reordered within the sidebar via `@dnd-kit/sortable`, AND dragged across the sidebar boundary onto the Kanban board to create a new task -- all within a single drag gesture.

## Architecture

```
Sidebar (TerminalSidebar.tsx)          Kanban (KanbanView.tsx)
┌─────────────────────────┐            ┌─────────────────────────┐
│  DndContext #1           │            │  DndContext #2           │
│  (project reorder)       │            │  (task reorder/move)     │
│                          │            │                          │
│  RepositoryGroup.tsx     │            │  KanbanColumn.tsx        │
│  ┌─────────────────────┐ │            │  ┌───────┬───────┬─────┐│
│  │ DndContext #3        │ │  cross-   │  │ TODO  │ WIP   │DONE ││
│  │ (agent reorder)     │ │  boundary │  │       │       │     ││
│  │                     │ ├───────────►│  │ ghost │       │     ││
│  │  SortableAgent      │ │  via      │  │ card  │       │     ││
│  │  SortableAgent      │ │  store    │  │       │       │     ││
│  └─────────────────────┘ │            │  └───────┴───────┴─────┘│
└─────────────────────────┘            └─────────────────────────┘
                                              ▲
                                              │
                                        kanbanStore.ts
                                        (bridge state)
```

### Three Nested DndContexts

1. **TerminalSidebar DndContext** -- reorders project groups/sections in the sidebar (`SortableContext` with `sectionIds`)
2. **RepositoryGroup DndContext** -- reorders agents within a project group (`SortableContext` per branch)
3. **KanbanView DndContext** -- reorders/moves task cards between columns (`SortableContext` per column)

Contexts #1 and #2 are nested (sidebar > repo group). Context #3 is separate (kanban panel). The cross-boundary bridge connects #2 to #3 without nesting their DndContexts.

## Cross-Boundary Drag Mechanism

### Problem

`@dnd-kit` DndContexts are isolated -- a drag started in one context cannot trigger drops in another. Since the sidebar and kanban live in separate DndContexts, there is no native way to drag an agent from the sidebar into a kanban column.

### Solution: Pointer Tracking + Store Bridge

The pattern uses manual pointer coordinate tracking during `onDragMove` to detect when the drag crosses the sidebar boundary, then communicates intent through a Zustand store.

**Key state in `RepositoryGroup.tsx`:**
```tsx
const [crossBoundaryIntent, setCrossBoundaryIntent] = useState(false);
const crossBoundaryRef = useRef(false);  // ref for sync access in dragEnd
const [dragPointer, setDragPointer] = useState<{ x: number; y: number } | null>(null);
```

**Why both ref and state?** `crossBoundaryRef` provides synchronous access in `handleDragEnd` (avoids stale closure). `crossBoundaryIntent` drives the visual transition (border, glow, "+ New Task" label) on the portal overlay.

### Step-by-Step Flow

1. **Drag starts** (`handleDragStart`) -- tracks `activeAgentId`, adds `.dragging-active` to body
2. **Drag moves** (`handleDragMove`) -- computes real pointer position from `activatorEvent + delta`:
   ```tsx
   const currentX = activatorEvent.clientX + event.delta.x;
   const currentY = activatorEvent.clientY + event.delta.y;
   ```
3. **Boundary detection** -- checks if pointer is 20px beyond sidebar right edge:
   ```tsx
   const sidebarRect = sidebarEl.getBoundingClientRect();
   const isBeyond = currentX > sidebarRect.right + 20;
   ```
4. **Column detection** -- queries DOM for `.kanban-column` elements, checks which one the pointer is over via `getBoundingClientRect()`, writes to store:
   ```tsx
   store.setSidebarDragHoverColumn(hoveredColumn);
   store.setSidebarDragAgentInfo({ name: agent.label, color: agent.color });
   ```
5. **Kanban reacts** -- `KanbanColumn` reads `sidebarDragHoverColumn` from store, renders a ghost card placeholder when hovered
6. **Drag ends** (`handleDragEnd`) -- if `crossBoundaryRef.current === true`:
   - Calls `store.requestAgentDrop(agentId)` which sets `agentDropRequest` in kanbanStore
   - `KanbanView` has a `useEffect` watching `agentDropRequest` -- triggers `handleSidebarAgentDrop` which opens the task creation modal pre-filled with agent info
   - If NOT cross-boundary: normal sort reorder within the branch

### Collision Detection Override

When the kanban is active, the sidebar DndContext disables its own collision detection to prevent interference:
```tsx
collisionDetection={isKanbanViewActive ? () => [] : closestCenter}
```

This ensures that during cross-boundary drag, the sidebar DndContext does not try to reorder agents -- the gesture is purely for kanban task creation.

## Portal-Based Drag Overlay

The drag overlay uses `createPortal(element, document.body)` instead of `@dnd-kit`'s built-in `<DragOverlay>`. This is necessary because the sidebar has `overflow: hidden`, which would clip the overlay during cross-boundary drag.

```tsx
{activeAgentId && dragPointer && createPortal(
  <div style={{
    position: "fixed",
    left: dragPointer.x + 12,
    top: dragPointer.y - 16,
    background: crossBoundaryIntent ? `${agent.color}40` : `${agent.color}25`,
    border: crossBoundaryIntent ? `2px solid` : `2px dashed`,
    zIndex: 99999,
    pointerEvents: "none",
  }}>
    <span>{agent.label}</span>
    {crossBoundaryIntent && <span>+ New Task</span>}
  </div>,
  document.body
)}
```

The built-in `<DragOverlay>` is still rendered (empty, hidden) because `@dnd-kit` uses it for internal measuring.

### Visual Feedback Transitions

The overlay transitions between two visual states:
- **Inside sidebar**: dashed border, lower opacity, subtle shadow -- normal reorder mode
- **Beyond sidebar**: solid border, higher opacity, stronger glow, "+ New Task" label -- kanban create mode

Transition is CSS-animated via `transition: "background 0.2s ease, border 0.2s ease, box-shadow 0.2s ease"`.

## Kanban Ghost Card

When the agent is dragged over a specific kanban column, that column renders a ghost card placeholder:

```tsx
{isSidebarDragHovered && sidebarDragAgentInfo && (
  <div className="kanban-ghost-card" style={{ borderColor: agentInfo.color }}>
    <div className="kanban-ghost-card-dot" style={{ background: agentInfo.color }} />
    <span>{agentInfo.name}</span>
    <span>+ New Task</span>
  </div>
)}
```

This gives spatial feedback about WHERE the task will land (which column).

## Store Bridge (kanbanStore.ts)

The Zustand store acts as the communication bridge between the two DndContexts:

| State | Type | Purpose |
|-------|------|---------|
| `sidebarDragHoverColumn` | `KanbanStatus \| null` | Which column the pointer is over |
| `sidebarDragAgentInfo` | `{ name, color } \| null` | Agent info for ghost card rendering |
| `agentDropRequest` | `{ agentId, timestamp } \| null` | Trigger for task creation |

**Cleanup**: all three are reset in `handleDragEnd` regardless of outcome. `agentDropRequest` is cleared by KanbanView after processing.

## File Map

| File | Role |
|------|------|
| `src/components/TerminalSidebar.tsx` | DndContext #1 -- project/group reorder |
| `src/components/RepositoryGroup.tsx` | DndContext #2 -- agent reorder + cross-boundary detection + portal overlay |
| `src/components/kanban/KanbanView.tsx` | DndContext #3 -- task reorder + `agentDropRequest` consumer |
| `src/components/kanban/KanbanColumn.tsx` | Ghost card rendering + `sidebarDragHoverColumn` consumer |
| `src/components/kanban/KanbanCard.tsx` | `useSortable` for task card reorder within columns |
| `src/stores/kanbanStore.ts` | Bridge state between sidebar and kanban DndContexts |
| `src/components/DragHandle.tsx` | Reusable 6-dot drag handle (used in sidebar project reorder) |

## Key Gotchas

1. **Ref + State duplication** -- `crossBoundaryRef` is needed because `handleDragEnd` would read stale `crossBoundaryIntent` state due to React's closure capture. Always update both.
2. **Dynamic import in drag handler** -- `import("../stores/kanbanStore")` is used in `handleDragMove` to avoid circular dependencies. This is async but fast (module is already loaded).
3. **Collision detection must be disabled** when kanban is active (`() => []`), otherwise sidebar DndContext tries to reorder agents during cross-boundary gestures.
4. **Portal overlay must use `pointerEvents: "none"`** -- otherwise it intercepts mouse events and breaks the drag.
5. **20px buffer** on boundary detection prevents accidental cross-boundary triggers during normal sidebar reorder.
6. **Built-in `<DragOverlay>` kept empty** -- removing it breaks `@dnd-kit` internal measuring. Render it with `dropAnimation={null}` and an invisible child.
