/**
 * KanbanShellDrawer Component
 *
 * A drawer that displays the terminal output for a shell/watch Kanban task.
 * Shows real-time output streaming and supports kill functionality.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import type { KanbanTask } from '../../types';

interface KanbanShellDrawerProps {
  task: KanbanTask | null;
  isOpen: boolean;
  onClose: () => void;
  /** In-memory output for this task */
  output: string;
  /** Whether the process is currently running */
  isRunning: boolean;
  /** Kill the running process */
  onKill: () => void;
  /** Start the process (for TODO tasks) */
  onStart: () => void;
  /** Clear the output */
  onClearOutput: () => void;
}

export default function KanbanShellDrawer({
  task,
  isOpen,
  onClose,
  output,
  isRunning,
  onKill,
  onStart,
  onClearOutput,
}: KanbanShellDrawerProps) {
  const outputRef = useRef<HTMLPreElement>(null);

  // Auto-scroll to bottom when output changes
  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!task) return null;

  const isShellTask = task.type === 'shell';
  const isWatchTask = task.type === 'watch';
  const taskTypeLabel = isShellTask ? 'Shell' : 'Watch';
  const taskTypeColor = isShellTask ? '#22c55e' : '#3b82f6';

  // Format duration
  const getDuration = () => {
    if (!task.startedAt) return null;
    const endTime = task.completedAt || Date.now();
    const durationMs = endTime - task.startedAt;
    const seconds = Math.floor(durationMs / 1000);
    const minutes = Math.floor(seconds / 60);
    if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    }
    return `${seconds}s`;
  };

  const drawerContent = (
    <div className={`kanban-drawer ${isOpen ? 'open' : ''}`}>
      {/* Backdrop */}
      <div className="kanban-drawer-backdrop" onClick={onClose} />

      {/* Panel */}
      <div className="kanban-drawer-panel kanban-shell-drawer-panel">
        {/* Header */}
        <div className="kanban-drawer-header">
          <div className="kanban-drawer-header-info">
            {/* Task type badge */}
            <span
              className="kanban-shell-drawer-type"
              style={{ backgroundColor: taskTypeColor }}
            >
              {taskTypeLabel}
            </span>

            {/* Title */}
            <span className="kanban-drawer-title">{task.title}</span>

            {/* Status indicator */}
            {isRunning && (
              <span className="kanban-shell-drawer-status running">
                <span className="kanban-shell-drawer-status-dot" />
                Running
              </span>
            )}
            {!isRunning && task.exitCode !== undefined && (
              <span
                className={`kanban-shell-drawer-status ${
                  task.exitCode === 0 ? 'success' : 'error'
                }`}
              >
                Exit: {task.exitCode}
              </span>
            )}
          </div>

          {/* Actions */}
          <div className="kanban-drawer-header-actions">
            {/* Duration */}
            {getDuration() && (
              <span className="kanban-shell-drawer-duration">{getDuration()}</span>
            )}

            {/* Start button (for TODO tasks) */}
            {task.status === 'todo' && (
              <button
                className="kanban-shell-drawer-action start"
                onClick={onStart}
                title="Start task"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Start
              </button>
            )}

            {/* Kill button (for running tasks) */}
            {isRunning && (
              <button
                className="kanban-shell-drawer-action kill"
                onClick={onKill}
                title="Kill process"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                </svg>
                Kill
              </button>
            )}

            {/* Clear output button */}
            {output && !isRunning && (
              <button
                className="kanban-shell-drawer-action clear"
                onClick={onClearOutput}
                title="Clear output"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                Clear
              </button>
            )}

            {/* Close button */}
            <button
              className="kanban-drawer-close"
              onClick={onClose}
              title="Close"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Command info */}
        <div className="kanban-shell-drawer-command">
          <span className="kanban-shell-drawer-command-label">
            {isShellTask ? 'Command:' : 'Watch:'}
          </span>
          <code className="kanban-shell-drawer-command-value">
            {isShellTask ? task.command : task.watchCommand}
          </code>
        </div>

        {/* Project info */}
        <div className="kanban-shell-drawer-project">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
          </svg>
          <span>{task.projectPath}</span>
        </div>

        {/* Watch patterns (for watch tasks) */}
        {isWatchTask && task.watchPatterns && task.watchPatterns.length > 0 && (
          <div className="kanban-shell-drawer-patterns">
            <span className="kanban-shell-drawer-patterns-label">Patterns:</span>
            <div className="kanban-shell-drawer-patterns-list">
              {task.watchPatterns.map((pattern, idx) => (
                <code key={idx} className="kanban-shell-drawer-pattern">
                  {pattern}
                </code>
              ))}
            </div>
          </div>
        )}

        {/* Terminal output */}
        <div className="kanban-shell-drawer-content">
          {output ? (
            <pre ref={outputRef} className="kanban-shell-drawer-output">
              {output}
            </pre>
          ) : (
            <div className="kanban-shell-drawer-empty">
              {task.status === 'todo' ? (
                <>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  <p>Click Start to run this task</p>
                </>
              ) : isRunning ? (
                <>
                  <div className="kanban-shell-drawer-spinner" />
                  <p>Waiting for output...</p>
                </>
              ) : (
                <>
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 17 10 11 4 5" />
                    <line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  <p>No output</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}
