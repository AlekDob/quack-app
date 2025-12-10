/**
 * Background Agents System Tests
 *
 * Tests for the background task management system including:
 * - Store operations
 * - Queue management
 * - Priority handling
 * - Task lifecycle
 *
 * @module tests/backgroundAgents
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useBackgroundAgentStore } from '../stores/backgroundAgentStore';
import type { BackgroundTaskConfig, BackgroundTaskPriority } from '../types';

// Reset store before each test
beforeEach(() => {
  // Reset store to initial state
  useBackgroundAgentStore.setState({
    tasks: [],
    maxConcurrent: 3,
    isPaused: false,
    watchTriggers: [],
    droidAutoTriggers: [],
    filters: {},
    selectedTaskId: null,
    expandedTaskIds: new Set(),
  });
});

describe('BackgroundAgentStore', () => {
  describe('Task Creation', () => {
    it('should create a task with correct defaults', () => {
      const store = useBackgroundAgentStore.getState();

      const config: BackgroundTaskConfig = {
        type: 'agent',
        name: 'Test Task',
        priority: 'medium',
        prompt: 'Test prompt',
      };

      const taskId = store.createTask(config);

      expect(taskId).toBeDefined();
      expect(taskId.length).toBeGreaterThan(0);

      const task = store.getTask(taskId);
      expect(task).toBeDefined();
      expect(task?.status).toBe('queued');
      expect(task?.config.name).toBe('Test Task');
      expect(task?.config.priority).toBe('medium');
      expect(task?.retryCount).toBe(0);
      expect(task?.logs).toEqual([]);
    });

    it('should assign correct queue positions', () => {
      const store = useBackgroundAgentStore.getState();

      const task1 = store.createTask({
        type: 'agent',
        name: 'Task 1',
        priority: 'medium',
        prompt: 'Prompt 1',
      });

      const task2 = store.createTask({
        type: 'agent',
        name: 'Task 2',
        priority: 'medium',
        prompt: 'Prompt 2',
      });

      const task3 = store.createTask({
        type: 'agent',
        name: 'Task 3',
        priority: 'medium',
        prompt: 'Prompt 3',
      });

      const queuedTasks = store.getQueuedTasks();
      expect(queuedTasks.length).toBe(3);

      // Queue positions should be assigned
      expect(queuedTasks[0].queuePosition).toBeDefined();
      expect(queuedTasks[1].queuePosition).toBeDefined();
      expect(queuedTasks[2].queuePosition).toBeDefined();
    });
  });

  describe('Priority Queue', () => {
    it('should sort tasks by priority', () => {
      const store = useBackgroundAgentStore.getState();

      // Create tasks in order: low, medium, high
      store.createTask({
        type: 'agent',
        name: 'Low Priority',
        priority: 'low',
        prompt: 'Prompt',
      });

      store.createTask({
        type: 'agent',
        name: 'Medium Priority',
        priority: 'medium',
        prompt: 'Prompt',
      });

      store.createTask({
        type: 'agent',
        name: 'High Priority',
        priority: 'high',
        prompt: 'Prompt',
      });

      // Get next task to run (should be high priority)
      const nextTask = store.getNextTaskToRun();
      expect(nextTask).toBeDefined();
      expect(nextTask?.config.name).toBe('High Priority');
    });

    it('should respect priority order: high > medium > low', () => {
      const store = useBackgroundAgentStore.getState();

      const tasks: { priority: BackgroundTaskPriority; name: string }[] = [
        { priority: 'low', name: 'Low 1' },
        { priority: 'high', name: 'High 1' },
        { priority: 'medium', name: 'Medium 1' },
        { priority: 'high', name: 'High 2' },
        { priority: 'low', name: 'Low 2' },
      ];

      tasks.forEach(({ priority, name }) => {
        store.createTask({
          type: 'agent',
          name,
          priority,
          prompt: 'Prompt',
        });
      });

      const queuedTasks = store.getQueuedTasks();
      const priorities = queuedTasks.map(t => t.config.priority);

      // High priority tasks should come first
      const highCount = priorities.filter(p => p === 'high').length;
      const highPriorities = priorities.slice(0, highCount);
      expect(highPriorities.every(p => p === 'high')).toBe(true);
    });

    it('should allow updating task priority', () => {
      const store = useBackgroundAgentStore.getState();

      const taskId = store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'low',
        prompt: 'Prompt',
      });

      // Update to high priority
      store.updateTaskPriority(taskId, 'high');

      const task = store.getTask(taskId);
      expect(task?.config.priority).toBe('high');
    });
  });

  describe('Task Lifecycle', () => {
    it('should transition from queued to running', () => {
      const store = useBackgroundAgentStore.getState();

      const taskId = store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      expect(store.getTask(taskId)?.status).toBe('queued');

      store.startTask(taskId);

      expect(store.getTask(taskId)?.status).toBe('running');
      expect(store.getTask(taskId)?.startedAt).toBeDefined();
    });

    it('should transition from running to completed', () => {
      const store = useBackgroundAgentStore.getState();

      const taskId = store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      store.startTask(taskId);
      store.completeTask(taskId, {
        success: true,
        output: 'Result output',
        duration_ms: 1000,
      });

      const task = store.getTask(taskId);
      expect(task?.status).toBe('completed');
      expect(task?.completedAt).toBeDefined();
      expect(task?.result?.success).toBe(true);
      expect(task?.result?.output).toBe('Result output');
    });

    it('should transition from running to failed', () => {
      const store = useBackgroundAgentStore.getState();

      const taskId = store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      store.startTask(taskId);
      store.failTask(taskId, 'Something went wrong');

      const task = store.getTask(taskId);
      expect(task?.status).toBe('failed');
      expect(task?.completedAt).toBeDefined();
      expect(task?.result?.success).toBe(false);
      expect(task?.result?.error).toBe('Something went wrong');
    });

    it('should allow pause and resume', () => {
      const store = useBackgroundAgentStore.getState();

      const taskId = store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      store.startTask(taskId);
      expect(store.getTask(taskId)?.status).toBe('running');

      store.pauseTask(taskId);
      expect(store.getTask(taskId)?.status).toBe('paused');
      expect(store.getTask(taskId)?.pausedAt).toBeDefined();

      store.resumeTask(taskId);
      expect(store.getTask(taskId)?.status).toBe('running');
    });

    it('should allow retry of failed tasks', () => {
      const store = useBackgroundAgentStore.getState();

      const taskId = store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      store.startTask(taskId);
      store.failTask(taskId, 'Error');
      expect(store.getTask(taskId)?.status).toBe('failed');

      store.retryTask(taskId);

      const task = store.getTask(taskId);
      expect(task?.status).toBe('queued');
      expect(task?.retryCount).toBe(1);
    });
  });

  describe('Concurrency Control', () => {
    it('should respect maxConcurrent limit', () => {
      const store = useBackgroundAgentStore.getState();
      store.setMaxConcurrent(2);

      // Create 3 tasks
      const task1 = store.createTask({
        type: 'agent',
        name: 'Task 1',
        priority: 'medium',
        prompt: 'Prompt',
      });

      const task2 = store.createTask({
        type: 'agent',
        name: 'Task 2',
        priority: 'medium',
        prompt: 'Prompt',
      });

      const task3 = store.createTask({
        type: 'agent',
        name: 'Task 3',
        priority: 'medium',
        prompt: 'Prompt',
      });

      // Start first two tasks
      store.startTask(task1);
      store.startTask(task2);

      // Should not be able to start a new task
      expect(store.canStartNewTask()).toBe(false);

      // Complete one task
      store.completeTask(task1, { success: true, duration_ms: 100 });

      // Now should be able to start another
      expect(store.canStartNewTask()).toBe(true);
    });

    it('should pause queue when isPaused is true', () => {
      const store = useBackgroundAgentStore.getState();

      store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      expect(store.canStartNewTask()).toBe(true);

      store.pauseQueue();

      expect(store.canStartNewTask()).toBe(false);

      store.resumeQueue();

      expect(store.canStartNewTask()).toBe(true);
    });
  });

  describe('Logs Management', () => {
    it('should add logs to tasks', () => {
      const store = useBackgroundAgentStore.getState();

      const taskId = store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      store.addTaskLog(taskId, {
        level: 'info',
        message: 'Starting task',
        source: 'system',
      });

      store.addTaskLog(taskId, {
        level: 'warn',
        message: 'Warning message',
        source: 'agent',
      });

      const task = store.getTask(taskId);
      expect(task?.logs.length).toBe(2);
      expect(task?.logs[0].message).toBe('Starting task');
      expect(task?.logs[1].level).toBe('warn');
    });

    it('should limit logs per task', () => {
      const store = useBackgroundAgentStore.getState();
      const MAX_LOGS = 500; // From store constant

      const taskId = store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      // Add more than max logs
      for (let i = 0; i < MAX_LOGS + 100; i++) {
        store.addTaskLog(taskId, {
          level: 'info',
          message: `Log ${i}`,
          source: 'test',
        });
      }

      const task = store.getTask(taskId);
      expect(task?.logs.length).toBeLessThanOrEqual(MAX_LOGS);
    });

    it('should toggle logs visibility', () => {
      const store = useBackgroundAgentStore.getState();

      const taskId = store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      // Default should be based on config
      const initialVisibility = store.getTask(taskId)?.logsVisible;

      store.toggleTaskLogs(taskId);
      expect(store.getTask(taskId)?.logsVisible).toBe(!initialVisibility);

      store.toggleTaskLogs(taskId);
      expect(store.getTask(taskId)?.logsVisible).toBe(initialVisibility);
    });
  });

  describe('Filtering', () => {
    it('should filter tasks by status', () => {
      const store = useBackgroundAgentStore.getState();

      const task1 = store.createTask({
        type: 'agent',
        name: 'Task 1',
        priority: 'medium',
        prompt: 'Prompt',
      });

      const task2 = store.createTask({
        type: 'agent',
        name: 'Task 2',
        priority: 'medium',
        prompt: 'Prompt',
      });

      store.startTask(task1);
      store.completeTask(task1, { success: true, duration_ms: 100 });

      const completed = store.getTasksByStatus('completed');
      expect(completed.length).toBe(1);
      expect(completed[0].id).toBe(task1);

      const queued = store.getTasksByStatus('queued');
      expect(queued.length).toBe(1);
      expect(queued[0].id).toBe(task2);
    });

    it('should filter tasks by type', () => {
      const store = useBackgroundAgentStore.getState();

      store.createTask({
        type: 'agent',
        name: 'Agent Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      store.createTask({
        type: 'build',
        name: 'Build Task',
        priority: 'medium',
        command: 'npm run build',
      });

      store.createTask({
        type: 'test',
        name: 'Test Task',
        priority: 'medium',
        command: 'npm test',
      });

      expect(store.getTasksByType('agent').length).toBe(1);
      expect(store.getTasksByType('build').length).toBe(1);
      expect(store.getTasksByType('test').length).toBe(1);
    });

    it('should filter tasks by search query', () => {
      const store = useBackgroundAgentStore.getState();

      store.createTask({
        type: 'agent',
        name: 'Build Frontend',
        priority: 'medium',
        prompt: 'Prompt',
      });

      store.createTask({
        type: 'agent',
        name: 'Test Backend',
        priority: 'medium',
        prompt: 'Prompt',
      });

      store.setFilters({ searchQuery: 'frontend' });
      const filtered = store.getFilteredTasks();

      expect(filtered.length).toBe(1);
      expect(filtered[0].config.name).toBe('Build Frontend');
    });
  });

  describe('Queue Statistics', () => {
    it('should calculate correct queue stats', () => {
      const store = useBackgroundAgentStore.getState();

      // Create tasks with different states
      const task1 = store.createTask({
        type: 'agent',
        name: 'Task 1',
        priority: 'high',
        prompt: 'Prompt',
      });

      const task2 = store.createTask({
        type: 'agent',
        name: 'Task 2',
        priority: 'medium',
        prompt: 'Prompt',
      });

      const task3 = store.createTask({
        type: 'agent',
        name: 'Task 3',
        priority: 'low',
        prompt: 'Prompt',
      });

      store.startTask(task1);
      store.startTask(task2);
      store.completeTask(task2, { success: true, duration_ms: 100 });

      // Get fresh state after mutations
      const currentState = useBackgroundAgentStore.getState();
      const stats = currentState.getQueueStats();

      expect(stats.totalTasks).toBe(3);
      expect(stats.running).toBe(1);
      expect(stats.queued).toBe(1);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(0);
    });
  });

  describe('Task Removal', () => {
    it('should remove a single task', () => {
      const store = useBackgroundAgentStore.getState();

      const taskId = store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      // Get fresh state
      let currentState = useBackgroundAgentStore.getState();
      expect(currentState.tasks.length).toBe(1);

      currentState.removeTask(taskId);

      // Get fresh state after removal
      currentState = useBackgroundAgentStore.getState();
      expect(currentState.tasks.length).toBe(0);
      expect(currentState.getTask(taskId)).toBeUndefined();
    });

    it('should clear all completed tasks', () => {
      const store = useBackgroundAgentStore.getState();

      const task1 = store.createTask({
        type: 'agent',
        name: 'Task 1',
        priority: 'medium',
        prompt: 'Prompt',
      });

      const task2 = store.createTask({
        type: 'agent',
        name: 'Task 2',
        priority: 'medium',
        prompt: 'Prompt',
      });

      const task3 = store.createTask({
        type: 'agent',
        name: 'Task 3',
        priority: 'medium',
        prompt: 'Prompt',
      });

      store.startTask(task1);
      store.completeTask(task1, { success: true, duration_ms: 100 });

      store.startTask(task2);
      store.completeTask(task2, { success: true, duration_ms: 100 });

      // Task 3 remains queued

      store.clearCompletedTasks();

      // Get fresh state after clearing
      const currentState = useBackgroundAgentStore.getState();
      expect(currentState.tasks.length).toBe(1);
      expect(currentState.getTask(task3)).toBeDefined();
      expect(currentState.getTask(task1)).toBeUndefined();
      expect(currentState.getTask(task2)).toBeUndefined();
    });
  });

  describe('UI State', () => {
    it('should manage expanded task IDs', () => {
      const store = useBackgroundAgentStore.getState();

      const task1 = store.createTask({
        type: 'agent',
        name: 'Task 1',
        priority: 'medium',
        prompt: 'Prompt',
      });

      const task2 = store.createTask({
        type: 'agent',
        name: 'Task 2',
        priority: 'medium',
        prompt: 'Prompt',
      });

      // Toggle expand
      store.toggleTaskExpanded(task1);
      let currentState = useBackgroundAgentStore.getState();
      expect(currentState.expandedTaskIds.has(task1)).toBe(true);

      currentState.toggleTaskExpanded(task1);
      currentState = useBackgroundAgentStore.getState();
      expect(currentState.expandedTaskIds.has(task1)).toBe(false);

      // Expand all
      currentState.expandAllTasks();
      currentState = useBackgroundAgentStore.getState();
      expect(currentState.expandedTaskIds.has(task1)).toBe(true);
      expect(currentState.expandedTaskIds.has(task2)).toBe(true);

      // Collapse all
      currentState.collapseAllTasks();
      currentState = useBackgroundAgentStore.getState();
      expect(currentState.expandedTaskIds.size).toBe(0);
    });

    it('should manage selected task', () => {
      const store = useBackgroundAgentStore.getState();

      const taskId = store.createTask({
        type: 'agent',
        name: 'Task',
        priority: 'medium',
        prompt: 'Prompt',
      });

      let currentState = useBackgroundAgentStore.getState();
      expect(currentState.selectedTaskId).toBeNull();

      currentState.setSelectedTask(taskId);
      currentState = useBackgroundAgentStore.getState();
      expect(currentState.selectedTaskId).toBe(taskId);

      currentState.setSelectedTask(null);
      currentState = useBackgroundAgentStore.getState();
      expect(currentState.selectedTaskId).toBeNull();
    });
  });
});
