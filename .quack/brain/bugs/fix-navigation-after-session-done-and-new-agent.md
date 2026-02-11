---
type: bug_fix
project: quack-app
created: 2026-02-11
tags: [navigation, state-management, react]
---

# Fix: Navigation didn't reset when marking sessions as done or creating new agents

## Problem

Two related navigation bugs prevented proper UI transitions:

1. **Mark as Done stays on session**: Right-clicking a session and selecting "Mark as Done" would keep the ChatView visible for that completed session instead of navigating back to SessionEmptyState (agent overview).

2. **New agent doesn't show its screen**: When creating a new agent via the "+" button, if a session was previously active, the UI would stay on that session's ChatView instead of showing the new agent's empty overview.

## Root Cause

State management issue: `activeSessionId` and `activeTaskId` weren't being cleared during transitions, so React continued rendering the ChatView component for stale session data.

## Solution

### Part 1: Mark as Done callback chain

Added `onActiveSessionDone` callback through the component hierarchy to reset navigation state:

1. **App.tsx**: Define the callback
```ts
const handleActiveSessionDone = () => {
  setActiveSessionId(null);
  setActiveTaskId(null);
};
```

2. **TerminalSidebar.tsx**: Accept and pass callback
```ts
<RepositoryGroup
  onActiveSessionDone={onActiveSessionDone}
/>
```

3. **RepositoryGroup.tsx**: Accept and pass to list
```ts
<AgentSessionList
  onActiveSessionDone={onActiveSessionDone}
/>
```

4. **AgentSessionList.tsx**: Invoke callback when marking done
```ts
const handleMarkSessionDone = (sessionId: string) => {
  // ... mark as done logic ...
  onActiveSessionDone?.();
};
```

### Part 2: New agent navigation reset

In `TerminalSidebar.tsx`, the `handleConfirmNewTerminal` function now explicitly resets all navigation state:

```ts
const handleConfirmNewTerminal = () => {
  // ... create agent logic ...
  setActiveSessionId(null);
  setActiveTaskId(null);
  setActiveTabId('chat');
};
```

## Files Changed

- `App.tsx` - Added `onActiveSessionDone` callback
- `TerminalSidebar.tsx` - Pass callback, reset state in `handleConfirmNewTerminal`
- `RepositoryGroup.tsx` - Pass callback through
- `AgentSessionList.tsx` - Invoke callback on mark done

## Key Insight

When transitioning between major UI contexts (session → overview, agent → agent), explicitly clear related state atoms rather than relying on automatic cleanup. The UI state tree needs explicit resets at boundaries, especially when components share state through callbacks.

## Testing

- Create new agent → verify agent overview displays
- Mark session as done → verify navigates back to SessionEmptyState
- New agent appears in list and is selectable
