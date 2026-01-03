# Kanban Task Wrong Project Context Fix

## Bug Summary

When opening a Kanban task chat (via `.agent-task-item` in sidebar), the Claude agent thought it was in the wrong project, even though the task card correctly showed the right project (e.g., "quack-app").

## Root Causes Found

### Issue 1: Wrong Storage Key in usePopoutKanbanChat.ts (For Popout Windows)

In `src/hooks/usePopoutKanbanChat.ts`, the code was using the wrong storage key to look up tasks:

```javascript
// WRONG - was using 'tasks'
const tasks = await kanbanStore.get<KanbanTask[]>('tasks') || [];
```

The correct key is `'kanbanTasks'`, which matches:
- `KANBAN_TASKS_KEY` in `src/services/kanbanStorage.ts`
- The MCP server's storage format in `kanban-mcp-server.js`

### Issue 2: Missing workingDirectory in Task Tab (Main Issue)

After refactoring to use task tabs (`.agent-task-item` click opens tab), the `projectPath` was not being passed to `sendMessageForTargetAgent`.

In `src/App.tsx`, the ChatView for task tabs was calling:
```javascript
onSendMessage={(content, opts) => sendMessageForTargetAgent(activeTab.taskId!, content, opts)}
```

But `opts` from ChatView didn't include `workingDirectory`, so `sendMessageForTargetAgent` would fallback to `'/'`:
```javascript
cwd: options?.workingDirectory || '/',  // Always '/' because workingDirectory was never set!
```

## Fixes Applied

### Fix 1: Storage Key (usePopoutKanbanChat.ts)

```javascript
// CORRECT - use 'kanbanTasks' to match kanbanStorage.ts
const tasks = await kanbanStore.get<KanbanTask[]>('kanbanTasks') || [];
```

### Fix 2: Inject projectPath in Task Tab (App.tsx)

Modified the `onSendMessage` wrapper to inject the task's `projectPath`:

```javascript
onSendMessage={(content, opts) => sendMessageForTargetAgent(activeTab.taskId!, content, {
  ...opts,
  // 🦆 CRITICAL: Use task's projectPath as working directory for Claude context
  workingDirectory: task?.projectPath || opts?.workingDirectory || '/',
})}
```

Also updated `basePath` to use the task's `projectPath`:
```javascript
basePath={task?.projectPath || explorerRoot || explorerPath}
```

## Test Coverage

Added `src/tests/kanbanTaskKeyConsistency.test.ts` that:
1. Scans all source files that access `quack-kanban-tasks.json`
2. Verifies they use the correct `'kanbanTasks'` key
3. Verifies `kanbanStorage.ts` defines the correct constant
4. Verifies MCP server uses the same key

## Files Changed

- `src/hooks/usePopoutKanbanChat.ts` - Fixed storage key
- `src/App.tsx` - Inject projectPath as workingDirectory for task tabs
- `src/App.tsx` - Fixed duplicate tab creation race condition
- `src/tests/kanbanTaskKeyConsistency.test.ts` - New test file for storage key consistency

## Additional Fix: Duplicate Task Tabs

### Problem
When clicking on `.agent-task-item` rapidly or from multiple places (sidebar + Kanban board), duplicate tabs were being created for the same task.

### Root Cause
The `openTaskTab` function had `tabs` in its dependency array and checked for existing tabs outside the `setTabs` callback. This caused race conditions where:
1. First click: checks `tabs` (empty for this task) → creates tab
2. Second click: checks `tabs` (still "old" value due to closure) → creates duplicate

### Solution
Moved ALL existence checks inside the `setTabs` callback which always receives fresh state:

```javascript
// 🦆 FIX: Do ALL existence checks inside setTabs callback with fresh state
setTabs(prev => {
  const existingTabIndex = prev.findIndex(t => t.id === tabId);
  if (existingTabIndex >= 0) {
    // Tab already exists - don't duplicate
    return prev;
  }
  return [...prev, newTab];
});
```

Also removed `tabs` from the dependency array to prevent stale closures.

## Additional Fix: Duplicate Task Tabs After Refactor

### Problem
After the refactor to show tasks in the agent's Chat tab (instead of separate tabs), old persisted task tabs (type: 'task') were still appearing alongside the new dynamically-created Chat tab, causing 3 identical tabs to show.

### Root Cause
The old architecture created separate tabs with `type: 'task'` for each task. After refactoring to use `activeTaskPerAgent` state and dynamically modify the Chat tab via `displayTabs`, the old task tabs remained in the `tabs` array.

### Solution
Two-part fix in `displayTabs` useMemo:

1. **Filter old task tabs**: Always remove any tabs with `type: 'task'` before processing
2. **Cleanup effect**: Added a one-time useEffect to permanently remove old task tabs on mount

```javascript
// 🦆 Display tabs: filter out old task tabs, then modify 'chat' tab for active task
const displayTabs = useMemo(() => {
  // 🦆 CLEANUP: Filter out any old task tabs from previous refactor
  const cleanedTabs = tabs.filter(tab => tab.type !== 'task');

  if (!activeTaskId) return cleanedTabs;
  // ... modify 'chat' tab with task info
}, [tabs, activeTaskId, kanbanTasks]);

// 🦆 CLEANUP EFFECT: Remove old task tabs from state permanently (one-time)
const hasCleanedOldTaskTabs = useRef(false);
useEffect(() => {
  if (hasCleanedOldTaskTabs.current) return;
  hasCleanedOldTaskTabs.current = true;
  setTabs(prev => prev.filter(tab => tab.type !== 'task'));
}, []);
```

## Verification

After fix, when opening a Kanban task chat via `.agent-task-item`:
1. The `projectPath` is correctly injected from the task
2. Claude receives the correct `cwd` parameter
3. Claude knows it's working in the correct project context
4. Only ONE tab is shown with the task title (the modified Chat tab)
5. Old task tabs are automatically cleaned up

---

**Date**: 2026-01-03
**Severity**: High (affected all Kanban task chat sessions)
**Status**: Fixed and tested
