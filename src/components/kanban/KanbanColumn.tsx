/**
 * KanbanColumn Component
 *
 * A droppable column in the Kanban board.
 * Contains a list of KanbanCards and handles drop events.
 *
 * Uses @dnd-kit/core for drop functionality.
 */

import { useState, useCallback, useMemo, useRef, useEffect, type DragEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import KanbanCard from './KanbanCard';
import type { KanbanTask, KanbanStatus, ChatMessage } from '../../types';
import { groupTasksByCompletionDate, type DateGroup } from '../../utils/kanbanDateGrouping';

// Types for In Progress column grouping by status
type InProgressBucket = 'ready' | 'working' | 'cold';

interface TaskWithState {
  task: KanbanTask;
  isLoading: boolean;
  hasMessages: boolean;
  isDormant: boolean;
  shellState?: { output: string; isRunning: boolean };
}

interface InProgressGroup {
  bucket: InProgressBucket;
  label: string;
  tasks: TaskWithState[];
}

/**
 * Determine if an agent task is "cold" (never started, no messages at all)
 */
function isTaskCold(
  task: KanbanTask,
  hasMessages: boolean
): boolean {
  const isAgentTask = (task.type || 'agent') === 'agent';
  return isAgentTask && !hasMessages;
}

/**
 * Determine if an agent task is "ready" (finished working, awaiting review)
 */
function isTaskReady(
  task: KanbanTask,
  isLoading: boolean,
  hasMessages: boolean,
  isDormant: boolean
): boolean {
  const isAgentTask = (task.type || 'agent') === 'agent';
  return isAgentTask && hasMessages && !isLoading && !isDormant;
}

interface KanbanColumnProps {
  id: KanbanStatus;
  title: string;
  icon: React.ReactNode;
  tasks: KanbanTask[];
  onTaskClick: (task: KanbanTask) => void;
  onTaskDelete: (taskId: string) => void | Promise<void>;
  onTaskEdit?: (task: KanbanTask) => void;
  onTaskKill?: (taskId: string) => void; // Kill shell/watch process
  onTaskStart?: (task: KanbanTask) => void; // Start TODO task: move to in_progress, open chat, send prompt
  onProjectClick?: (projectPath: string) => void; // Click on project name to open side panel
  // Chat state for activity indicators
  chatLoadingMap?: Map<string, boolean>;
  chatSessions?: Map<string, ChatMessage[]>;
  // Shell task state
  shellOutputs?: Map<string, { output: string; isRunning: boolean }>;
  // Drop target from parent (more reliable than internal isOver)
  isDropTarget?: boolean;
  // Handler for agent drop from sidebar (native HTML5 drag-and-drop)
  onSidebarAgentDrop?: (agentId: string, targetColumn: KanbanStatus) => void;
  // Handler for clearing all tasks in Done column
  onClearAll?: () => void;
  // Infinite scroll props for Done column
  hasMore?: boolean;
  isLoadingMore?: boolean;
  onLoadMore?: () => void;
  totalCount?: number; // Total count of tasks (for showing "X of Y")
}

export default function KanbanColumn({
  id,
  title,
  icon,
  tasks,
  onTaskClick,
  onTaskDelete,
  onTaskEdit,
  onTaskKill,
  onTaskStart,
  onProjectClick,
  chatLoadingMap,
  chatSessions,
  shellOutputs,
  isDropTarget = false,
  onSidebarAgentDrop,
  onClearAll,
  hasMore = false,
  isLoadingMore = false,
  onLoadMore,
  totalCount,
}: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: {
      type: 'column',
      status: id,
    },
  });

  // Track native HTML5 drag-over state for sidebar agents
  const [isNativeDragOver, setIsNativeDragOver] = useState(false);

  // Intersection Observer for infinite scroll (Done column only)
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Only set up observer for Done column with hasMore and onLoadMore
    if (id !== 'done' || !hasMore || !onLoadMore) return;

    // Capture sentinel ref to avoid stale closure
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        // Check entry.isIntersecting - isLoadingMore checked via onLoadMore guard
        if (entry.isIntersecting) {
          onLoadMore();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '100px', // Trigger slightly before reaching the sentinel
      }
    );

    observer.observe(sentinel);

    return () => {
      observer.unobserve(sentinel);
      observer.disconnect();
    };
  }, [id, hasMore, onLoadMore]);

  // Use parent-provided isDropTarget OR internal isOver OR native drag for highlighting
  const showDropHighlight = isDropTarget || isOver || isNativeDragOver;

  // Group tasks by completion date for Done column
  const dateGroups: DateGroup[] = useMemo(() => {
    if (id === 'done' && tasks.length > 0) {
      return groupTasksByCompletionDate(tasks);
    }
    return [];
  }, [id, tasks]);

  // Group tasks by status for In Progress column (Ready vs Working vs Cold)
  const inProgressGroups: InProgressGroup[] = useMemo(() => {
    if (id !== 'in_progress' || tasks.length === 0) return [];

    const ready: TaskWithState[] = [];
    const working: TaskWithState[] = [];
    const cold: TaskWithState[] = [];

    tasks.forEach((task) => {
      const isLoading = chatLoadingMap?.get(task.id) || false;
      const messages = chatSessions?.get(task.id) || [];
      const hasMessages = messages.length > 0;
      const hasUserMessage = messages.some((msg) => msg.role === 'user');
      const isDormant = !hasUserMessage;
      const shellState = shellOutputs?.get(task.id);

      const taskWithState: TaskWithState = {
        task,
        isLoading,
        hasMessages,
        isDormant,
        shellState,
      };

      // Cold = never started (no messages at all)
      if (isTaskCold(task, hasMessages)) {
        cold.push(taskWithState);
      // Ready = finished working, awaiting review
      } else if (isTaskReady(task, isLoading, hasMessages, isDormant)) {
        ready.push(taskWithState);
      // Working = currently being worked on
      } else {
        working.push(taskWithState);
      }
    });

    const groups: InProgressGroup[] = [];
    // Ready tasks first (at the top)
    if (ready.length > 0) {
      groups.push({ bucket: 'ready', label: 'READY', tasks: ready });
    }
    // Working tasks in the middle
    if (working.length > 0) {
      groups.push({ bucket: 'working', label: 'WORKING', tasks: working });
    }
    // Cold tasks at the bottom (never started)
    if (cold.length > 0) {
      groups.push({ bucket: 'cold', label: 'COLD', tasks: cold });
    }

    return groups;
  }, [id, tasks, chatLoadingMap, chatSessions, shellOutputs]);

  // Native HTML5 drag handlers for sidebar agent drops
  const handleNativeDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Check if this is a sidebar agent drag
    const types = e.dataTransfer.types;
    if (types.includes('application/x-quack-agent')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      setIsNativeDragOver(true);
    }
  }, []);

  const handleNativeDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Only reset if leaving the column entirely (not just entering a child)
    const relatedTarget = e.relatedTarget as HTMLElement | null;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setIsNativeDragOver(false);
    }
  }, []);

  const handleNativeDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsNativeDragOver(false);

    const agentId = e.dataTransfer.getData('application/x-quack-agent');
    if (agentId && onSidebarAgentDrop) {
      onSidebarAgentDrop(agentId, id);
    }
  }, [id, onSidebarAgentDrop]);

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
      onDragOver={handleNativeDragOver}
      onDragLeave={handleNativeDragLeave}
      onDrop={handleNativeDrop}
    >
      {/* Column header */}
      <div className="kanban-column-header">
        <div className="kanban-column-title">
          <span className="kanban-column-icon" style={{ color: getColumnColor() }}>
            {icon}
          </span>
          <h3>{title}</h3>
          <span className="kanban-column-count">{tasks.length}</span>
          {/* Clear All button - only show in Done column when there are tasks */}
          {id === 'done' && tasks.length > 0 && onClearAll && (
            <button
              className="kanban-column-clear-all"
              onClick={(e) => {
                e.stopPropagation();
                onClearAll();
              }}
              title="Clear all completed tasks"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          )}
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
              {id === 'todo' && 'Drag an agent here or click Add Task'}
              {id === 'in_progress' && 'Drag tasks or agents here to start'}
              {id === 'done' && 'Completed tasks will appear here'}
            </div>
          ) : id === 'done' && dateGroups.length > 0 ? (
            // Render grouped tasks for Done column (by completion date)
            dateGroups.map((group) => (
              <div key={group.bucket} className="kanban-date-group">
                <div className="kanban-date-group-header">
                  <span className="kanban-date-group-label">{group.label}</span>
                  <span className="kanban-date-group-count">{group.tasks.length}</span>
                </div>
                {group.tasks.map((task) => {
                  const isLoading = chatLoadingMap?.get(task.id) || false;
                  const messages = chatSessions?.get(task.id) || [];
                  const hasMessages = messages.length > 0;
                  const hasUserMessage = messages.some(msg => msg.role === 'user');
                  const isDormant = !hasUserMessage;
                  const shellState = shellOutputs?.get(task.id);
                  const isShellRunning = shellState?.isRunning || false;
                  const shellOutput = shellState?.output || '';
                  const taskType = task.type || 'agent';
                  const isTaskLoading = taskType === 'agent' ? isLoading : isShellRunning;

                  return (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      isLoading={isTaskLoading}
                      hasMessages={hasMessages}
                      messageCount={messages.length}
                      isDormant={isDormant}
                      shellOutput={shellOutput}
                      onClick={() => onTaskClick(task)}
                      onDelete={() => onTaskDelete(task.id)}
                      onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
                      onKill={onTaskKill ? () => onTaskKill(task.id) : undefined}
                      onProjectClick={onProjectClick}
                    />
                  );
                })}
              </div>
            ))
          ) : id === 'in_progress' && inProgressGroups.length > 0 ? (
            // Render grouped tasks for In Progress column (Ready vs Working)
            inProgressGroups.map((group) => (
              <div
                key={group.bucket}
                className={`kanban-status-group kanban-status-group--${group.bucket}`}
              >
                <div className="kanban-status-group-header">
                  <span className={`kanban-status-indicator kanban-status-indicator--${group.bucket}`} />
                  <span className="kanban-status-group-label">{group.label}</span>
                  <span className="kanban-status-group-count">{group.tasks.length}</span>
                </div>
                {group.tasks.map(({ task, isLoading, hasMessages, isDormant, shellState }) => {
                  const messages = chatSessions?.get(task.id) || [];
                  const isShellRunning = shellState?.isRunning || false;
                  const shellOutput = shellState?.output || '';
                  const taskType = task.type || 'agent';
                  const isTaskLoading = taskType === 'agent' ? isLoading : isShellRunning;

                  return (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      isLoading={isTaskLoading}
                      hasMessages={hasMessages}
                      messageCount={messages.length}
                      isDormant={isDormant}
                      shellOutput={shellOutput}
                      onClick={() => onTaskClick(task)}
                      onDelete={() => onTaskDelete(task.id)}
                      onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
                      onKill={onTaskKill ? () => onTaskKill(task.id) : undefined}
                      onProjectClick={onProjectClick}
                    />
                  );
                })}
              </div>
            ))
          ) : (
            // Render flat list for TODO column
            tasks.map((task) => {
              // Get chat state for this task (agent tasks)
              const isLoading = chatLoadingMap?.get(task.id) || false;
              const messages = chatSessions?.get(task.id) || [];
              const hasMessages = messages.length > 0;
              const hasUserMessage = messages.some(msg => msg.role === 'user');
              const isDormant = !hasUserMessage;

              // Get shell state for this task (shell/watch tasks)
              const shellState = shellOutputs?.get(task.id);
              const isShellRunning = shellState?.isRunning || false;
              const shellOutput = shellState?.output || '';

              // Determine loading state based on task type
              const taskType = task.type || 'agent';
              const isTaskLoading = taskType === 'agent' ? isLoading : isShellRunning;

              return (
                <KanbanCard
                  key={task.id}
                  task={task}
                  isLoading={isTaskLoading}
                  hasMessages={hasMessages}
                  messageCount={messages.length}
                  isDormant={isDormant}
                  shellOutput={shellOutput}
                  onClick={() => onTaskClick(task)}
                  onDelete={() => onTaskDelete(task.id)}
                  onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
                  onKill={onTaskKill ? () => onTaskKill(task.id) : undefined}
                  onStart={onTaskStart ? () => onTaskStart(task) : undefined}
                  onProjectClick={onProjectClick}
                />
              );
            })
          )}
        </SortableContext>

        {/* Infinite scroll sentinel for Done column */}
        {id === 'done' && hasMore && (
          <div ref={sentinelRef} className="kanban-load-more-sentinel">
            {isLoadingMore ? (
              <div className="kanban-loading-spinner">
                <svg className="spinner" viewBox="0 0 24 24" width="20" height="20">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    fill="none"
                    strokeDasharray="31.4"
                    strokeDashoffset="10"
                  />
                </svg>
                <span>Loading more...</span>
              </div>
            ) : (
              <div className="kanban-load-more-hint">
                Scroll for more
              </div>
            )}
          </div>
        )}

        {/* Show count info when there are paginated results */}
        {id === 'done' && totalCount !== undefined && totalCount > tasks.length && (
          <div className="kanban-pagination-info">
            Showing {tasks.length} of {totalCount} tasks
          </div>
        )}
      </div>
    </div>
  );
}
