import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TasksSidebarSection from './TasksSidebarSection';
import type { KanbanTask, ChatMessage } from '../types';

// Mock Tauri API
vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => path,
}));

// Mock custom avatar utilities
vi.mock('../utils/customAvatarStorage', () => ({
  getCustomAvatarUrl: (name: string) => `/custom/${name}`,
  isCustomAvatar: (name: string) => name.startsWith('custom-'),
}));

describe('TasksSidebarSection', () => {
  const mockTasks: KanbanTask[] = [
    {
      id: 'task-1',
      title: 'Implement user authentication',
      prompt: 'Create a secure auth system',
      status: 'todo',
      type: 'agent',
      projectPath: '/project/quack-app',
      projectName: 'quack-app',
      assignedAgent: {
        id: 'agent-1',
        name: 'Agent Alpha',
        avatar: 'duck1.png',
        color: '#3b82f6',
      },
      createdAt: Date.now(),
    },
    {
      id: 'task-2',
      title: 'Fix responsive layout bug',
      prompt: 'Fix mobile view',
      status: 'in_progress',
      type: 'agent',
      projectPath: '/project/quack-app',
      projectName: 'quack-app',
      assignedAgent: {
        id: 'agent-2',
        name: 'Agent Beta',
        avatar: 'duck2.png',
        color: '#22c55e',
      },
      createdAt: Date.now(),
    },
    {
      id: 'task-3',
      title: 'Completed task - should not show',
      prompt: 'Already done',
      status: 'done',
      type: 'agent',
      projectPath: '/project/quack-app',
      projectName: 'quack-app',
      createdAt: Date.now(),
    },
    {
      id: 'task-4',
      title: 'Task from different project',
      prompt: 'Different project',
      status: 'todo',
      type: 'agent',
      projectPath: '/project/other-app',
      projectName: 'other-app',
      createdAt: Date.now(),
    },
  ];

  const mockOnOpenTaskTab = vi.fn();

  it('renders section with correct task count', () => {
    render(
      <TasksSidebarSection
        tasks={mockTasks}
        activeTaskId={null}
        onOpenTaskTab={mockOnOpenTaskTab}
      />
    );

    // Should show TASKS header
    expect(screen.getByText('TASKS')).toBeInTheDocument();

    // Should show count of active tasks (todo + in_progress, excluding done)
    expect(screen.getByText('3')).toBeInTheDocument(); // 3 active tasks (excluding done)
  });

  it('filters out done tasks', () => {
    render(
      <TasksSidebarSection
        tasks={mockTasks}
        activeTaskId={null}
        onOpenTaskTab={mockOnOpenTaskTab}
      />
    );

    // Should NOT show completed task
    expect(screen.queryByText('Completed task - should not show')).not.toBeInTheDocument();

    // Should show active tasks
    expect(screen.getByText(/Implement user authentication/)).toBeInTheDocument();
    expect(screen.getByText(/Fix responsive layout bug/)).toBeInTheDocument();
  });

  it('filters tasks by current project path', () => {
    render(
      <TasksSidebarSection
        tasks={mockTasks}
        activeTaskId={null}
        onOpenTaskTab={mockOnOpenTaskTab}
        currentProjectPath="/project/quack-app"
      />
    );

    // Should show count badge with 2 (filtered by project)
    expect(screen.getByText('2')).toBeInTheDocument();

    // Should show tasks from current project only
    expect(screen.getByText(/Implement user authentication/)).toBeInTheDocument();
    expect(screen.getByText(/Fix responsive layout bug/)).toBeInTheDocument();

    // Should NOT show task from different project
    expect(screen.queryByText(/Task from different project/)).not.toBeInTheDocument();
  });

  it('shows all active tasks when no currentProjectPath provided', () => {
    render(
      <TasksSidebarSection
        tasks={mockTasks}
        activeTaskId={null}
        onOpenTaskTab={mockOnOpenTaskTab}
      />
    );

    // Should show all active tasks (no project filter)
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/Implement user authentication/)).toBeInTheDocument();
    expect(screen.getByText(/Fix responsive layout bug/)).toBeInTheDocument();
    expect(screen.getByText(/Task from different project/)).toBeInTheDocument();
  });

  it('highlights selected task', () => {
    const { container } = render(
      <TasksSidebarSection
        tasks={mockTasks}
        activeTaskId="task-2"
        onOpenTaskTab={mockOnOpenTaskTab}
      />
    );

    const taskItem = screen.getByText(/Fix responsive layout bug/).closest('.task-item') as HTMLElement;
    // Check that selected task has visible box-shadow (not 'none')
    const boxShadow = taskItem?.style.boxShadow || '';
    expect(boxShadow).toBeTruthy();
    expect(boxShadow).not.toBe('none');
  });

  it('calls onOpenTaskTab when task is clicked', () => {
    render(
      <TasksSidebarSection
        tasks={mockTasks}
        activeTaskId={null}
        onOpenTaskTab={mockOnOpenTaskTab}
      />
    );

    const taskItem = screen.getByText(/Implement user authentication/);
    fireEvent.click(taskItem);

    expect(mockOnOpenTaskTab).toHaveBeenCalledWith(mockTasks[0]);
  });

  it('toggles collapse state', () => {
    render(
      <TasksSidebarSection
        tasks={mockTasks}
        activeTaskId={null}
        onOpenTaskTab={mockOnOpenTaskTab}
      />
    );

    const header = screen.getByText('TASKS').closest('div');

    // Initially expanded - tasks should be visible
    expect(screen.getByText(/Implement user authentication/)).toBeInTheDocument();

    // Click header to collapse
    fireEvent.click(header!);

    // Tasks should be hidden after collapse
    expect(screen.queryByText(/Implement user authentication/)).not.toBeInTheDocument();

    // Click again to expand
    fireEvent.click(header!);

    // Tasks should be visible again
    expect(screen.getByText(/Implement user authentication/)).toBeInTheDocument();
  });

  it('does not render when no active tasks', () => {
    const { container } = render(
      <TasksSidebarSection
        tasks={[mockTasks[2]]} // Only done task
        activeTaskId={null}
        onOpenTaskTab={mockOnOpenTaskTab}
      />
    );

    // Should not render section at all
    expect(container.firstChild).toBeNull();
  });

  it('displays correct status colors', () => {
    const tasksWithMessages: KanbanTask[] = [
      { ...mockTasks[0], status: 'todo' }, // Gray
      { ...mockTasks[1], status: 'in_progress' }, // Blue (cold) or orange/green depending on messages
    ];

    const chatSessions = new Map<string, ChatMessage[]>();
    // task-2 has messages (ready state)
    chatSessions.set('task-2', [
      { role: 'user', content: 'Hello', timestamp: Date.now() },
      { role: 'assistant', content: 'Hi', timestamp: Date.now() },
    ]);

    const { container } = render(
      <TasksSidebarSection
        tasks={tasksWithMessages}
        activeTaskId={null}
        onOpenTaskTab={mockOnOpenTaskTab}
        chatSessions={chatSessions}
      />
    );

    const statusIndicators = container.querySelectorAll('[style*="border-radius: 50%"]');
    expect(statusIndicators).toHaveLength(2);

    // First task (todo) should have gray status
    expect(statusIndicators[0]).toHaveStyle({ background: '#6b7280' });

    // Second task (in_progress with messages) should have green status (ready)
    expect(statusIndicators[1]).toHaveStyle({ background: '#22c55e' });
  });

  it('renders mini avatars correctly', () => {
    const { container } = render(
      <TasksSidebarSection
        tasks={[mockTasks[0]]}
        activeTaskId={null}
        onOpenTaskTab={mockOnOpenTaskTab}
      />
    );

    const avatar = container.querySelector('img');
    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveAttribute('alt', 'Agent Alpha');
  });

  it('truncates long task titles', () => {
    const longTask: KanbanTask = {
      ...mockTasks[0],
      title: 'This is a very long task title that should be truncated when displayed in the sidebar',
    };

    render(
      <TasksSidebarSection
        tasks={[longTask]}
        activeTaskId={null}
        onOpenTaskTab={mockOnOpenTaskTab}
      />
    );

    // Should truncate title to 35 chars + '...'
    const taskText = screen.getByText(/This is a very long task title that/);
    expect(taskText.textContent).toHaveLength(38); // 35 + '...'
  });
});
