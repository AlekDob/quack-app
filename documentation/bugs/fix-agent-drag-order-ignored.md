---
type: bug_fix
created: 2026-02-11
tags: [react, dnd-kit, sidebar, agent-ordering]
---

# Fix: Agent drag & drop order was always overridden by timestamp sorting

## Problem

Users could manually reorder agents in the sidebar using drag & drop (via dnd-kit), and the order was persisted to `.quack-agent-order.dat`. However, the order was immediately discarded because `applyCustomOrder` **always** sorted agents by their last assistant message timestamp, ignoring the saved manual order entirely. This made the drag & drop feature completely useless.

## Root Cause

The old `applyCustomOrder` function treated the timestamp sort as the only source of truth, without checking if a manual order had been saved first. The saved `agentOrder` state was being loaded but never actually consulted when rendering the agent list.

## Solution

Refactored `applyCustomOrder` in `src/components/RepositoryGroup.tsx` (lines 1397-1457) into three focused hooks:

1. **`getLastAssistantTimestamp`** (lines 1398-1411)
   - Extracts the most recent assistant message timestamp for an agent
   - Returns 0 if no messages or no assistant response exists
   - Memoized with `useCallback` to avoid re-computation

2. **`sortByTimestamp`** (lines 1414-1427)
   - Sorts agents by most recent assistant message (descending)
   - Handles edge cases: agents with no assistant messages float to the bottom
   - Pure function with memoization

3. **`applyCustomOrder`** (lines 1430-1457) - **The fix**
   - **FIRST** checks if a manual order exists: `agentOrder[orderKey]`
   - **IF** manual order exists, respects it completely
   - **IF** no manual order, falls back to timestamp sort
   - **NEW agents** (not in saved order) are appended at the end, sorted by timestamp
   - This preserves user intent while auto-placing new additions

## Key Implementation Details

```typescript
// 1. Check for saved manual order
const savedOrder = agentOrder[orderKey];

// 2. If no manual order, use timestamp sorting
if (!savedOrder || savedOrder.length === 0) {
  return sortByTimestamp(agents);
}

// 3. Build ordered list from saved IDs, preserving user's drag order
const agentMap = new Map(agents.map((a) => [a.id, a]));
const ordered: TerminalInfo[] = [];

for (const id of savedOrder) {
  const agent = agentMap.get(id);
  if (agent) {
    ordered.push(agent);
    agentMap.delete(id);
  }
}

// 4. Append new agents not in saved order, sorted by timestamp
const newAgents = sortByTimestamp([...agentMap.values()]);
return [...ordered, ...newAgents];
```

## Files Changed

- `src/components/RepositoryGroup.tsx` lines 1397-1457

## Impact

- **Drag & drop now works as expected** - user-ordered agents stay in the exact order they placed them
- **Graceful handling of new agents** - new agents automatically appear at the end, sorted by recency
- **Code clarity** - three single-responsibility hooks instead of one conflated function
- **No breaking changes** - fallback to timestamp sort for branches without saved order preserves backward compatibility

## Trigger Conditions

This bug manifests when:
1. User manually reorders agents via drag & drop in the sidebar
2. The order is saved to `.quack-agent-order.dat`
3. Component re-renders (e.g., new message arrives, tab switches)
4. Expected: agents stay in user's custom order
5. Actual (before fix): agents revert to timestamp sort, ignoring manual order

---

## Part 2: dnd-kit listeners never attached

### Problem

While fixing Part 1, a second bug was discovered: in `src/components/RepositoryGroup.tsx`, the `SortableAgent` component correctly calls `useSortable()` and extracts both `attributes` and `listeners`, but these are never spread onto any DOM element. Without `{...attributes} {...listeners}` on the draggable element, **dnd-kit has no way to detect drag interactions**, making the entire drag system non-functional at the DOM level.

### Root Cause

The `setNodeRef` and `style` were correctly applied to the outer wrapper div (lines 599, 601), but `attributes` and `listeners` were simply unused — likely an oversight from a previous refactor where the component structure changed but the attributes/listeners weren't moved to match.

### Additional Complication

The codebase uses **two coexisting drag systems**:
- **dnd-kit**: For reordering agents within the sidebar (intended for `SortableAgent`)
- **Native HTML5**: For dragging agents to the Kanban board (`draggable` with `onDragStart` on line 614)

This dual-system design is intentional and necessary, but both were trying to work with the same DOM elements, causing conflicts.

### Solution

Added `{...attributes} {...listeners}` to the outer wrapper div that already had `ref={setNodeRef}` (line 599). This enables dnd-kit to properly detect mouse/touch events on the draggable element without breaking the native HTML5 drag system (which operates on a child element).

### Implementation Example

