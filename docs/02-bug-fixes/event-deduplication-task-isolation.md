# Event Deduplication Task Isolation Fix

**Date**: 2026-01-08
**Component**: `useClaudeChat` hook
**Issue**: Cross-task event contamination causing messages to not render

## Problem

The `seenEventIdsRef` Set was shared across all task switches, causing events from Task B to be incorrectly flagged as duplicates if they had similar IDs to Task A's events. This resulted in messages not rendering when an agent had multiple tasks.

### Root Cause

1. `seenEventIdsRef` persisted across the entire hook lifecycle
2. Event IDs were generated WITHOUT taskId scope
3. When switching from Task A to Task B, the Set contained Task A's event IDs
4. Task B's events with similar patterns (e.g., `system-init`, `assistant-{messageId}`) were flagged as duplicates
5. `claudeSessionId.current` maintained the previous task's session

## Solution

### 1. Added `taskId` Parameter to Options

```typescript
export interface UseClaudeChatOptions {
  initialSessionId?: string;
  initialTokens?: {...};
  taskId?: string; // NEW: Optional task ID for per-task event deduplication
}
```

### 2. Task-Scoped Event IDs

Updated `getEventId()` to include taskId prefix:

```typescript
const getEventId = (event: ClaudeEvent): string => {
  const taskPrefix = options?.taskId ? `${options.taskId}-` : '';

  // All event IDs now include taskPrefix
  if (event.type === 'system' && 'subtype' in event) {
    return `${taskPrefix}system-${event.subtype}`;
  }
  // ... other event types
};
```

### 3. Automatic Cleanup on Task Switch

Added useEffect to detect taskId changes and clear deduplication state:

```typescript
useEffect(() => {
  const newTaskId = options?.taskId;

  if (newTaskId !== currentTaskIdRef.current) {
    console.log('[useClaudeChat] TaskId changed, clearing event deduplication');

    // Clear deduplication Set
    seenEventIdsRef.current.clear();
    currentTaskIdRef.current = newTaskId;

    // Reset session ID unless explicitly provided
    if (!options?.initialSessionId) {
      claudeSessionId.current = undefined;
    }
  }
}, [options?.taskId, options?.initialSessionId]);
```

### 4. Session Reset Logic

- If `taskId` changes, session is reset to `undefined`
- UNLESS `initialSessionId` is provided (for resume scenarios)
- This ensures each task starts with a fresh Claude SDK session

## Usage

### Single Task (No isolation needed)

```typescript
const chat = useClaudeChat({
  initialSessionId: 'existing-session-id',
  initialTokens: {...}
});
```

### Multi-Task (Isolation required)

```typescript
const chat = useClaudeChat({
  taskId: 'task-abc-123', // Isolate events per task
  initialSessionId: task.sessionId,
  initialTokens: task.tokens
});
```

### Task Switching

When user switches from Task A to Task B:

```typescript
// Task A
const chatA = useClaudeChat({ taskId: 'task-a' });

// User switches to Task B - hook auto-detects change
const chatB = useClaudeChat({ taskId: 'task-b' }); // ✅ Clean slate
```

## Implementation Details

### Event ID Format

**Before** (no task isolation):
```
system-init
assistant-msg_123-text|tool_use-...
user-tool_result-...
result-session_xyz
```

**After** (with task isolation):
```
task-abc-123-system-init
task-abc-123-assistant-msg_123-text|tool_use-...
task-abc-123-user-tool_result-...
task-abc-123-result-session_xyz
```

### Deduplication Lifecycle

1. **Task A starts**: `seenEventIdsRef` is empty
2. **Task A receives events**: IDs like `task-a-system-init` are added
3. **User switches to Task B**: useEffect detects change
4. **Cleanup triggered**: `seenEventIdsRef.clear()` + session reset
5. **Task B receives events**: IDs like `task-b-system-init` are added (no collision!)

## Files Modified

- `/src/hooks/useClaudeChat.ts`
  - Added `taskId` to `UseClaudeChatOptions` interface
  - Added `currentTaskIdRef` to track task changes
  - Added `useEffect` for cleanup on task switch
  - Updated `getEventId()` to include taskPrefix
  - Added import for `useEffect` from React

## Testing

### Manual Testing Checklist

- [ ] Create Task A, send messages, verify events render
- [ ] Create Task B, send messages, verify events render
- [ ] Switch between Task A and Task B multiple times
- [ ] Verify no duplicate warnings in console
- [ ] Verify each task maintains separate chat history
- [ ] Verify session IDs are properly isolated

### Automated Testing

Create test file: `src/tests/useClaudeChat.taskIsolation.test.ts`

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useClaudeChat } from '../hooks/useClaudeChat';

describe('useClaudeChat - Task Isolation', () => {
  it('should clear deduplication when taskId changes', async () => {
    const { rerender } = renderHook(
      ({ taskId }) => useClaudeChat({ taskId }),
      { initialProps: { taskId: 'task-a' } }
    );

    // Simulate task switch
    rerender({ taskId: 'task-b' });

    // Verify clean slate (check console logs or state)
    await waitFor(() => {
      expect(/* deduplication cleared */).toBe(true);
    });
  });
});
```

## Benefits

1. **No Cross-Task Contamination**: Events from Task A never interfere with Task B
2. **Automatic Cleanup**: No manual intervention needed when switching tasks
3. **Backward Compatible**: taskId is optional - existing code works without changes
4. **Session Isolation**: Each task gets its own Claude SDK session
5. **Predictable Behavior**: Event deduplication now scoped to logical boundaries

## Related Issues

- Event deduplication was already fixed for intra-task duplicates (previous commit)
- This fix addresses inter-task contamination (different issue)
- See `docs/03-testing/event-deduplication-test-results.md` for related tests

## Future Improvements

1. Consider using `Map<taskId, Set<eventId>>` for multi-task isolation in same hook instance
2. Add telemetry to track task switching patterns
3. Add visual indicator in UI when session is reset
4. Expose `getCurrentTaskId()` method for debugging
