/**
 * Kanban Custom Tools for Claude Agent SDK
 *
 * These tools allow Claude to manage Kanban tasks:
 * - List tasks (context awareness)
 * - Move tasks (self-completion)
 * - Create tasks (subtask decomposition)
 * - Update tasks (progress tracking)
 * - Delete tasks (cleanup)
 * - Get workload (load balancing)
 *
 * Data is stored in quack-kanban-tasks.json via Tauri Store
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';
import { z } from 'zod';

/**
 * Get the correct path for Tauri Store files based on OS
 * macOS: ~/Library/Application Support/com.quack.terminal/
 * Linux: ~/.local/share/com.quack.terminal/
 * Windows: %APPDATA%/com.quack.terminal/
 */
function getTauriStorePath() {
  const os = platform();
  const home = homedir();

  if (os === 'darwin') {
    return join(home, 'Library', 'Application Support', 'com.quack.terminal');
  } else if (os === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'com.quack.terminal');
  } else {
    // Linux and others
    return join(home, '.local', 'share', 'com.quack.terminal');
  }
}

// Path to Kanban tasks storage (Tauri Store format)
const KANBAN_STORE_PATH = join(getTauriStorePath(), 'quack-kanban-tasks.json');

// Log path on module load for debugging
console.error(`[KanbanTools] Storage path: ${KANBAN_STORE_PATH}`);

/**
 * Load Kanban tasks from storage
 */
function loadKanbanTasks() {
  try {
    if (!existsSync(KANBAN_STORE_PATH)) {
      console.error('[KanbanTools] No tasks file found, returning empty array');
      return [];
    }

    const data = JSON.parse(readFileSync(KANBAN_STORE_PATH, 'utf8'));
    // Tauri Store format: { kanbanTasks: [...] }
    const tasks = data.kanbanTasks || [];
    console.error(`[KanbanTools] Loaded ${tasks.length} tasks from storage`);
    return tasks;
  } catch (error) {
    console.error(`[KanbanTools] Error loading tasks: ${error.message}`);
    return [];
  }
}

/**
 * Save Kanban tasks to storage
 */
