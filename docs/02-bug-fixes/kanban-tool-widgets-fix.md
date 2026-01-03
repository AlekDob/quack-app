# Kanban Chat Drawer Tool Widgets Fix

## Bug Description

Tool widgets (Read, Write, Edit, Bash, etc.) were not rendering correctly in the Kanban chat drawer during and after streaming. Only plain text was displayed instead of the interactive tool widgets.

## Root Cause

The issue was in `src/components/kanban/KanbanChatDrawer.tsx` at the `useMemo` hook that determines which messages to display.

### The Problem

```typescript
// BEFORE (broken)
const messages = useMemo(() => {
  const appMessages = chatSessions.get(agentId) || [];
  // ...
}, [storeMessages, chatSessions, agentId]);
```

The dependency array included `chatSessions` (a `Map`), but React doesn't deeply compare Map contents. When `setChatSessions` was called during streaming, a new Map was created, but the `useMemo` wasn't properly detecting the change to the extracted messages.

### Why Events Were Lost

1. Messages are created in App.tsx with an `events` array that accumulates tool_use and tool_result events during streaming
2. The `chatSessions` Map was updated correctly during streaming
3. However, the `useMemo` in KanbanChatDrawer wasn't re-computing because:
   - React compares Map references, not contents
   - The extracted `appMessages` was computed inside the useMemo, so changes weren't detected

## Solution

Extract the messages from the Map BEFORE the useMemo, making the array a direct dependency:

```typescript
// AFTER (fixed)
// Extract messages FIRST for proper dependency tracking
const appMessages = chatSessions.get(agentId) || [];

const messages = useMemo(() => {
  if (appMessages.length > 0) {
    return appMessages;
  }
  // fallback to store...
}, [appMessages, storeMessages, agentId]);
```

Now when `chatSessions` changes (new Map instance), `appMessages` also gets a new reference, triggering the useMemo to recompute.

## Files Changed

- `src/components/kanban/KanbanChatDrawer.tsx` - Fixed useMemo dependency

## Tests Added

- `src/tests/kanbanChatDrawerEvents.test.ts` - 13 tests covering:
  - Message events detection
  - chatSessions Map extraction
  - Message priority logic
  - Events array integrity during streaming

## Verification

1. Open Kanban board (Cmd+K)
2. Start a conversation with an agent
3. Verify tool widgets (Edit, Read, Write, Bash) appear during streaming
4. Verify tool widgets remain visible after streaming completes
5. Close and reopen the drawer - widgets should still be visible

## Related Components

- `ChatMessage.tsx` - Renders `message.events` via `StreamMessage` component
- `StreamMessage.tsx` - Renders individual tool widgets
- `App.tsx` - Manages `chatSessions` state and adds events during streaming

## Prevention

When using React Maps as state:
1. Extract needed values BEFORE useMemo/useCallback
2. Use the extracted values as dependencies
3. Never rely on Map reference comparison for reactivity
