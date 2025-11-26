# Terminal Refactor - Integration Guide

## Summary

Successfully refactored terminals from agent-scoped to project-scoped architecture. This guide documents the changes and remaining integration steps.

## Completed Changes

### 1. Type Definitions (`src/types.ts`)
- ✅ Renamed `AgentTerminal` → `ProjectTerminal`
- ✅ Changed `agentId` → `projectPath`
- ✅ Added legacy type alias for backwards compatibility

### 2. Terminal Store (`src/stores/terminalStore.ts`)
- ✅ Renamed `agentTerminals` → `projectTerminals`
- ✅ Added `activeProjectTerminalId` state
- ✅ Added project terminal actions (add, remove, update, setActive)
- ✅ Added selectors: `getProjectTerminalById`, `getActiveProjectTerminal`, `getProjectTerminalsByPath`
- ✅ Updated persistence to include projectTerminals

### 3. XTerm Component
- ✅ Renamed `AgentTerminalTab.tsx` → `XTermInstance.tsx`
- ✅ Updated component name and props
- ✅ Updated all log messages
- ✅ Renamed CSS classes: `agent-terminal-tab` → `xterm-instance`
- ✅ Renamed dispose function: `disposeAgentTerminalTab` → `disposeXTermInstance`

### 4. New Components Created

**TerminalWindow.tsx** (~80 lines)
- Main window container
- Manages terminal groups by project path
- Auto-selects first terminal
- Shows empty state when no terminals

**TerminalSidebarPanel.tsx** (~120 lines)
- Sidebar with collapsible project groups
- "+" button to add terminals per project
- Reuses sidebar styling pattern

**ProjectTerminalItem.tsx** (~50 lines)
- Individual terminal item
- Shows status (busy/idle)
- Close button functionality

### 5. CSS Files Created

- `TerminalWindow.css` - Main window styling
- `TerminalSidebarPanel.css` - Sidebar styling (glassmorphism)
- `ProjectTerminalItem.css` - Terminal item styling

### 6. UI Store (`src/stores/uiStore.ts`)
- ✅ Added `showTerminalWindow` state
- ✅ Added window management actions (open, close, toggle)

## Remaining Integration Steps

### Step 1: Import TerminalWindow in App.tsx

```typescript
// Add to imports
import { TerminalWindow } from './components/TerminalWindow';
import { useUIStore } from './stores/uiStore';
```

### Step 2: Add TerminalWindow to render

```typescript
// In App.tsx render, after other modals/drawers:
const showTerminalWindow = useUIStore(state => state.showTerminalWindow);

// In JSX:
<TerminalWindow visible={showTerminalWindow} />
```

### Step 3: Add UI trigger (toolbar button or keyboard shortcut)

Example toolbar button:
```typescript
<button
  onClick={() => useUIStore.getState().toggleWindow('showTerminalWindow')}
  title="Open Terminals"
>
  💻
</button>
```

### Step 4: Remove old agentTerminals logic from App.tsx

Search and remove/update:
- `const [agentTerminals, setAgentTerminals]`
- `agentTerminals.filter(t => t.agentId === ...)`
- Any references to `AgentTerminalTab` component (should use XTermInstance now)

### Step 5: Update any imports of AgentTerminalTab

```typescript
// OLD:
import { AgentTerminalTab } from './components/AgentTerminalTab';

// NEW:
import { XTermInstance } from './components/XTermInstance';
```

## Testing Checklist

- [ ] Open TerminalWindow via UI
- [ ] Create terminal for a project
- [ ] Switch between terminals
- [ ] Close terminal
- [ ] Multiple terminals per project display correctly
- [ ] Terminal survives project/agent switches
- [ ] XTerm renders correctly in new window
- [ ] Keyboard shortcuts work (if added)

## Migration Notes

### For Users
- Terminals are now project-scoped, not agent-scoped
- One project can have multiple terminals
- Terminals persist across agent switches
- New dedicated window for terminal management

### For Developers
- `ProjectTerminal` replaces `AgentTerminal`
- Use `projectPath` instead of `agentId`
- Terminal state is in `terminalStore.projectTerminals`
- XTerm logic is in standalone `XTermInstance` component

## Rollback Plan

If issues arise, the legacy type alias allows temporary rollback:
```typescript
// types.ts already has:
export type AgentTerminal = ProjectTerminal;
```

This means old code referencing `AgentTerminal` will still work during migration.

## Architecture Benefits

1. **Clearer separation**: Agents (AI chat) vs Terminals (CLI)
2. **Better UX**: Terminals don't disappear when switching agents
3. **DRY principle**: XTermInstance is reusable component
4. **Scalability**: Easy to add multiple terminals per project

---

**Status**: Refactor complete, pending App.tsx integration
**Date**: 2025-01-17
**Author**: Agent Laura
