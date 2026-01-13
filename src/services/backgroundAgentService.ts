/**
 * Background Agent Service
 *
 * Core service for managing background task execution.
 * Handles task lifecycle, queue processing, and integration with Claude SDK.
 *
 * @module backgroundAgentService
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, emit } from '@tauri-apps/api/event';
import { sendNotification } from '@tauri-apps/plugin-notification';
import { useBackgroundAgentStore } from '../stores/backgroundAgentStore';
import { useKanbanStore } from '../stores/kanbanStore';
import type {
  BackgroundTask,
  BackgroundTaskConfig,
  BackgroundTaskResult,
  BackgroundTaskLogEntry,
  BackgroundTaskProgress,
  BackgroundTaskEvent,
  ClaudeEvent,
} from '../types';

// Queue processing interval (ms)
const QUEUE_PROCESS_INTERVAL = 1000;

// Event channel names
const BACKGROUND_TASK_EVENT = 'background-task-event';
const BACKGROUND_TASK_LOG = 'background-task-log';
const BACKGROUND_TASK_COMPLETE = 'background-task-complete';

// Store reference for non-React contexts
let storeInstance: ReturnType<typeof useBackgroundAgentStore.getState> | null = null;

/**
 * Initialize the background agent service
 * Sets up event listeners and starts queue processing
 */
export async function initBackgroundAgentService(): Promise<void> {
  console.log('[BackgroundAgentService] Initializing...');

  // Get store reference
  storeInstance = useBackgroundAgentStore.getState();

  // Setup Tauri event listeners
  await setupEventListeners();

  // Start queue processor
  startQueueProcessor();

  console.log('[BackgroundAgentService] Initialized successfully');
}

/**
 * Setup Tauri event listeners for background task events
 */
async function setupEventListeners(): Promise<void> {
  // Listen for task events from backend
  await listen<BackgroundTaskEvent>(BACKGROUND_TASK_EVENT, (event) => {
    handleBackgroundTaskEvent(event.payload);
  });

  // Listen for log entries from backend
  await listen<{ taskId: string; log: BackgroundTaskLogEntry }>(BACKGROUND_TASK_LOG, (event) => {
    const { taskId, log } = event.payload;
    const store = useBackgroundAgentStore.getState();
    store.addTaskLog(taskId, log);
  });

  // Listen for task completion from backend
  await listen<{ taskId: string; result: BackgroundTaskResult }>(BACKGROUND_TASK_COMPLETE, (event) => {
    const { taskId, result } = event.payload;
    handleTaskCompletion(taskId, result);
  });

  console.log('[BackgroundAgentService] Event listeners setup complete');
}

/**
 * Handle incoming background task events
 */
function handleBackgroundTaskEvent(event: BackgroundTaskEvent): void {
  const store = useBackgroundAgentStore.getState();

  switch (event.type) {
    case 'progress':
      if (event.data?.progress) {
        store.updateTaskProgress(event.taskId, event.data.progress);
      }
      break;

    case 'log':
      if (event.data?.log) {
        store.addTaskLog(event.taskId, event.data.log);
      }
      break;

    case 'completed':
      if (event.data?.result) {
        handleTaskCompletion(event.taskId, event.data.result);
      }
      break;

    case 'failed':
      if (event.data?.error) {
        store.failTask(event.taskId, event.data.error);
        notifyTaskCompletion(event.taskId, false, event.data.error);
      }
      break;

    default:
      console.log(`[BackgroundAgentService] Unhandled event type: ${event.type}`);
  }
}

/**
 * Handle task completion
 */
