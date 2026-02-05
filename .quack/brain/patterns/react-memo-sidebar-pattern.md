---
type: pattern
project: quack-app
created: 2026-01-10
migrated: true
---

# react-memo-sidebar-pattern

[2026-01-10] Pattern per memoizzare componenti sidebar che si renderizzano per ogni progetto

Problema: TasksSidebarSection veniva renderizzato N volte (una per progetto) anche con 0 task

Soluzione: memo() con custom arePropsEqual() che confronta solo props rilevanti

Custom comparison: controlla tasks array (ids, status, titles), activeTaskId, chatLoadingMap solo per task visibili

Rimossi console.log per ridurre overhead

TaskItem wrappato con memo() separatamente per granularità fine

Beneficio: previene cascading re-renders quando parent cambia stato non correlato
