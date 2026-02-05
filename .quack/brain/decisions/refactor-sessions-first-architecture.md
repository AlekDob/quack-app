---
type: decision
project: quack-app
created: 2026-01-13
migrated: true
---

# refactor-sessions-first-architecture

[2026-01-13] MAJOR REFACTOR: Sessions-First Architecture - Eliminare Task, promuovere Sessioni Chat come entità di primo livello sotto ogni agente

[2026-01-13] AgentSession type sostituisce KanbanTask con: id, claudeSessionId, title, agentId, projectPath, status (todo/in_progress/done)

[2026-01-13] Logica stato: TODO = no risposte, In Progress = almeno 1 risposta, Done = manuale

[2026-01-13] Click Agent Card = Kanban filtrata per agente, Click Session = Chat

[2026-01-13] Files nuovi: sessionStore.ts, AgentSessionList.tsx, AgentSessionItem.tsx, NewSessionModal.tsx

[2026-01-13] Files da rimuovere: AddKanbanTaskModal.tsx, KanbanShellDrawer.tsx, useKanbanShellTask.ts