function saveKanbanTasks(tasks) {
  try {
    // Ensure directory exists
    const dir = getTauriStorePath();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Tauri Store format
    const data = { kanbanTasks: tasks };
    writeFileSync(KANBAN_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.error(`[KanbanTools] Saved ${tasks.length} tasks to storage`);
    return true;
  } catch (error) {
    console.error(`[KanbanTools] Error saving tasks: ${error.message}`);
    return false;
  }
}

/**
 * Emit event to frontend via stdout (will be captured by Rust backend)
 */
function emitKanbanEvent(eventType, payload) {
  const event = {
    type: 'kanban_event',
    eventType,
    payload,
    timestamp: Date.now(),
  };
  // Emit as JSON line for Rust to parse
  console.log(JSON.stringify(event));
}

/**
 * Generate unique task ID
 */
function generateTaskId() {
  return `kanban-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// ============================================================
// KANBAN TOOLS DEFINITIONS
// ============================================================

/**
 * Tool: kanban_list_tasks
 * Purpose: Claude can see all tasks for context awareness
 */
const kanbanListTasks = tool(
  'kanban_list_tasks',
  'List all Kanban tasks. Use this to understand the current project context, see what tasks exist, and check workload before creating new tasks.',
  {
    status: z.enum(['todo', 'in_progress', 'done']).optional()
      .describe('Filter by status. Omit to see all tasks.'),
    projectPath: z.string().optional()
      .describe('Filter by project path. Omit to see all projects.'),
    agentId: z.string().optional()
      .describe('Filter by assigned agent ID. Omit to see all agents.'),
    includeCompleted: z.boolean().optional().default(true)
      .describe('Whether to include completed (done) tasks.'),
  },
  async (args) => {
    const tasks = loadKanbanTasks();

    let filtered = tasks.filter(task => {
      // Filter by status
      if (args.status && task.status !== args.status) return false;

      // Filter by project
      if (args.projectPath && task.projectPath !== args.projectPath) return false;

      // Filter by agent
      if (args.agentId && task.assignedAgent?.id !== args.agentId) return false;

      // Exclude completed if requested
      if (!args.includeCompleted && task.status === 'done') return false;

      return true;
    });

    // Sort by createdAt descending (newest first)
    filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Format output for Claude
    const summary = {
      total: filtered.length,
      byStatus: {
        todo: filtered.filter(t => t.status === 'todo').length,
        in_progress: filtered.filter(t => t.status === 'in_progress').length,
        done: filtered.filter(t => t.status === 'done').length,
      },
      tasks: filtered.map(t => ({
        id: t.id,
        title: t.title,
        status: t.status,
        projectName: t.projectName,
        projectPath: t.projectPath,
        branch: t.branch,
        assignedAgent: t.assignedAgent ? {
          id: t.assignedAgent.id,
          name: t.assignedAgent.name,
        } : null,
        parentTaskId: t.parentTaskId,
        progress: t.progress,
        createdAt: t.createdAt,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
      })),
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(summary, null, 2),
      }],
    };
  }
);

/**
 * Tool: kanban_move_task
 * Purpose: Claude can move tasks between columns (including self-completion)
 */
const kanbanMoveTask = tool(
  'kanban_move_task',
  'Move a task to a different status column. Use this to mark a task as complete when finished, or to change task status. This is how you signal that your work on a task is done.',
  {
    taskId: z.string().describe('The ID of the task to move'),
    newStatus: z.enum(['todo', 'in_progress', 'done'])
      .describe('The new status column'),
    completionNote: z.string().optional()
      .describe('Note when marking as done (e.g., "All tests passing, feature complete")'),
  },
  async (args) => {
    const tasks = loadKanbanTasks();
    const taskIndex = tasks.findIndex(t => t.id === args.taskId);

    if (taskIndex === -1) {
      return {
        content: [{
          type: 'text',
          text: `Error: Task with ID "${args.taskId}" not found`,
        }],
      };
    }

    const task = tasks[taskIndex];
    const previousStatus = task.status;

    // Update task
    task.status = args.newStatus;

    // Set timestamps based on new status
    if (args.newStatus === 'in_progress' && !task.startedAt) {
      task.startedAt = Date.now();
    }
    if (args.newStatus === 'done') {
      task.completedAt = Date.now();
      if (args.completionNote) {
        task.completionNote = args.completionNote;
      }
    }

    // Save
    tasks[taskIndex] = task;
    const saved = saveKanbanTasks(tasks);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: `Error: Failed to save task update`,
        }],
      };
    }

    // Emit event for frontend
    emitKanbanEvent('task_moved', {
      taskId: args.taskId,
      previousStatus,
      newStatus: args.newStatus,
      completionNote: args.completionNote,
    });

    return {
      content: [{
        type: 'text',
        text: `Task "${task.title}" moved from ${previousStatus} to ${args.newStatus}` +
              (args.completionNote ? `\nNote: ${args.completionNote}` : ''),
      }],
    };
  }
);

/**
 * Attachment schema for images
 */
const attachmentSchema = z.object({
  path: z.string().describe('Absolute path to the image file'),
  name: z.string().optional().describe('Display name for the attachment (defaults to filename)'),
  mimeType: z.string().optional().describe('MIME type of the image (e.g., "image/png", "image/jpeg")'),
});

/**
 * Generate unique attachment ID
 */
function generateAttachmentId() {
  return `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Tool: kanban_create_task
 * Purpose: Claude can create subtasks for task decomposition
 */
const kanbanCreateTask = tool(
  'kanban_create_task',
  'Create a new Kanban task. Use this to break down complex tasks into smaller subtasks, or to create related tasks. When creating a subtask, set the parentTaskId to link it to the parent task.',
  {
    title: z.string().describe('Short title for the task (shown on card)'),
    prompt: z.string().describe('Full prompt/description for the task'),
    status: z.enum(['todo', 'in_progress']).default('todo')
      .describe('Initial status. Usually "todo" for new tasks.'),
    projectPath: z.string().describe('Absolute path to the project directory'),
    projectName: z.string().describe('Display name of the project'),
    branch: z.string().optional().describe('Git branch for this task'),
    parentTaskId: z.string().optional()
      .describe('ID of parent task if this is a subtask'),
    assignedAgentId: z.string().optional()
      .describe('ID of agent to assign. Omit to leave unassigned.'),
    attachments: z.array(attachmentSchema).optional()
      .describe('Image attachments for the task. Each attachment should have path (absolute file path) and optionally name, mimeType. Images will be displayed in the task card.'),
  },
  async (args) => {
    const tasks = loadKanbanTasks();

    // Validate parent task exists if specified
    if (args.parentTaskId) {
      const parentTask = tasks.find(t => t.id === args.parentTaskId);
      if (!parentTask) {
        return {
          content: [{
            type: 'text',
            text: `Error: Parent task with ID "${args.parentTaskId}" not found`,
          }],
        };
      }
    }

    // Process attachments - add IDs and extract filename if name not provided
    const processedAttachments = args.attachments?.map(att => ({
      id: generateAttachmentId(),
      name: att.name || att.path.split('/').pop() || 'attachment',
      path: att.path,
      size: 0, // Size unknown from path alone
      mimeType: att.mimeType || (att.path.toLowerCase().endsWith('.png') ? 'image/png' :
                                  att.path.toLowerCase().endsWith('.jpg') || att.path.toLowerCase().endsWith('.jpeg') ? 'image/jpeg' :
                                  att.path.toLowerCase().endsWith('.gif') ? 'image/gif' :
                                  att.path.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/png'),
      previewUrl: `file://${att.path}`, // Use file:// protocol for local images
    })) || [];

    // Create new task
    const newTask = {
      id: generateTaskId(),
      title: args.title,
      prompt: args.prompt,
      status: args.status,
      projectPath: args.projectPath,
      projectName: args.projectName,
      branch: args.branch,
      parentTaskId: args.parentTaskId,
      attachments: processedAttachments.length > 0 ? processedAttachments : undefined,
      createdAt: Date.now(),
      type: 'agent', // Default to agent task
      // assignedAgent will be set by frontend when agent picks up task
    };

    if (args.status === 'in_progress') {
      newTask.startedAt = Date.now();
    }

    // Add to tasks
    tasks.push(newTask);
    const saved = saveKanbanTasks(tasks);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: `Error: Failed to save new task`,
        }],
      };
    }

    // Emit event for frontend
    emitKanbanEvent('task_created', {
      task: newTask,
      parentTaskId: args.parentTaskId,
    });

    const attachmentInfo = processedAttachments.length > 0
      ? `\nAttachments: ${processedAttachments.length} image(s)`
      : '';

    return {
      content: [{
        type: 'text',
        text: `Created task "${newTask.title}" (ID: ${newTask.id}) in ${args.status}` +
              (args.parentTaskId ? `\nSubtask of: ${args.parentTaskId}` : '') +
              attachmentInfo,
      }],
    };
  }
);

