/**
 * TaskOutputWidget - Displays background task output status
 *
 * Shows task ID, status indicator, and expandable output content.
 * Used for TaskOutput tool results in chat.
 */

import React, { useState } from 'react';
import { ToolIcon } from './ToolWidgets';
import { JsonViewer } from './JsonViewer';

interface TaskOutputWidgetProps {
  taskId: string;
  status?: 'pending' | 'running' | 'completed' | 'error' | 'unknown';
  output?: string;
  error?: string;
  block?: boolean;
  timeout?: number;
  isLoading: boolean;
  defaultExpanded?: boolean;
}

// Task status colors
const statusColors: Record<string, string> = {
  pending: '#f59e0b',    // Amber
  running: '#3b82f6',    // Blue
  completed: '#10b981',  // Green
  error: '#ef4444',      // Red
  unknown: '#6b7280',    // Gray
};

// Status icons
const StatusIcon: React.FC<{ status: string }> = ({ status }) => {
  switch (status) {
    case 'completed':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill={statusColors.completed}>
          <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z" />
        </svg>
      );
    case 'error':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill={statusColors.error}>
          <path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z" />
        </svg>
      );
    case 'running':
      return (
        <div className="spinner" style={{ width: 14, height: 14 }} />
      );
    case 'pending':
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill={statusColors.pending}>
          <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1013 0 6.5 6.5 0 00-13 0zm7-3.25v2.992l2.028.812a.75.75 0 01-.556 1.392l-2.75-1.1a.75.75 0 01-.472-.696V4.75a.75.75 0 011.5 0z" />
        </svg>
      );
    default:
      return (
        <svg width="14" height="14" viewBox="0 0 16 16" fill={statusColors.unknown}>
          <path d="M8 0a8 8 0 110 16A8 8 0 018 0zM1.5 8a6.5 6.5 0 1013 0 6.5 6.5 0 00-13 0zm6.5-.25A.75.75 0 019 7v3.25a.75.75 0 01-1.5 0V7a.75.75 0 01.75-.75zm0-3a.75.75 0 100 1.5.75.75 0 000-1.5z" />
        </svg>
      );
  }
};

export const TaskOutputWidget: React.FC<TaskOutputWidgetProps> = ({
  taskId,
  status = 'unknown',
  output,
  error,
  block,
  timeout,
  isLoading,
  defaultExpanded = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded || !!output || !!error);

  const statusColor = statusColors[status] || statusColors.unknown;
  const hasContent = !!output || !!error;

  // Format task ID for display (truncate if too long)
  const displayTaskId = taskId.length > 20 ? `${taskId.slice(0, 8)}...${taskId.slice(-8)}` : taskId;

  // Format status for display
  const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);

  return (
    <div
      className="tool-widget task-output-widget"
      style={{
        borderColor: statusColor,
        background: `linear-gradient(135deg, ${statusColor}15 0%, ${statusColor}05 100%)`,
      }}
    >
      {/* Header */}
      <div
        className="tool-widget-header task-output-header"
        onClick={() => hasContent && setIsExpanded(!isExpanded)}
        style={{
          cursor: hasContent ? 'pointer' : 'default',
          background: `${statusColor}10`,
        }}
      >
        <div className="tool-widget-title" style={{ color: statusColor }}>
          <ToolIcon name="TaskOutput" />
          <span>Task Output</span>
        </div>

        {/* Task ID Badge */}
        <div className="task-output-id-badge">
          <code>{displayTaskId}</code>
        </div>

        {/* Status Badge */}
        <div
          className="task-output-status-badge"
          style={{
            background: `${statusColor}20`,
            borderColor: `${statusColor}40`,
            color: statusColor,
          }}
        >
          <StatusIcon status={isLoading ? 'running' : status} />
          <span>{isLoading ? 'Loading' : statusLabel}</span>
        </div>

        {/* Expand chevron */}
        {hasContent && (
          <svg
            className={`collapse-chevron ${isExpanded ? 'expanded' : ''}`}
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
            style={{
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              opacity: 0.6,
              marginLeft: 'auto',
            }}
          >
            <path d="M4.427 6.427l3.396 3.396a.25.25 0 00.354 0l3.396-3.396A.25.25 0 0011.396 6H4.604a.25.25 0 00-.177.427z" />
          </svg>
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && hasContent && (
        <div className="tool-widget-content task-output-content">
          {/* Configuration info */}
          {(block !== undefined || timeout !== undefined) && (
            <div className="task-output-config">
              {block !== undefined && (
                <span className="task-output-config-item">
                  Blocking: {block ? 'Yes' : 'No'}
                </span>
              )}
              {timeout !== undefined && (
                <span className="task-output-config-item">
                  Timeout: {timeout}ms
                </span>
              )}
            </div>
          )}

          {/* Output */}
          {output && (
            <div className="task-output-result">
              <JsonViewer data={output} maxHeight="500px" />
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="task-output-error">
              <div className="task-output-error-label">Error</div>
              <JsonViewer data={error} maxHeight="300px" />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskOutputWidget;
