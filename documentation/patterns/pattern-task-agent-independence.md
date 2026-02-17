---
type: pattern
created: 2026-01-09
---

# Task Agent Independence

Tasks in Quack Kanban are treated as 'duplicate agents' -- independent chat sessions dedicated to specific tasks.

Task chat storage key: `chat-${taskId}` (NOT agentId) -- ensures task data survives agent reset.

Task tokens stored separately in chatTokensMap with taskId as key.

When agent resets: (1) assignedAgent.id updated to new UUID for visual link, (2) activeTaskPerAgent key migrated, (3) task chat/tokens preserved.

This pattern allows users to reset agent context without losing task progress.
