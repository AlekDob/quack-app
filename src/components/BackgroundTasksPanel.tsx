/**
 * BackgroundTasksPanel Component
 *
 * Dedicated panel for managing background tasks.
 * Shows task queue, progress, logs, and controls.
 *
 * @module BackgroundTasksPanel
 */

import { useState, useCallback } from 'react';
import { useBackgroundAgents } from '../hooks/useBackgroundAgents';
import BackgroundTaskCard from './BackgroundTaskCard';
import TaskDetailsDrawer from './TaskDetailsDrawer';
import type {
  BackgroundTask,
  BackgroundTaskStatus,
  BackgroundTaskType,
  BackgroundTaskPriority,
} from '../types';

interface BackgroundTasksPanelProps {
  onClose?: () => void;
}

// Status filter options
const STATUS_OPTIONS: { value: BackgroundTaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'running', label: 'Running' },
  { value: 'queued', label: 'Queued' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
];

// Type filter options
const TYPE_OPTIONS: { value: BackgroundTaskType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'agent', label: 'Agents' },
  { value: 'build', label: 'Builds' },
  { value: 'test', label: 'Tests' },
  { value: 'analysis', label: 'Analysis' },
  { value: 'watch', label: 'Watchers' },
  { value: 'custom', label: 'Custom' },
];

export default function BackgroundTasksPanel({ onClose }: BackgroundTasksPanelProps) {
  const {
    tasks,
    filteredTasks,
    filters,
    maxConcurrent,
    isPaused,
    // Actions
    pauseTask,
    resumeTask,
    cancelTask,
    retryTask,
    removeTask,
    clearCompletedTasks,
    // Queue management
    setMaxConcurrent,
    pauseQueue,
    resumeQueue,
    updateTaskPriority,
    // UI actions
    setFilters,
    // Computed
    runningCount,
    queuedCount,
    completedCount,
    failedCount,
  } = useBackgroundAgents();

  const [showSettings, setShowSettings] = useState(false);
  const [selectedTask, setSelectedTask] = useState<BackgroundTask | null>(null);

  // Filter handlers
  const handleStatusFilter = useCallback((status: BackgroundTaskStatus | 'all') => {
    setFilters({
      status: status === 'all' ? undefined : [status],
    });
  }, [setFilters]);

  const handleTypeFilter = useCallback((type: BackgroundTaskType | 'all') => {
    setFilters({
      type: type === 'all' ? undefined : [type],
    });
  }, [setFilters]);

  const handleSearchChange = useCallback((query: string) => {
    setFilters({ searchQuery: query || undefined });
  }, [setFilters]);

  // Calculate stats
  const stats = {
    total: tasks.length,
    running: runningCount,
    queued: queuedCount,
    completed: completedCount,
    failed: failedCount,
  };

  return (
    <div className="background-tasks-panel">
      {/* Header */}
      <header className="background-tasks-header">
        <div className="background-tasks-title">
          <h2>Background Tasks</h2>
          {onClose && (
            <button
              type="button"
              className="background-tasks-close"
              onClick={onClose}
              title="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Stats bar */}
        <div className="background-tasks-stats">
          <div className="stat-item running">
            <span className="stat-dot" />
            <span className="stat-value">{stats.running}</span>
            <span className="stat-label">Running</span>
          </div>
          <div className="stat-item queued">
            <span className="stat-dot" />
            <span className="stat-value">{stats.queued}</span>
            <span className="stat-label">Queued</span>
          </div>
          <div className="stat-item completed">
            <span className="stat-dot" />
            <span className="stat-value">{stats.completed}</span>
            <span className="stat-label">Done</span>
          </div>
          <div className="stat-item failed">
            <span className="stat-dot" />
            <span className="stat-value">{stats.failed}</span>
            <span className="stat-label">Failed</span>
          </div>
        </div>
      </header>

      {/* Toolbar */}
      <div className="background-tasks-toolbar">
        {/* Search */}
        <div className="background-tasks-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Search tasks..."
            value={filters.searchQuery || ''}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Filters */}
        <div className="background-tasks-filters">
          <select
            value={filters.status?.[0] || 'all'}
            onChange={(e) => handleStatusFilter(e.target.value as BackgroundTaskStatus | 'all')}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={filters.type?.[0] || 'all'}
            onChange={(e) => handleTypeFilter(e.target.value as BackgroundTaskType | 'all')}
          >
            {TYPE_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="background-tasks-actions">
          <button
            type="button"
            className="action-btn"
            onClick={() => isPaused ? resumeQueue() : pauseQueue()}
            title={isPaused ? 'Resume Queue' : 'Pause Queue'}
          >
            {isPaused ? 'Play' : 'Pause'}
          </button>
          <button
            type="button"
            className="action-btn"
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            Settings
          </button>
          <button
            type="button"
            className="action-btn danger"
            onClick={clearCompletedTasks}
            title="Clear Completed"
            disabled={completedCount === 0}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Settings panel (collapsible) */}
      {showSettings && (
        <div className="background-tasks-settings">
          <div className="settings-row">
            <label>Max Concurrent Tasks</label>
            <div className="settings-control">
              <button
                type="button"
                onClick={() => setMaxConcurrent(Math.max(1, maxConcurrent - 1))}
                disabled={maxConcurrent <= 1}
              >
                -
              </button>
              <span>{maxConcurrent}</span>
              <button
                type="button"
                onClick={() => setMaxConcurrent(Math.min(10, maxConcurrent + 1))}
                disabled={maxConcurrent >= 10}
              >
                +
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task list */}
      <div className="background-tasks-list">
        {filteredTasks.length === 0 ? (
          <div className="background-tasks-empty">
            <div className="empty-icon">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 12l2 2 4-4" />
              </svg>
            </div>
            <p>No background tasks</p>
            <span>Tasks will appear here when you run agents or commands in the background</span>
          </div>
        ) : (
          filteredTasks.map((task) => (
            <BackgroundTaskCard
              key={task.id}
              task={task}
              onPause={() => pauseTask(task.id)}
              onResume={() => resumeTask(task.id)}
              onCancel={() => cancelTask(task.id)}
              onRetry={() => retryTask(task.id)}
              onRemove={() => removeTask(task.id)}
              onChangePriority={(priority: BackgroundTaskPriority) => updateTaskPriority(task.id, priority)}
              onOpenDetails={() => setSelectedTask(task)}
            />
          ))
        )}
      </div>

      {/* Queue status footer */}
      {isPaused && (
        <div className="background-tasks-footer paused">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
          <span>Queue paused - {queuedCount} tasks waiting</span>
          <button type="button" onClick={resumeQueue}>Resume</button>
        </div>
      )}

      {/* Task Details Drawer */}
      <TaskDetailsDrawer
        task={selectedTask ? tasks.find(t => t.id === selectedTask.id) || selectedTask : null}
        isOpen={selectedTask !== null}
        onClose={() => setSelectedTask(null)}
        onPause={() => selectedTask && pauseTask(selectedTask.id)}
        onResume={() => selectedTask && resumeTask(selectedTask.id)}
        onCancel={() => {
          if (selectedTask) {
            cancelTask(selectedTask.id);
            setSelectedTask(null);
          }
        }}
        onRetry={() => selectedTask && retryTask(selectedTask.id)}
        onRemove={() => {
          if (selectedTask) {
            removeTask(selectedTask.id);
            setSelectedTask(null);
          }
        }}
        onChangePriority={(priority) => selectedTask && updateTaskPriority(selectedTask.id, priority)}
      />
    </div>
  );
}