async function handleTaskCompletion(
  taskId: string,
  result: BackgroundTaskResult
): Promise<void> {
  const store = useBackgroundAgentStore.getState();
  const task = store.getTask(taskId);

  if (!task) {
    console.warn(`[BackgroundAgentService] Task not found: ${taskId}`);
    return;
  }

  // Guard: Skip if already completed (prevents infinite loop)
  if (['completed', 'failed', 'cancelled'].includes(task.status)) {
    return;
  }

  // Update task status
  if (result.success) {
    store.completeTask(taskId, result);
  } else {
    store.failTask(taskId, result.error || 'Unknown error');
  }

  // Update Kanban task if linked
  if (task.config.kanbanTaskId) {
    const kanbanStore = useKanbanStore.getState();
    try {
      await kanbanStore.moveTask(
        task.config.kanbanTaskId,
        result.success ? 'done' : 'todo'
      );
      console.log(`[BackgroundAgentService] Updated Kanban task ${task.config.kanbanTaskId} to ${result.success ? 'done' : 'todo'}`);
    } catch (error) {
      console.error(`[BackgroundAgentService] Failed to update Kanban task:`, error);
    }
  }

  // Send notification if enabled
  if (task.config.notifyOnComplete !== false) {
    await notifyTaskCompletion(taskId, result.success, result.error);
  }

  // Post result to chat if configured
  if (task.chatId) {
    await postResultToChat(task, result);
  }

  // Emit event for UI updates
  await emit(BACKGROUND_TASK_COMPLETE, { taskId, result });
}

/**
 * Send desktop notification for task completion
 */
async function notifyTaskCompletion(
  taskId: string,
  success: boolean,
  error?: string
): Promise<void> {
  const store = useBackgroundAgentStore.getState();
  const task = store.getTask(taskId);

  if (!task) return;

  try {
    await sendNotification({
      title: success ? 'Task Completed' : 'Task Failed',
      body: success
        ? `${task.config.name} completed successfully`
        : `${task.config.name} failed: ${error || 'Unknown error'}`,
      // icon: success ? 'success' : 'error', // Tauri 2.x doesn't support this yet
    });

    // Play quack sound for completed tasks
    if (success) {
      playQuackSound();
    }
  } catch (err) {
    console.warn('[BackgroundAgentService] Failed to send notification:', err);
  }
}

/**
 * Play the quack sound effect
 */
function playQuackSound(): void {
  try {
    // Use WebAudio to play quack sound
    const audio = new Audio('/quack.mp3');
    audio.volume = 0.3;
    audio.play().catch(() => {
      // Ignore autoplay errors
    });
  } catch {
    // Ignore audio errors
  }
}

/**
 * Post task result to chat
 */
async function postResultToChat(
  task: BackgroundTask,
  result: BackgroundTaskResult
): Promise<void> {
  if (!task.chatId) return;

  try {
    // Emit event for chat integration
    await emit('background-task-result-to-chat', {
      chatId: task.chatId,
      taskId: task.id,
      taskName: task.config.name,
      success: result.success,
      output: result.output,
      error: result.error,
      duration_ms: result.duration_ms,
      usage: result.usage,
      cost_usd: result.cost_usd,
    });
  } catch (err) {
    console.error('[BackgroundAgentService] Failed to post result to chat:', err);
  }
}

// Queue processor interval reference
let queueProcessorInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Start the queue processor
 */
function startQueueProcessor(): void {
  if (queueProcessorInterval) {
    console.warn('[BackgroundAgentService] Queue processor already running');
    return;
  }

  queueProcessorInterval = setInterval(() => {
    processQueue();
  }, QUEUE_PROCESS_INTERVAL);

  console.log('[BackgroundAgentService] Queue processor started');
}

/**
 * Stop the queue processor
 */
export function stopQueueProcessor(): void {
  if (queueProcessorInterval) {
    clearInterval(queueProcessorInterval);
    queueProcessorInterval = null;
    console.log('[BackgroundAgentService] Queue processor stopped');
  }
}

/**
 * Process the task queue - start next tasks if possible
 */
async function processQueue(): Promise<void> {
  const store = useBackgroundAgentStore.getState();

  // Check if we can start a new task
  if (!store.canStartNewTask()) {
    return;
  }

  // Get next task to run
  const nextTask = store.getNextTaskToRun();
  if (!nextTask) {
    return;
  }

  // Start the task
  await startTask(nextTask.id);
}

/**
 * Create and queue a new background task
 */
export function createBackgroundTask(config: BackgroundTaskConfig): string {
  const store = useBackgroundAgentStore.getState();
  const taskId = store.createTask(config);

  console.log(`[BackgroundAgentService] Created task: ${taskId} - ${config.name}`);

  // Trigger immediate queue processing
  processQueue();

  return taskId;
}

/**
 * Start executing a task
 */
