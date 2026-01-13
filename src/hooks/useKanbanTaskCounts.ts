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
  // 🦆 SESSIONS-FIRST: Use getters instead of direct tasks array
  const getTasksByStatus = useKanbanStore((state) => state.getTasksByStatus);
  const getTasksByProject = useKanbanStore((state) => state.getTasksByProject);

  // Get tasks either by project or all
  const todoTasks = projectPath ? getTasksByProject(projectPath).filter(t => t.status === 'todo') : getTasksByStatus('todo');
  const inProgressTasks = projectPath ? getTasksByProject(projectPath).filter(t => t.status === 'in_progress') : getTasksByStatus('in_progress');
  const doneTasks = projectPath ? getTasksByProject(projectPath).filter(t => t.status === 'done') : getTasksByStatus('done');

  return {
    todoCount: todoTasks.length,
    inProgressCount: inProgressTasks.length,
    doneCount: doneTasks.length,
    totalActive: todoTasks.length + inProgressTasks.length,
  };
}
