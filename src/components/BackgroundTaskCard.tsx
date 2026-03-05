/**
 * BackgroundTaskCard Component
 *
 * Compact task card showing status and essential info.
 * Click to open detailed drawer view.
 *
 * @module BackgroundTaskCard
 */

import { useState, useMemo, type ReactNode } from 'react';
import type { BackgroundTask, BackgroundTaskPriority } from '../types';

interface BackgroundTaskCardProps {
  task: BackgroundTask;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onChangePriority: (priority: BackgroundTaskPriority) => void;
  onOpenDetails: () => void;
}

// Status colors and icons
const STATUS_CONFIG: Record<string, { color: string; icon: string; label: string }> = {
  running: { color: '#22c55e', icon: 'spinner', label: 'Running' },
  queued: { color: '#f59e0b', icon: 'clock', label: 'Queued' },
  paused: { color: '#6366f1', icon: 'pause', label: 'Paused' },
  completed: { color: '#10b981', icon: 'check', label: 'Completed' },
  failed: { color: '#ef4444', icon: 'x', label: 'Failed' },
  cancelled: { color: '#6b7280', icon: 'stop', label: 'Cancelled' },
};

// Type icons
const TYPE_ICONS: Record<string, ReactNode> = {
  agent: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2a3 3 0 0 0-3 3v4a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3" />
    </svg>
  ),
  build: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
    </svg>
  ),
  test: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4" />
      <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z" />
    </svg>
  ),
  analysis: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 21H4.6c-.56 0-.84 0-1.05-.11a1 1 0 0 1-.44-.44C3 20.24 3 19.96 3 19.4V3" />
      <path d="M7 14.5l3.5-3.5 3.5 3.5L21 7" />
    </svg>
  ),
  watch: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  custom: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
};

// Priority badges
const PRIORITY_CONFIG: Record<BackgroundTaskPriority, { color: string; label: string }> = {
  high: { color: '#ef4444', label: 'High' },
  medium: { color: '#f59e0b', label: 'Medium' },
  low: { color: '#6b7280', label: 'Low' },
};

// Format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainingSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// Format time ago
function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

// Truncate text with ellipsis
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trim() + '...';
}

// Get summary message for completed/failed tasks
function getResultSummary(task: BackgroundTask): string | null {
  if (!task.result) return null;

  if (task.result.success) {
    return 'Completed successfully';
  }

  if (task.result.error) {
    // Clean up error message - remove ANSI codes and excessive whitespace
    const cleanError = task.result.error
      .replace(/\x1b\[[0-9;]*m/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return truncateText(cleanError, 80);
  }

  return 'Task failed';
}

export default function BackgroundTaskCard({
  task,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove,
  onChangePriority,
  onOpenDetails,
}: BackgroundTaskCardProps) {
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);

  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.queued;
  const typeIcon = TYPE_ICONS[task.config.type] || TYPE_ICONS.custom;
  const priorityConfig = PRIORITY_CONFIG[task.config.priority];

  // Calculate elapsed time for running tasks
  const elapsedTime = useMemo(() => {
    if (task.status === 'running' && task.startedAt) {
      return Date.now() - task.startedAt;
    }
    if (task.result?.duration_ms) {
      return task.result.duration_ms;
    }
    if (task.completedAt && task.startedAt) {
      return task.completedAt - task.startedAt;
    }
    return 0;
  }, [task]);

  // Progress percentage
  const progress = task.progress?.percentage || 0;

  // Get result summary for display
  const resultSummary = getResultSummary(task);

  // Handle card click - open details drawer
  const handleCardClick = () => {
    onOpenDetails();
  };

  // Handle quick action click (stop propagation to prevent opening drawer)
  const handleQuickAction = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <article
      className={`background-task-card ${task.status} compact`}
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleCardClick()}
    >
      {/* Main row */}
      <div className="task-card-row">
        {/* Status indicator */}
        <div className="task-status" style={{ color: statusConfig.color }}>
          {task.status === 'running' ? (
            <div className="task-spinner" />
          ) : (
            <span className="task-status-dot" />
          )}
        </div>

        {/* Type icon */}
        <div className="task-type-icon" title={task.config.type}>
          {typeIcon}
        </div>

        {/* Task info */}
        <div className="task-info">
          <div className="task-name">{task.config.name}</div>
          <div className="task-meta">
            {elapsedTime > 0 && (
              <span className="task-duration">{formatDuration(elapsedTime)}</span>
            )}
            <span className="task-time">{formatTimeAgo(task.createdAt)}</span>
          </div>
        </div>

        {/* Priority badge */}
        <div className="task-priority-wrapper">
          <button
            type="button"
            className="task-priority-badge"
            style={{ borderColor: priorityConfig.color, color: priorityConfig.color }}
            onClick={(e) => handleQuickAction(e, () => setShowPriorityMenu(!showPriorityMenu))}
            title="Change priority"
          >
            {priorityConfig.label}
          </button>
          {showPriorityMenu && (
            <div className="task-priority-menu">
              {(['high', 'medium', 'low'] as BackgroundTaskPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  className={p === task.config.priority ? 'active' : ''}
                  onClick={(e) => handleQuickAction(e, () => {
                    onChangePriority(p);
                    setShowPriorityMenu(false);
                  })}
                  style={{ color: PRIORITY_CONFIG[p].color }}
                >
                  {PRIORITY_CONFIG[p].label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="task-quick-actions">
          {task.status === 'running' && (
            <button
              type="button"
              className="quick-action-btn cancel"
              onClick={(e) => handleQuickAction(e, onCancel)}
              title="Cancel task"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
          {(task.status === 'failed' || task.status === 'cancelled') && (
            <button
              type="button"
              className="quick-action-btn retry"
              onClick={(e) => handleQuickAction(e, onRetry)}
              title="Retry task"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M1 4v6h6M23 20v-6h-6" />
                <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
              </svg>
            </button>
          )}
          {(task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') && (
            <button
              type="button"
              className="quick-action-btn remove"
              onClick={(e) => handleQuickAction(e, onRemove)}
              title="Remove task"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
              </svg>
            </button>
          )}

          {/* Arrow indicator for details */}
          <div className="task-details-arrow" title="View details">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </div>
        </div>
      </div>

      {/* Progress bar (only for running tasks) */}
      {task.status === 'running' && task.progress && (
        <div className="task-progress-bar compact">
          <div
            className="task-progress-fill"
            style={{ width: `${progress}%` }}
          />
          {task.progress.stage && (
            <span className="task-progress-stage">{task.progress.stage}</span>
          )}
        </div>
      )}

      {/* Result summary (only for completed/failed tasks) */}
      {resultSummary && (task.status === 'completed' || task.status === 'failed' || task.status === 'cancelled') && (
        <div className={`task-result-summary ${task.result?.success ? 'success' : 'error'}`}>
          {task.result?.success ? (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 12l2 2 4-4" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
          )}
          <span>{resultSummary}</span>
        </div>
      )}
    </article>
  );
}
