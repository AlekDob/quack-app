/**
 * KanbanCard Component
 *
 * A draggable card representing a task on the Kanban board.
 * Shows task title, project name, assigned agent avatar/name, and color accent.
 *
 * Uses @dnd-kit/sortable for drag-and-drop functionality.
 */

import { useState, useEffect, useCallback } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { convertFileSrc } from '@tauri-apps/api/core';
import type { KanbanTask } from '../../types';
import { getCustomAvatarUrl, isCustomAvatar } from '../../utils/customAvatarStorage';

interface KanbanCardProps {
  task: KanbanTask;
  isSelected?: boolean;
  onClick?: () => void;
  onDelete?: () => void;
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
  onClick,
  onDelete,
}: KanbanCardProps) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={`kanban-card ${isDragging ? 'dragging' : ''} ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      {/* Color accent bar */}
      <div
        className="kanban-card-accent"
        style={{ backgroundColor: accentColor }}
      />

      {/* Card content */}
      <div className="kanban-card-content">
        {/* Header with title and delete button */}
        <div className="kanban-card-header">
          <h4 className="kanban-card-title">{displayTitle}</h4>
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

        {/* Project info */}
        <div className="kanban-card-project">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>{task.projectName}</span>
          {task.branch && (
            <>
              <span className="kanban-card-separator">/</span>
              <span className="kanban-card-branch">{task.branch}</span>
            </>
          )}
        </div>

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

        {/* Status indicators */}
        {task.status === 'in_progress' && task.sessionId && (
          <div className="kanban-card-status">
            <span className="kanban-card-status-dot active" />
            <span>Active session</span>
          </div>
        )}

        {task.status === 'done' && task.totalCost !== undefined && (
          <div className="kanban-card-cost">
            ${task.totalCost.toFixed(4)}
          </div>
        )}
      </div>
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
