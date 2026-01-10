import { useState, useMemo, useEffect, useRef, memo, type MouseEvent } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { isCustomAvatar, getCustomAvatarUrl } from '../utils/customAvatarStorage';
import { useKanbanStore } from '../stores/kanbanStore';
import type { KanbanTask, ChatMessage } from '../types';

interface TasksSidebarSectionProps {
  // All active tasks (todo + in_progress)
  tasks: KanbanTask[];
  // Currently active task ID
  activeTaskId: string | null;
  // Callback to open task chat
  onOpenTaskTab: (task: KanbanTask) => void;
  // Chat sessions for task status
  chatSessions?: Map<string, ChatMessage[]>;
  // Loading state per task
  chatLoadingMap?: Map<string, boolean>;
  // Current project path to filter tasks
  currentProjectPath?: string;
}

/**
 * TaskItem - Individual task row with async avatar loading
 */
interface TaskItemProps {
  task: KanbanTask;
  isSelected: boolean;
  statusColor: string;
  agentColor: string;
  isWaitingForInput: boolean; // Green status = waiting for user input
  onClick: () => void;
  onContextMenu: (event: MouseEvent) => void;
}

const TaskItem = memo(function TaskItem({ task, isSelected, statusColor, agentColor, isWaitingForInput, onClick, onContextMenu }: TaskItemProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const avatarName = task.assignedAgent?.avatar;

  // Load avatar URL (async for custom avatars)
  useEffect(() => {
    let isMounted = true;

    const loadAvatar = async () => {
      if (!avatarName) {
        setAvatarUrl(null);
        return;
      }

      // Check if it's a custom avatar (UUID format)
      if (isCustomAvatar(avatarName)) {
        try {
          const url = await getCustomAvatarUrl(avatarName);
          if (isMounted) {
            setAvatarUrl(url);
          }
        } catch (error) {
          console.error('[TaskItem] Failed to load custom avatar:', error);
          if (isMounted) {
            setAvatarUrl(null); // Fallback to letter
          }
        }
      } else {
        // Regular avatar from new-avatars folder
        const url = window.__TAURI__
          ? convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, 'asset')
          : `/images/ducks/new-avatars/${avatarName}`;
        if (isMounted) {
          setAvatarUrl(url);
        }
      }
    };

    loadAvatar();

    return () => {
      isMounted = false;
    };
  }, [avatarName]);

  return (
    <div
      className="task-item"
      onClick={onClick}
      onContextMenu={onContextMenu}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        paddingRight: isWaitingForInput ? '20px' : '10px', // Extra space for quack indicator
        marginBottom: '4px',
        marginLeft: '8px',
        marginRight: isWaitingForInput ? '8px' : '0', // Extra margin when showing quack
        background: isSelected ? `${agentColor}35` : `${agentColor}15`,
        border: isSelected
          ? `2px solid ${agentColor}`
          : `1px solid ${agentColor}33`,
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        color: isSelected ? 'rgba(255, 255, 255, 1)' : 'rgba(255, 255, 255, 0.85)',
        transition: 'all 0.2s ease',
        boxShadow: isSelected ? `0 0 8px ${agentColor}55` : 'none',
        position: 'relative', // For absolute positioning of quack indicator
        overflow: 'visible', // Allow quack to overflow
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = `${agentColor}25`;
          e.currentTarget.style.borderColor = `${agentColor}55`;
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.background = `${agentColor}15`;
          e.currentTarget.style.borderColor = `${agentColor}33`;
        }
      }}
    >
      {/* Mini Avatar */}
      <div
        style={{
          width: '20px',
          height: '20px',
          borderRadius: '4px',
          border: `1.5px solid ${agentColor}66`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          overflow: 'hidden',
          background: avatarUrl ? 'transparent' : `linear-gradient(135deg, ${agentColor}40, ${agentColor}20)`,
        }}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={task.assignedAgent?.name || 'Task'}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
            }}
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              // Fallback to default avatar
              if (window.__TAURI__) {
                target.src = convertFileSrc('/images/ducks/new-avatars/duck15.jpeg', 'asset');
              } else {
                target.src = '/images/ducks/new-avatars/duck15.jpeg';
              }
            }}
          />
        ) : (
          // Letter fallback
          <span
            style={{
              fontSize: '10px',
              fontWeight: 700,
              color: agentColor,
            }}
          >
            {(task.assignedAgent?.name || task.title).charAt(0).toUpperCase()}
          </span>
        )}
      </div>

      {/* Task Title */}
      <span
        style={{
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.title.length > 35 ? task.title.substring(0, 35) + '...' : task.title}
      </span>

      {/* Status Indicator */}
      <div
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: statusColor,
          boxShadow: `0 0 6px ${statusColor}`,
          animation: statusColor === '#f59e0b' ? 'pulse 2s ease-in-out infinite' : 'none',
          flexShrink: 0,
        }}
      />

      {/* Quack Quack Indicator - shows when task is waiting for input */}
      {isWaitingForInput && (
        <div
          style={{
            position: 'absolute',
            right: '-12px',
            top: '50%',
            transform: 'translateY(-50%)',
            zIndex: 100,
            pointerEvents: 'none', // Allow clicks to pass through
          }}
        >
          <span
            style={{
              fontSize: '16px',
              animation: 'quackBounce 1s ease-in-out infinite',
              display: 'block',
            }}
          >
            💬
          </span>
        </div>
      )}
    </div>
  );
});

