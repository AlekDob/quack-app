/**
 * Tests for Kanban In Progress Column Status Grouping
 *
 * Tests the logic for grouping In Progress tasks into:
 * - READY: Agent tasks that finished working (has messages, not loading, not dormant)
 * - WORKING: Tasks actively being processed (loading or dormant)
 */

import { describe, it, expect } from 'vitest';
import type { KanbanTask, ChatMessage } from '../types';

// Recreate the isTaskReady logic from KanbanColumn
function isTaskReady(
  task: KanbanTask,
  isLoading: boolean,
  hasMessages: boolean,
  isDormant: boolean
): boolean {
  const isAgentTask = (task.type || 'agent') === 'agent';
  return isAgentTask && hasMessages && !isLoading && !isDormant;
}

// Helper to create a mock task
function createMockTask(overrides: Partial<KanbanTask> = {}): KanbanTask {
  return {
    id: `task-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Task',
    prompt: 'Test prompt',
    status: 'in_progress',
    type: 'agent',
    projectPath: '/test/project',
    projectName: 'test-project',
    createdAt: Date.now(),
    ...overrides,
  };
}

// Helper to create mock messages
function createMockMessages(hasUserMessage: boolean): ChatMessage[] {
  const messages: ChatMessage[] = [];
  if (hasUserMessage) {
    messages.push({
      id: 'msg-1',
      role: 'user',
      content: 'Hello',
      timestamp: Date.now(),
    });
  }
  messages.push({
    id: 'msg-2',
    role: 'assistant',
    content: 'Response',
    timestamp: Date.now(),
  });
  return messages;
}

describe('Kanban In Progress Status Grouping', () => {
  describe('isTaskReady', () => {
    it('should return true for agent task that is not loading, has messages, and is not dormant', () => {
      const task = createMockTask({ type: 'agent' });
      const result = isTaskReady(task, false, true, false);
      expect(result).toBe(true);
    });

    it('should return false when task is loading', () => {
      const task = createMockTask({ type: 'agent' });
      const result = isTaskReady(task, true, true, false);
      expect(result).toBe(false);
    });

    it('should return false when task has no messages', () => {
      const task = createMockTask({ type: 'agent' });
      const result = isTaskReady(task, false, false, false);
      expect(result).toBe(false);
    });

    it('should return false when task is dormant (no user interaction)', () => {
      const task = createMockTask({ type: 'agent' });
      const result = isTaskReady(task, false, true, true);
      expect(result).toBe(false);
    });

    it('should return false for shell tasks (always working)', () => {
      const task = createMockTask({ type: 'shell' });
      const result = isTaskReady(task, false, true, false);
      expect(result).toBe(false);
    });

    it('should return false for watch tasks (always working)', () => {
      const task = createMockTask({ type: 'watch' });
      const result = isTaskReady(task, false, true, false);
      expect(result).toBe(false);
    });

    it('should treat tasks without type as agent tasks', () => {
      // Backwards compatibility: tasks without type should be treated as agent
      const task = createMockTask();
      delete (task as any).type;
      const result = isTaskReady(task, false, true, false);
      expect(result).toBe(true);
    });
  });

  describe('Task Grouping Logic', () => {
    // Simulate the grouping logic from KanbanColumn
    type InProgressBucket = 'ready' | 'working';

    interface TaskWithState {
      task: KanbanTask;
      isLoading: boolean;
      hasMessages: boolean;
      isDormant: boolean;
    }

    interface InProgressGroup {
      bucket: InProgressBucket;
      label: string;
      tasks: TaskWithState[];
    }

    function groupInProgressTasks(
      tasks: KanbanTask[],
      chatLoadingMap: Map<string, boolean>,
      chatSessions: Map<string, ChatMessage[]>
    ): InProgressGroup[] {
      const ready: TaskWithState[] = [];
      const working: TaskWithState[] = [];

      tasks.forEach((task) => {
        const isLoading = chatLoadingMap?.get(task.id) || false;
        const messages = chatSessions?.get(task.id) || [];
        const hasMessages = messages.length > 0;
        const hasUserMessage = messages.some((msg) => msg.role === 'user');
        const isDormant = !hasUserMessage;

        const taskWithState: TaskWithState = {
          task,
          isLoading,
          hasMessages,
          isDormant,
        };

        if (isTaskReady(task, isLoading, hasMessages, isDormant)) {
          ready.push(taskWithState);
        } else {
          working.push(taskWithState);
        }
      });

      const groups: InProgressGroup[] = [];
      if (ready.length > 0) {
        groups.push({ bucket: 'ready', label: 'READY', tasks: ready });
      }
      if (working.length > 0) {
        groups.push({ bucket: 'working', label: 'WORKING', tasks: working });
      }

      return groups;
    }

    it('should put ready agent task in READY group', () => {
      const task = createMockTask({ id: 'task-1', type: 'agent' });
      const chatLoadingMap = new Map<string, boolean>([['task-1', false]]);
      const chatSessions = new Map<string, ChatMessage[]>([
        ['task-1', createMockMessages(true)],
      ]);

      const groups = groupInProgressTasks([task], chatLoadingMap, chatSessions);

      expect(groups).toHaveLength(1);
      expect(groups[0].bucket).toBe('ready');
      expect(groups[0].tasks).toHaveLength(1);
      expect(groups[0].tasks[0].task.id).toBe('task-1');
    });

    it('should put loading agent task in WORKING group', () => {
      const task = createMockTask({ id: 'task-1', type: 'agent' });
      const chatLoadingMap = new Map<string, boolean>([['task-1', true]]);
      const chatSessions = new Map<string, ChatMessage[]>([
        ['task-1', createMockMessages(true)],
      ]);

      const groups = groupInProgressTasks([task], chatLoadingMap, chatSessions);

      expect(groups).toHaveLength(1);
      expect(groups[0].bucket).toBe('working');
    });

    it('should put dormant task (no user message) in WORKING group', () => {
      const task = createMockTask({ id: 'task-1', type: 'agent' });
      const chatLoadingMap = new Map<string, boolean>([['task-1', false]]);
      // Messages exist but no user message (only assistant message)
      const chatSessions = new Map<string, ChatMessage[]>([
        ['task-1', createMockMessages(false)],
      ]);

      const groups = groupInProgressTasks([task], chatLoadingMap, chatSessions);

      expect(groups).toHaveLength(1);
      expect(groups[0].bucket).toBe('working');
    });

    it('should put shell task in WORKING group', () => {
      const task = createMockTask({ id: 'task-1', type: 'shell' });
      const chatLoadingMap = new Map<string, boolean>();
      const chatSessions = new Map<string, ChatMessage[]>();

      const groups = groupInProgressTasks([task], chatLoadingMap, chatSessions);

      expect(groups).toHaveLength(1);
      expect(groups[0].bucket).toBe('working');
    });

    it('should separate ready and working tasks correctly', () => {
      const readyTask = createMockTask({ id: 'ready-1', type: 'agent' });
      const workingTask1 = createMockTask({ id: 'working-1', type: 'agent' });
      const workingTask2 = createMockTask({ id: 'working-2', type: 'shell' });

      const chatLoadingMap = new Map<string, boolean>([
        ['ready-1', false],
        ['working-1', true], // Loading
        ['working-2', false],
      ]);

      const chatSessions = new Map<string, ChatMessage[]>([
        ['ready-1', createMockMessages(true)],
        ['working-1', createMockMessages(true)],
        ['working-2', []],
      ]);

      const groups = groupInProgressTasks(
        [readyTask, workingTask1, workingTask2],
        chatLoadingMap,
        chatSessions
      );

      expect(groups).toHaveLength(2);
      expect(groups[0].bucket).toBe('ready');
      expect(groups[0].tasks).toHaveLength(1);
      expect(groups[0].tasks[0].task.id).toBe('ready-1');

      expect(groups[1].bucket).toBe('working');
      expect(groups[1].tasks).toHaveLength(2);
    });

    it('should put READY group first (at the top)', () => {
      const readyTask = createMockTask({ id: 'ready-1', type: 'agent' });
      const workingTask = createMockTask({ id: 'working-1', type: 'agent' });

      const chatLoadingMap = new Map<string, boolean>([
        ['ready-1', false],
        ['working-1', true],
      ]);

      const chatSessions = new Map<string, ChatMessage[]>([
        ['ready-1', createMockMessages(true)],
        ['working-1', createMockMessages(true)],
      ]);

      // Even if working task comes first in the array
      const groups = groupInProgressTasks(
        [workingTask, readyTask],
        chatLoadingMap,
        chatSessions
      );

      expect(groups[0].bucket).toBe('ready');
      expect(groups[1].bucket).toBe('working');
    });

    it('should return empty array for empty task list', () => {
      const chatLoadingMap = new Map<string, boolean>();
      const chatSessions = new Map<string, ChatMessage[]>();

      const groups = groupInProgressTasks([], chatLoadingMap, chatSessions);

      expect(groups).toHaveLength(0);
    });

    it('should handle tasks with no chat session data', () => {
      const task = createMockTask({ id: 'task-1', type: 'agent' });
      const chatLoadingMap = new Map<string, boolean>();
      const chatSessions = new Map<string, ChatMessage[]>();

      const groups = groupInProgressTasks([task], chatLoadingMap, chatSessions);

      // No messages = not ready
      expect(groups).toHaveLength(1);
      expect(groups[0].bucket).toBe('working');
    });

    it('should only return READY group when all tasks are ready', () => {
      const task1 = createMockTask({ id: 'task-1', type: 'agent' });
      const task2 = createMockTask({ id: 'task-2', type: 'agent' });

      const chatLoadingMap = new Map<string, boolean>([
        ['task-1', false],
        ['task-2', false],
      ]);

      const chatSessions = new Map<string, ChatMessage[]>([
        ['task-1', createMockMessages(true)],
        ['task-2', createMockMessages(true)],
      ]);

      const groups = groupInProgressTasks([task1, task2], chatLoadingMap, chatSessions);

      expect(groups).toHaveLength(1);
      expect(groups[0].bucket).toBe('ready');
      expect(groups[0].tasks).toHaveLength(2);
    });

    it('should only return WORKING group when no tasks are ready', () => {
      const task1 = createMockTask({ id: 'task-1', type: 'agent' });
      const task2 = createMockTask({ id: 'task-2', type: 'shell' });

      const chatLoadingMap = new Map<string, boolean>([
        ['task-1', true], // Loading
        ['task-2', false],
      ]);

      const chatSessions = new Map<string, ChatMessage[]>([
        ['task-1', createMockMessages(true)],
      ]);

      const groups = groupInProgressTasks([task1, task2], chatLoadingMap, chatSessions);

      expect(groups).toHaveLength(1);
      expect(groups[0].bucket).toBe('working');
      expect(groups[0].tasks).toHaveLength(2);
    });
  });
});
