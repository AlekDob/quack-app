# Kanban Chat Drawer Truncation Bug Fix

**Date**: 2026-01-02
**Status**: Fixed
**Impact**: Critical - Messages in Kanban chat drawer were truncated/incomplete

## Problem

When opening the Kanban chat drawer, users saw incomplete conversations:
- Only last 5 messages were visible (instead of full history)
- Message content was truncated to 200 characters with "..."
- CLI Claude Code showed full conversation, but Kanban drawer showed truncated version

## Root Cause Analysis

Initial analysis suggested the issue was with sync events, but the **actual root cause** was different:

1. `chatSessions` prop in main window contains **COMPLETE** messages from App.tsx state
2. The truncated sync was for **popout windows only** (cross-window communication)
3. The drawer was incorrectly prioritizing store data over app state

The confusion arose because:
- `useKanbanChatSync` was recently refactored to remove `chatSessions` from events (performance optimization)
- The drawer wasn't using the correct data source priority

## Solution

**Simple fix**: Use `chatSessions` prop (from App.tsx state) as PRIMARY source, with Store as BACKUP.

### Before (incorrect)
```typescript
// Tried to read from store first, fell back to sync data
const messages = storeMessages.length > 0 ? storeMessages : syncMessages;
```

### After (correct)
```typescript
// Primary: App state (always complete in main window)
// Backup: Store (for recovery after app restart)
const messages = useMemo(() => {
  const appMessages = chatSessions.get(agentId) || [];
  if (appMessages.length > 0) return appMessages;
  if (storeMessages.length > 0) return storeMessages;
  return [];
}, [storeMessages, chatSessions, agentId]);
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      MAIN WINDOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   App.tsx State (chatSessions)  ─────►  KanbanChatDrawer   │
│   [COMPLETE MESSAGES]                   [PRIMARY SOURCE]    │
│                                                             │
│         │                                                   │
│         ▼                                                   │
│   quack-chats.json (Tauri Store)  ──►  [BACKUP SOURCE]     │
│   [PERSISTED FOR RECOVERY]                                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                     POPOUT WINDOWS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   kanban:chat-state-sync event  ─────►  Loading indicator  │
│   [LIGHTWEIGHT - only loading status]   [Working/Ready]     │
│                                                             │
│   quack-chats.json (Tauri Store)  ──►  Full messages       │
│   [READ DIRECTLY FOR DISPLAY]                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Details

### 1. useKanbanChatStore.ts (Backup Hook)

Reads from Tauri Store for:
- Recovery after app restart
- Popout windows that don't have access to main App state

### 2. KanbanChatDrawer.tsx

Uses data source priority:
1. **Primary**: `chatSessions` prop (complete messages from App.tsx state)
2. **Backup**: `storeMessages` (from useKanbanChatStore hook)

### 3. App.tsx - loadKanbanChatSessions

Added store saving when loading from Rust backend:
```typescript
// Save to store so popout windows can read complete messages
if (store) {
  await store.set(`chat-${task.id}`, { messages: chatMessages, ... });
  await store.save();
}
```

## Files Changed

| File | Change |
|------|--------|
| `src/hooks/useKanbanChatStore.ts` | **NEW** - Store reading hook (backup) |
| `src/components/kanban/KanbanChatDrawer.tsx` | Fixed data source priority |
| `src/App.tsx` | Save to store during session recovery |
| `src/tests/kanbanChatStore.test.ts` | **NEW** - Test coverage |

## Verification

- [x] TypeScript compiles without errors
- [x] All 10 new tests pass
- [x] No regression in existing tests
- [x] Messages in drawer are now complete
- [x] Works for both main window and popout windows

## Key Learnings

1. **Data source matters**: In main window, App.tsx state is the authoritative source
2. **Sync ≠ Source**: The sync mechanism is for cross-window communication, not for reading data
3. **Keep it simple**: The fix was simply using the correct data source priority
