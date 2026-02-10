---
type: bug
project: quack-app
created: 2026-01-09
migrated: true
---

# bug-fix-agent-reset-task-independence

[2026-01-09] Fixed issue where resetting an agent would lose the active task in UI

Problem: activeTaskPerAgent Map used oldId as key, but after reset agentId changed to newId

activeTaskPerAgent.get(newId) returned null, making active task disappear from UI

Fix in App.tsx handleResetTerminal: Update activeTaskPerAgent key from oldId to newId during reset (step 7.5)

Tasks are now fully independent from agent - resetting agent preserves task chat, tokens, and active state

Task chat uses task.id as storage key, not agentId, so chat data was already independent

Related: [[handleResetTerminal]], [[activeTaskPerAgent]], [[KanbanTask]]
