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
import { useKanbanStore } from '../../stores/kanbanStore';

// Types for Human Review column grouping
type HumanReviewBucket = 'awaiting_input' | 'ready';

interface TaskWithState {
  task: KanbanTask;
  isLoading: boolean;
  hasMessages: boolean;
  isDormant: boolean;
}

interface HumanReviewGroup {
  bucket: HumanReviewBucket;
  label: string;
  tasks: TaskWithState[];
}

interface KanbanColumnProps {
  id: KanbanStatus;
  title: string;
  icon: React.ReactNode;
  tasks: KanbanTask[];
  onTaskClick: (task: KanbanTask) => void;
  onTaskDelete: (taskId: string) => void | Promise<void>;
  onTaskEdit?: (task: KanbanTask) => void;
  onTaskStart?: (task: KanbanTask) => void; // Start TODO task: move to in_progress, open chat, send prompt
  onOpenTerminal?: (path: string, label?: string) => void; // Open terminal in specified directory (for worktree tasks)
  // Chat state for activity indicators
  chatLoadingMap?: Map<string, boolean>;
  chatSessions?: Map<string, ChatMessage[]>;
  // Pending questions state (for "Awaiting Input" badge)
  pendingQuestionsChecker?: (sessionId: string) => boolean;
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
  onTaskStart,
  onOpenTerminal,
  chatLoadingMap,
  chatSessions,
  pendingQuestionsChecker,
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

  // Track if THIS column is being hovered during sidebar drag
  const sidebarDragHoverColumn = useKanbanStore((s) => s.sidebarDragHoverColumn);
  const sidebarDragAgentInfo = useKanbanStore((s) => s.sidebarDragAgentInfo);
  const isSidebarDragHovered = sidebarDragHoverColumn === id;

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

  // Use parent-provided isDropTarget OR internal isOver OR native drag OR sidebar hover on this column
  const showDropHighlight = isDropTarget || isOver || isNativeDragOver || isSidebarDragHovered;

  // Group tasks by completion date for Done column
  const dateGroups: DateGroup[] = useMemo(() => {
    if (id === 'done' && tasks.length > 0) {
      return groupTasksByCompletionDate(tasks);
    }
    return [];
  }, [id, tasks]);

  // Group tasks for Human Review column (Awaiting Input vs Ready)
  const humanReviewGroups: HumanReviewGroup[] = useMemo(() => {
    if (id !== 'human_review' || tasks.length === 0) return [];

    const awaitingInput: TaskWithState[] = [];
    const ready: TaskWithState[] = [];

    tasks.forEach((task) => {
      const isLoading = chatLoadingMap?.get(task.id) || false;
      const messages = chatSessions?.get(task.id) || [];
      const hasMessages = messages.length > 0;
      const hasUserMessage = messages.some((msg) => msg.role === 'user');
      const isDormant = !hasUserMessage;

      const taskWithState: TaskWithState = { task, isLoading, hasMessages, isDormant };

      // Awaiting Input: SDK asked a question (AskUserQuestion/PlanApproval)
      if (pendingQuestionsChecker?.(task.id)) {
        awaitingInput.push(taskWithState);
      } else {
        // Ready: agent finished, no pending question
        ready.push(taskWithState);
      }
    });

    const groups: HumanReviewGroup[] = [];
    if (awaitingInput.length > 0) {
      groups.push({ bucket: 'awaiting_input', label: 'AWAITING INPUT', tasks: awaitingInput });
    }
    if (ready.length > 0) {
      groups.push({ bucket: 'ready', label: 'READY', tasks: ready });
    }

    return groups;
  }, [id, tasks, chatLoadingMap, chatSessions, pendingQuestionsChecker]);

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
    switch (id as string) {
      case 'todo':
        return 'var(--kanban-todo-color, #6b7280)';
      case 'in_progress':
        return 'var(--kanban-progress-color, #f59e0b)';
      case 'human_review':
        return 'var(--kanban-review-color, #a855f7)';
      case 'done':
        return 'var(--kanban-done-color, #22c55e)';
      default:
        return '#6b7280';
    }
  };

  return (
    <div
      ref={setNodeRef}
      data-column-id={id}
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
              {(id as string) === 'human_review' && 'Tasks waiting for your input will appear here'}
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
                  return (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      isLoading={isLoading}
                      hasMessages={hasMessages}
                      messageCount={messages.length}
                      isDormant={isDormant}
                      onClick={() => onTaskClick(task)}
                      onDelete={() => onTaskDelete(task.id)}
                      onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
                                            onOpenTerminal={onOpenTerminal}
                    />
                  );
                })}
              </div>
            ))
          ) : id === 'human_review' && humanReviewGroups.length > 0 ? (
            // Render grouped tasks for Human Review column (Awaiting Input vs Ready)
            humanReviewGroups.map((group) => (
              <div
                key={group.bucket}
                className={`kanban-status-group kanban-status-group--${group.bucket}`}
              >
                <div className="kanban-status-group-header">
                  <span className={`kanban-status-indicator kanban-status-indicator--${group.bucket}`} />
                  <span className="kanban-status-group-label">{group.label}</span>
                  <span className="kanban-status-group-count">{group.tasks.length}</span>
                </div>
                {group.tasks.map(({ task, isLoading, hasMessages, isDormant }) => {
                  const messages = chatSessions?.get(task.id) || [];

                  return (
                    <KanbanCard
                      key={task.id}
                      task={task}
                      isLoading={isLoading}
                      hasMessages={hasMessages}
                      messageCount={messages.length}
                      isDormant={isDormant}
                      hasPendingQuestion={pendingQuestionsChecker?.(task.id) ?? false}
                      onClick={() => onTaskClick(task)}
                      onDelete={() => onTaskDelete(task.id)}
                      onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
                                            onOpenTerminal={onOpenTerminal}
                    />
                  );
                })}
              </div>
            ))
          ) : (
            // Render flat list for TODO and Human Review columns
            tasks.map((task) => {
              const isLoading = chatLoadingMap?.get(task.id) || false;
              const messages = chatSessions?.get(task.id) || [];
              const hasMessages = messages.length > 0;
              const hasUserMessage = messages.some(msg => msg.role === 'user');
              const isDormant = !hasUserMessage;

              return (
                <KanbanCard
                  key={task.id}
                  task={task}
                  isLoading={isLoading}
                  hasMessages={hasMessages}
                  messageCount={messages.length}
                  isDormant={isDormant}
                  hasPendingQuestion={pendingQuestionsChecker?.(task.id) ?? false}
                  onClick={() => onTaskClick(task)}
                  onDelete={() => onTaskDelete(task.id)}
                  onEdit={onTaskEdit ? () => onTaskEdit(task) : undefined}
                  onStart={onTaskStart ? () => onTaskStart(task) : undefined}
                                    onOpenTerminal={onOpenTerminal}
                />
              );
            })
          )}
        </SortableContext>

        {/* Ghost card placeholder when dragging agent from sidebar */}
        {isSidebarDragHovered && sidebarDragAgentInfo && (
          <div
            className="kanban-ghost-card"
            style={{
              borderColor: sidebarDragAgentInfo.color,
              '--ghost-color': sidebarDragAgentInfo.color,
            } as React.CSSProperties}
          >
            <div className="kanban-ghost-card-dot" style={{ background: sidebarDragAgentInfo.color }} />
            <span className="kanban-ghost-card-name">{sidebarDragAgentInfo.name}</span>
            <span className="kanban-ghost-card-label">+ New Task</span>
          </div>
        )}

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
