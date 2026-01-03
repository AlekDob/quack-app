/**
 * useKanbanTaskCounts - Hook to get Kanban task counts by status
 *
 * Provides todo and in_progress counts from the Kanban store.
 * Optionally filters by project path.
 *
 * @module useKanbanTaskCounts
 */

import { useKanbanStore } from '../stores/kanbanStore';

interface KanbanTaskCounts {
  todoCount: number;
  inProgressCount: number;
  doneCount: number;
  totalActive: number; // todo + in_progress
}

/**
 * Get Kanban task counts, optionally filtered by project
 * @param projectPath - Optional project path to filter tasks
 */
export function useKanbanTaskCounts(projectPath?: string): KanbanTaskCounts {
  const tasks = useKanbanStore((state) => state.tasks);

  // Filter by project if provided
  const filteredTasks = projectPath
    ? tasks.filter((task) => task.projectPath === projectPath)
    : tasks;

  const todoCount = filteredTasks.filter((task) => task.status === 'todo').length;
  const inProgressCount = filteredTasks.filter((task) => task.status === 'in_progress').length;
  const doneCount = filteredTasks.filter((task) => task.status === 'done').length;

  return {
    todoCount,
    inProgressCount,
    doneCount,
    totalActive: todoCount + inProgressCount,
  };
}
