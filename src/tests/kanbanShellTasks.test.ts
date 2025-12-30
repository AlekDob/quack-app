/**
 * Kanban Shell Tasks Tests
 *
 * Tests for the Kanban shell task system that replaced the old Background Tasks.
 * Tests cover:
 * - Shell task creation via kanbanStore
 * - Shell task types (shell, watch)
 * - Task lifecycle (todo -> in_progress -> done)
 * - Shell service functions
 *
 * @module tests/kanbanShellTasks
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useKanbanStore } from '../stores/kanbanStore';
import type { KanbanTask, KanbanStatus, KanbanTaskType } from '../types';

// Mock the storage functions
vi.mock('../services/kanbanStorage', () => ({
  saveKanbanTasks: vi.fn().mockResolvedValue(undefined),
  loadKanbanTasks: vi.fn().mockResolvedValue([]),
}));

// Reset store before each test
beforeEach(() => {
  useKanbanStore.setState({
    tasks: [],
    selectedTaskId: null,
    isDrawerOpen: false,
    isKanbanViewActive: false,
    isLoading: false,
  });
});

describe('Kanban Shell Tasks', () => {
  describe('Shell Task Creation', () => {
    it('should create a shell task with correct type', async () => {
      const { addTask, tasks } = useKanbanStore.getState();

      const task = await addTask({
        title: 'npm run build',
        prompt: 'npm run build',
        status: 'todo',
        projectPath: '/test/project',
        projectName: 'test-project',
        type: 'shell',
        command: 'npm run build',
      });

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.type).toBe('shell');
      expect(task.command).toBe('npm run build');
      expect(task.status).toBe('todo');
      expect(task.createdAt).toBeDefined();

      const currentState = useKanbanStore.getState();
      expect(currentState.tasks.length).toBe(1);
    });

    it('should create a watch task with patterns', async () => {
      const { addTask } = useKanbanStore.getState();

      const task = await addTask({
        title: 'Watch src/**/*.ts',
        prompt: 'Watch TypeScript files',
        status: 'todo',
        projectPath: '/test/project',
        projectName: 'test-project',
        type: 'watch',
        watchPatterns: ['src/**/*.ts', 'src/**/*.tsx'],
        watchCommand: 'npm run test',
        watchDebounceMs: 500,
      });

      expect(task.type).toBe('watch');
      expect(task.watchPatterns).toEqual(['src/**/*.ts', 'src/**/*.tsx']);
      expect(task.watchCommand).toBe('npm run test');
      expect(task.watchDebounceMs).toBe(500);
    });

    it('should default to agent type when type not specified', async () => {
      const { addTask } = useKanbanStore.getState();

      const task = await addTask({
        title: 'Agent Task',
        prompt: 'Do something',
        status: 'todo',
        projectPath: '/test/project',
        projectName: 'test-project',
      });

      expect(task.type).toBe('agent');
    });
  });

  describe('Task Types', () => {
    it('should correctly identify different task types', async () => {
      const { addTask } = useKanbanStore.getState();

      const agentTask = await addTask({
        title: 'Agent Task',
        prompt: 'Prompt',
        status: 'todo',
        projectPath: '/test',
        projectName: 'test',
        type: 'agent',
      });

      const shellTask = await addTask({
        title: 'Shell Task',
        prompt: 'npm build',
        status: 'todo',
        projectPath: '/test',
        projectName: 'test',
        type: 'shell',
        command: 'npm run build',
      });

      const watchTask = await addTask({
        title: 'Watch Task',
        prompt: 'Watch files',
        status: 'todo',
        projectPath: '/test',
        projectName: 'test',
        type: 'watch',
        watchPatterns: ['**/*.ts'],
        watchCommand: 'npm test',
      });

      const currentState = useKanbanStore.getState();
      expect(currentState.tasks.length).toBe(3);

      const types = currentState.tasks.map(t => t.type);
      expect(types).toContain('agent');
      expect(types).toContain('shell');
      expect(types).toContain('watch');
    });
  });

  describe('Shell Task Lifecycle', () => {
    it('should move task from todo to in_progress', async () => {
      const { addTask, moveTask } = useKanbanStore.getState();

      const task = await addTask({
        title: 'npm run build',
        prompt: 'npm run build',
        status: 'todo',
        projectPath: '/test/project',
        projectName: 'test-project',
        type: 'shell',
        command: 'npm run build',
      });

      expect(task.status).toBe('todo');
      expect(task.startedAt).toBeUndefined();

      await moveTask(task.id, 'in_progress');

      const currentState = useKanbanStore.getState();
      const updatedTask = currentState.tasks.find(t => t.id === task.id);
      expect(updatedTask?.status).toBe('in_progress');
      expect(updatedTask?.startedAt).toBeDefined();
    });

    it('should move task from in_progress to done', async () => {
      const { addTask, moveTask } = useKanbanStore.getState();

      const task = await addTask({
        title: 'npm run build',
        prompt: 'npm run build',
        status: 'in_progress',
        projectPath: '/test/project',
        projectName: 'test-project',
        type: 'shell',
        command: 'npm run build',
      });

      await moveTask(task.id, 'done');

      const currentState = useKanbanStore.getState();
      const updatedTask = currentState.tasks.find(t => t.id === task.id);
      expect(updatedTask?.status).toBe('done');
      expect(updatedTask?.completedAt).toBeDefined();
    });

    it('should update task with exit code', async () => {
      const { addTask, updateTask } = useKanbanStore.getState();

      const task = await addTask({
        title: 'npm run test',
        prompt: 'npm run test',
        status: 'in_progress',
        projectPath: '/test/project',
        projectName: 'test-project',
        type: 'shell',
        command: 'npm run test',
      });

      await updateTask(task.id, {
        exitCode: 0,
        completedAt: Date.now(),
      });

      const currentState = useKanbanStore.getState();
      const updatedTask = currentState.tasks.find(t => t.id === task.id);
      expect(updatedTask?.exitCode).toBe(0);
      expect(updatedTask?.completedAt).toBeDefined();
    });

    it('should update task with PID when started', async () => {
      const { addTask, updateTask } = useKanbanStore.getState();

      const task = await addTask({
        title: 'npm run dev',
        prompt: 'npm run dev',
        status: 'todo',
        projectPath: '/test/project',
        projectName: 'test-project',
        type: 'shell',
        command: 'npm run dev',
      });

      await updateTask(task.id, {
        pid: 12345,
        startedAt: Date.now(),
      });

      const currentState = useKanbanStore.getState();
      const updatedTask = currentState.tasks.find(t => t.id === task.id);
      expect(updatedTask?.pid).toBe(12345);
    });
  });

  describe('Task Filtering by Type', () => {
    it('should get tasks by status', async () => {
      const { addTask, getTasksByStatus } = useKanbanStore.getState();

      await addTask({
        title: 'Todo Task',
        prompt: 'Todo',
        status: 'todo',
        projectPath: '/test',
        projectName: 'test',
        type: 'shell',
        command: 'echo todo',
      });

      await addTask({
        title: 'In Progress Task',
        prompt: 'In Progress',
        status: 'in_progress',
        projectPath: '/test',
        projectName: 'test',
        type: 'shell',
        command: 'echo progress',
      });

      await addTask({
        title: 'Done Task',
        prompt: 'Done',
        status: 'done',
        projectPath: '/test',
        projectName: 'test',
        type: 'shell',
        command: 'echo done',
      });

      const currentState = useKanbanStore.getState();

      const todoTasks = currentState.getTasksByStatus('todo');
      expect(todoTasks.length).toBe(1);
      expect(todoTasks[0].title).toBe('Todo Task');

      const inProgressTasks = currentState.getTasksByStatus('in_progress');
      expect(inProgressTasks.length).toBe(1);

      const doneTasks = currentState.getTasksByStatus('done');
      expect(doneTasks.length).toBe(1);
    });

    it('should get tasks by project', async () => {
      const { addTask, getTasksByProject } = useKanbanStore.getState();

      await addTask({
        title: 'Project A Task',
        prompt: 'Task A',
        status: 'todo',
        projectPath: '/projects/a',
        projectName: 'project-a',
        type: 'shell',
        command: 'npm build',
      });

      await addTask({
        title: 'Project B Task',
        prompt: 'Task B',
        status: 'todo',
        projectPath: '/projects/b',
        projectName: 'project-b',
        type: 'shell',
        command: 'npm build',
      });

      const currentState = useKanbanStore.getState();

      const projectATasks = currentState.getTasksByProject('/projects/a');
      expect(projectATasks.length).toBe(1);
      expect(projectATasks[0].projectName).toBe('project-a');

      const projectBTasks = currentState.getTasksByProject('/projects/b');
      expect(projectBTasks.length).toBe(1);
    });
  });

  describe('Task Deletion', () => {
    it('should delete a shell task', async () => {
      const { addTask, deleteTask } = useKanbanStore.getState();

      const task = await addTask({
        title: 'Task to Delete',
        prompt: 'Delete me',
        status: 'todo',
        projectPath: '/test',
        projectName: 'test',
        type: 'shell',
        command: 'echo delete',
      });

      const beforeState = useKanbanStore.getState();
      expect(beforeState.tasks.length).toBe(1);

      await deleteTask(task.id);

      const afterState = useKanbanStore.getState();
      expect(afterState.tasks.length).toBe(0);
    });

    it('should close drawer when deleting selected task', async () => {
      const { addTask, deleteTask, selectTask, openDrawer } = useKanbanStore.getState();

      const task = await addTask({
        title: 'Selected Task',
        prompt: 'Selected',
        status: 'todo',
        projectPath: '/test',
        projectName: 'test',
        type: 'shell',
        command: 'echo select',
      });

      selectTask(task.id);
      openDrawer();

      const beforeState = useKanbanStore.getState();
      expect(beforeState.selectedTaskId).toBe(task.id);
      expect(beforeState.isDrawerOpen).toBe(true);

      await deleteTask(task.id);

      const afterState = useKanbanStore.getState();
      expect(afterState.selectedTaskId).toBeNull();
      expect(afterState.isDrawerOpen).toBe(false);
    });
  });

  describe('Kanban View Toggle', () => {
    it('should toggle kanban view', () => {
      const { toggleKanbanView, setKanbanViewActive } = useKanbanStore.getState();

      expect(useKanbanStore.getState().isKanbanViewActive).toBe(false);

      toggleKanbanView();
      expect(useKanbanStore.getState().isKanbanViewActive).toBe(true);

      toggleKanbanView();
      expect(useKanbanStore.getState().isKanbanViewActive).toBe(false);

      setKanbanViewActive(true);
      expect(useKanbanStore.getState().isKanbanViewActive).toBe(true);

      setKanbanViewActive(false);
      expect(useKanbanStore.getState().isKanbanViewActive).toBe(false);
    });
  });

  describe('Selected Task', () => {
    it('should get selected task', async () => {
      const { addTask, selectTask, getSelectedTask } = useKanbanStore.getState();

      const task = await addTask({
        title: 'Test Task',
        prompt: 'Test',
        status: 'todo',
        projectPath: '/test',
        projectName: 'test',
        type: 'shell',
        command: 'echo test',
      });

      selectTask(task.id);

      const currentState = useKanbanStore.getState();
      const selectedTask = currentState.getSelectedTask();
      expect(selectedTask).toBeDefined();
      expect(selectedTask?.id).toBe(task.id);
    });

    it('should return null when no task selected', () => {
      const { getSelectedTask } = useKanbanStore.getState();
      expect(getSelectedTask()).toBeNull();
    });
  });

  describe('Drawer State', () => {
    it('should manage drawer open/close state', () => {
      const { openDrawer, closeDrawer } = useKanbanStore.getState();

      expect(useKanbanStore.getState().isDrawerOpen).toBe(false);

      openDrawer();
      expect(useKanbanStore.getState().isDrawerOpen).toBe(true);

      closeDrawer();
      expect(useKanbanStore.getState().isDrawerOpen).toBe(false);
    });
  });
});

