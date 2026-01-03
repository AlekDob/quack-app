/**
 * KanbanTasksBar Component Tests
 *
 * Tests for the Kanban Tasks Bar component.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KanbanTasksBar from '../components/KanbanTasksBar';

describe('KanbanTasksBar', () => {
  it('should not render when there are no tasks', () => {
    const { container } = render(
      <KanbanTasksBar
        todoCount={0}
        inProgressCount={0}
        onOpenKanban={() => {}}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('should render when there are todo tasks', () => {
    render(
      <KanbanTasksBar
        todoCount={3}
        inProgressCount={0}
        onOpenKanban={() => {}}
      />
    );

    expect(screen.getByText('Kanban Tasks (3)')).toBeInTheDocument();
    expect(screen.getByText('3 todo')).toBeInTheDocument();
  });

  it('should render when there are in progress tasks', () => {
    render(
      <KanbanTasksBar
        todoCount={0}
        inProgressCount={2}
        onOpenKanban={() => {}}
      />
    );

    expect(screen.getByText('Kanban Tasks (2)')).toBeInTheDocument();
    expect(screen.getByText('2 in progress')).toBeInTheDocument();
  });

  it('should render both badges when there are both task types', () => {
    render(
      <KanbanTasksBar
        todoCount={1}
        inProgressCount={2}
        onOpenKanban={() => {}}
      />
    );

    expect(screen.getByText('Kanban Tasks (3)')).toBeInTheDocument();
    expect(screen.getByText('1 todo')).toBeInTheDocument();
    expect(screen.getByText('2 in progress')).toBeInTheDocument();
  });

  it('should call onOpenKanban when header is clicked', () => {
    const onOpenKanban = vi.fn();

    render(
      <KanbanTasksBar
        todoCount={1}
        inProgressCount={1}
        onOpenKanban={onOpenKanban}
      />
    );

    fireEvent.click(screen.getByText('Kanban Tasks (2)'));
    expect(onOpenKanban).toHaveBeenCalledTimes(1);
  });

  it('should have correct CSS classes', () => {
    const { container } = render(
      <KanbanTasksBar
        todoCount={1}
        inProgressCount={1}
        onOpenKanban={() => {}}
      />
    );

    expect(container.querySelector('.kanban-tasks-bar')).toBeInTheDocument();
    expect(container.querySelector('.kanban-tasks-bar-header')).toBeInTheDocument();
    expect(container.querySelector('.kanban-tasks-bar-title')).toBeInTheDocument();
    expect(container.querySelectorAll('.kanban-tasks-bar-badge')).toHaveLength(2);
  });
});