/**
 * Tool: kanban_update_task
 * Purpose: Claude can update task metadata (progress, notes, etc.)
 */
const kanbanUpdateTask = tool(
  'kanban_update_task',
  'Update task metadata like title, description, progress percentage, or notes. Use this to track progress or add context to a task.',
  {
    taskId: z.string().describe('The ID of the task to update'),
    title: z.string().optional().describe('New title for the task'),
    prompt: z.string().optional().describe('Updated prompt/description'),
    progress: z.number().min(0).max(100).optional()
      .describe('Progress percentage (0-100)'),
    notes: z.string().optional()
      .describe('Additional notes to append'),
    blockedBy: z.string().optional()
      .describe('ID of task that blocks this one'),
  },
  async (args) => {
    const tasks = loadKanbanTasks();
    const taskIndex = tasks.findIndex(t => t.id === args.taskId);

    if (taskIndex === -1) {
      return {
        content: [{
          type: 'text',
          text: `Error: Task with ID "${args.taskId}" not found`,
        }],
      };
    }

    const task = tasks[taskIndex];
    const updates = [];

    // Apply updates
    if (args.title !== undefined) {
      task.title = args.title;
      updates.push(`title: "${args.title}"`);
    }
    if (args.prompt !== undefined) {
      task.prompt = args.prompt;
      updates.push('prompt updated');
    }
    if (args.progress !== undefined) {
      task.progress = args.progress;
      updates.push(`progress: ${args.progress}%`);
    }
    if (args.notes !== undefined) {
      task.notes = task.notes
        ? `${task.notes}\n\n---\n\n${args.notes}`
        : args.notes;
      updates.push('notes added');
    }
    if (args.blockedBy !== undefined) {
      task.blockedBy = args.blockedBy;
      updates.push(`blocked by: ${args.blockedBy}`);
    }

    // Save
    tasks[taskIndex] = task;
    const saved = saveKanbanTasks(tasks);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: `Error: Failed to save task update`,
        }],
      };
    }

    // Emit event for frontend
    emitKanbanEvent('task_updated', {
      taskId: args.taskId,
      updates: args,
    });

    return {
      content: [{
        type: 'text',
        text: `Task "${task.title}" updated: ${updates.join(', ')}`,
      }],
    };
  }
);