/**
 * Calculate status color based on task state
 */
function getTaskStatusColor(
  task: KanbanTask,
  messages: ChatMessage[],
  isLoading: boolean
): string {
  const taskType = task.type || 'agent';
  const isAgentTask = taskType === 'agent';
  const hasMessages = messages.length > 0;
  const hasUserMessage = messages.some(msg => msg.role === 'user');
  const isDormant = !hasUserMessage;

  const isTodo = task.status === 'todo';
  const isCold = isAgentTask && !hasMessages && !isTodo;
  const isReady = isAgentTask && task.status === 'in_progress' && hasMessages && !isLoading && !isDormant;

  // Status colors:
  // Gray (#6b7280) - TODO (not started)
  // Blue (#3b82f6) - Cold (in_progress but no messages)
  // Green (#22c55e) - Ready (waiting for input)
  // Orange (#f59e0b) - Working (loading/processing)
  if (isTodo) return '#6b7280';
  if (isCold) return '#3b82f6';
  if (isReady) return '#22c55e';
  return '#f59e0b';
}

/**
 * Task Context Menu Component
 */
interface TaskContextMenuProps {
  position: { x: number; y: number };
  task: KanbanTask;
  onClose: () => void;
  onMarkDone: () => void;
}

function TaskContextMenu({ position, task, onClose, onMarkDone }: TaskContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: globalThis.MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
      }}
    >
      <button
        type="button"
        className="context-menu-item"
        onClick={() => {
          onMarkDone();
          onClose();
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ marginRight: '8px', opacity: 0.7 }}
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <span>Mark as Done</span>
      </button>
    </div>
  );
}

/**
 * Tasks Sidebar Section
 *
 * Shows all active tasks (todo + in_progress) independently from agents.
 * Each task displays: mini avatar + title + status indicator.
 */
