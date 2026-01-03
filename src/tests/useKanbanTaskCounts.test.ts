/**
 * useKanbanTaskCounts Hook Tests
 *
 * Tests for the Kanban task counts hook.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useKanbanTaskCounts } from '../hooks/useKanbanTaskCounts';
import { useKanbanStore } from '../stores/kanbanStore';

describe('useKanbanTaskCounts', () => {
  beforeEach(() => {
    // Reset store before each test
    useKanbanStore.setState({
      tasks: [],
      selectedTaskId: null,
      isDrawerOpen: false,
      isKanbanViewActive: false,
      isLoading: false,
      pendingNotification: null,
      isNewTaskModalRequested: false,
      processingDocumentation: new Set(),
    });
  });

  it('should return zero counts when no tasks', () => {
    const { result } = renderHook(() => useKanbanTaskCounts());

    expect(result.current.todoCount).toBe(0);
    expect(result.current.inProgressCount).toBe(0);
    expect(result.current.doneCount).toBe(0);
    expect(result.current.totalActive).toBe(0);
  });

  it('should count tasks by status', () => {
    useKanbanStore.setState({
      tasks: [
        { id: '1', title: 'Task 1', prompt: '', status: 'todo', createdAt: Date.now(), projectPath: '/test', projectName: 'Test' },
        { id: '2', title: 'Task 2', prompt: '', status: 'todo', createdAt: Date.now(), projectPath: '/test', projectName: 'Test' },
        { id: '3', title: 'Task 3', prompt: '', status: 'in_progress', createdAt: Date.now(), projectPath: '/test', projectName: 'Test' },
        { id: '4', title: 'Task 4', prompt: '', status: 'done', createdAt: Date.now(), projectPath: '/test', projectName: 'Test' },
      ],
    });

    const { result } = renderHook(() => useKanbanTaskCounts());

    expect(result.current.todoCount).toBe(2);
    expect(result.current.inProgressCount).toBe(1);
    expect(result.current.doneCount).toBe(1);
    expect(result.current.totalActive).toBe(3);
  });

  it('should filter by project path', () => {
    useKanbanStore.setState({
      tasks: [
        { id: '1', title: 'Task 1', prompt: '', status: 'todo', createdAt: Date.now(), projectPath: '/project-a', projectName: 'A' },
        { id: '2', title: 'Task 2', prompt: '', status: 'todo', createdAt: Date.now(), projectPath: '/project-b', projectName: 'B' },
        { id: '3', title: 'Task 3', prompt: '', status: 'in_progress', createdAt: Date.now(), projectPath: '/project-a', projectName: 'A' },
      ],
    });

    const { result } = renderHook(() => useKanbanTaskCounts('/project-a'));

    expect(result.current.todoCount).toBe(1);
    expect(result.current.inProgressCount).toBe(1);
    expect(result.current.totalActive).toBe(2);
  });

  it('should update when tasks change', () => {
    const { result } = renderHook(() => useKanbanTaskCounts());

    expect(result.current.todoCount).toBe(0);

    act(() => {
      useKanbanStore.setState({
        tasks: [
          { id: '1', title: 'Task 1', prompt: '', status: 'todo', createdAt: Date.now(), projectPath: '/test', projectName: 'Test' },
        ],
      });
    });

    expect(result.current.todoCount).toBe(1);
  });
});
