/**
 * KanbanCard Component
 *
 * A draggable card representing a task on the Kanban board.
 * Supports three task types:
 * - agent: Claude chat tasks (shows avatar, prompt preview)
 * - shell: Shell command tasks (shows terminal icon, command, exit code)
 * - watch: File watcher tasks (shows eye icon, patterns, last triggered)
 *
 * Uses @dnd-kit/sortable for drag-and-drop functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { convertFileSrc } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-shell';
import { FileText } from 'lucide-react';
import type { KanbanTask } from '../../types';
import { getCustomAvatarUrl, isCustomAvatar } from '../../utils/customAvatarStorage';
import { useAgentAvatar } from '../../hooks/useAgentAvatar';

// Task type colors
const TASK_TYPE_COLORS = {
  agent: null, // Uses agent color
  shell: '#22c55e', // Green
  watch: '#3b82f6', // Blue
};

interface KanbanCardProps {
  task: KanbanTask;
  isLoading?: boolean;        // Whether the chat is currently streaming (agent) or process running (shell)
  hasMessages?: boolean;      // Whether there are messages in the chat
  messageCount?: number;      // Number of messages in the chat
  isDormant?: boolean;        // No user interaction yet (chat empty)
  shellOutput?: string;       // Shell command output (in-memory, not persisted)
  processingDocumentation?: Set<string>; // Set of task IDs currently processing documentation
  onClick?: () => void;
  onDelete?: () => void | Promise<void>;
  onEdit?: () => void;
  onKill?: () => void;        // Kill running shell/watch process
  onStart?: () => void;       // Start task: move to in_progress, open chat, send prompt
  onProjectClick?: (projectPath: string) => void; // Click on project name to open side panel
  onOpenTerminal?: (path: string, label?: string) => void; // Open terminal in specified directory (for worktree)
}

// Helper function to get avatar image URL
function getAvatarUrl(avatarName: string): string {
  if (window.__TAURI__) {
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, 'asset');
  }
  return `/images/ducks/new-avatars/${avatarName}`;
}

/**
 * MiniAgentAvatar - Small circular avatar for task headers
 */
interface MiniAgentAvatarProps {
  agentName: string;
  avatarFilename?: string;
  agentColor?: string;
}

function MiniAgentAvatar({ agentName, avatarFilename, agentColor }: MiniAgentAvatarProps) {
  const avatarUrl = useAgentAvatar(agentName, avatarFilename);

  return (
    <div className="kanban-mini-avatar" style={{ borderColor: agentColor || '#6b7280' }}>
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt={agentName}
          className="kanban-mini-avatar-img"
        />
      ) : (
        <div
          className="kanban-mini-avatar-placeholder"
          style={{ backgroundColor: agentColor || '#6b7280' }}
        >
          {agentName.charAt(0).toUpperCase()}
        </div>
      )}
    </div>
  );
}

