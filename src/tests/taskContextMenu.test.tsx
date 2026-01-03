import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import TaskContextMenu from '../components/TaskContextMenu';
import type { KanbanTask } from '../types';

describe('TaskContextMenu', () => {
  const mockTask: KanbanTask = {
    id: 'test-task-1',
    title: 'Test Task',
    description: 'Test description',
    status: 'in_progress',
    createdAt: Date.now(),
    type: 'agent',
  };

  const mockPosition = { x: 100, y: 200 };
  const mockOnMarkDone = vi.fn();
  const mockOnDelete = vi.fn();
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render context menu with correct position', () => {
    const { container } = render(
      <TaskContextMenu
        position={mockPosition}
        task={mockTask}
        onMarkDone={mockOnMarkDone}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    const menu = container.querySelector('.context-menu');
    expect(menu).toBeTruthy();
    expect(menu?.getAttribute('style')).toContain('left: 100px');
    expect(menu?.getAttribute('style')).toContain('top: 200px');
  });

  it('should show "Mark as Done" option for non-done tasks', () => {
    render(
      <TaskContextMenu
        position={mockPosition}
        task={mockTask}
        onMarkDone={mockOnMarkDone}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Mark as Done')).toBeTruthy();
  });

  it('should NOT show "Mark as Done" option for done tasks', () => {
    const doneTask = { ...mockTask, status: 'done' as const };
    render(
      <TaskContextMenu
        position={mockPosition}
        task={doneTask}
        onMarkDone={mockOnMarkDone}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    expect(screen.queryByText('Mark as Done')).toBeFalsy();
  });

  it('should always show "Delete Task" option', () => {
    render(
      <TaskContextMenu
        position={mockPosition}
        task={mockTask}
        onMarkDone={mockOnMarkDone}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText('Delete Task')).toBeTruthy();
  });

  it('should call onMarkDone and onClose when "Mark as Done" is clicked', () => {
    render(
      <TaskContextMenu
        position={mockPosition}
        task={mockTask}
        onMarkDone={mockOnMarkDone}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    const markDoneButton = screen.getByText('Mark as Done');
    fireEvent.click(markDoneButton);

    expect(mockOnMarkDone).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onDelete and onClose when "Delete Task" is clicked', () => {
    render(
      <TaskContextMenu
        position={mockPosition}
        task={mockTask}
        onMarkDone={mockOnMarkDone}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    const deleteButton = screen.getByText('Delete Task');
    fireEvent.click(deleteButton);

    expect(mockOnDelete).toHaveBeenCalledTimes(1);
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when clicking outside the menu', () => {
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <TaskContextMenu
          position={mockPosition}
          task={mockTask}
          onMarkDone={mockOnMarkDone}
          onDelete={mockOnDelete}
          onClose={mockOnClose}
        />
      </div>
    );

    const outsideElement = screen.getByTestId('outside');
    fireEvent.mouseDown(outsideElement);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose when pressing Escape key', () => {
    render(
      <TaskContextMenu
        position={mockPosition}
        task={mockTask}
        onMarkDone={mockOnMarkDone}
        onDelete={mockOnDelete}
        onClose={mockOnClose}
      />
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
