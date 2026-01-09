import { useState, useMemo, useEffect } from 'react';
import { convertFileSrc } from '@tauri-apps/api/core';
import { isCustomAvatar, getCustomAvatarUrl } from '../utils/customAvatarStorage';
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
  onClick: () => void;
}

function TaskItem({ task, isSelected, statusColor, agentColor, onClick }: TaskItemProps) {
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
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '6px 10px',
        marginBottom: '4px',
        marginLeft: '8px',
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
    </div>
  );
}

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
 * Tasks Sidebar Section
 *
 * Shows all active tasks (todo + in_progress) independently from agents.
 * Each task displays: mini avatar + title + status indicator.
 */
export default function TasksSidebarSection({
  tasks,
  activeTaskId,
  onOpenTaskTab,
  chatSessions,
  chatLoadingMap,
  currentProjectPath,
}: TasksSidebarSectionProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  // Filter tasks: only active (not done)
  // Show ALL active tasks regardless of project (users can see all their work)
  const activeTasks = useMemo(() => {
    console.log('[TasksSidebarSection] All tasks:', tasks.length, 'currentProjectPath:', currentProjectPath);
    const filtered = tasks.filter(task => {
      // Only show todo + in_progress (not done)
      if (task.status === 'done') return false;
      return true; // Show all active tasks, regardless of project
    });
    console.log('[TasksSidebarSection] Active tasks after filter:', filtered.length);
    return filtered;
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

            return (
              <TaskItem
                key={task.id}
                task={task}
                isSelected={isSelected}
                statusColor={statusColor}
                agentColor={agentColor}
                onClick={() => onOpenTaskTab(task)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
