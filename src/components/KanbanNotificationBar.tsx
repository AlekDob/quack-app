/**
 * KanbanNotificationBar Component
 *
 * Shows a notification bar inviting the user to open the Kanban view
 * after a background task is created via /background command.
 */

import { useEffect, useState } from 'react';
import './KanbanNotificationBar.css';

interface KanbanNotificationBarProps {
  taskTitle: string;
  onOpenKanban: () => void;
  onDismiss: () => void;
  autoDismissMs?: number; // Auto-dismiss after X milliseconds (default: 10000)
}

export default function KanbanNotificationBar({
  taskTitle,
  onOpenKanban,
  onDismiss,
  autoDismissMs = 10000,
}: KanbanNotificationBarProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [progress, setProgress] = useState(100);

  // Auto-dismiss timer - 100ms interval is sufficient for smooth animation
  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / autoDismissMs) * 100);
      setProgress(remaining);

      if (remaining === 0) {
        clearInterval(interval);
        handleDismiss();
      }
    }, 100); // 100ms instead of 50ms - reduces CPU usage

    return () => clearInterval(interval);
  }, [autoDismissMs]);

  const handleDismiss = () => {
    setIsVisible(false);
    setTimeout(onDismiss, 200); // Wait for fade out animation
  };

  const handleOpenKanban = () => {
    onOpenKanban();
    handleDismiss();
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="kanban-notification-bar">
      <div className="kanban-notification-bar-progress" style={{ width: `${progress}%` }} />
      <div className="kanban-notification-bar-content">
        <div className="kanban-notification-bar-left">
          <div className="kanban-notification-bar-icon">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="5" height="18" rx="1" />
              <rect x="10" y="3" width="5" height="12" rx="1" />
              <rect x="17" y="3" width="5" height="8" rx="1" />
            </svg>
          </div>
          <div className="kanban-notification-bar-text">
            <span className="kanban-notification-bar-title">Task running in background</span>
            <span className="kanban-notification-bar-subtitle">{taskTitle}</span>
          </div>
        </div>
        <div className="kanban-notification-bar-actions">
          <button
            type="button"
            className="kanban-notification-bar-btn kanban-notification-bar-btn-primary"
            onClick={handleOpenKanban}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="5" height="18" rx="1" />
              <rect x="10" y="3" width="5" height="12" rx="1" />
              <rect x="17" y="3" width="5" height="8" rx="1" />
            </svg>
            Open Kanban
          </button>
          <button
            type="button"
            className="kanban-notification-bar-btn kanban-notification-bar-btn-dismiss"
            onClick={handleDismiss}
            title="Dismiss"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
