/**
 * BackgroundTasksSidebarButton Component
 *
 * Button for the sidebar that shows background tasks count and status.
 *
 * @module BackgroundTasksSidebarButton
 */

import { useBackgroundTaskBadge } from '../hooks/useBackgroundAgents';
import './BackgroundTasks.css';

interface BackgroundTasksSidebarButtonProps {
  onClick: () => void;
}

export default function BackgroundTasksSidebarButton({
  onClick,
}: BackgroundTasksSidebarButtonProps) {
  const { count, hasRunning, hasFailed } = useBackgroundTaskBadge();

  const buttonClass = [
    'sidebar-background-tasks-btn',
    hasRunning ? 'has-active' : '',
    hasFailed ? 'has-failed' : '',
  ].filter(Boolean).join(' ');

  return (
    <button
      type="button"
      className={buttonClass}
      onClick={onClick}
      title="Background Tasks"
    >
      <div className="sidebar-background-tasks-btn-content">
        <div className="sidebar-background-tasks-btn-icon">
          {hasRunning ? (
            // Spinning loader when tasks are running
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83">
                <animateTransform
                  attributeName="transform"
                  type="rotate"
                  from="0 12 12"
                  to="360 12 12"
                  dur="1s"
                  repeatCount="indefinite"
                />
              </path>
            </svg>
          ) : (
            // Static icon when idle
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 12l2 2 4-4" />
            </svg>
          )}
        </div>
        <span>Background Tasks</span>
      </div>

      {count > 0 && (
        <span
          className={`background-tasks-badge ${hasRunning ? 'running' : ''} ${hasFailed ? 'failed' : ''}`}
        >
          {count}
        </span>
      )}
    </button>
  );
}
