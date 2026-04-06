/**
 * KanbanMiniPanel Component
 *
 * Compact Kanban view for the side panel.
 * Shows task counts per column and a scrollable list of "In Progress" tasks.
 * Clicking on a task opens a dedicated task tab for that task.
 *
 * @module KanbanMiniPanel
 */

import { useState, useCallback, useMemo } from 'react';
import { useKanbanStore } from '../../stores/kanbanStore';
import { groupTasksByCompletionDate } from '../../utils/kanbanDateGrouping';
import type { KanbanTask, KanbanStatus, ChatMessage } from '../../types';
import './KanbanMiniPanel.css';

interface KanbanMiniPanelProps {
  /** Chat loading map for showing Working/Ready status */
  chatLoadingMap: Map<string, boolean>;
  /** Chat sessions for showing last message preview */
  chatSessions: Map<string, ChatMessage[]>;
  /** Callback when user clicks on a task - opens task tab */
  onTaskClick: (taskId: string) => void;
  /** Callback to open Kanban tab */
  onOpenKanban: () => void;
}

/**
 * Collapsible section for a Kanban column
 */
interface ColumnSectionProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  tasks: KanbanTask[];
  isExpanded: boolean;
  onToggle: () => void;
  onTaskClick: (taskId: string) => void;
  chatLoadingMap: Map<string, boolean>;
  chatSessions: Map<string, ChatMessage[]>;
  showDateGroups?: boolean;
  accentColor?: string;
}

function ColumnSection({
  title,
  count,
  icon,
  tasks,
  isExpanded,
  onToggle,
  onTaskClick,
  chatLoadingMap,
  chatSessions,
  showDateGroups = false,
  accentColor,
}: ColumnSectionProps) {
  // Group tasks by date for Done column
  const groupedTasks = useMemo(() => {
    if (!showDateGroups) return null;
    return groupTasksByCompletionDate(tasks);
  }, [tasks, showDateGroups]);

  return (
    <div className="mini-panel-section">
      <button
        type="button"
        className="mini-panel-section-header"
        onClick={onToggle}
        aria-expanded={isExpanded}
      >
        <div className="mini-panel-section-left">
          <svg
            className={`mini-panel-chevron ${isExpanded ? 'expanded' : ''}`}
            width="12"
            height="12"
            viewBox="0 0 12 12"
            fill="none"
          >
            <path
              d="M4 2L8 6L4 10"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="mini-panel-section-icon" style={accentColor ? { color: accentColor } : undefined}>
            {icon}
          </span>
          <span className="mini-panel-section-title">{title}</span>
        </div>
        <span className="mini-panel-section-count" style={accentColor ? { backgroundColor: `${accentColor}20`, color: accentColor } : undefined}>
          {count}
        </span>
      </button>

      {isExpanded && count > 0 && (
        <div className="mini-panel-section-content">
          {showDateGroups && groupedTasks ? (
            // Render with date groups for Done column
            groupedTasks.map((group) => (
              group.tasks.length > 0 && (
                <div key={group.bucket} className="mini-panel-date-group">
                  <div className="mini-panel-date-header">
                    {group.label}
                    <span className="mini-panel-date-count">{group.tasks.length}</span>
                  </div>
                  {group.tasks.map((task) => (
                    <MiniTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => onTaskClick(task.id)}
                      isLoading={chatLoadingMap.get(task.id) || false}
                      lastMessage={getLastMessage(chatSessions.get(task.id))}
                    />
                  ))}
                </div>
              )
            ))
          ) : (
            // Render flat list for TODO and In Progress
            tasks.map((task) => (
              <MiniTaskCard
                key={task.id}
                task={task}
                onClick={() => onTaskClick(task.id)}
                isLoading={chatLoadingMap.get(task.id) || false}
                lastMessage={getLastMessage(chatSessions.get(task.id))}
              />
            ))
          )}
        </div>
      )}

      {isExpanded && count === 0 && (
        <div className="mini-panel-empty">No tasks</div>
      )}
    </div>
  );
}

/**
 * Compact task card for mini panel
 */
interface MiniTaskCardProps {
  task: KanbanTask;
  onClick: () => void;
  isLoading: boolean;
  lastMessage?: string;
}

