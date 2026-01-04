/**
 * Tests for Kanban Infinite Scroll Feature
 *
 * Tests the pagination state and selectors in kanbanStore
 * for the Done column infinite scroll functionality.
 *
 * @module tests/kanbanInfiniteScroll
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';

// Mock Tauri Store
vi.mock('@tauri-apps/plugin-store', () => ({
  Store: vi.fn().mockImplementation(() => ({
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Import store after mocking
import { useKanbanStore } from '../stores/kanbanStore';
import type { KanbanTask } from '../types';

// Helper to create mock tasks
function createMockDoneTask(id: string, completedAt: number): KanbanTask {
  return {
    id,
    title: `Done Task ${id}`,
    prompt: `Prompt for ${id}`,
    status: 'done',
    projectPath: '/test/project',
    projectName: 'Test Project',
    createdAt: Date.now() - 1000000,
    completedAt,
  };
}

function createMockTasks(count: number, status: 'todo' | 'in_progress' | 'done' = 'done'): KanbanTask[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `task-${i + 1}`,
    title: `Task ${i + 1}`,
    prompt: `Prompt for ${i + 1}`,
    status,
    projectPath: '/test/project',
    projectName: 'Test Project',
    createdAt: Date.now() - 1000000,
    completedAt: status === 'done' ? Date.now() - i * 1000 : undefined, // Most recent first
  }));
}

describe('Kanban Infinite Scroll', () => {
  beforeEach(() => {
    // Reset store to initial state
    useKanbanStore.setState({
      tasks: [],
      doneVisibleCount: 20,
      donePageSize: 20,
      isLoadingMoreDone: false,
    });
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Initial State', () => {
    it('should have default pagination values', () => {
      const state = useKanbanStore.getState();
      expect(state.doneVisibleCount).toBe(20);
      expect(state.donePageSize).toBe(20);
      expect(state.isLoadingMoreDone).toBe(false);
    });
  });

  describe('getVisibleDoneTasks', () => {
    it('should return only visible done tasks', () => {
      const doneTasks = createMockTasks(50, 'done');
      const todoTasks = createMockTasks(10, 'todo');

      useKanbanStore.setState({
        tasks: [...doneTasks, ...todoTasks],
        doneVisibleCount: 20,
      });

      const visibleTasks = useKanbanStore.getState().getVisibleDoneTasks();

      expect(visibleTasks.length).toBe(20);
      expect(visibleTasks.every((t) => t.status === 'done')).toBe(true);
    });

    it('should sort tasks by completedAt descending (most recent first)', () => {
      const now = Date.now();
      const tasks: KanbanTask[] = [
        createMockDoneTask('1', now - 3000), // Oldest
        createMockDoneTask('2', now - 1000), // Middle
        createMockDoneTask('3', now), // Most recent
      ];

      useKanbanStore.setState({ tasks, doneVisibleCount: 20 });

      const visibleTasks = useKanbanStore.getState().getVisibleDoneTasks();

      expect(visibleTasks[0].id).toBe('3'); // Most recent first
      expect(visibleTasks[1].id).toBe('2');
      expect(visibleTasks[2].id).toBe('1'); // Oldest last
    });

    it('should return all done tasks if less than visible count', () => {
      const doneTasks = createMockTasks(10, 'done');

      useKanbanStore.setState({
        tasks: doneTasks,
        doneVisibleCount: 20,
      });

      const visibleTasks = useKanbanStore.getState().getVisibleDoneTasks();

      expect(visibleTasks.length).toBe(10);
    });

    it('should return empty array if no done tasks', () => {
      const todoTasks = createMockTasks(10, 'todo');

      useKanbanStore.setState({
        tasks: todoTasks,
        doneVisibleCount: 20,
      });

      const visibleTasks = useKanbanStore.getState().getVisibleDoneTasks();

      expect(visibleTasks.length).toBe(0);
    });
  });

  describe('hasMoreDoneTasks', () => {
    it('should return true when there are more done tasks than visible', () => {
      const doneTasks = createMockTasks(50, 'done');

      useKanbanStore.setState({
        tasks: doneTasks,
        doneVisibleCount: 20,
      });

      expect(useKanbanStore.getState().hasMoreDoneTasks()).toBe(true);
    });

    it('should return false when all done tasks are visible', () => {
      const doneTasks = createMockTasks(15, 'done');

      useKanbanStore.setState({
        tasks: doneTasks,
        doneVisibleCount: 20,
      });

      expect(useKanbanStore.getState().hasMoreDoneTasks()).toBe(false);
    });

    it('should return false when visible count equals done tasks count', () => {
      const doneTasks = createMockTasks(20, 'done');

      useKanbanStore.setState({
        tasks: doneTasks,
        doneVisibleCount: 20,
      });

      expect(useKanbanStore.getState().hasMoreDoneTasks()).toBe(false);
    });
  });

  describe('loadMoreDone', () => {
    it('should increase visible count by page size', async () => {
      const doneTasks = createMockTasks(100, 'done');

      useKanbanStore.setState({
        tasks: doneTasks,
        doneVisibleCount: 20,
        donePageSize: 20,
      });

      act(() => {
        useKanbanStore.getState().loadMoreDone();
      });

      // Should set loading state immediately
      expect(useKanbanStore.getState().isLoadingMoreDone).toBe(true);

      // Fast-forward timers
      await act(async () => {
        vi.advanceTimersByTime(200);
      });

      expect(useKanbanStore.getState().doneVisibleCount).toBe(40);
      expect(useKanbanStore.getState().isLoadingMoreDone).toBe(false);
    });

    it('should not load more if already loading', async () => {
      useKanbanStore.setState({
        tasks: createMockTasks(100, 'done'),
        doneVisibleCount: 20,
        isLoadingMoreDone: true,
      });

      act(() => {
        useKanbanStore.getState().loadMoreDone();
      });

      // Should not change visible count
      expect(useKanbanStore.getState().doneVisibleCount).toBe(20);
    });

    it('should load multiple pages sequentially', async () => {
      const doneTasks = createMockTasks(100, 'done');

      useKanbanStore.setState({
        tasks: doneTasks,
        doneVisibleCount: 20,
        donePageSize: 20,
      });

      // Load first page
      act(() => {
        useKanbanStore.getState().loadMoreDone();
      });
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(useKanbanStore.getState().doneVisibleCount).toBe(40);

      // Load second page
      act(() => {
        useKanbanStore.getState().loadMoreDone();
      });
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(useKanbanStore.getState().doneVisibleCount).toBe(60);

      // Load third page
      act(() => {
        useKanbanStore.getState().loadMoreDone();
      });
      await act(async () => {
        vi.advanceTimersByTime(200);
      });
      expect(useKanbanStore.getState().doneVisibleCount).toBe(80);
    });
  });

  describe('resetDonePagination', () => {
    it('should reset visible count to default', () => {
      useKanbanStore.setState({
        doneVisibleCount: 100,
        isLoadingMoreDone: true,
      });

      act(() => {
        useKanbanStore.getState().resetDonePagination();
      });

      expect(useKanbanStore.getState().doneVisibleCount).toBe(20);
      expect(useKanbanStore.getState().isLoadingMoreDone).toBe(false);
    });
  });

  describe('Integration with other task operations', () => {
    it('should not affect todo and in_progress tasks', () => {
      const todoTasks = createMockTasks(30, 'todo');
      const inProgressTasks = createMockTasks(25, 'in_progress');
      const doneTasks = createMockTasks(50, 'done');

      useKanbanStore.setState({
        tasks: [...todoTasks, ...inProgressTasks, ...doneTasks],
        doneVisibleCount: 20,
      });

      const state = useKanbanStore.getState();

      // getTasksByStatus should return all tasks of that status
      expect(state.getTasksByStatus('todo').length).toBe(30);
      expect(state.getTasksByStatus('in_progress').length).toBe(25);
      expect(state.getTasksByStatus('done').length).toBe(50);

      // But visible done tasks should be limited
      expect(state.getVisibleDoneTasks().length).toBe(20);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty task list', () => {
      useKanbanStore.setState({
        tasks: [],
        doneVisibleCount: 20,
      });

      const state = useKanbanStore.getState();
      expect(state.getVisibleDoneTasks().length).toBe(0);
      expect(state.hasMoreDoneTasks()).toBe(false);
    });

    it('should handle tasks without completedAt (fallback to createdAt)', () => {
      const now = Date.now();
      const tasks: KanbanTask[] = [
        {
          id: '1',
          title: 'Task 1',
          prompt: 'Prompt 1',
          status: 'done',
          projectPath: '/test',
          projectName: 'Test',
          createdAt: now - 1000,
          // No completedAt
        },
        {
          id: '2',
          title: 'Task 2',
          prompt: 'Prompt 2',
          status: 'done',
          projectPath: '/test',
          projectName: 'Test',
          createdAt: now,
          // No completedAt
        },
      ];

      useKanbanStore.setState({ tasks, doneVisibleCount: 20 });

      const visibleTasks = useKanbanStore.getState().getVisibleDoneTasks();

      // Should sort by createdAt when completedAt is missing
      expect(visibleTasks[0].id).toBe('2'); // Most recent createdAt first
      expect(visibleTasks[1].id).toBe('1');
    });

    it('should handle very large task lists', () => {
      const doneTasks = createMockTasks(1000, 'done');

      useKanbanStore.setState({
        tasks: doneTasks,
        doneVisibleCount: 20,
      });

      const state = useKanbanStore.getState();

      // Should only return 20 visible tasks
      expect(state.getVisibleDoneTasks().length).toBe(20);
      expect(state.hasMoreDoneTasks()).toBe(true);

      // getTasksByStatus still returns all
      expect(state.getTasksByStatus('done').length).toBe(1000);
    });
  });
});