async function startTask(taskId: string): Promise<void> {
  const store = useBackgroundAgentStore.getState();
  const task = store.getTask(taskId);

  if (!task || task.status !== 'queued') {
    console.warn(`[BackgroundAgentService] Cannot start task ${taskId}: invalid state`);
    return;
  }

  console.log(`[BackgroundAgentService] Starting task: ${taskId}`);
  store.startTask(taskId);

  // Add initial log
  store.addTaskLog(taskId, {
    level: 'info',
    message: `Starting task: ${task.config.name}`,
    source: 'system',
  });

  try {
    switch (task.config.type) {
      case 'agent':
        await executeAgentTask(task);
        break;

      case 'build':
      case 'test':
      case 'analysis':
      case 'custom':
        await executeCommandTask(task);
        break;

      case 'watch':
        await executeWatchTask(task);
        break;

      default:
        throw new Error(`Unknown task type: ${task.config.type}`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`[BackgroundAgentService] Task ${taskId} failed:`, errorMessage);
    store.failTask(taskId, errorMessage);
    await notifyTaskCompletion(taskId, false, errorMessage);
  }
}

/**
 * Execute an agent-based task using Claude SDK
 */
async function executeAgentTask(task: BackgroundTask): Promise<void> {
  const store = useBackgroundAgentStore.getState();

  if (!task.config.prompt) {
    throw new Error('Agent task requires a prompt');
  }

  store.addTaskLog(task.id, {
    level: 'info',
    message: `Executing agent task with model: ${task.config.model || 'sonnet'}`,
    source: 'agent',
  });

  try {
    // Call Tauri backend to execute agent in background
    const result = await invoke<BackgroundTaskResult>('execute_background_agent', {
      taskId: task.id,
      prompt: task.config.prompt,
      model: task.config.model || 'sonnet',
      workingDirectory: task.config.workingDirectory,
      agentId: task.config.agentId,
      timeout: task.config.timeout_ms,
    });

    // Handle completion
    await handleTaskCompletion(task.id, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    store.failTask(task.id, errorMessage);
    await notifyTaskCompletion(task.id, false, errorMessage);
  }
}

/**
 * Execute a command-based task (build, test, analysis, custom)
 */
async function executeCommandTask(task: BackgroundTask): Promise<void> {
  const store = useBackgroundAgentStore.getState();

  if (!task.config.command) {
    throw new Error('Command task requires a command');
  }

  store.addTaskLog(task.id, {
    level: 'info',
    message: `Executing command: ${task.config.command}`,
    source: 'command',
  });

  try {
    // Call Tauri backend to execute command in background
    const result = await invoke<BackgroundTaskResult>('execute_background_command', {
      taskId: task.id,
      command: task.config.command,
      args: task.config.args || [],
      workingDirectory: task.config.workingDirectory,
      env: task.config.env,
      timeout: task.config.timeout_ms,
    });

    // Handle completion
    await handleTaskCompletion(task.id, result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    store.failTask(task.id, errorMessage);
    await notifyTaskCompletion(task.id, false, errorMessage);
  }
}

/**
 * Execute a watch task (file monitoring)
 */
async function executeWatchTask(task: BackgroundTask): Promise<void> {
  const store = useBackgroundAgentStore.getState();

  if (!task.config.watchPatterns?.length) {
    throw new Error('Watch task requires watch patterns');
  }

  store.addTaskLog(task.id, {
    level: 'info',
    message: `Starting file watcher for patterns: ${task.config.watchPatterns.join(', ')}`,
    source: 'watcher',
  });

  try {
    // Call Tauri backend to start file watcher
    await invoke('start_background_watcher', {
      taskId: task.id,
      patterns: task.config.watchPatterns,
      workingDirectory: task.config.workingDirectory,
      debounceMs: task.config.debounceMs || 500,
    });

    // Watch tasks run indefinitely until cancelled
    // The backend will send events when files change
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    store.failTask(task.id, errorMessage);
    await notifyTaskCompletion(task.id, false, errorMessage);
  }
}

/**
 * Pause a running task
 */
export async function pauseTask(taskId: string): Promise<void> {
  const store = useBackgroundAgentStore.getState();
  const task = store.getTask(taskId);

  if (!task || task.status !== 'running') {
    console.warn(`[BackgroundAgentService] Cannot pause task ${taskId}: invalid state`);
    return;
  }

  try {
    // Notify backend to pause
    await invoke('pause_background_task', { taskId });
    store.pauseTask(taskId);

    store.addTaskLog(taskId, {
      level: 'info',
      message: 'Task paused',
      source: 'system',
    });
  } catch (error) {
    console.error(`[BackgroundAgentService] Failed to pause task ${taskId}:`, error);
  }
}

/**
 * Resume a paused task
 */
export async function resumeTask(taskId: string): Promise<void> {
  const store = useBackgroundAgentStore.getState();
  const task = store.getTask(taskId);

  if (!task || task.status !== 'paused') {
    console.warn(`[BackgroundAgentService] Cannot resume task ${taskId}: invalid state`);
    return;
  }

  try {
    // Notify backend to resume
    await invoke('resume_background_task', { taskId });
    store.resumeTask(taskId);

    store.addTaskLog(taskId, {
      level: 'info',
      message: 'Task resumed',
      source: 'system',
    });
  } catch (error) {
    console.error(`[BackgroundAgentService] Failed to resume task ${taskId}:`, error);
  }
}

/**
 * Cancel a task
 */
export async function cancelTask(taskId: string): Promise<void> {
  const store = useBackgroundAgentStore.getState();
  const task = store.getTask(taskId);

  if (!task || ['completed', 'failed', 'cancelled'].includes(task.status)) {
    console.warn(`[BackgroundAgentService] Cannot cancel task ${taskId}: invalid state`);
    return;
  }

  try {
    // Notify backend to cancel
    await invoke('cancel_background_task', { taskId });
    store.cancelTask(taskId);

    store.addTaskLog(taskId, {
      level: 'warn',
      message: 'Task cancelled by user',
      source: 'system',
    });
  } catch (error) {
    console.error(`[BackgroundAgentService] Failed to cancel task ${taskId}:`, error);
  }
}

/**
 * Retry a failed or cancelled task
 */
export function retryTask(taskId: string): void {
  const store = useBackgroundAgentStore.getState();
  store.retryTask(taskId);

  // Trigger immediate queue processing
  processQueue();
}

/**
 * Create a task for running a droid in background
 */
export function runDroidInBackground(
  droidId: string,
  droidName: string,
  prompt: string,
  options: {
    model?: 'opus' | 'sonnet' | 'haiku';
    workingDirectory?: string;
    priority?: 'high' | 'medium' | 'low';
    chatId?: string;
  } = {}
): string {
  return createBackgroundTask({
    type: 'agent',
    name: `Droid: ${droidName}`,
    description: prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''),
    priority: options.priority || 'medium',
    agentId: droidId,
    prompt,
    model: options.model,
    workingDirectory: options.workingDirectory,
    notifyOnComplete: true,
    showLogsInRealtime: true,
  });
}

/**
 * Create a task for running a shell command in background
 */
export function runCommandInBackground(
  command: string,
  options: {
    name?: string;
    args?: string[];
    workingDirectory?: string;
    env?: Record<string, string>;
    priority?: 'high' | 'medium' | 'low';
    type?: 'build' | 'test' | 'analysis' | 'custom';
    chatId?: string;
  } = {}
): string {
  return createBackgroundTask({
    type: options.type || 'custom',
    name: options.name || command.split(' ')[0],
    description: command,
    priority: options.priority || 'medium',
    command,
    args: options.args,
    workingDirectory: options.workingDirectory,
    env: options.env,
    notifyOnComplete: true,
    showLogsInRealtime: false,
  });
}

/**
 * Get all active (running + queued) tasks
 */
export function getActiveTasks(): BackgroundTask[] {
  const store = useBackgroundAgentStore.getState();
  return store.tasks.filter(t => ['running', 'queued', 'paused'].includes(t.status));
}

/**
 * Get queue statistics
 */
export function getQueueStats() {
  const store = useBackgroundAgentStore.getState();
  return store.getQueueStats();
}

/**
 * Cleanup service on app shutdown
 */
export function cleanupBackgroundAgentService(): void {
  stopQueueProcessor();
  console.log('[BackgroundAgentService] Cleaned up');
}