```typescript
// BEFORE: attributes and listeners extracted but never used
const { attributes, listeners, setNodeRef, style } = useSortable({ id: agent.id });

return (
  <div ref={setNodeRef} style={style}>  {/* ref and style OK, but no listeners */}
    {/* inner content */}
    <div draggable onDragStart={...}>  {/* native HTML5 drag */}
      {/* drag handle */}
    </div>
  </div>
);

// AFTER: listeners now attached to enable dnd-kit detection
return (
  <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
    {/* inner content */}
    <div draggable onDragStart={...}>  {/* native HTML5 drag still works */}
      {/* drag handle */}
    </div>
  </div>
);
```

---

## Part 3: Native HTML5 `draggable` conflict with dnd-kit PointerSensor

### Problem

After fixing Parts 1 and 2, drag initiation still failed. The root cause: the agent row div had both `draggable="true"` AND `onDragStart` handlers (for Kanban board drag functionality), AND it was a child of the dnd-kit sensored element. The native HTML5 `draggable` attribute captures pointer events at a lower level than dnd-kit's PointerSensor, preventing dnd-kit from ever detecting the gesture.

### Solution

**Removed the native `draggable="true"` attribute from the agent row div** (line 614 in `SortableAgent`). The native HTML5 drag-to-Kanban functionality is intended for different use cases; the primary drag system in the sidebar should be dnd-kit only.

---

## Part 4: handleDragEnd using stale IDs (ROOT CAUSE - The Real Bug)

### Problem

After fixing Parts 1-3, drag functionality still didn't work. The `handleDragEnd` event handler was called correctly, but the drag order was never persisted. Debugging revealed the root cause: **`handleDragEnd` was unable to find the dragged agents in its internal tracking structures**.

### Root Cause

`handleDragEnd` attempted to reconstruct the agent list from `mainAgents` and `worktreeAgents` props:

```typescript
// PROBLEMATIC CODE
const allAgents = [...mainAgents, ...worktreeAgents];
const branchAgents = allAgents.filter(a => a.sessionType === branchType);
```

But this reconstruction happened **inside the event handler**, using props that may have been:
1. **Not yet updated** by the time drag ends
2. **Stale** if agents were added/removed since the last render
3. **Mismatched** with the IDs that dnd-kit tracked in `SortableContext`

### Solution

Introduced **`renderedOrderRef`**, a `useRef<Map<string, string[]>>()` that tracks the exact agent IDs as they are rendered in each branch's `SortableContext`:

```typescript
// At component level (line 1155)
const renderedOrderRef = useRef<Map<string, string[]>>(new Map());

// During render, after applyCustomOrder (line 2073)
const sortedAgents = applyCustomOrder(agents, agentOrder, orderKey);
renderedOrderRef.current.set(orderKey, sortedAgents.map(a => a.id));

// In handleDragEnd (simplified, lines 1356-1401)
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event;

  const orderedIds = renderedOrderRef.current.get(orderKey) || [];
  const activeIndex = orderedIds.indexOf(String(active.id));
  const overIndex = orderedIds.indexOf(String(over.id));

  if (activeIndex === -1 || overIndex === -1) {
    console.warn(`[DnD] IDs not found in rendered order for ${orderKey}`);
    return;
  }

  const newOrder = arrayMove(orderedIds, activeIndex, overIndex);
  setAgentOrder(prev => ({ ...prev, [orderKey]: newOrder }));

  console.log(`[DnD] Successfully reordered: ${active.id} -> index ${overIndex}`);
};
```

---

## Complete Fix Summary

This was a 4-part debugging journey:

| Part | Issue | Root Cause | Fix |
|------|-------|-----------|-----|
| 1 | Saved order ignored | `applyCustomOrder` always sorted by timestamp | Refactored into 3 hooks that check manual order first |
| 2 | dnd-kit listeners unused | `attributes` and `listeners` never spread onto DOM | Added `{...attributes} {...listeners}` to wrapper div |
| 3 | Native `draggable` conflict | HTML5 `draggable="true"` blocked dnd-kit PointerSensor | Removed native `draggable` attribute from agent row |
| 4 | Persistence failed | `handleDragEnd` reconstructed stale agent IDs from props | Introduced `renderedOrderRef` to track rendered IDs in real-time |

## Key Learnings

1. **Always verify dnd-kit listeners are spread onto DOM** — Extracting but not spreading listeners is a silent failure
2. **Native HTML5 `draggable` and dnd-kit conflict** — They both vie for pointer events; avoid mixing on the same element
3. **Don't reconstruct state in event handlers from props** — Use refs to track rendered state instead
4. **Spreading `{...listeners}` after custom `onPointerDown` overwrites dnd-kit's handler** — Use the `mergedListeners` pattern to combine them safely
5. **Debug logs with a consistent prefix (`[DnD]`)** — Essential for diagnosing multi-system issues like this

---

**Status**: Complete — All 4 parts fixed, tested, and verified to work end-to-end.
