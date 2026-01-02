# Kanban Tab Refactor

**Date:** 2026-01-01
**Type:** Feature Refactor
**Status:** Completed

## Summary

Refactored the Kanban Board from an overlay system to a proper Tab in the TabBar, following the same pattern used by Knowledge Graph and Second Brain views.

## Changes Made

### New Files Created

1. **`src/hooks/useKanbanTab.ts`**
   - Hook following `useSecondBrainTab` pattern
   - Returns `openKanbanTab()` and `isKanbanTab()` functions
   - Uses singleton pattern with fixed ID `'kanban-board'`

2. **`src/views/KanbanTabView.tsx`**
   - Wrapper component for KanbanView to work as a tab
   - Receives all KanbanView props plus `tab` and `isActive`
   - Memoized for performance

### Files Modified

1. **`src/components/TabBar.tsx`**
   - Added `'kanban'` to Tab type union
   - Added kanban icon rendering (clipboard SVG icon)

2. **`src/App.tsx`**
   - Imported `useKanbanTab` hook and `KanbanTabView` component
   - Changed from overlay state (`isKanbanViewActive`) to tab-based (`isKanbanTabActive`)
   - Created `handleOpenKanbanTab` function with toggle behavior
   - Updated keyboard shortcut handler (Cmd+K)
   - Replaced `KanbanView` rendering with `KanbanTabView`
   - ActionIcons menu now always visible (removed `!isKanbanTabActive` condition)

3. **`src/components/TerminalSidebar.tsx`**
   - Renamed props: `isKanbanViewActive` -> `isKanbanTabActive`
   - Renamed props: `onToggleKanbanView` -> `onOpenKanbanTab`

4. **`src/components/SidePanel.tsx`**
   - Renamed prop: `isKanbanViewActive` -> `isKanbanTabActive`

5. **`src/hooks/useTabPopoutWindow.ts`**
   - Added kanban window size: `{ width: 1400, height: 900 }`

6. **`src/stores/popoutWindowStore.ts`**
   - Added `kanban` to `canPopoutTab()` blacklist (cannot be popped out)

7. **`src/components/TabPopoutWindowApp.tsx`**
   - Added kanban icon in `getTabIcon()`
   - Added placeholder case for kanban type (fallback message)

## Behavior

### Cmd+K Toggle

- **First press:** Opens Kanban tab (or focuses if already exists)
- **Second press (when Kanban is active):** Returns to Chat tab

### Tab Properties

- **Type:** `'kanban'`
- **ID:** `'kanban-board'` (singleton - only one kanban tab allowed)
- **Closable:** Yes
- **Poppable:** No (requires main app state: terminals, chat sessions, etc.)

### UI Changes

- Kanban appears as a tab in the TabBar
- ActionIcons menu stays visible in Kanban mode
- Side panel toggle works as expected
- No popout button shown for Kanban tab

## Code Pattern

```typescript
// Hook usage
const { openKanbanTab, isKanbanTab } = useKanbanTab();

// Derived state
const isKanbanTabActive = activeTabId === 'kanban-board';

// Toggle handler
const handleOpenKanbanTab = useCallback(() => {
  if (isKanbanTabActive) {
    setActiveTabId('chat');
    return;
  }

  const existingTab = tabs.find(t => t.type === 'kanban');
  if (existingTab) {
    setActiveTabId(existingTab.id);
    return;
  }

  const newTab = openKanbanTab();
  setTabs((prevTabs) => [...prevTabs, newTab]);
  setActiveTabId(newTab.id);
}, [openKanbanTab, tabs, isKanbanTabActive]);
```

## Related Files

- `src/components/kanban/KanbanView.tsx` - Main Kanban component
- `src/stores/kanbanStore.ts` - Kanban state management
- `docs/05-features/kanban-board.md` - Kanban Board documentation
