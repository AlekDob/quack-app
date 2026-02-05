---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Kanban Board System

Frontend: kanban/KanbanView.tsx, KanbanColumn.tsx, KanbanCard.tsx, KanbanChatDrawer.tsx

Store: kanbanStore.ts - tasks, columns, agent assignments (persistent)

MCP Server: kanban-mcp-server.js (38K LOC) - 8 tools for AI automation

Features: 3-column layout, drag-and-drop (@dnd-kit), agent assignment, task chat drawer, worktree support

## Un Kanban per Task AI

Il Kanban di Quack non e un semplice task manager - e progettato per **delegare task ad agenti AI**. Ogni card puo essere assegnata a un agente che la esegue autonomamente.

## Layout e Interazione

- **3 colonne**: TODO, In Progress, Done
- **Drag & Drop**: via `@dnd-kit/core`
- **Chat Drawer**: clicca una card per aprire la chat con l'agente
- **Agent Panel**: sidebar destra con agenti disponibili

## MCP Tools per Automazione

Il Kanban espone 8 tool MCP che permettono a Claude di gestire task:

```
kanban_list_agents    -> Lista agenti disponibili
kanban_create_task    -> Crea nuovo task
kanban_move_task      -> Sposta tra colonne
kanban_update_task    -> Aggiorna progresso
kanban_get_workload   -> Carico di lavoro agenti
```

## File Structure

```
/src/components/kanban/
├── KanbanView.tsx        # Container principale
├── KanbanColumn.tsx      # Colonna droppable
├── KanbanCard.tsx        # Card draggable
├── KanbanChatDrawer.tsx  # Chat con agente
└── AddKanbanTaskModal.tsx # Creazione task

/src/stores/kanbanStore.ts # Stato persistente
```

## Worktree Integration

Quando crei un task, Quack puo creare un git worktree dedicato. L'agente lavora in un branch isolato senza interferire con il tuo lavoro.
