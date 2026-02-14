---
type: pattern
created: 2026-01-08
---

# Kanban Board System

Frontend: kanban/KanbanView.tsx, KanbanColumn.tsx, KanbanCard.tsx, KanbanChatDrawer.tsx

Store: kanbanStore.ts - tasks, columns, agent assignments (persistent)

MCP Server: kanban-mcp-server.js - 8 tools for AI automation

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
- `kanban_list_agents`, `kanban_create_task`, `kanban_move_task`, `kanban_update_task`, `kanban_get_workload`

## Worktree Integration

Quando crei un task, Quack puo creare un git worktree dedicato. L'agente lavora in un branch isolato senza interferire con il tuo lavoro.