describe('Shell Task Properties', () => {
  beforeEach(() => {
    useKanbanStore.setState({
      tasks: [],
      selectedTaskId: null,
      isDrawerOpen: false,
      isKanbanViewActive: false,
      isLoading: false,
    });
  });

  it('should store shell-specific properties', async () => {
    const { addTask } = useKanbanStore.getState();

    const task = await addTask({
      title: 'Shell Task',
      prompt: 'npm run build',
      status: 'in_progress',
      projectPath: '/test/project',
      projectName: 'test-project',
      type: 'shell',
      command: 'npm run build',
      pid: 12345,
      startedAt: Date.now(),
    });

    expect(task.type).toBe('shell');
    expect(task.command).toBe('npm run build');
    expect(task.pid).toBe(12345);
    expect(task.startedAt).toBeDefined();
  });

  it('should store watch-specific properties', async () => {
    const { addTask } = useKanbanStore.getState();

    const task = await addTask({
      title: 'Watch Task',
      prompt: 'Watch files',
      status: 'in_progress',
      projectPath: '/test/project',
      projectName: 'test-project',
      type: 'watch',
      watchPatterns: ['**/*.ts', '**/*.tsx'],
      watchCommand: 'npm run test',
      watchDebounceMs: 300,
      lastTriggered: Date.now(),
    });

    expect(task.type).toBe('watch');
    expect(task.watchPatterns).toHaveLength(2);
    expect(task.watchCommand).toBe('npm run test');
    expect(task.watchDebounceMs).toBe(300);
    expect(task.lastTriggered).toBeDefined();
  });

  it('should handle exit codes', async () => {
    const { addTask, updateTask } = useKanbanStore.getState();

    const task = await addTask({
      title: 'Shell with Exit',
      prompt: 'npm test',
      status: 'in_progress',
      projectPath: '/test',
      projectName: 'test',
      type: 'shell',
      command: 'npm test',
    });

    // Simulate successful completion
    await updateTask(task.id, {
      exitCode: 0,
      completedAt: Date.now(),
    });

    let updatedTask = useKanbanStore.getState().tasks.find(t => t.id === task.id);
    expect(updatedTask?.exitCode).toBe(0);

    // Simulate failure
    await updateTask(task.id, {
      exitCode: 1,
    });

    updatedTask = useKanbanStore.getState().tasks.find(t => t.id === task.id);
    expect(updatedTask?.exitCode).toBe(1);

    // Simulate killed process
    await updateTask(task.id, {
      exitCode: -1,
    });

    updatedTask = useKanbanStore.getState().tasks.find(t => t.id === task.id);
    expect(updatedTask?.exitCode).toBe(-1);
  });
});
