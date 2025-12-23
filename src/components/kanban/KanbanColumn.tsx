/**
 * KanbanColumn Component
 *
 * A droppable column in the Kanban board.
 * Contains a list of KanbanCards and handles drop events.
 *
 * Uses @dnd-kit/core for drop functionality.
 */

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';
import type { KanbanTask, KanbanStatus } from '../../types';

interface KanbanColumnProps {
  id: KanbanStatus;
  title: string;
  icon: React.ReactNode;
  tasks: KanbanTask[];
  selectedTaskId: string | null;
  onTaskClick: (task: KanbanTask) => void;
  onTaskDelete: (taskId: string) => void;
}

export default function KanbanColumn({
  id,
  title,
  icon,
  tasks,
  selectedTaskId,
  onTaskClick,
  onTaskDelete,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'column',
      status: id,
    },
  });

  // Get column color based on status
  const getColumnColor = () => {
    switch (id) {
      case 'todo':
        return 'var(--kanban-todo-color, #6b7280)';
      case 'in_progress':
        return 'var(--kanban-progress-color, #f59e0b)';
      case 'done':
        return 'var(--kanban-done-color, #22c55e)';
      default:
        return '#6b7280';
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={`kanban-column ${isOver ? 'drop-target' : ''}`}
    >
      {/* Column header */}
      <div className="kanban-column-header">
        <div className="kanban-column-title">
          <span className="kanban-column-icon" style={{ color: getColumnColor() }}>
            {icon}
          </span>
          <h3>{title}</h3>
          <span className="kanban-column-count">{tasks.length}</span>
        </div>
      </div>

      {/* Cards container */}
      <div className="kanban-column-content">
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.length === 0 ? (
            <div className="kanban-column-empty">
              {id === 'todo' && 'No tasks yet. Create one!'}
              {id === 'in_progress' && 'Drag tasks here to start working'}
              {id === 'done' && 'Completed tasks will appear here'}
            </div>
          ) : (
            tasks.map((task) => (
              <KanbanCard
                key={task.id}
                task={task}
                isSelected={task.id === selectedTaskId}
                onClick={() => onTaskClick(task)}
                onDelete={() => onTaskDelete(task.id)}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}
