/**
 * KanbanCard Component
 *
 * A draggable card representing a task on the Kanban board.
 * Shows task title, project name, assigned agent avatar/name, and color accent.
 *
 * Uses @dnd-kit/sortable for drag-and-drop functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { KanbanTask } from '../../types';
import { getCustomAvatarUrl, isCustomAvatar } from '../../utils/customAvatarStorage';

interface KanbanCardProps {
  task: KanbanTask;
  isSelected?: boolean;
  isLoading?: boolean;        // Whether the chat is currently streaming
  hasMessages?: boolean;      // Whether there are messages in the chat
  isDormant?: boolean;        // No user interaction yet (chat empty)
  onClick?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
  onProjectClick?: (projectPath: string) => void; // Click on project name to open side panel
}

// Helper function to get avatar image URL
function getAvatarUrl(avatarName: string): string {
  if (window.__TAURI__) {
    return convertFileSrc(`/images/ducks/new-avatars/${avatarName}`, 'asset');
  }
  return `/images/ducks/new-avatars/${avatarName}`;
}

export default function KanbanCard({
  task,
  isSelected = false,
  isLoading = false,
  hasMessages = false,
  isDormant = true,
  onClick,
  onDelete,
  onEdit,
  onProjectClick,
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

  // Get the accent color from the assigned agent, or default
  const accentColor = task.assignedAgent?.color || '#6b7280';

  // Truncate title if too long
  const displayTitle = task.title.length > 40
    ? task.title.substring(0, 40) + '...'
    : task.title;

  // Truncate prompt preview
  const promptPreview = task.prompt.length > 60
    ? task.prompt.substring(0, 60) + '...'
    : task.prompt;

  // Determine status badge for in_progress tasks
  const getStatusBadge = () => {
    if (task.status !== 'in_progress') return null;
    if (isLoading) return '⚡'; // Busy/streaming
    if (isDormant || !hasMessages) return '💤'; // Dormant/no interaction
    return '💬'; // Has messages, waiting for response
  };

  const statusBadge = getStatusBadge();
  const badgeClassName = isLoading
    ? 'kanban-status-badge busy'
    : (isDormant || !hasMessages)
      ? 'kanban-status-badge sleeping'
      : 'kanban-status-badge waiting';

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
      onContextMenu={handleContextMenu}
    >
      {/* Color accent bar */}
      <div
        className="kanban-card-accent"
        style={{ backgroundColor: accentColor }}
      />

      {/* Card content */}
      <div className="kanban-card-content">
        {/* Header with title, status badge, and delete button */}
        <div className="kanban-card-header">
          <h4 className="kanban-card-title">
            {displayTitle}
            {statusBadge && (
              <span className={badgeClassName}>{statusBadge}</span>
            )}
          </h4>
          {onDelete && (
            <button
              className="kanban-card-delete"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              title="Delete task"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>

        {/* Progress bar when streaming/busy */}
        {task.status === 'in_progress' && isLoading && (
          <div className="kanban-progress-bar">
            <div className="kanban-progress-indicator" />
          </div>
        )}

        {/* Project info - clickable to open side panel */}
        <button
          type="button"
          className="kanban-card-project kanban-card-project-clickable"
          onClick={(e) => {
            e.stopPropagation();
            onProjectClick?.(task.projectPath);
          }}
          title="Open project context panel"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span className="kanban-card-project-name">{task.projectName}</span>
          {task.branch && (
            <>
              <span className="kanban-card-separator">/</span>
              <span className="kanban-card-branch">{task.branch}</span>
            </>
          )}
          <svg className="kanban-card-project-arrow" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>

        {/* Prompt preview */}
        <p className="kanban-card-prompt">{promptPreview}</p>

        {/* Agent info */}
        {task.assignedAgent && (
          <div className="kanban-card-agent">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={task.assignedAgent.name}
                className="kanban-card-avatar"
              />
            ) : (
              <div
                className="kanban-card-avatar-placeholder"
                style={{ backgroundColor: accentColor }}
              >
                {task.assignedAgent.name.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="kanban-card-agent-name">
              {task.assignedAgent.name}
            </span>
          </div>
        )}


        {task.status === 'done' && task.totalCost !== undefined && (
          <div className="kanban-card-cost">
            ${task.totalCost.toFixed(4)}
          </div>
        )}
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
  const accentColor = task.assignedAgent?.color || '#6b7280';
  const displayTitle = task.title.length > 40
    ? task.title.substring(0, 40) + '...'
    : task.title;

  return (
    <div className="kanban-card dragging-overlay">
      <div
        className="kanban-card-accent"
        style={{ backgroundColor: accentColor }}
      />
      <div className="kanban-card-content">
        <h4 className="kanban-card-title">{displayTitle}</h4>
        <div className="kanban-card-project">
          <span>{task.projectName}</span>
        </div>
        {task.assignedAgent && (
          <div className="kanban-card-agent">
            <span className="kanban-card-agent-name">
              {task.assignedAgent.name}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
