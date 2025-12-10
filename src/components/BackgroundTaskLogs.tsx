/**
 * BackgroundTaskLogs Component
 *
 * Displays real-time logs for a background task.
 * Supports auto-scroll, filtering, and copy functionality.
 *
 * @module BackgroundTaskLogs
 */

import { useState, useRef, useEffect, useMemo, type ReactNode } from 'react';
import type { BackgroundTaskLogEntry } from '../types';

interface BackgroundTaskLogsProps {
  logs: BackgroundTaskLogEntry[];
  isVisible: boolean;
  maxHeight?: number;
}

// Log level colors
const LOG_LEVEL_COLORS: Record<string, string> = {
  debug: '#6b7280',
  info: '#3b82f6',
  warn: '#f59e0b',
  error: '#ef4444',
  success: '#10b981',
};

// Log level icons
const LOG_LEVEL_ICONS: Record<string, ReactNode> = {
  debug: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  info: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  warn: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  ),
  error: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </svg>
  ),
  success: (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="10" />
    </svg>
  ),
};

// Format timestamp
function formatLogTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }) + '.' + String(date.getMilliseconds()).padStart(3, '0');
}

export default function BackgroundTaskLogs({
  logs,
  isVisible,
  maxHeight = 200,
}: BackgroundTaskLogsProps) {
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Filter logs
  const filteredLogs = useMemo(() => {
    let result = logs;

    // Filter by level
    if (filter) {
      result = result.filter(log => log.level === filter);
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(log =>
        log.message.toLowerCase().includes(query) ||
        log.source?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [logs, filter, searchQuery]);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logsContainerRef.current) {
      logsContainerRef.current.scrollTop = logsContainerRef.current.scrollHeight;
    }
  }, [filteredLogs, autoScroll]);

  // Handle scroll - disable auto-scroll if user scrolls up
  const handleScroll = () => {
    if (!logsContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = logsContainerRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setAutoScroll(isAtBottom);
  };

  // Copy logs to clipboard
  const copyLogs = () => {
    const text = filteredLogs
      .map(log => `[${formatLogTime(log.timestamp)}] [${log.level.toUpperCase()}] ${log.source ? `[${log.source}] ` : ''}${log.message}`)
      .join('\n');
    navigator.clipboard.writeText(text);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="background-task-logs">
      {/* Logs toolbar */}
      <div className="logs-toolbar">
        <div className="logs-filters">
          {/* Level filters */}
          <div className="logs-level-filters">
            <button
              type="button"
              className={filter === null ? 'active' : ''}
              onClick={() => setFilter(null)}
            >
              All
            </button>
            {['info', 'warn', 'error'].map((level) => (
              <button
                key={level}
                type="button"
                className={filter === level ? 'active' : ''}
                style={{ color: LOG_LEVEL_COLORS[level] }}
                onClick={() => setFilter(filter === level ? null : level)}
              >
                {level}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="logs-search">
            <input
              type="text"
              placeholder="Filter logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="logs-actions">
          {/* Auto-scroll toggle */}
          <button
            type="button"
            className={`logs-autoscroll ${autoScroll ? 'active' : ''}`}
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? 'Auto-scroll ON' : 'Auto-scroll OFF'}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M19 12l-7 7-7-7" />
            </svg>
          </button>

          {/* Copy logs */}
          <button
            type="button"
            className="logs-copy"
            onClick={copyLogs}
            title="Copy logs"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
        style={{ maxHeight: `${maxHeight}px` }}
        onScroll={handleScroll}
      >
        {filteredLogs.length === 0 ? (
          <div className="logs-empty">
            {logs.length === 0 ? 'No logs yet' : 'No matching logs'}
          </div>
        ) : (
          filteredLogs.map((log, index) => (
            <div
              key={`${log.timestamp}-${index}`}
              className={`log-entry ${log.level}`}
              style={{ borderLeftColor: LOG_LEVEL_COLORS[log.level] || LOG_LEVEL_COLORS.info }}
            >
              <span className="log-time">{formatLogTime(log.timestamp)}</span>
              <span className="log-level" style={{ color: LOG_LEVEL_COLORS[log.level] }}>
                {LOG_LEVEL_ICONS[log.level] || LOG_LEVEL_ICONS.info}
              </span>
              {log.source && (
                <span className="log-source">[{log.source}]</span>
              )}
              <span className="log-message">{log.message}</span>
            </div>
          ))
        )}
      </div>

      {/* Log count */}
      <div className="logs-footer">
        <span>{filteredLogs.length} / {logs.length} logs</span>
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
  );
}