function TasksSidebarSection({
  tasks,
  activeTaskId,
  onOpenTaskTab,
  chatSessions,
  chatLoadingMap,
  currentProjectPath,
}: TasksSidebarSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    position: { x: number; y: number };
    task: KanbanTask;
  } | null>(null);

  const moveTask = useKanbanStore((state) => state.moveTask);

  // Context menu handlers
  const handleContextMenu = (event: MouseEvent, task: KanbanTask) => {
    event.preventDefault();
    event.stopPropagation();
    setContextMenu({
      position: { x: event.clientX, y: event.clientY },
      task,
    });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleMarkDone = async (task: KanbanTask) => {
    await moveTask(task.id, 'done');
  };

  // Filter and sort tasks: only active (not done), in_progress first
  // Show ALL active tasks regardless of project (users can see all their work)
  const activeTasks = useMemo(() => {
    const filtered = tasks.filter(task => {
      // Only show todo + in_progress (not done)
      if (task.status === 'done') return false;
      return true; // Show all active tasks, regardless of project
    });

    // Sort: in_progress tasks first, then todo
    const sorted = [...filtered].sort((a, b) => {
      if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
      if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
      return 0;
    });

    return sorted;
  }, [tasks, currentProjectPath]);

  // Don't render section if no active tasks
  if (activeTasks.length === 0) {
    return null;
  }

  return (
    <div className="tasks-sidebar-section" style={{ marginTop: '16px', marginLeft: '32px' }}>
      {/* Section Header */}
      <div
        className="explorer-root-label"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          paddingRight: '12px',
        }}
        onClick={() => setIsCollapsed(!isCollapsed)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* Collapse arrow */}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              opacity: 0.6,
              transition: 'transform 0.2s ease',
              transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
            }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
          <span>TASKS</span>
        </div>

        {/* Task count badge */}
        <span
          style={{
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '8px',
            backgroundColor: 'rgba(139, 92, 246, 0.2)',
            color: '#8b5cf6',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            fontWeight: 600,
          }}
        >
          {activeTasks.length}
        </span>
      </div>

      {/* Task List */}
      {!isCollapsed && (
        <div className="tasks-list" style={{ marginTop: '8px', paddingLeft: '4px' }}>
          {activeTasks.map(task => {
            const isSelected = activeTaskId === task.id;
            const messages = chatSessions?.get(task.id) || [];
            const isLoading = chatLoadingMap?.get(task.id) || false;
            const statusColor = getTaskStatusColor(task, messages, isLoading);
            const agentColor = task.assignedAgent?.color || '#8b5cf6';
            // Task is waiting for input when status is green (#22c55e)
            const isWaitingForInput = statusColor === '#22c55e';

            return (
              <TaskItem
                key={task.id}
                task={task}
                isSelected={isSelected}
                statusColor={statusColor}
                agentColor={agentColor}
                isWaitingForInput={isWaitingForInput}
                onClick={() => onOpenTaskTab(task)}
                onContextMenu={(e) => handleContextMenu(e, task)}
              />
            );
          })}
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <TaskContextMenu
          position={contextMenu.position}
          task={contextMenu.task}
          onClose={closeContextMenu}
          onMarkDone={() => handleMarkDone(contextMenu.task)}
        />
      )}
    </div>
  );
}

/**
 * Custom comparison function for memo
 * Only re-render when relevant props change
 */
function arePropsEqual(
  prevProps: TasksSidebarSectionProps,
  nextProps: TasksSidebarSectionProps
): boolean {
  // Check activeTaskId
  if (prevProps.activeTaskId !== nextProps.activeTaskId) {
    return false;
  }

  // Check currentProjectPath
  if (prevProps.currentProjectPath !== nextProps.currentProjectPath) {
    return false;
  }

  // Check tasks array (by reference first, then length and IDs)
  if (prevProps.tasks === nextProps.tasks) {
    // Same reference, check chatLoadingMap for active tasks only
    const prevTaskIds = prevProps.tasks.map(t => t.id);
    const prevLoading = prevTaskIds.map(id => prevProps.chatLoadingMap?.get(id) ?? false);
    const nextLoading = prevTaskIds.map(id => nextProps.chatLoadingMap?.get(id) ?? false);

    if (prevLoading.some((loading, i) => loading !== nextLoading[i])) {
      return false;
    }

    return true; // No changes
  }

  // Different reference, check length and task IDs
  if (prevProps.tasks.length !== nextProps.tasks.length) {
    return false;
  }

  // Check if task IDs and statuses are the same
  const prevTaskData = prevProps.tasks.map(t => ({ id: t.id, status: t.status, title: t.title }));
  const nextTaskData = nextProps.tasks.map(t => ({ id: t.id, status: t.status, title: t.title }));

  for (let i = 0; i < prevTaskData.length; i++) {
    if (
      prevTaskData[i].id !== nextTaskData[i].id ||
      prevTaskData[i].status !== nextTaskData[i].status ||
      prevTaskData[i].title !== nextTaskData[i].title
    ) {
      return false;
    }
  }

  // Check chatLoadingMap for relevant task IDs
  const taskIds = prevProps.tasks.map(t => t.id);
  const prevLoading = taskIds.map(id => prevProps.chatLoadingMap?.get(id) ?? false);
  const nextLoading = taskIds.map(id => nextProps.chatLoadingMap?.get(id) ?? false);

  if (prevLoading.some((loading, i) => loading !== nextLoading[i])) {
    return false;
  }

  // All checks passed - props are equal
  return true;
}

export default memo(TasksSidebarSection, arePropsEqual);
