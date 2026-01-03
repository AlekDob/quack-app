/**
 * KanbanTasksBar - Persistent bar showing Kanban task counts
 *
 * Styled identically to EditSummaryBar but with orange theme.
 * Shows todo and in_progress task counts, clicking opens Kanban view.
 *
 * @module KanbanTasksBar
 */

import './KanbanTasksBar.css';

interface KanbanTasksBarProps {
  todoCount: number;
  inProgressCount: number;
  onOpenKanban: () => void;
}

export default function KanbanTasksBar({
  todoCount,
  inProgressCount,
  onOpenKanban,
}: KanbanTasksBarProps) {
  const totalCount = todoCount + inProgressCount;

  // Don't render if no tasks
  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="kanban-tasks-bar">
      <div
        className="kanban-tasks-bar-header"
        onClick={onOpenKanban}
      >
        <div className="kanban-tasks-bar-title">
          {/* Kanban board icon */}
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
            <line x1="15" y1="3" x2="15" y2="21" />
          </svg>
          <span className="kanban-tasks-bar-label">Kanban Tasks ({totalCount})</span>
          {todoCount > 0 && (
            <span className="kanban-tasks-bar-badge">{todoCount} todo</span>
          )}
          {inProgressCount > 0 && (
            <span className="kanban-tasks-bar-badge kanban-tasks-bar-badge-progress">
              {inProgressCount} in progress
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
