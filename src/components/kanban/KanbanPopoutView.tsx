/**
 * KanbanPopoutView Component
 *
 * Standalone Kanban board for popout windows.
 * Read-only view that displays tasks from the store.
 * Does not support chat or agent assignment (requires main app).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import KanbanColumn from './KanbanColumn';
import { KanbanCardOverlay } from './KanbanCard';
import { useKanbanStore } from '../../stores/kanbanStore';
import type { KanbanTask, KanbanStatus } from '../../types';
import { toast } from 'sonner';
import './KanbanView.css';

export default function KanbanPopoutView() {
  const {
    tasks,
    isLoading,
    loadTasks,
    moveTask,
    deleteTask,
  } = useKanbanStore();

  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);
  const [overColumnId, setOverColumnId] = useState<string | null>(null);

  // Filter tasks by status
  const todoTasks = tasks.filter((t) => t.status === 'todo');
  const inProgressTasks = tasks.filter((t) => t.status === 'in_progress');
  const doneTasks = tasks.filter((t) => t.status === 'done');

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Configure drag sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Custom collision detection
  const customCollisionDetection: CollisionDetection = useCallback((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }
    return rectIntersection(args);
  }, []);

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const task = tasks.find((t) => t.id === active.id);
    if (task) {
      setActiveTask(task);
    }
  };

  // Handle drag over
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (over && ['todo', 'in_progress', 'done'].includes(over.id as string)) {
      setOverColumnId(over.id as string);
    } else {
      setOverColumnId(null);
    }
  };

  // Handle drag end
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    setOverColumnId(null);

    if (!over) return;

    const taskId = active.id as string;
    const overId = over.id as string;

    if (['todo', 'in_progress', 'done'].includes(overId)) {
      const newStatus = overId as KanbanStatus;
      const task = tasks.find((t) => t.id === taskId);

      if (task && task.status !== newStatus) {
        moveTask(taskId, newStatus);
        toast.success(`Task moved to ${newStatus.replace('_', ' ')}`);
      }
    }
  };

  // Handle task click - show info toast since we can't open chat in popout
  const handleTaskClick = useCallback((task: KanbanTask) => {
    toast.info('Open the main app to chat with this task');
  }, []);

  // Handle task delete
  const handleTaskDelete = useCallback(async (taskId: string) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      await deleteTask(taskId);
      toast.success('Task deleted');
    }
  }, [deleteTask]);

  if (isLoading) {
    return (
      <div className="kanban-view" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.6)' }}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>Loading tasks...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="kanban-view">
      {/* Header */}
      <div className="kanban-header" data-tauri-drag-region>
        <h1 className="kanban-title" data-tauri-drag-region>Kanban Board</h1>
        <div style={{ flex: 1 }} data-tauri-drag-region />
        <span style={{
          color: 'rgba(255,255,255,0.5)',
          fontSize: '12px',
          padding: '4px 8px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '4px'
        }}>
          Popout Mode - Drag tasks to move
        </span>
      </div>

      {/* Kanban columns */}
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        <div className="kanban-columns">
          <KanbanColumn
            id="todo"
            title="TODO"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <line x1="9" y1="9" x2="15" y2="9" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            }
            tasks={todoTasks}
            selectedTaskId={null}
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            isDropTarget={overColumnId === 'todo'}
          />
          <KanbanColumn
            id="in_progress"
            title="In Progress"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
            }
            tasks={inProgressTasks}
            selectedTaskId={null}
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            isDropTarget={overColumnId === 'in_progress'}
          />
          <KanbanColumn
            id="done"
            title="Done"
            icon={
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            }
            tasks={doneTasks}
            selectedTaskId={null}
            onTaskClick={handleTaskClick}
            onTaskDelete={handleTaskDelete}
            isDropTarget={overColumnId === 'done'}
          />
        </div>

        {/* Drag overlay */}
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <KanbanCardOverlay task={activeTask} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}
