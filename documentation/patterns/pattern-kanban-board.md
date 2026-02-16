---
type: pattern
created: 2026-01-08
updated: 2026-02-16
---

# Kanban Board System

Frontend: kanban/KanbanView.tsx, KanbanColumn.tsx, KanbanCard.tsx
Store: kanbanStore.ts (sessions-first, reads from sessionStore)
Chat state: chatStore.ts (pendingQuestionsMap for Human Review detection)

## 4-Column Layout

| Column | Status | Color | Description |
|--------|--------|-------|-------------|
| TODO | `todo` | Gray #6b7280 | Tasks waiting to start |
| In Progress | `in_progress` | Orange #f59e0b | Active tasks (sub-groups: READY/WORKING/COLD) |
| Human Review | virtual (`in_progress` + pending question) | Purple #a855f7 | Tasks awaiting user input |
| Done | `done` | Green #22c55e | Completed tasks (date-grouped, paginated) |

## Human Review - Virtual Column

The Human Review column is **not a new KanbanStatus**. It filters `in_progress` tasks by checking `chatStore.hasPendingQuestion(sessionId)`. This avoids persistence changes.

**Auto-move in**: When an agent calls `AskUserQuestion` or requests plan approval, `pendingQuestionsMap` updates, React re-renders, and the card appears in Human Review.

**Auto-move out**: When the user answers, `pendingQuestionsMap` clears for that session, and the card returns to In Progress.

**Manual drag**: Users can drag any `in_progress` task into Human Review. This is tracked via `kanbanStore.manualHumanReviewIds` (ephemeral `Set<string>`, not persisted). The flag is cleared when the task is dragged out of Human Review or when `moveTask()` changes its actual status.

**Filtering logic**: A task appears in Human Review if `hasPendingQuestion(id) || isManualHumanReview(id)`. Otherwise it stays in In Progress.

## In Progress Sub-Groups

| Group | Condition | Color |
|-------|-----------|-------|
| READY | hasMessages && !isLoading && !isDormant | Green |
| WORKING | isLoading or (hasMessages && isDormant) | Orange |
| COLD | !hasMessages (never started) | Blue |

## Card Badges

- **Ready** (green): Agent finished, awaiting review. Shows when `isReady && !hasPendingQuestion`
- **Awaiting Input** (purple): Agent needs user response. Shows when `hasPendingQuestion`
- Progress bar: Shows when `isLoading` (streaming)

## Drag & Drop

- Library: `@dnd-kit/core` with custom collision detection favoring columns
- Sidebar agents can be dropped onto columns via native HTML5 drag
- Validation: Cannot move to TODO if conversation exists

## Data Flow

```
AgentSession (sessionStore) → sessionToKanbanTask() → KanbanTask (in-memory)
chatStore.pendingQuestionsMap → hasPendingQuestion() ─┐
kanbanStore.manualHumanReviewIds → isManualHumanReview() ─┤→ splits in_progress vs human_review
                                                          │  (OR logic: either trigger = Human Review)
```

## Key Files

- `KanbanView.tsx`: Main orchestrator, drag-drop, column rendering, task splitting
- `KanbanColumn.tsx`: Droppable column, sub-grouping logic (READY/WORKING/COLD)
- `KanbanCard.tsx`: Draggable card with badges (Ready/Awaiting Input)
- `KanbanView.css`: 4-column grid, status colors, badge animations
- `kanbanStore.ts`: Sessions-first store (reads from sessionStore), `manualHumanReviewIds` for manual placement
- `chatStore.ts`: pendingQuestionsMap for awaiting detection
