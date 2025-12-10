/**
 * TaskDetailsDrawer Component
 *
 * Full-screen drawer for viewing task details, logs, and actions.
 * Features ANSI code parsing, tabbed interface, and real-time log streaming.
 */

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { toast } from 'sonner';
import { ansiToHtml, stripAnsi } from '../utils/ansiParser';
import type { BackgroundTask, BackgroundTaskPriority, BackgroundTaskLogEntry } from '../types';
import './TaskDetailsDrawer.css';

interface TaskDetailsDrawerProps {
  task: BackgroundTask | null;
  isOpen: boolean;
  onClose: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
  onChangePriority: (priority: BackgroundTaskPriority) => void;
}

type TabType = 'overview' | 'logs' | 'errors';

// Status configuration
const STATUS_CONFIG: Record<string, { color: string; label: string; bgColor: string }> = {
  running: { color: '#22c55e', label: 'Running', bgColor: 'rgba(34, 197, 94, 0.15)' },
  queued: { color: '#f59e0b', label: 'Queued', bgColor: 'rgba(245, 158, 11, 0.15)' },
  paused: { color: '#6366f1', label: 'Paused', bgColor: 'rgba(99, 102, 241, 0.15)' },
  completed: { color: '#10b981', label: 'Completed', bgColor: 'rgba(16, 185, 129, 0.15)' },
  failed: { color: '#ef4444', label: 'Failed', bgColor: 'rgba(239, 68, 68, 0.15)' },
  cancelled: { color: '#6b7280', label: 'Cancelled', bgColor: 'rgba(107, 114, 128, 0.15)' },
};

// Priority configuration
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

// Format timestamp
function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

// Format log time
function formatLogTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
}

