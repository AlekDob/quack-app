/**
 * Kanban Shell Service
 *
 * Service for creating shell/watch tasks in the Kanban board.
 * Used by the /background command to create Kanban tasks instead of
 * using the old Background Tasks system.
 *
 * @module kanbanShellService
 */

import { useKanbanStore } from '../stores/kanbanStore';
import type { KanbanTask, KanbanStatus } from '../types';

/**
 * Detect task type from command string
 */
function detectTaskType(command: string): 'build' | 'test' | 'analysis' | 'custom' {
  const lowerCommand = command.toLowerCase();

  if (lowerCommand.includes('build') || lowerCommand.includes('compile') || lowerCommand.includes('dev')) {
    return 'build';
  }

  if (lowerCommand.includes('test') || lowerCommand.includes('vitest') || lowerCommand.includes('jest')) {
    return 'test';
  }

  if (lowerCommand.includes('lint') || lowerCommand.includes('analyze') || lowerCommand.includes('audit')) {
    return 'analysis';
  }

  return 'custom';
}

/**
 * Create a name from command
 */
function createNameFromCommand(command: string): string {
  const parts = command.trim().split(' ');
  if (parts.length >= 2 && parts[0] === 'npm' && parts[1] === 'run') {
    return parts[2] || 'npm run';
  }
  if (parts.length >= 2 && (parts[0] === 'npm' || parts[0] === 'yarn' || parts[0] === 'pnpm')) {
    return `${parts[0]} ${parts[1]}`;
  }
  return parts.slice(0, 2).join(' ');
}

interface CreateShellTaskOptions {
  command: string;
  projectPath: string;
  projectName?: string;
  title?: string;
  status?: KanbanStatus;
  autoStart?: boolean;
}

/**
 * Create a shell task in the Kanban board
 *
 * @param options - Options for creating the shell task
 * @returns The created KanbanTask
 */
export async function createKanbanShellTask(options: CreateShellTaskOptions): Promise<KanbanTask> {
  const {
    command,
    projectPath,
    projectName,
    title,
    status = 'in_progress', // Default to in_progress to auto-start
    autoStart = true,
  } = options;

  const taskType = detectTaskType(command);
  const taskTitle = title || createNameFromCommand(command);

  // Extract project name from path if not provided
  const derivedProjectName = projectName || projectPath.split('/').pop() || 'Unknown Project';

  const { addTask, moveTask } = useKanbanStore.getState();

  // Create the task
  const task = await addTask({
    title: taskTitle,
    prompt: command,
    status: autoStart ? 'in_progress' : (status || 'todo'),
    projectPath,
    projectName: derivedProjectName,
    type: 'shell',
    command,
  });

  console.log(`[kanbanShellService] Created shell task: ${task.id} - ${taskTitle}`);

  return task;
}

interface CreateWatchTaskOptions {
  watchPatterns: string[];
  watchCommand: string;
  projectPath: string;
  projectName?: string;
  title?: string;
  debounceMs?: number;
  status?: KanbanStatus;
}

/**
 * Create a watch task in the Kanban board
 *
 * @param options - Options for creating the watch task
 * @returns The created KanbanTask
 */
export async function createKanbanWatchTask(options: CreateWatchTaskOptions): Promise<KanbanTask> {
  const {
    watchPatterns,
    watchCommand,
    projectPath,
    projectName,
    title,
    debounceMs = 500,
    status = 'todo',
  } = options;

  const taskTitle = title || `Watch: ${watchPatterns.join(', ').substring(0, 30)}`;
  const derivedProjectName = projectName || projectPath.split('/').pop() || 'Unknown Project';

  const { addTask } = useKanbanStore.getState();

  const task = await addTask({
    title: taskTitle,
    prompt: `Watch ${watchPatterns.join(', ')} and run: ${watchCommand}`,
    status: status || 'todo',
    projectPath,
    projectName: derivedProjectName,
    type: 'watch',
    watchPatterns,
    watchCommand,
    watchDebounceMs: debounceMs,
  });

  console.log(`[kanbanShellService] Created watch task: ${task.id} - ${taskTitle}`);

  return task;
}

/**
 * Run a shell command in background via Kanban
 *
 * This is a drop-in replacement for runCommandInBackground from backgroundAgentService.
 * It creates a shell task in the Kanban board that can be monitored and managed.
 *
 * @param command - The shell command to execute
 * @param options - Additional options
 * @returns The task ID
 */
export async function runShellCommandViaKanban(
  command: string,
  options: {
    name?: string;
    workingDirectory?: string;
    projectName?: string;
    autoStart?: boolean;
  } = {}
): Promise<string> {
  const workingDirectory = options.workingDirectory || process.cwd?.() || '/';

  const task = await createKanbanShellTask({
    command,
    projectPath: workingDirectory,
    projectName: options.projectName,
    title: options.name,
    autoStart: options.autoStart ?? true,
  });

  return task.id;
}

/**
 * Get all shell/watch tasks from Kanban
 */
export function getKanbanShellTasks(): KanbanTask[] {
  const { tasks } = useKanbanStore.getState();
  return tasks.filter(t => t.type === 'shell' || t.type === 'watch');
}

/**
 * Get running shell/watch tasks
 */
export function getRunningShellTasks(): KanbanTask[] {
  const { tasks } = useKanbanStore.getState();
  return tasks.filter(t =>
    (t.type === 'shell' || t.type === 'watch') &&
    t.status === 'in_progress'
  );
}
