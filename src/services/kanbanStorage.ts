/**
 * Kanban Storage Service
 *
 * Handles persistent storage of Kanban tasks using Tauri Store.
 * Tasks are stored per project and persist across app restarts.
 *
 * @module kanbanStorage
 */

import { Store } from "@tauri-apps/plugin-store";
import { toast } from "sonner";
import type { KanbanTask } from "../types";
import { getTestModeStoreName } from "../utils/testModeStorage";

// Storage key for kanban tasks
const KANBAN_TASKS_KEY = "kanbanTasks";

/**
 * Saves kanban tasks to persistent storage
 *
 * @param tasks - Array of KanbanTask objects to persist
 *
 * @example
 * ```typescript
 * const tasks: KanbanTask[] = [
 *   { id: "1", title: "Review code", prompt: "...", status: "todo", ... }
 * ];
 * await saveKanbanTasks(tasks);
 * ```
 */
export const saveKanbanTasks = async (tasks: KanbanTask[]): Promise<void> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-kanban-tasks.json"));
    await store.set(KANBAN_TASKS_KEY, tasks);
    await store.save();
    console.log(`[kanbanStorage] Saved ${tasks.length} Kanban tasks`);
  } catch (error) {
    console.error("[kanbanStorage] Failed to save Kanban tasks:", error);
    toast.error("Failed to save Kanban tasks");
  }
};

/**
 * Loads kanban tasks from persistent storage with defensive validation
 *
 * Features:
 * - Validates data structure (must be array)
 * - Filters out corrupted/invalid entries
 * - Auto-cleans storage on corruption detection
 * - Returns empty array on critical errors
 *
 * @returns Promise resolving to validated array of KanbanTask objects
 *
 * @example
 * ```typescript
 * const tasks = await loadKanbanTasks();
 * console.log(`Loaded ${tasks.length} kanban tasks`);
 * ```
 */
export const loadKanbanTasks = async (): Promise<KanbanTask[]> => {
  try {
    const store = await Store.load(getTestModeStoreName("quack-kanban-tasks.json"));
    const stored = await store.get<KanbanTask[]>(KANBAN_TASKS_KEY);

    // Defensive: Validate data structure before returning
    if (!stored) {
      return [];
    }

    if (!Array.isArray(stored)) {
      console.error("🦆 [kanbanStorage] Storage corruption detected: kanbanTasks is not an array", typeof stored);
      toast.error("Kanban storage corrupted - resetting to clean state");
      await store.delete(KANBAN_TASKS_KEY);
      await store.save();
      return [];
    }

    // Defensive: Validate each task has required fields
    const validated = stored.filter((task: unknown) => {
      if (!task || typeof task !== 'object') {
        console.warn("🦆 [kanbanStorage] Skipping invalid task entry:", task);
        return false;
      }
      const t = task as Record<string, unknown>;
      if (!t.id || !t.title || !t.status) {
        console.warn("🦆 [kanbanStorage] Skipping task missing id/title/status:", task);
        return false;
      }
      // Validate status is valid
      if (!['todo', 'in_progress', 'done'].includes(t.status as string)) {
        console.warn("🦆 [kanbanStorage] Skipping task with invalid status:", task);
        return false;
      }
      return true;
    }) as KanbanTask[];

    if (validated.length !== stored.length) {
      console.warn(`🦆 [kanbanStorage] Filtered out ${stored.length - validated.length} corrupted entries`);
    }

    console.log(`[kanbanStorage] Loaded ${validated.length} Kanban tasks`);
    return validated;
  } catch (error) {
    console.error("🦆 [kanbanStorage] Critical error loading Kanban tasks:", error);
    toast.error("Failed to load Kanban tasks - starting fresh");
    return [];
  }
};

/**
 * Deletes a specific task from storage
 *
 * @param taskId - ID of the task to delete
 */
export const deleteKanbanTask = async (taskId: string): Promise<void> => {
  try {
    const tasks = await loadKanbanTasks();
    const filtered = tasks.filter(t => t.id !== taskId);
    await saveKanbanTasks(filtered);
    console.log(`[kanbanStorage] Deleted task ${taskId}`);
  } catch (error) {
    console.error("[kanbanStorage] Failed to delete task:", error);
    toast.error("Failed to delete task");
  }
};

/**
 * Updates a specific task in storage
 *
 * @param taskId - ID of the task to update
 * @param updates - Partial task object with fields to update
 */
export const updateKanbanTask = async (
  taskId: string,
  updates: Partial<KanbanTask>
): Promise<void> => {
  try {
    const tasks = await loadKanbanTasks();
    const index = tasks.findIndex(t => t.id === taskId);
    if (index === -1) {
      console.warn(`[kanbanStorage] Task ${taskId} not found for update`);
      return;
    }
    tasks[index] = { ...tasks[index], ...updates };
    await saveKanbanTasks(tasks);
    console.log(`[kanbanStorage] Updated task ${taskId}`);
  } catch (error) {
    console.error("[kanbanStorage] Failed to update task:", error);
    toast.error("Failed to update task");
  }
};

/**
 * Gets tasks filtered by project path
 *
 * @param projectPath - Path of the project to filter by
 * @returns Array of tasks belonging to the specified project
 */
export const getTasksByProject = async (projectPath: string): Promise<KanbanTask[]> => {
  const tasks = await loadKanbanTasks();
  return tasks.filter(t => t.projectPath === projectPath);
};
