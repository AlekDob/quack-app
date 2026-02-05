---
type: bug
project: quack-app
created: 2026-01-09
migrated: true
---

# bug-fix-task-switch-message-loss

[2026-01-09] Fixed race condition where switching tasks during Claude streaming caused message loss

Root cause: When taskId changed, old stream continued updating detached React state while new hook mounted with empty state

Fix in useClaudeChat.ts: Added stream abort when taskId changes in useEffect (lines 82-116)

Fix in App.tsx openTaskTab: Save current task messages to disk BEFORE switching to preserve streaming data

Key insight: The streaming for-await loop continued even after component unmounted, updating stale closures

Related files: [[useClaudeChat]], [[App.tsx]], [[agentChatPersistence]]

[2026-01-10] UPDATE: Il fix precedente non era sufficiente. Il vero problema era l'await ensureListenerReady() che rompeva il React batching tra setChatSessions e setActiveTaskPerAgent. Fix definitivo: spostare setActiveTaskPerAgent PRIMA di ensureListenerReady, e rendere ensureListenerReady fire-and-forget.
