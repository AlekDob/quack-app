/**
 * KanbanToast Component
 *
 * Simple toast notification for Kanban events.
 * Shows in bottom-right corner with auto-dismiss.
 */

import { useEffect, useState, useCallback } from 'react';
import { listen } from '@tauri-apps/api/event';
import './KanbanToast.css';

interface ToastMessage {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  icon: string;
}

interface KanbanUpdatePayload {
  eventType: string;
  payload: {
    taskId?: string;
    task?: { title?: string };
    title?: string;
    previousStatus?: string;
    newStatus?: string;
    completionNote?: string;
    reason?: string;
    updates?: Record<string, unknown>;
    parentTaskId?: string;
  };
  timestamp: number;
  agentId: string;
}

export default function KanbanToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastMessage['type'], icon: string) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    setToasts(prev => [...prev, { id, message, type, icon }]);

    // Auto-dismiss after 4 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const unlistenPromise = listen<KanbanUpdatePayload>('kanban:update', (event) => {
      const { eventType, payload } = event.payload;

      switch (eventType) {
        case 'task_created':
          addToast(
            payload.parentTaskId
              ? `Subtask: "${payload.task?.title || 'New task'}"`
              : `Task: "${payload.task?.title || 'New task'}"`,
            'success',
            payload.parentTaskId ? '🔀' : '📝'
          );
          break;

        case 'task_moved':
          if (payload.newStatus === 'done') {
            addToast(
              `Completed: ${payload.completionNote || 'Task finished'}`,
              'success',
              '✅'
            );
          } else if (payload.newStatus === 'in_progress') {
            addToast(
              `Started working on task`,
              'info',
              '⚡'
            );
          } else {
            addToast(
              `Task moved to ${payload.newStatus}`,
              'info',
              '📋'
            );
          }
          break;

        case 'task_updated':
          addToast(
            `Task updated`,
            'info',
            '✏️'
          );
          break;

        case 'task_deleted':
          addToast(
            `Deleted: "${payload.title}"${payload.reason ? ` - ${payload.reason}` : ''}`,
            'warning',
            '🗑️'
          );
          break;

        default:
          console.log('[KanbanToast] Unknown event type:', eventType);
      }
    });

    return () => {
      unlistenPromise.then(unlisten => unlisten()).catch(() => undefined);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="kanban-toast-container">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`kanban-toast kanban-toast--${toast.type}`}
          onClick={() => removeToast(toast.id)}
        >
          <span className="kanban-toast-icon">{toast.icon}</span>
          <span className="kanban-toast-message">{toast.message}</span>
          <button className="kanban-toast-close" aria-label="Dismiss">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      ))}
    </div>
  );
}