export default function TaskDetailsDrawer({
  task,
  isOpen,
  onClose,
  onPause,
  onResume,
  onCancel,
  onRetry,
  onRemove,
  onChangePriority,
}: TaskDetailsDrawerProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [autoScroll, setAutoScroll] = useState(true);
  const [logFilter, setLogFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPriorityMenu, setShowPriorityMenu] = useState(false);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Filter logs
  const filteredLogs = useMemo(() => {
    if (!task) return [];
    let result = task.logs;

    // Filter by level
    if (logFilter) {
      result = result.filter(log => log.level === logFilter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(log =>
        stripAnsi(log.message).toLowerCase().includes(query) ||
        log.source?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [task?.logs, logFilter, searchQuery]);

  // Error logs
  const errorLogs = useMemo(() => {
    if (!task) return [];
    return task.logs.filter(log => log.level === 'error');
  }, [task?.logs]);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logsContainerRef.current && activeTab === 'logs') {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll, activeTab]);

  // Handle scroll
  const handleScroll = useCallback(() => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  }, []);

  // Copy logs to clipboard
  const copyLogs = useCallback(() => {
    if (!task) return;
    const text = filteredLogs
      .map(log => `[${formatLogTime(log.timestamp)}] [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ''}${stripAnsi(log.message)}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast.success('Logs copied to clipboard');
  }, [filteredLogs, task]);

  // Copy command
  const copyCommand = useCallback(() => {
    if (!task?.config.command) return;
    navigator.clipboard.writeText(task.config.command);
    toast.success('Command copied to clipboard');
  }, [task?.config.command]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Calculate elapsed time
  const elapsedTime = useMemo(() => {
    if (!task) return 0;
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

  if (!isOpen || !task) return null;

  const statusConfig = STATUS_CONFIG[task.status] || STATUS_CONFIG.queued;
  const priorityConfig = PRIORITY_CONFIG[task.config.priority];

  return (
    <div className="task-details-overlay" onClick={onClose}>
      <div className="task-details-drawer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <header className="task-details-header">
          <div className="task-details-title">
            <div
              className="task-status-badge"
              style={{
                backgroundColor: statusConfig.bgColor,
                color: statusConfig.color,
                borderColor: statusConfig.color,
              }}
            >
              {task.status === 'running' && <div className="status-spinner" />}
              {statusConfig.label}
            </div>
            <h2>{task.config.name}</h2>
          </div>

          <div className="task-details-actions">
            {/* Priority selector */}
            <div className="priority-selector">
              <button
                type="button"
                className="priority-badge"
                style={{ borderColor: priorityConfig.color, color: priorityConfig.color }}
                onClick={() => setShowPriorityMenu(!showPriorityMenu)}
              >
                {priorityConfig.label} Priority
              </button>
              {showPriorityMenu && (
                <div className="priority-menu">
                  {(['high', 'medium', 'low'] as BackgroundTaskPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={p === task.config.priority ? 'active' : ''}
                      onClick={() => {
                        onChangePriority(p);
                        setShowPriorityMenu(false);
                      }}
                      style={{ color: PRIORITY_CONFIG[p].color }}
                    >
                      {PRIORITY_CONFIG[p].label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Close button */}
            <button type="button" className="close-btn" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Tabs */}
        <nav className="task-details-tabs">
          <button
            type="button"
            className={activeTab === 'overview' ? 'active' : ''}
            onClick={() => setActiveTab('overview')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <path d="M9 9h6M9 13h6M9 17h4" />
            </svg>
            Overview
          </button>
          <button
            type="button"
            className={activeTab === 'logs' ? 'active' : ''}
            onClick={() => setActiveTab('logs')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            </svg>
            Logs
            <span className="tab-badge">{task.logs.length}</span>
          </button>
          <button
            type="button"
            className={`${activeTab === 'errors' ? 'active' : ''} ${errorLogs.length > 0 ? 'has-errors' : ''}`}
            onClick={() => setActiveTab('errors')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <path d="M15 9l-6 6M9 9l6 6" />
            </svg>
            Errors
            {errorLogs.length > 0 && <span className="tab-badge error">{errorLogs.length}</span>}
          </button>
        </nav>

        {/* Content */}
        <div className="task-details-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="overview-content">
              {/* Task Info */}
              <section className="info-section">
                <h3>Task Information</h3>
                <div className="info-grid">
                  <div className="info-item">
                    <label>Type</label>
                    <span className="info-value type">{task.config.type}</span>
                  </div>
                  <div className="info-item">
                    <label>Status</label>
                    <span className="info-value" style={{ color: statusConfig.color }}>
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="info-item">
                    <label>Created</label>
                    <span className="info-value">{formatTimestamp(task.createdAt)}</span>
                  </div>
                  {task.startedAt && (
                    <div className="info-item">
                      <label>Started</label>
                      <span className="info-value">{formatTimestamp(task.startedAt)}</span>
                    </div>
                  )}
                  {task.completedAt && (
                    <div className="info-item">
                      <label>Completed</label>
                      <span className="info-value">{formatTimestamp(task.completedAt)}</span>
                    </div>
                  )}
                  {elapsedTime > 0 && (
                    <div className="info-item">
                      <label>Duration</label>
                      <span className="info-value">{formatDuration(elapsedTime)}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Command */}
              {task.config.command && (
                <section className="info-section">
                  <h3>Command</h3>
                  <div className="command-block">
                    <code>{task.config.command}</code>
                    <button type="button" onClick={copyCommand} title="Copy command">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2" />
                        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                      </svg>
                    </button>
                  </div>
                </section>
              )}

              {/* Agent Info */}
              {task.config.agentId && (
                <section className="info-section">
                  <h3>Agent</h3>
                  <div className="agent-info">
                    <span className="agent-id">{task.config.agentId}</span>
                    {task.config.prompt && (
                      <p className="agent-prompt">{task.config.prompt}</p>
                    )}
                  </div>
                </section>
              )}

              {/* Working Directory */}
              {task.config.workingDirectory && (
                <section className="info-section">
                  <h3>Working Directory</h3>
                  <code className="directory-path">{task.config.workingDirectory}</code>
                </section>
              )}

              {/* Result */}
              {task.result && (
                <section className="info-section">
                  <h3>Result</h3>
                  <div className={`result-block ${task.result.success ? 'success' : 'error'}`}>
                    <div className="result-status">
                      {task.result.success ? (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M9 12l2 2 4-4" />
                            <circle cx="12" cy="12" r="10" />
                          </svg>
                          <span>Task completed successfully</span>
                        </>
                      ) : (
                        <>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <path d="M15 9l-6 6M9 9l6 6" />
                          </svg>
                          <span>{task.result.error || 'Task failed'}</span>
                        </>
                      )}
                    </div>
                    {task.result.usage && (
                      <div className="result-usage">
                        <span>Input: {task.result.usage.input_tokens.toLocaleString()} tokens</span>
                        <span>Output: {task.result.usage.output_tokens.toLocaleString()} tokens</span>
                        {task.result.cost_usd && (
                          <span>Cost: ${task.result.cost_usd.toFixed(4)}</span>
                        )}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Progress */}
              {task.status === 'running' && task.progress && (
                <section className="info-section">
                  <h3>Progress</h3>
                  <div className="progress-block">
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{ width: `${task.progress.percentage || 0}%` }}
                      />
                    </div>
                    <div className="progress-info">
                      <span>{task.progress.percentage || 0}%</span>
                      {task.progress.stage && <span>{task.progress.stage}</span>}
                    </div>
                  </div>
                </section>
              )}
            </div>
          )}

          {/* Logs Tab */}
          {activeTab === 'logs' && (
            <div className="logs-content">
              {/* Logs toolbar */}
              <div className="logs-toolbar">
                <div className="logs-filters">
                  <button
                    type="button"
                    className={logFilter === null ? 'active' : ''}
                    onClick={() => setLogFilter(null)}
                  >
                    All
                  </button>
                  <button
                    type="button"
                    className={logFilter === 'info' ? 'active' : ''}
                    style={{ color: '#3b82f6' }}
                    onClick={() => setLogFilter(logFilter === 'info' ? null : 'info')}
                  >
                    Info
                  </button>
                  <button
                    type="button"
                    className={logFilter === 'warn' ? 'active' : ''}
                    style={{ color: '#f59e0b' }}
                    onClick={() => setLogFilter(logFilter === 'warn' ? null : 'warn')}
                  >
                    Warn
                  </button>
                  <button
                    type="button"
                    className={logFilter === 'error' ? 'active' : ''}
                    style={{ color: '#ef4444' }}
                    onClick={() => setLogFilter(logFilter === 'error' ? null : 'error')}
                  >
                    Error
                  </button>
                </div>

                <div className="logs-search">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="11" cy="11" r="8" />
                    <path d="M21 21l-4.35-4.35" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search logs..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>

                <div className="logs-actions">
                  <button
                    type="button"
                    className={autoScroll ? 'active' : ''}
                    onClick={() => setAutoScroll(!autoScroll)}
                    title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M12 5v14M19 12l-7 7-7-7" />
                    </svg>
                  </button>
                  <button type="button" onClick={copyLogs} title="Copy logs">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Logs container */}
              <div
                ref={logsContainerRef}
                className="logs-container"
                onScroll={handleScroll}
              >
                {filteredLogs.length === 0 ? (
                  <div className="logs-empty">
                    {task.logs.length === 0 ? 'No logs yet' : 'No matching logs'}
                  </div>
                ) : (
                  filteredLogs.map((log, index) => (
                    <LogEntry key={`${log.timestamp}-${index}`} log={log} />
                  ))
                )}
              </div>

              {/* Logs footer */}
              <div className="logs-footer">
                <span>{filteredLogs.length} / {task.logs.length} logs</span>
                {!autoScroll && (
                  <button
                    type="button"
                    onClick={() => {
                      setAutoScroll(true);
                      if (logsContainerRef.current) {
                        logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
                      }
                    }}
                  >
                    Jump to bottom
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Errors Tab */}
          {activeTab === 'errors' && (
            <div className="errors-content">
              {errorLogs.length === 0 ? (
                <div className="errors-empty">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M9 12l2 2 4-4" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                  <p>No errors</p>
                  <span>This task has not encountered any errors</span>
                </div>
              ) : (
                <div className="errors-list">
                  {errorLogs.map((log, index) => (
                    <div key={`error-${log.timestamp}-${index}`} className="error-entry">
                      <div className="error-header">
                        <span className="error-time">{formatLogTime(log.timestamp)}</span>
                        {log.source && <span className="error-source">[{log.source}]</span>}
                      </div>
                      <div
                        className="error-message"
                        dangerouslySetInnerHTML={{ __html: ansiToHtml(log.message) }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer with actions */}
        <footer className="task-details-footer">
          {task.status === 'running' && (
            <>
              <button type="button" className="action-btn pause" onClick={onPause}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
                Pause
              </button>
              <button type="button" className="action-btn cancel" onClick={onCancel}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Cancel
              </button>
            </>
          )}

          {task.status === 'paused' && (
            <>
              <button type="button" className="action-btn resume" onClick={onResume}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Resume
              </button>
              <button type="button" className="action-btn cancel" onClick={onCancel}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
                Cancel
              </button>
            </>
          )}

          {task.status === 'queued' && (
            <button type="button" className="action-btn cancel" onClick={onCancel}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
              Remove from Queue
            </button>
          )}

          {(task.status === 'failed' || task.status === 'cancelled') && (
            <>
              <button type="button" className="action-btn retry" onClick={onRetry}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 4v6h6M23 20v-6h-6" />
                  <path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15" />
                </svg>
                Retry
              </button>
              <button type="button" className="action-btn remove" onClick={onRemove}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
                </svg>
                Remove
              </button>
            </>
          )}

          {task.status === 'completed' && (
            <button type="button" className="action-btn remove" onClick={onRemove}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6" />
              </svg>
              Remove
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

// Log entry component with ANSI parsing
function LogEntry({ log }: { log: BackgroundTaskLogEntry }) {
  const levelColors: Record<string, string> = {
    debug: '#6b7280',
    info: '#3b82f6',
    warn: '#f59e0b',
    error: '#ef4444',
    success: '#10b981',
  };

  return (
    <div className={`log-entry ${log.level}`} style={{ borderLeftColor: levelColors[log.level] || levelColors.info }}>
      <span className="log-time">{formatLogTime(log.timestamp)}</span>
      <span className="log-level" style={{ color: levelColors[log.level] }}>
        {log.level.toUpperCase()}
      </span>
      {log.source && <span className="log-source">[{log.source}]</span>}
      <span
        className="log-message"
        dangerouslySetInnerHTML={{ __html: ansiToHtml(log.message) }}
      />
    </div>
  );
}