/**
 * Tool: kanban_delete_task
 * Purpose: Claude can delete tasks (cleanup)
 */
const kanbanDeleteTask = tool(
  'kanban_delete_task',
  'Delete a Kanban task. Use with caution - this permanently removes the task. Consider moving to "done" instead if the work was completed.',
  {
    taskId: z.string().describe('The ID of the task to delete'),
    reason: z.string().optional()
      .describe('Reason for deletion (for audit trail)'),
  },
  async (args) => {
    const tasks = loadKanbanTasks();
    const taskIndex = tasks.findIndex(t => t.id === args.taskId);

    if (taskIndex === -1) {
      return {
        content: [{
          type: 'text',
          text: `Error: Task with ID "${args.taskId}" not found`,
        }],
      };
    }

    const deletedTask = tasks[taskIndex];

    // Check for subtasks
    const subtasks = tasks.filter(t => t.parentTaskId === args.taskId);
    if (subtasks.length > 0) {
      return {
        content: [{
          type: 'text',
          text: `Warning: Task "${deletedTask.title}" has ${subtasks.length} subtask(s). ` +
                `Delete or reassign subtasks first: ${subtasks.map(t => t.id).join(', ')}`,
        }],
      };
    }

    // Remove task
    tasks.splice(taskIndex, 1);
    const saved = saveKanbanTasks(tasks);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: `Error: Failed to save after deletion`,
        }],
      };
    }

    // Emit event for frontend
    emitKanbanEvent('task_deleted', {
      taskId: args.taskId,
      title: deletedTask.title,
      reason: args.reason,
    });

    return {
      content: [{
        type: 'text',
        text: `Deleted task "${deletedTask.title}" (ID: ${args.taskId})` +
              (args.reason ? `\nReason: ${args.reason}` : ''),
      }],
    };
  }
);

/**
 * Tool: kanban_get_workload
 * Purpose: Claude can see agent workload for load balancing
 */
const kanbanGetWorkload = tool(
  'kanban_get_workload',
  'Get workload summary for agents. Use this to understand which agents are busy and which have capacity for new tasks.',
  {
    agentId: z.string().optional()
      .describe('Get workload for specific agent. Omit for all agents.'),
    projectPath: z.string().optional()
      .describe('Filter to a specific project.'),
  },
  async (args) => {
    const tasks = loadKanbanTasks();

    // Filter by project if specified
    let filteredTasks = tasks;
    if (args.projectPath) {
      filteredTasks = tasks.filter(t => t.projectPath === args.projectPath);
    }

    // Build workload map
    const workload = {};

    filteredTasks.forEach(task => {
      if (task.assignedAgent) {
        const id = task.assignedAgent.id;

        // Filter by agent if specified
        if (args.agentId && id !== args.agentId) return;

        if (!workload[id]) {
          workload[id] = {
            agentId: id,
            agentName: task.assignedAgent.name,
            projectName: task.projectName,
            todo: 0,
            in_progress: 0,
            done: 0,
            tasks: [],
          };
        }

        workload[id][task.status]++;
        workload[id].tasks.push({
          id: task.id,
          title: task.title,
          status: task.status,
        });
      }
    });

    // Convert to array and sort by in_progress count
    const workloadArray = Object.values(workload)
      .sort((a, b) => b.in_progress - a.in_progress);

    // Summary
    const summary = {
      totalAgents: workloadArray.length,
      agentWorkloads: workloadArray,
      unassignedTasks: filteredTasks.filter(t => !t.assignedAgent).length,
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(summary, null, 2),
      }],
    };
  }
);

// ============================================================
// CREATE MCP SERVER
// ============================================================

/**
 * Create the Kanban Tools MCP Server
 * This server provides all Kanban-related tools to Claude
 */
export function createKanbanToolsServer() {
  return createSdkMcpServer({
    name: 'kanban-tools',
    version: '1.0.0',
    tools: [
      kanbanListTasks,
      kanbanMoveTask,
      kanbanCreateTask,
      kanbanUpdateTask,
      kanbanDeleteTask,
      kanbanGetWorkload,
    ],
  });
}

// Export individual tools for testing
export {
  kanbanListTasks,
  kanbanMoveTask,
  kanbanCreateTask,
  kanbanUpdateTask,
  kanbanDeleteTask,
  kanbanGetWorkload,
};
