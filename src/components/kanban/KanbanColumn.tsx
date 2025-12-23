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
import type { KanbanTask, KanbanStatus, ChatMessage } from '../../types';

interface KanbanColumnProps {
  id: KanbanStatus;
  title: string;
  icon: React.ReactNode;
  tasks: KanbanTask[];
  selectedTaskId: string | null;
  onTaskClick: (task: KanbanTask) => void;
  onTaskDelete: (taskId: string) => void;
  onTaskEdit?: (task: KanbanTask) => void;
  // Chat state for activity indicators
  chatLoadingMap?: Map<string, boolean>;
  chatSessions?: Map<string, ChatMessage[]>;
  // Drop target from parent (more reliable than internal isOver)
  isDropTarget?: boolean;
}

export default function KanbanColumn({
  id,
  title,
  icon,
  tasks,
  selectedTaskId,
  onTaskClick,
  onTaskDelete,
  onTaskEdit,
  chatLoadingMap,
  chatSessions,
  isDropTarget = false,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'column',
      status: id,
    },
  });

  // Use parent-provided isDropTarget OR internal isOver for highlighting
  const showDropHighlight = isDropTarget || isOver;

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
      className={`kanban-column ${showDropHighlight ? 'drop-target' : ''}`}
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
            tasks.map((task) => {
              // Get chat state for this task
              const isLoading = chatLoadingMap?.get(task.id) || false;
              const messages = chatSessions?.get(task.id) || [];
              const hasMessages = messages.length > 0;
              const hasUserMessage = messages.some(msg => msg.role === 'user');
              const isDormant = !hasUserMessage;

              return (
                <KanbanCard
                  key={task.id}
                  task={task}
                  isSelected={task.id === selectedTaskId}
                  isLoading={isLoading}
                  hasMessages={hasMessages}
                  isDormant={isDormant}
                  onClick={() => onTaskClick(task)}
                  onDelete={() => onTaskDelete(task.id)}
                  onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
                />
              );
            })
          )}
        </SortableContext>
      </div>
    </div>
  );
}
