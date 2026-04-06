---
type: feature-doc
project: quack-app
stack: TypeScript strict (React 18 frontend) + @dnd-kit/core, @dnd-kit/sortable, Zustand, Tauri v2, sonner (toasts)
created: 2026-04-06
last_verified: 2026-04-06
tags: [kanban, board, task-management, drag-and-drop, sessions-first, project-management, dnd-kit]
---

## Kanban View
**Purpose:** Tab-based Kanban board displaying agent sessions organized in four columns (TODO, In Progress, Human Review, Done). Supports drag-and-drop between columns, text filtering, task creation/editing via modal, agent drop from sidebar, and integration with the session/chat system. Cross-project view showing all tasks from all projects.
**Stack:** React 18 + TypeScript strict + @dnd-kit + Zustand + Tauri v2
**Tab type:** `kanban` (singleton, fixed ID `kanban-board`)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/kanban/KanbanView.tsx` | Main Kanban board container — 4-column layout, DndContext, drag handlers, filter input, task CRUD orchestration, reopen-done dialog |
| Component | `src/components/kanban/KanbanColumn.tsx` | Droppable column — SortableContext, native HTML5 drag for sidebar agents, date grouping (Done), status grouping (In Progress: Ready/Working/Cold), infinite scroll sentinel, ghost card placeholder |
| Component | `src/components/kanban/KanbanCard.tsx` | Draggable task card — agent avatar, project color accent bar, progress indicator, status badges (Awaiting Input, Ready), context menu (portal), image attachment thumbnails, task type badges (agent/shell/watch) |
| Component | `src/components/kanban/KanbanCard.tsx` | `KanbanCardOverlay` — simplified card for drag overlay (no interactivity) |
| Component | `src/components/kanban/AddKanbanTaskModal.tsx` | Modal for creating/editing tasks — project selection, branch selection, agent assignment, title/prompt input, image attachments, draft persistence |
| Component | `src/components/kanban/KanbanMiniPanel.tsx` | Compact sidebar panel — collapsible sections per column, quick actions (Add Task, Full Board), task counts, last message preview |
| Component | `src/components/kanban/KanbanPopoutView.tsx` | (Deprecated) Standalone popout window — replaced by KanbanMiniPanel + KanbanTabView pattern |
| Barrel | `src/components/kanban/index.ts` | Re-exports KanbanView, KanbanColumn, KanbanCard, KanbanCardOverlay, AddKanbanTaskModal |
| Style | `src/components/kanban/KanbanView.css` | Dark-theme styles for board, columns, cards, header, filter, dialogs, context menus, ghost cards |
| Style | `src/components/kanban/KanbanMiniPanel.css` | Styles for compact sidebar panel |
| Store/State | `src/stores/kanbanStore.ts` | Zustand store — sessions-first architecture (reads from sessionStore), task CRUD, drawer state, sidebar drag tracking, pagination (Done), manual Human Review tracking, text filter, write lock |
| Hook | `src/hooks/useKanbanTab.ts` | Singleton tab hook — `openKanbanTab()` returns fixed-ID tab, `isKanbanTab()` type guard |
| Hook | `src/hooks/useKanbanChatSync.ts` | Syncs loading state from main window to popout (lightweight, no full chat sessions) |
| Hook | `src/hooks/usePopoutKanbanChat.ts` | Standalone chat system for popout window (send, abort, clear, compact) |
| Hook | `src/hooks/useProjectColor.ts` | Returns deterministic color for project path (used for card accent bar) |
| Util | `src/utils/kanbanDateGrouping.ts` | Groups completed tasks by date bucket (Today, Yesterday, This Week, Last Week, Older) with localized labels |
| Route/Page | `src/views/KanbanTabView.tsx` | Tab view wrapper — memoized, renders KanbanView when active, passes all props through |
| Test | `src/tests/kanbanDateGrouping.test.ts` | Unit tests for date grouping utility |

### Columns
| Column | Status | Color Variable | Behavior |
|--------|--------|---------------|----------|
| TODO | `todo` | `--kanban-todo-color` (#6b7280) | Flat card list, Start button on agent tasks, blocks move-back if conversation exists |
| In Progress | `in_progress` | `--kanban-progress-color` (#f59e0b) | Grouped by status: Ready (finished, awaiting review) > Working (streaming) > Cold (never started) |
| Human Review | virtual (`in_progress`) | `--kanban-review-color` (#a855f7) | Tasks with pending AskUserQuestion/PlanApproval OR manually dragged here; underlying status stays `in_progress` |
| Done | `done` | `--kanban-done-color` (#22c55e) | Grouped by completion date (Today/Yesterday/This Week/Last Week/Older), paginated with infinite scroll, Clear All button |

### Data Flow
`sessionStore` (source of truth) -> `kanbanStore.getTasksByStatus()` -> `KanbanView` -> `KanbanColumn` -> `KanbanCard`

### Task Types
| Type | Badge | Accent Color | Features |
|------|-------|-------------|----------|
| `agent` | (none) | Project color | Avatar, prompt preview, message count, session ID, Ready/Awaiting badges |
| `shell` | SHELL | Green (#22c55e) | Command preview, PID display, exit code, duration |
| `watch` | WATCH | Blue (#3b82f6) | Watch patterns, last triggered time |

### Drag-and-Drop
- **Library:** @dnd-kit/core + @dnd-kit/sortable
- **Sensors:** PointerSensor (8px activation distance) + KeyboardSensor
- **Collision detection:** Custom — prioritizes column collisions via `pointerWithin`, falls back to `rectIntersection`
- **Drag overlay:** Simplified `KanbanCardOverlay` component (no interactivity)
- **Sidebar agent drop:** Dual system — native HTML5 `application/x-quack-agent` MIME type + dnd-kit `agentDropRequest` cross-boundary detection
- **Ghost card:** Shown in target column during sidebar agent drag (agent color dot + name + "+ New Task")

### Card Metadata
| Field | Display | Source |
|-------|---------|--------|
| Agent avatar | Mini circular avatar (24px) with agent color border | `task.assignedAgent.avatar` via `useAgentAvatar` hook |
| Project name | Colored text with folder icon | `task.projectName`, color from `useProjectColor` |
| Message count | Chat bubble icon + count | `chatSessions.get(task.id).length` |
| Session ID | Truncated hash (click to copy) | `task.sessionId` (first 8 chars) |
| Progress bar | Animated indeterminate bar | Shown when `status === 'in_progress' && isLoading` |
| Attachments | Image thumbnails (max 3) + overflow count | `task.attachments` filtered by `image/*` MIME |

### In Progress Grouping
| Bucket | Label | Condition |
|--------|-------|-----------|
| Ready | READY | Has messages + not loading + not dormant |
| Working | WORKING | Currently streaming (isLoading) or has user messages |
| Cold | COLD | Agent task with zero messages (never started) |

### Human Review Column
- **Virtual column** — underlying task status remains `in_progress`
- **Auto-populated:** Tasks where `chatStore.hasPendingQuestion(task.id)` is true (AskUserQuestion or PlanApproval events)
- **Manual placement:** Tasks dragged into Human Review column tracked in `manualHumanReview` Set (kanbanStore)
- **Exit:** Moving task out of Human Review clears manual flag via `removeFromHumanReview()`

### Done Column Pagination
- **Infinite scroll:** IntersectionObserver on sentinel element at bottom of column
- **Threshold:** 0.1 intersection ratio, 100px root margin (triggers slightly before reaching end)
- **Store methods:** `getVisibleDoneTasks()`, `hasMoreDoneTasks()`, `loadMoreDone()`, `isLoadingMoreDone`
- **Pagination info:** "Showing X of Y tasks" when paginated

### Text Filter
- **Location:** Header search input with magnifying glass icon
- **Store:** `filterText` / `setFilterText` in kanbanStore
- **Scope:** Filters tasks by project name or task title (cross-column)
- **Clear button:** X icon shown when filter is non-empty

### Task Creation Modal (AddKanbanTaskModal)
- **Trigger:** "Add Task" button, keyboard shortcut, agent drag from sidebar, context menu "Create Task"
- **Fields:** Project (grouped repos), Branch (git branches), Agent (active terminals), Title, Prompt, Image attachments
- **Draft persistence:** Form state preserved when modal is accidentally closed (`KanbanTaskDraft` state)
- **Edit mode:** Same modal used for editing existing tasks
- **Initial values:** Pre-populated from sidebar agent drag (`KanbanTaskInitialValues`)

### Mini Panel (Sidebar)
- **Component:** `KanbanMiniPanel`
- **Sections:** Collapsible TODO, In Progress (expanded by default), Done (with date groups)
- **Quick actions:** Add Task (opens Kanban + requests modal), Full Board (opens Kanban tab)
- **Task cards:** Compact cards with status indicator (working dot / ready dot / done check), title, last message preview, agent name, project name
- **Empty state:** Kanban icon + "No tasks yet" message

### Context Menu (Right-click)
- **Rendered via:** React Portal to `document.body` (escapes card stacking context)
- **Actions:** Edit, Open Terminal (in_progress tasks, uses worktreePath if available), Delete
- **Dismissal:** Click outside or another right-click

### Reopen Done Task Dialog
- **Trigger:** Clicking a Done task card
- **Dialog:** Custom overlay with "Reopen Task?" message
- **Action:** Moves task to `in_progress`, opens session, exits Kanban view
- **Cancel:** Closes dialog, no state change

### Task Lifecycle
1. **Create** -> TODO (via AddKanbanTaskModal)
2. **Start** -> In Progress (Start button sends initial prompt, opens session)
3. **Working** -> Agent streams response (progress bar visible)
4. **Ready/Human Review** -> Agent finished or awaiting input
5. **Done** -> Task completed (grouped by date, paginated)
6. **Reopen** -> Done task moved back to In Progress (confirmation required)

### Sessions-First Architecture
- Tasks are NOT stored in kanbanStore — `sessionStore` is the source of truth
- `kanbanStore.getTasksByStatus()` reads from sessionStore via `sessionToKanbanTask()` adapter
- `agentInfoMap` syncs terminal metadata (name, avatar, color) for proper card rendering
- `kanbanWriteLock` prevents race conditions between local writes and file watcher reloads (500ms debounce)

### External Dependencies
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop
- `@tauri-apps/plugin-dialog` — native confirm dialog (task deletion, clear done)
- `@tauri-apps/api/core` — `convertFileSrc` for avatar images
- `@tauri-apps/plugin-shell` — `open` for documentation files
- `sonner` — toast notifications
- `lucide-react` — `FileText` icon for documentation badge

### Config
- Pointer activation distance: 8px
- Done column infinite scroll: 0.1 threshold, 100px root margin
- Write lock debounce: 500ms
- Card title truncation: 80 chars
- Prompt preview truncation: 60 chars
- Max image attachments displayed: 3 thumbnails + overflow count

### UI Language
- All user-facing strings in English (international audience)