export default function KanbanCard({
  task,
  isLoading = false,
  hasMessages = false,
  messageCount = 0,
  isDormant = true,
  shellOutput,
  processingDocumentation,
  onClick,
  onDelete,
  onEdit,
  onKill,
  onStart,
  onProjectClick,
  onOpenTerminal,
}: KanbanCardProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
  });

  // Load avatar URL
  useEffect(() => {
    async function loadAvatar() {
      const avatar = task.assignedAgent?.avatar;
      if (!avatar) {
        setAvatarUrl(getAvatarUrl('duck15.jpeg'));
        return;
      }

      if (isCustomAvatar(avatar)) {
        try {
          const url = await getCustomAvatarUrl(avatar);
          setAvatarUrl(url);
        } catch (err) {
          console.error('Failed to load custom avatar:', err);
          setAvatarUrl(getAvatarUrl('duck15.jpeg'));
        }
      } else {
        setAvatarUrl(getAvatarUrl(avatar));
      }
    }

    loadAvatar();
  }, [task.assignedAgent?.avatar]);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setShowContextMenu(true);
  }, []);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      if (showContextMenu) {
        setShowContextMenu(false);
      }
    };

    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('contextmenu', handleClickOutside);
    }

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('contextmenu', handleClickOutside);
    };
  }, [showContextMenu]);

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Get task type (default to 'agent' for backwards compatibility)
  const taskType = task.type || 'agent';
  const isShellTask = taskType === 'shell';
  const isWatchTask = taskType === 'watch';
  const isAgentTask = taskType === 'agent';

  // Get the accent color based on task type
  const accentColor = isShellTask
    ? TASK_TYPE_COLORS.shell
    : isWatchTask
      ? TASK_TYPE_COLORS.watch
      : (task.assignedAgent?.color || '#6b7280');

  // Truncate title if too long (increased limit for better readability)
  const displayTitle = task.title.length > 80
    ? task.title.substring(0, 80) + '...'
    : task.title;

  // Truncate prompt/command preview
  const previewText = isShellTask || isWatchTask
    ? (task.command || task.watchCommand || '')
    : task.prompt;
  const promptPreview = previewText.length > 60
    ? previewText.substring(0, 60) + '...'
    : previewText;

  // Get last 3 lines of shell output for preview
  const getShellOutputPreview = () => {
    if (!shellOutput) return null;
    const lines = shellOutput.trim().split('\n');
    return lines.slice(-3).join('\n');
  };

  // Format relative time for watch tasks
  const getLastTriggeredText = () => {
    if (!task.lastTriggered) return null;
    const diff = Date.now() - task.lastTriggered;
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  // Determine if task is ready (finished working, has messages, not loading)
  const isReady = isAgentTask &&
    task.status === 'in_progress' &&
    hasMessages &&
    !isLoading &&
    !isDormant;

  // Handle opening documentation
  const handleOpenDoc = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (task.docFilePath) {
      try {
        await open(task.docFilePath);
      } catch (err) {
        console.error('Failed to open documentation:', err);
      }
    }
  }, [task.docFilePath]);

  // Check if documentation is being processed
  const isProcessingDoc = processingDocumentation?.has(task.id) ?? false;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card ${isDragging ? 'dragging' : ''}`}
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      {/* Color accent bar */}
      <div
        className="kanban-card-accent"
        style={{ backgroundColor: accentColor }}
      />

      {/* Card content - MINIMAL DESIGN */}
      <div className="kanban-card-content">
        {/* Row 1: Agent + Actions */}
        <div className="kanban-card-header">
          {/* Left: Agent avatar + name */}
          {task.assignedAgent && (
            <div className="kanban-card-agent-info">
              <MiniAgentAvatar
                agentName={task.assignedAgent.name}
                avatarFilename={task.assignedAgent.avatar}
                agentColor={task.assignedAgent.color}
              />
              <span className="kanban-card-agent-name" style={{ color: accentColor }}>
                {task.assignedAgent.name}
              </span>
            </div>
          )}
          {/* Shell/Watch badge */}
          {!isAgentTask && (
            <span className="kanban-task-type-badge" style={{ backgroundColor: accentColor }}>
              {isShellTask ? 'SHELL' : 'WATCH'}
            </span>
          )}
          {/* Right: Actions */}
          <div className="kanban-card-actions">
            {isAgentTask && task.status === 'todo' && onStart && (
              <button className="kanban-card-start" onClick={(e) => { e.stopPropagation(); onStart(); }} title="Start">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </button>
            )}
            {(task.docFilePath || isProcessingDoc) && (
              <button className="kanban-doc-badge" onClick={handleOpenDoc} disabled={isProcessingDoc} title="Docs">
                <FileText size={12} />
              </button>
            )}
            {(isShellTask || isWatchTask) && task.status === 'in_progress' && task.pid && onKill && (
              <button className="kanban-card-kill" onClick={(e) => { e.stopPropagation(); onKill(); }} title="Kill">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /></svg>
              </button>
            )}
            {onDelete && (
              <button className="kanban-card-delete" onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Delete">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Session/Task title (on its own line) */}
        <h4 className="kanban-card-title">{displayTitle}</h4>

        {/* Row 2: Project name (small, colored) */}
        <div 
          className="kanban-card-project-row"
          onClick={(e) => { e.stopPropagation(); onProjectClick?.(task.projectPath); }}
          title={task.projectPath}
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={accentColor} strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span style={{ color: accentColor }}>{task.projectName}</span>
        </div>

        {/* Progress bar */}
        {task.status === 'in_progress' && isLoading && (
          <div className="kanban-progress-bar"><div className="kanban-progress-indicator" /></div>
        )}

        {/* Shell output preview (last 3 lines) */}
        {isShellTask && shellOutput && (
          <div className="kanban-card-shell-output">
            <pre>{getShellOutputPreview()}</pre>
          </div>
        )}

        {/* Watch task info */}
        {isWatchTask && (
          <div className="kanban-card-watch-info">
            {task.watchPatterns && task.watchPatterns.length > 0 && (
              <div className="kanban-card-watch-patterns">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
                <span>{task.watchPatterns.slice(0, 2).join(', ')}{task.watchPatterns.length > 2 ? '...' : ''}</span>
              </div>
            )}
            {task.lastTriggered && (
              <div className="kanban-card-watch-triggered">
                Last: {getLastTriggeredText()}
              </div>
            )}
          </div>
        )}

        {/* Shell task exit code */}
        {isShellTask && task.status === 'done' && task.exitCode !== undefined && (
          <div className={`kanban-card-exit-code ${task.exitCode === 0 ? 'success' : 'error'}`}>
            Exit: {task.exitCode}
          </div>
        )}

        {/* Image attachments preview (show first 3 images as thumbnails) */}
        {task.attachments && task.attachments.length > 0 && (
          <div className="kanban-card-attachments">
            {task.attachments
              .filter(att => att.mimeType?.startsWith('image/'))
              .slice(0, 3)
              .map((attachment) => (
                <div key={attachment.id} className="kanban-card-attachment-thumb">
                  {attachment.previewUrl ? (
                    <img
                      src={attachment.previewUrl}
                      alt={attachment.name}
                      className="kanban-card-attachment-img"
                    />
                  ) : (
                    <div className="kanban-card-attachment-placeholder">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <polyline points="21 15 16 10 5 21" />
                      </svg>
                    </div>
                  )}
                </div>
              ))}
            {task.attachments.filter(att => att.mimeType?.startsWith('image/')).length > 3 && (
              <div className="kanban-card-attachment-more">
                +{task.attachments.filter(att => att.mimeType?.startsWith('image/')).length - 3}
              </div>
            )}
          </div>
        )}

        {/* Ready indicator - shows when agent finished and awaiting review */}
        {isAgentTask && isReady && (
          <div className="kanban-card-ready-row">
            <span className="kanban-ready-badge">
              <span className="kanban-ready-dot" />
              Ready
            </span>
          </div>
        )}


        {/* Footer: message count/session for agents, PID for shell/watch */}
        <div className="kanban-card-footer">
          {/* Agent task footer */}
          {isAgentTask && (
            <>
              {messageCount > 0 && (
                <div className="kanban-card-messages" title={`${messageCount} messages in conversation`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{messageCount}</span>
                </div>
              )}
              {task.sessionId && (
                <div
                  className="kanban-card-session"
                  title={`Session: ${task.sessionId}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(task.sessionId!);
                  }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                  </svg>
                  <span>{task.sessionId.slice(0, 8)}...</span>
                </div>
              )}
            </>
          )}
          {/* Shell/Watch task footer */}
          {(isShellTask || isWatchTask) && (
            <>
              {task.pid && task.status === 'in_progress' && (
                <div className="kanban-card-pid" title={`Process ID: ${task.pid}`}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  <span>PID: {task.pid}</span>
                </div>
              )}
              {isShellTask && task.status === 'done' && (
                <div className="kanban-card-duration">
                  {task.startedAt && task.completedAt && (
                    <span>{Math.round((task.completedAt - task.startedAt) / 1000)}s</span>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Context Menu - rendered via Portal to escape card's stacking context */}
      {showContextMenu && createPortal(
        <div
          className="kanban-context-menu"
          style={{
            position: 'fixed',
            left: contextMenuPos.x,
            top: contextMenuPos.y,
            zIndex: 99999,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {onEdit && (
            <button
              className="kanban-context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                onEdit();
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              Edit
            </button>
          )}
          {/* Open Terminal - available for tasks with worktree or any task in progress */}
          {onOpenTerminal && task.status === 'in_progress' && (
            <button
              className="kanban-context-menu-item"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                // Use worktreePath if available, otherwise projectPath
                const terminalPath = task.worktreePath || task.projectPath;
                const terminalLabel = task.worktreePath
                  ? `Worktree: ${task.title.slice(0, 20)}`
                  : task.projectName;
                onOpenTerminal(terminalPath, terminalLabel);
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
              </svg>
              {task.worktreePath ? 'Open Terminal in Worktree' : 'Open Terminal'}
            </button>
          )}
          {onDelete && (
            <button
              className="kanban-context-menu-item delete"
              onClick={(e) => {
                e.stopPropagation();
                setShowContextMenu(false);
                onDelete();
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
              </svg>
              Delete
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

/**
 * Simplified card for drag overlay (no interactivity)
 */
export function KanbanCardOverlay({ task }: { task: KanbanTask }) {
  const taskType = task.type || 'agent';
  const isShellTask = taskType === 'shell';
  const isWatchTask = taskType === 'watch';
  const isAgentTask = taskType === 'agent';

  const accentColor = isShellTask
    ? TASK_TYPE_COLORS.shell
    : isWatchTask
      ? TASK_TYPE_COLORS.watch
      : (task.assignedAgent?.color || '#6b7280');

  const displayTitle = task.title.length > 80
    ? task.title.substring(0, 80) + '...'
    : task.title;

  return (
    <div className="kanban-card dragging-overlay">
      <div
        className="kanban-card-accent"
        style={{ backgroundColor: accentColor }}
      />
      <div className="kanban-card-content">
        <div className="kanban-card-title-row">
          {/* Mini agent avatar for drag overlay */}
          {task.assignedAgent && (
            <MiniAgentAvatar
              agentName={task.assignedAgent.name}
              avatarFilename={task.assignedAgent.avatar}
              agentColor={task.assignedAgent.color}
            />
          )}
          {!isAgentTask && (
            <span
              className="kanban-task-type-badge"
              style={{ backgroundColor: accentColor }}
            >
              {isShellTask ? 'SHELL' : 'WATCH'}
            </span>
          )}
          <h4 className="kanban-card-title">{displayTitle}</h4>
        </div>
        <div className="kanban-card-project">
          <span>{task.projectName}</span>
        </div>
      </div>
    </div>
  );
}
