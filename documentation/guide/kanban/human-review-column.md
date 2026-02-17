---
type: guide
audience: human
created: 2026-02-16
---

# Human Review Column

The Kanban board has 4 columns: **TODO** | **In Progress** | **Human Review** | **Done**.

## What Is Human Review?

When an AI agent needs your input — asking a question or requesting plan approval — the task card automatically moves from "In Progress" to "Human Review". This makes it immediately visible that something needs your attention.

## How It Works

```
Agent working → Agent asks question → Card moves to Human Review (auto)
You answer → Card returns to In Progress (auto)
```

See the flow diagram: [kanban-flow.mmd](./kanban-flow.mmd)

### Automatic Detection

The system uses `chatStore.pendingQuestionsMap` to detect pending questions:
- `AskUserQuestion` tool calls set a pending question
- Plan approval requests set a pending question
- When you respond, the pending question clears
- React re-renders split tasks between In Progress and Human Review

### Visual Indicators

- **Purple column header** (#a855f7) — matches the sidebar's "awaiting" dot
- **"Awaiting Input" badge** on cards — purple pulsing badge
- Cards in Human Review are fully draggable

### Manual Drag

You can also **manually drag** any In Progress task into the Human Review column. This is useful when you want to park a task for your own review, even if the agent hasn't asked a question. The task will stay in Human Review until you drag it back out or move it to another column.

### Drag Behavior

| From | To | Effect |
|------|----|--------|
| In Progress | Human Review | Status stays `in_progress`, tracked as manual placement |
| Any other column | Human Review | Status set to `in_progress`, tracked as manual placement |
| Human Review | In Progress | Clears manual flag, card returns to In Progress |
| Human Review | Done | Marks as `done`, clears manual flag |
| Human Review | TODO | Blocked if conversation exists |

## Architecture Note

Human Review is a **virtual column** — there is no `human_review` KanbanStatus. The underlying status remains `in_progress`. Tasks appear here via two mechanisms:
1. **Auto-detection**: `chatStore.hasPendingQuestion()` returns true (agent asked a question)
2. **Manual placement**: `kanbanStore.manualHumanReviewIds` tracks user-dragged tasks (ephemeral, not persisted)

Both are OR-combined in the filter. Zero persistence/schema changes were needed.
