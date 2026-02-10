---
type: bug
project: quack-app
created: 2026-01-10
migrated: true
---

# bug-task-chat-empty-on-switch

[2026-01-10] DEFINITIVO: Risolto bug ricorrente dove i messaggi chat non apparivano quando si switchava tra task

Sintomo: Switchando tra task dello stesso agente, la chat appariva vuota fino all'invio di un nuovo messaggio

Root cause: await ensureListenerReady(task.id) tra setChatSessions e setActiveTaskPerAgent rompeva il batching di React

React 18+ batcha gli state updates nello stesso event handler, ma await/async rompe questo batching

Quando il batching si rompe, React renderizza con stato intermedio: activeTaskPerAgent aggiornato ma chatSessions non ancora pronto

ChatView usa key={taskId} che causa UNMOUNT+MOUNT del componente - il nuovo componente legge chatSessions vuoto

Fix: Spostato setActiveTaskPerAgent PRIMA di ensureListenerReady, nello stesso blocco sincrono di setChatSessions

ensureListenerReady ora è fire-and-forget con .then()/.catch() - non blocca più il render

File: App.tsx openTaskTab(), righe 7716-7741

Pattern chiave: MAI mettere await tra setState correlati che devono essere batchati insieme