function MiniTaskCard({ task, onClick, isLoading, lastMessage }: MiniTaskCardProps) {
  const statusIndicator = useMemo(() => {
    if (task.status === 'done') {
      return (
        <span className="mini-task-status done" title="Completed">
          <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
            <path d="M13.5 4.5L6 12L2.5 8.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      );
    }
    if (isLoading) {
      return <span className="mini-task-status working" title="Working" />;
    }
    return <span className="mini-task-status ready" title="Ready" />;
  }, [task.status, isLoading]);

  return (
    <button
      type="button"
      className="mini-task-card"
      onClick={onClick}
    >
      <div className="mini-task-header">
        {statusIndicator}
        <span className="mini-task-title">{task.title}</span>
      </div>
      {lastMessage && (
        <p className="mini-task-preview">{lastMessage}</p>
      )}
      <div className="mini-task-meta">
        {task.assignedAgent && (
          <span className="mini-task-agent">
            {task.assignedAgent.avatar || ''}
            <span>{task.assignedAgent.name}</span>
          </span>
        )}
        <span className="mini-task-project">{task.projectName}</span>
      </div>
    </button>
  );
}

/**
 * Get last message preview from chat session
 */
function getLastMessage(messages?: ChatMessage[]): string | undefined {
  if (!messages || messages.length === 0) return undefined;
  const lastAssistant = [...messages].reverse().find(m => m.role === 'assistant');
  if (!lastAssistant) return undefined;
  // Truncate to ~60 chars
  const content = lastAssistant.content || '';
  if (content.length <= 60) return content;
  return content.substring(0, 60) + '...';
}

/**
 * Quick action buttons for common operations
 */
interface QuickActionsProps {
  onAddTask: () => void;
  onOpenKanban: () => void;
}

function QuickActions({ onAddTask, onOpenKanban }: QuickActionsProps) {
  return (
    <div className="mini-panel-quick-actions">
      <button
        type="button"
        className="mini-panel-action-btn primary"
        onClick={onAddTask}
        title="Add new task (opens Kanban)"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        Add Task
      </button>
      <button
        type="button"
        className="mini-panel-action-btn secondary"
        onClick={onOpenKanban}
        title="Open full Kanban board"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="6" y="2" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
          <rect x="11" y="2" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
        </svg>
        Full Board
      </button>
    </div>
  );
}

export default function KanbanMiniPanel({
  chatLoadingMap,
  chatSessions,
  onTaskClick,
  onOpenKanban,
}: KanbanMiniPanelProps) {
  const { getAllTasks, requestNewTaskModal } = useKanbanStore();
  const tasks = getAllTasks();

  // Section expansion state - In Progress expanded by default, Done collapsed
  const [expandedSections, setExpandedSections] = useState<Record<KanbanStatus, boolean>>({
    todo: false,
    in_progress: true,
    done: false,
  });

  // Filter tasks by status
  const todoTasks = useMemo(() => tasks.filter((t: KanbanTask) => t.status === 'todo'), [tasks]);
  const inProgressTasks = useMemo(() => tasks.filter((t: KanbanTask) => t.status === 'in_progress'), [tasks]);
  const doneTasks = useMemo(() => tasks.filter((t: KanbanTask) => t.status === 'done'), [tasks]);

  // Toggle section expansion
  const toggleSection = useCallback((status: KanbanStatus) => {
    setExpandedSections(prev => ({
      ...prev,
      [status]: !prev[status],
    }));
  }, []);

  // Handle add task - open Kanban and request new task modal
  const handleAddTask = useCallback(() => {
    onOpenKanban();
    // Small delay to ensure Kanban is open before requesting modal
    setTimeout(() => {
      requestNewTaskModal();
    }, 100);
  }, [onOpenKanban, requestNewTaskModal]);

  // Handle task click - open Kanban tab first, then open task tab
  const handleTaskClick = useCallback((taskId: string) => {
    onOpenKanban();
    onTaskClick(taskId);
  }, [onOpenKanban, onTaskClick]);

  const totalTasks = tasks.length;

  return (
    <div className="kanban-mini-panel">
      {/* Header */}
      <div className="mini-panel-header">
        <div className="mini-panel-header-left">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="mini-panel-icon">
            <rect x="1" y="2" width="4" height="12" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="6" y="2" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
            <rect x="11" y="2" width="4" height="5" rx="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <h3 className="mini-panel-title">Tasks</h3>
        </div>
        <span className="mini-panel-total">{totalTasks}</span>
      </div>

      {/* Quick Actions */}
      <QuickActions onAddTask={handleAddTask} onOpenKanban={onOpenKanban} />

      {/* Sections */}
      <div className="mini-panel-sections">
        <ColumnSection
          title="TODO"
          count={todoTasks.length}
          icon={
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          }
          tasks={todoTasks}
          isExpanded={expandedSections.todo}
          onToggle={() => toggleSection('todo')}
          onTaskClick={handleTaskClick}
          chatLoadingMap={chatLoadingMap}
          chatSessions={chatSessions}
        />

        <ColumnSection
          title="In Progress"
          count={inProgressTasks.length}
          icon={
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M8 5V8L10 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          tasks={inProgressTasks}
          isExpanded={expandedSections.in_progress}
          onToggle={() => toggleSection('in_progress')}
          onTaskClick={handleTaskClick}
          chatLoadingMap={chatLoadingMap}
          chatSessions={chatSessions}
          accentColor="var(--accent-color)"
        />

        <ColumnSection
          title="Done"
          count={doneTasks.length}
          icon={
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.5" />
              <path d="M5.5 8L7 9.5L10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          }
          tasks={doneTasks}
          isExpanded={expandedSections.done}
          onToggle={() => toggleSection('done')}
          onTaskClick={handleTaskClick}
          chatLoadingMap={chatLoadingMap}
          chatSessions={chatSessions}
          showDateGroups={true}
          accentColor="#22c55e"
        />
      </div>

      {/* Empty state */}
      {totalTasks === 0 && (
        <div className="mini-panel-empty-state">
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none" opacity="0.4">
            <rect x="4" y="6" width="8" height="20" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <rect x="14" y="6" width="8" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <rect x="24" y="6" width="4" height="8" rx="1" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          <p>No tasks yet</p>
          <span>Create your first task to get started</span>
        </div>
      )}
    </div>
  );
}
