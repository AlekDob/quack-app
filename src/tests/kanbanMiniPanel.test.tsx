/**
 * Tests for KanbanMiniPanel Component
 *
 * @module tests/kanbanMiniPanel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mock the zustand store
vi.mock('../stores/kanbanStore', () => ({
  useKanbanStore: vi.fn(() => ({
    tasks: [],
    requestNewTaskModal: vi.fn(),
  })),
}));

// Mock the date grouping utility
vi.mock('../utils/kanbanDateGrouping', () => ({
  groupTasksByCompletionDate: vi.fn(() => []),
}));

import KanbanMiniPanel from '../components/kanban/KanbanMiniPanel';
import { useKanbanStore } from '../stores/kanbanStore';
import type { KanbanTask, ChatMessage } from '../types';

// Helper to create mock tasks
function createMockTask(
  id: string,
  status: 'todo' | 'in_progress' | 'done',
  title = `Task ${id}`
): KanbanTask {
  return {
    id,
    title,
    prompt: `Prompt for ${id}`,
    status,
    projectPath: '/test/project',
    projectName: 'Test Project',
    createdAt: Date.now(),
    completedAt: status === 'done' ? Date.now() : undefined,
  };
}

// Helper to create mock chat message
function createMockMessage(role: 'user' | 'assistant', content: string): ChatMessage {
  return {
    id: `msg-${Math.random()}`,
    role,
    content,
    timestamp: Date.now(),
  };
}

describe('KanbanMiniPanel', () => {
  const mockOnTaskClick = vi.fn();
  const mockOnOpenKanban = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('should render the panel header', () => {
      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: [],
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      expect(screen.getByText('Tasks')).toBeInTheDocument();
    });

    it('should render empty state when no tasks', () => {
      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: [],
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      expect(screen.getByText('No tasks yet')).toBeInTheDocument();
    });

    it('should render task counts for each column', () => {
      const mockTasks = [
        createMockTask('1', 'todo'),
        createMockTask('2', 'todo'),
        createMockTask('3', 'in_progress'),
        createMockTask('4', 'done'),
        createMockTask('5', 'done'),
        createMockTask('6', 'done'),
      ];

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: mockTasks,
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      // Total tasks count in header
      expect(screen.getByText('6')).toBeInTheDocument();
    });

    it('should render section headers with icons', () => {
      const mockTasks = [
        createMockTask('1', 'todo'),
        createMockTask('2', 'in_progress'),
        createMockTask('3', 'done'),
      ];

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: mockTasks,
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      expect(screen.getByText('TODO')).toBeInTheDocument();
      expect(screen.getByText('In Progress')).toBeInTheDocument();
      expect(screen.getByText('Done')).toBeInTheDocument();
    });
  });

  describe('quick actions', () => {
    it('should render Add Task button', () => {
      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: [],
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      expect(screen.getByText('Add Task')).toBeInTheDocument();
    });

    it('should render Full Board button', () => {
      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: [],
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      expect(screen.getByText('Full Board')).toBeInTheDocument();
    });

    it('should call onOpenKanban when Full Board button is clicked', () => {
      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: [],
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      fireEvent.click(screen.getByText('Full Board'));
      expect(mockOnOpenKanban).toHaveBeenCalled();
    });

    it('should call onOpenKanban and requestNewTaskModal when Add Task is clicked', () => {
      vi.useFakeTimers();
      const mockRequestNewTaskModal = vi.fn();

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: [],
        requestNewTaskModal: mockRequestNewTaskModal,
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      fireEvent.click(screen.getByText('Add Task'));
      expect(mockOnOpenKanban).toHaveBeenCalled();

      // Fast-forward timer for setTimeout
      vi.advanceTimersByTime(100);
      expect(mockRequestNewTaskModal).toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('section expansion', () => {
    it('should have In Progress section expanded by default', () => {
      const mockTasks = [
        createMockTask('1', 'in_progress', 'My In Progress Task'),
      ];

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: mockTasks,
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      // In Progress is expanded by default, so we should see the task
      expect(screen.getByText('My In Progress Task')).toBeInTheDocument();
    });

    it('should have TODO section collapsed by default', () => {
      const mockTasks = [createMockTask('1', 'todo', 'My TODO Task')];

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: mockTasks,
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      // TODO is collapsed by default, so task should not be visible
      expect(screen.queryByText('My TODO Task')).not.toBeInTheDocument();
    });

    it('should toggle section when clicking header', () => {
      const mockTasks = [createMockTask('1', 'todo', 'My TODO Task')];

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: mockTasks,
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      // Click TODO section to expand
      fireEvent.click(screen.getByText('TODO'));
      expect(screen.getByText('My TODO Task')).toBeInTheDocument();

      // Click again to collapse
      fireEvent.click(screen.getByText('TODO'));
      expect(screen.queryByText('My TODO Task')).not.toBeInTheDocument();
    });
  });

  describe('task interaction', () => {
    it('should call onOpenKanban and onTaskClick when task is clicked', () => {
      const mockTasks = [createMockTask('task-1', 'in_progress', 'My Task')];

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: mockTasks,
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      fireEvent.click(screen.getByText('My Task'));

      expect(mockOnOpenKanban).toHaveBeenCalled();
      expect(mockOnTaskClick).toHaveBeenCalledWith('task-1');
    });
  });

  describe('task status indicators', () => {
    it('should show working status when task is loading', () => {
      const mockTasks = [createMockTask('task-1', 'in_progress')];
      const loadingMap = new Map([['task-1', true]]);

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: mockTasks,
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={loadingMap}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      // Should have a working status indicator (check via status span title)
      expect(screen.getByTitle('Working')).toBeInTheDocument();
    });

    it('should show ready status when task is not loading', () => {
      const mockTasks = [createMockTask('task-1', 'in_progress')];

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: mockTasks,
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      // Should have a ready status indicator (check via status span title)
      expect(screen.getByTitle('Ready')).toBeInTheDocument();
    });
  });

  describe('chat preview', () => {
    it('should show last assistant message preview', () => {
      const mockTasks = [createMockTask('task-1', 'in_progress')];
      const chatSessions = new Map([
        [
          'task-1',
          [
            createMockMessage('user', 'Hello'),
            createMockMessage('assistant', 'This is a test response'),
          ],
        ],
      ]);

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: mockTasks,
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={chatSessions}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      expect(screen.getByText('This is a test response')).toBeInTheDocument();
    });

    it('should truncate long messages', () => {
      const mockTasks = [createMockTask('task-1', 'in_progress')];
      const longMessage = 'A'.repeat(100);
      const chatSessions = new Map([
        ['task-1', [createMockMessage('assistant', longMessage)]],
      ]);

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: mockTasks,
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={chatSessions}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      // Should show truncated message with ellipsis
      const preview = screen.getByText(/^A{60}\.\.\./);
      expect(preview).toBeInTheDocument();
    });
  });

  describe('assigned agent', () => {
    it('should show agent name when task has assigned agent', () => {
      const mockTask: KanbanTask = {
        ...createMockTask('task-1', 'in_progress'),
        assignedAgent: {
          id: 'agent-1',
          name: 'Magnus',
          avatar: '🤖',
        },
      };

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: [mockTask],
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      expect(screen.getByText('Magnus')).toBeInTheDocument();
    });

    it('should show agent avatar when available', () => {
      const mockTask: KanbanTask = {
        ...createMockTask('task-1', 'in_progress'),
        assignedAgent: {
          id: 'agent-1',
          name: 'Magnus',
          avatar: '🤖',
        },
      };

      (useKanbanStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        tasks: [mockTask],
        requestNewTaskModal: vi.fn(),
      });

      render(
        <KanbanMiniPanel
          chatLoadingMap={new Map()}
          chatSessions={new Map()}
          onTaskClick={mockOnTaskClick}
          onOpenKanban={mockOnOpenKanban}
        />
      );

      expect(screen.getByText('🤖')).toBeInTheDocument();
    });
  });
});
