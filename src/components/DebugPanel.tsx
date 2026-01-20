/**
 * 🦆 Debug Panel Component
 *
 * Integrated debugging tool for production issue tracking.
 * Accessible from Settings > Debug to inspect event deduplication and rendering issues.
 */

import { useState, useEffect } from 'react';
import debugLogger, { type DebugLogEntry } from '../services/debugLogger';
import { useSessionStore } from '../stores/sessionStore';
import './DebugPanel.css';

export default function DebugPanel() {
  const [enabled, setEnabled] = useState(debugLogger.isEnabled());
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [filter, setFilter] = useState<'all' | 'deduplication' | 'rendering' | 'events'>('all');
  const [levelFilter, setLevelFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { sessions } = useSessionStore();

  // Load logs on mount and refresh
  useEffect(() => {
    refreshLogs();

    if (autoRefresh) {
      const interval = setInterval(refreshLogs, 2000); // Refresh every 2 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, filter, levelFilter]);

  const refreshLogs = () => {
    let filteredLogs = debugLogger.getLogs();

    // Apply category filter
    if (filter !== 'all') {
      filteredLogs = debugLogger.getLogsByCategory(filter);
    }

    // Apply level filter
    if (levelFilter !== 'all') {
      filteredLogs = filteredLogs.filter(log => log.level === levelFilter);
    }

    setLogs(filteredLogs.reverse()); // Show newest first
  };

  const handleToggleEnabled = () => {
    const newValue = !enabled;
    debugLogger.setEnabled(newValue);
    setEnabled(newValue);
  };

  const handleClearLogs = () => {
    if (confirm('Are you sure you want to clear all debug logs?')) {
      debugLogger.clearLogs();
      refreshLogs();
    }
  };

  const handleExportLogs = () => {
    const json = debugLogger.exportLogs();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `quack-debug-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const stats = debugLogger.getStats();

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  };

  const getLevelIcon = (level: DebugLogEntry['level']) => {
    switch (level) {
      case 'info': return '✅';
      case 'warn': return '⚠️';
      case 'error': return '❌';
      default: return '📝';
    }
  };

  const getCategoryColor = (category: DebugLogEntry['category']) => {
    switch (category) {
      case 'deduplication': return '#FF6B35'; // Orange (primary color)
      case 'rendering': return '#00D9FF'; // Cyan (success color)
      case 'events': return '#F7931E'; // Yellow (accent)
      case 'general': return '#004E89'; // Blue (secondary)
      default: return '#888';
    }
  };

  const activeSessions = sessions.filter(s => s.status !== 'done');
  const completedSessions = sessions.filter(s => s.status === 'done');

  return (
    <div className="debug-panel">
      <div className="debug-panel-header">
        <h2>🦆 Debug Panel</h2>
        <p className="debug-panel-description">
          Production debugging tool for tracking event deduplication and rendering issues.
        </p>
      </div>

      {/* Controls */}
      <div className="debug-panel-controls">
        <div className="debug-control-row">
          <button
            className={`debug-toggle-btn ${enabled ? 'enabled' : 'disabled'}`}
            onClick={handleToggleEnabled}
          >
            {enabled ? '🟢 Logging Enabled' : '⚪ Logging Disabled'}
          </button>
          <button className="debug-action-btn" onClick={refreshLogs}>
            🔄 Refresh
          </button>
          <button className="debug-action-btn" onClick={handleClearLogs}>
            🗑️ Clear Logs
          </button>
          <button className="debug-action-btn" onClick={handleExportLogs}>
            📥 Export JSON
          </button>
        </div>

        {/* Stats */}
        <div className="debug-stats">
          <div className="debug-stat">
            <span className="debug-stat-label">Total Logs:</span>
            <span className="debug-stat-value">{stats.total}</span>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Duplicates:</span>
            <span className="debug-stat-value" style={{ color: '#FF6B35' }}>
              {stats.byCategory.deduplication || 0}
            </span>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Errors:</span>
            <span className="debug-stat-value" style={{ color: '#ff4444' }}>
              {stats.byLevel.error || 0}
            </span>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Warnings:</span>
            <span className="debug-stat-value" style={{ color: '#ffaa00' }}>
              {stats.byLevel.warn || 0}
            </span>
          </div>
        </div>

        {/* Filters */}
        <div className="debug-filters">
          <div className="debug-filter-group">
            <label>Category:</label>
            <select value={filter} onChange={(e) => setFilter(e.target.value as any)}>
              <option value="all">All Categories</option>
              <option value="deduplication">Deduplication</option>
              <option value="rendering">Rendering</option>
              <option value="events">Events</option>
              <option value="general">General</option>
            </select>
          </div>

          <div className="debug-filter-group">
            <label>Level:</label>
            <select value={levelFilter} onChange={(e) => setLevelFilter(e.target.value as any)}>
              <option value="all">All Levels</option>
              <option value="info">Info</option>
              <option value="warn">Warnings</option>
              <option value="error">Errors</option>
            </select>
          </div>

          <div className="debug-filter-group">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto-refresh (2s)
            </label>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="debug-logs">
        {!enabled && (
          <div className="debug-logs-disabled">
            <p>🔒 Debug logging is currently disabled.</p>
            <p>Enable it to start tracking events and issues in production.</p>
            <button className="debug-enable-btn" onClick={handleToggleEnabled}>
              Enable Debug Logging
            </button>
          </div>
        )}

        {enabled && logs.length === 0 && (
          <div className="debug-logs-empty">
            <p>📭 No logs yet.</p>
            <p>Logs will appear here as events occur.</p>
          </div>
        )}

        {enabled && logs.length > 0 && (
          <div className="debug-logs-list">
            {logs.map((log, idx) => (
              <div key={idx} className={`debug-log-entry ${log.level}`}>
                <div className="debug-log-header">
                  <span className="debug-log-icon">{getLevelIcon(log.level)}</span>
                  <span className="debug-log-timestamp">{formatTimestamp(log.timestamp)}</span>
                  <span
                    className="debug-log-category"
                    style={{ color: getCategoryColor(log.category) }}
                  >
                    {log.category}
                  </span>
                </div>
                <div className="debug-log-message">{log.message}</div>
                {log.data && (
                  <details className="debug-log-data">
                    <summary>View Data</summary>
                    <pre>{JSON.stringify(log.data, null, 2)}</pre>
                  </details>
                )}
                {log.stackTrace && (
                  <details className="debug-log-stack">
                    <summary>View Stack Trace</summary>
                    <pre>{log.stackTrace}</pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Session Stats Section */}
      <div className="debug-panel-storage">
        <h3>📊 Sessions</h3>
        <div className="debug-stats" style={{ marginBottom: '12px' }}>
          <div className="debug-stat">
            <span className="debug-stat-label">Active Sessions:</span>
            <span className="debug-stat-value">{activeSessions.length}</span>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Completed:</span>
            <span className="debug-stat-value">{completedSessions.length}</span>
          </div>
          <div className="debug-stat">
            <span className="debug-stat-label">Total:</span>
            <span className="debug-stat-value" style={{ color: '#00D9FF' }}>{sessions.length}</span>
          </div>
        </div>
        <p className="debug-panel-description" style={{ fontSize: '11px', opacity: 0.7 }}>
          Chat history is managed by Claude SDK. Sessions are stored in sessionStore.
        </p>
      </div>

      {/* Help */}
      <div className="debug-panel-help">
        <h3>💡 How to Use</h3>
        <ul>
          <li><strong>Enable Logging:</strong> Turn on debug logging to track events</li>
          <li><strong>Filter Logs:</strong> Use filters to focus on specific categories or levels</li>
          <li><strong>Export Logs:</strong> Save logs as JSON to share with support or analyze later</li>
          <li><strong>Deduplication:</strong> Watch for duplicate events in the "deduplication" category</li>
        </ul>

        <h3>🔍 Categories</h3>
        <ul>
          <li><span style={{ color: '#FF6B35' }}>●</span> <strong>Deduplication:</strong> Event duplicate detection</li>
          <li><span style={{ color: '#00D9FF' }}>●</span> <strong>Rendering:</strong> UI rendering issues</li>
          <li><span style={{ color: '#F7931E' }}>●</span> <strong>Events:</strong> Event stream processing</li>
          <li><span style={{ color: '#004E89' }}>●</span> <strong>General:</strong> General system logs</li>
        </ul>
      </div>
    </div>
  );
}
