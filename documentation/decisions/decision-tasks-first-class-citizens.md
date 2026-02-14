---
type: decision
created: 2026-01-10
tags: [architecture, tasks, state-management]
---

# decision-tasks-first-class-citizens

[2026-01-10] Architectural decision: Tasks are now FIRST-CLASS CITIZENS, completely independent from agents

Before: Tasks were children of agents via `activeTaskPerAgent` Map - selecting a task also highlighted its agent

After: `activeTaskId` is a direct state variable, tasks get their own dedicated tabs (type: 'task')

Key changes in App.tsx:

1. Replaced `activeTaskPerAgent: Map<agentId, taskId>` with direct `activeTaskId: string | null` state

2. `openTaskTab` now creates a real tab with `type: 'task'` instead of modifying the 'chat' tab

3. `openTaskTab` does NOT call `setActiveId(agentId)` - task is independent from agent selection

4. Separate ChatView render sections: one for agent chat (`activeTabId === 'chat'`), one for task chat (`activeTabId.startsWith('task-')`)

5. `handleTabClose` resets `activeTaskId` when closing task tabs

6. `handleSelectTerminal` resets `activeTaskId` to null when selecting agent from sidebar

Benefits: No more coupling bugs, tasks can be switched without affecting agent selection, cleaner separation of concerns
