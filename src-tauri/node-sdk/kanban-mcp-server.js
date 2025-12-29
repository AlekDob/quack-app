#!/usr/bin/env node

/**
 * Kanban MCP Server (stdio-based)
 *
 * This is a standalone MCP server that provides Kanban task management tools.
 * It runs as a separate process and communicates via stdin/stdout.
 *
 * Tools provided:
 * - kanban_list_tasks: List all Kanban tasks
 * - kanban_move_task: Move a task between columns
 * - kanban_create_task: Create a new task
 * - kanban_update_task: Update task metadata
 * - kanban_delete_task: Delete a task
 * - kanban_get_workload: Get agent workload summary
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

// =============================================================================
// STORAGE PATH
// =============================================================================

/**
 * Get the correct path for Tauri Store files based on OS
 */
function getTauriStorePath() {
  const os = platform();
  const home = homedir();

  if (os === 'darwin') {
    return join(home, 'Library', 'Application Support', 'com.quack.terminal');
  } else if (os === 'win32') {
    return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'com.quack.terminal');
  } else {
    return join(home, '.local', 'share', 'com.quack.terminal');
  }
}

const KANBAN_STORE_PATH = join(getTauriStorePath(), 'quack-kanban-tasks.json');
const CHAT_STORE_PATH = join(getTauriStorePath(), 'quack-chats.json');
const TERMINALS_STORE_PATH = join(getTauriStorePath(), 'quack-terminals.json');

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Load available agents (terminals) from the sidebar
 * Returns array of agents with their info
 */
function loadAvailableAgents() {
  try {
    if (!existsSync(TERMINALS_STORE_PATH)) {
      console.error(`[KanbanMCP] Terminals store not found: ${TERMINALS_STORE_PATH}`);
      return [];
    }

    const data = JSON.parse(readFileSync(TERMINALS_STORE_PATH, 'utf8'));
    const terminals = data.terminals || [];

    return terminals.map(t => ({
      id: t.id,
      name: t.label,
      color: t.color,
      avatar: t.avatar,
      projectPath: t.cwd,
      projectName: t.cwd ? t.cwd.split('/').pop() : 'Unknown',
      branch: t.branch,
      workingOn: t.workingOn,
      personality: t.personality,
    }));
  } catch (error) {
    console.error(`[KanbanMCP] Error loading agents: ${error.message}`);
    return [];
  }
}

/**
 * Find an agent by ID or by fuzzy name matching
 * @param {string} identifier - Agent ID or name to search for
 * @param {string} projectPath - Optional: filter by project path
 * @returns {object|null} - Matching agent or null
 */
function findAgent(identifier, projectPath = null) {
  const agents = loadAvailableAgents();

  if (!identifier) return null;

  // First try exact ID match
  let agent = agents.find(a => a.id === identifier);
  if (agent) {
    console.error(`[KanbanMCP] Found agent by exact ID: ${agent.name}`);
    return agent;
  }

  // Filter by project if specified
  let searchPool = projectPath
    ? agents.filter(a => a.projectPath === projectPath)
    : agents;

  // Try exact name match (case-insensitive)
  const lowerIdentifier = identifier.toLowerCase();
  agent = searchPool.find(a =>
    a.name.toLowerCase() === lowerIdentifier ||
    a.name.toLowerCase() === `agent ${lowerIdentifier}`
  );
  if (agent) {
    console.error(`[KanbanMCP] Found agent by exact name: ${agent.name}`);
    return agent;
  }

  // Try partial name match (contains)
  agent = searchPool.find(a =>
    a.name.toLowerCase().includes(lowerIdentifier) ||
    lowerIdentifier.includes(a.name.toLowerCase().replace('agent ', ''))
  );
  if (agent) {
    console.error(`[KanbanMCP] Found agent by partial name: ${agent.name}`);
    return agent;
  }

  console.error(`[KanbanMCP] No agent found for: ${identifier}`);
  return null;
}

/**
 * Load chat session for a specific agent
 * Returns the last N messages from the conversation
 */
function loadChatSession(agentId, messageLimit = 10) {
  try {
    if (!existsSync(CHAT_STORE_PATH)) {
      console.error(`[KanbanMCP] Chat store not found: ${CHAT_STORE_PATH}`);
      return null;
    }

    const data = JSON.parse(readFileSync(CHAT_STORE_PATH, 'utf8'));
    const chatKey = `chat-${agentId}`;
    const chatData = data[chatKey];

    if (!chatData || !chatData.messages) {
      console.error(`[KanbanMCP] No chat data found for agent: ${agentId}`);
      return null;
    }

    // Get the last N messages
    const messages = chatData.messages.slice(-messageLimit);

    return {
      agentId,
      sessionId: chatData.sessionId,
      messageCount: chatData.messages.length,
      lastUpdated: chatData.timestamp,
      recentMessages: messages.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
        hasToolCalls: !!m.toolCalls?.length,
        toolCallsSummary: m.toolCalls?.map(tc => tc.name || tc.tool_name).filter(Boolean),
        hasAttachments: !!m.attachments?.length,
      })),
      tokens: chatData.tokens ? {
        inputTokens: chatData.tokens.inputTokens,
        outputTokens: chatData.tokens.outputTokens,
        totalCost: chatData.tokens.totalCost,
      } : null,
    };
  } catch (error) {
    console.error(`[KanbanMCP] Error loading chat session: ${error.message}`);
    return null;
  }
}

function loadKanbanTasks() {
  try {
    if (!existsSync(KANBAN_STORE_PATH)) {
      return [];
    }
    const data = JSON.parse(readFileSync(KANBAN_STORE_PATH, 'utf8'));
    return data.kanbanTasks || [];
  } catch (error) {
    console.error(`[KanbanMCP] Error loading tasks: ${error.message}`);
    return [];
  }
}

function saveKanbanTasks(tasks) {
  try {
    const dir = getTauriStorePath();
    console.error(`[KanbanMCP] Saving to dir: ${dir}`);
    console.error(`[KanbanMCP] Full path: ${KANBAN_STORE_PATH}`);
    console.error(`[KanbanMCP] Tasks count: ${tasks.length}`);

    if (!existsSync(dir)) {
      console.error(`[KanbanMCP] Creating directory...`);
      mkdirSync(dir, { recursive: true });
    }

    const data = { kanbanTasks: tasks };
    const jsonStr = JSON.stringify(data, null, 2);
    console.error(`[KanbanMCP] Writing ${jsonStr.length} bytes...`);

    writeFileSync(KANBAN_STORE_PATH, jsonStr, 'utf8');

    // Verify write
    const verifyData = readFileSync(KANBAN_STORE_PATH, 'utf8');
    const verified = JSON.parse(verifyData);
    console.error(`[KanbanMCP] Verified: ${verified.kanbanTasks.length} tasks in file`);

    return true;
  } catch (error) {
    console.error(`[KanbanMCP] ERROR saving tasks: ${error.message}`);
    console.error(`[KanbanMCP] Stack: ${error.stack}`);
    return false;
  }
}

function generateTaskId() {
  return `kanban-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

// =============================================================================
// TOOL HANDLERS
// =============================================================================

async function handleListTasks(args) {
  const tasks = loadKanbanTasks();

  let filtered = tasks.filter(task => {
    if (args.status && task.status !== args.status) return false;
    if (args.projectPath && task.projectPath !== args.projectPath) return false;
    if (args.agentId && task.assignedAgent?.id !== args.agentId) return false;
    if (args.includeCompleted === false && task.status === 'done') return false;
    return true;
  });

  filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

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

  return JSON.stringify(summary, null, 2);
}

async function handleMoveTask(args) {
  const tasks = loadKanbanTasks();
  const taskIndex = tasks.findIndex(t => t.id === args.taskId);

  if (taskIndex === -1) {
    return `Error: Task with ID "${args.taskId}" not found`;
  }

  const task = tasks[taskIndex];
  const previousStatus = task.status;

  task.status = args.newStatus;

  if (args.newStatus === 'in_progress' && !task.startedAt) {
    task.startedAt = Date.now();
  }
  if (args.newStatus === 'done') {
    task.completedAt = Date.now();
    if (args.completionNote) {
      task.completionNote = args.completionNote;
    }
  }

  tasks[taskIndex] = task;
  const saved = saveKanbanTasks(tasks);

  if (!saved) {
    return `Error: Failed to save task update`;
  }

  return `Task "${task.title}" moved from ${previousStatus} to ${args.newStatus}` +
    (args.completionNote ? `\nNote: ${args.completionNote}` : '');
}

async function handleListAgents(args) {
  const agents = loadAvailableAgents();

  // Filter by project if specified
  let filtered = agents;
  if (args.projectPath) {
    filtered = agents.filter(a => a.projectPath === args.projectPath);
  }

  const summary = {
    totalAgents: filtered.length,
    agents: filtered.map(a => ({
      id: a.id,
      name: a.name,
      color: a.color,
      avatar: a.avatar,
      projectPath: a.projectPath,
      projectName: a.projectName,
      branch: a.branch,
      workingOn: a.workingOn,
    })),
    // Group by project for easier reading
    byProject: Object.entries(
      filtered.reduce((acc, a) => {
        const proj = a.projectName || 'Unknown';
        if (!acc[proj]) acc[proj] = [];
        acc[proj].push({ id: a.id, name: a.name, branch: a.branch });
        return acc;
      }, {})
    ).map(([projectName, agents]) => ({ projectName, agents })),
  };

  return JSON.stringify(summary, null, 2);
}

async function handleCreateTask(args) {
  console.error(`[KanbanMCP] handleCreateTask called with:`, JSON.stringify(args));

  const tasks = loadKanbanTasks();
  console.error(`[KanbanMCP] Loaded ${tasks.length} existing tasks`);

  if (args.parentTaskId) {
    const parentTask = tasks.find(t => t.id === args.parentTaskId);
    if (!parentTask) {
      return `Error: Parent task with ID "${args.parentTaskId}" not found`;
    }
  }

  // Find and assign agent if specified
  let assignedAgent = null;
  if (args.assignedAgentId || args.assignedAgentName) {
    const agentIdentifier = args.assignedAgentId || args.assignedAgentName;
    const foundAgent = findAgent(agentIdentifier, args.projectPath);

    if (foundAgent) {
      assignedAgent = {
        id: foundAgent.id,
        name: foundAgent.name,
        color: foundAgent.color,
        avatar: foundAgent.avatar,
        projectPath: foundAgent.projectPath,
        projectName: foundAgent.projectName,
        branch: foundAgent.branch,
      };
      console.error(`[KanbanMCP] Assigned to agent: ${assignedAgent.name} (${assignedAgent.id})`);
    } else {
      console.error(`[KanbanMCP] Warning: Could not find agent "${agentIdentifier}"`);
      // Don't fail - just create unassigned task
    }
  }

  const newTask = {
    id: generateTaskId(),
    title: args.title,
    prompt: args.prompt,
    status: args.status || 'todo',
    projectPath: args.projectPath,
    projectName: args.projectName,
    branch: args.branch,
    parentTaskId: args.parentTaskId,
    assignedAgent: assignedAgent,
    createdAt: Date.now(),
  };

  console.error(`[KanbanMCP] Created new task: ${newTask.id} - ${newTask.title}`);

  if (newTask.status === 'in_progress') {
    newTask.startedAt = Date.now();
  }

  tasks.push(newTask);
  console.error(`[KanbanMCP] Total tasks before save: ${tasks.length}`);

  const saved = saveKanbanTasks(tasks);
  console.error(`[KanbanMCP] Save result: ${saved}`);

  if (!saved) {
    return `Error: Failed to save new task`;
  }

  let resultMsg = `Created task "${newTask.title}" (ID: ${newTask.id}) in ${newTask.status}`;
  if (assignedAgent) {
    resultMsg += `\nAssigned to: ${assignedAgent.name}`;
  } else if (args.assignedAgentId || args.assignedAgentName) {
    resultMsg += `\nWarning: Could not find agent "${args.assignedAgentId || args.assignedAgentName}" - task created unassigned`;
  }
  if (args.parentTaskId) {
    resultMsg += `\nSubtask of: ${args.parentTaskId}`;
  }

  return resultMsg;
}

async function handleUpdateTask(args) {
  const tasks = loadKanbanTasks();
  const taskIndex = tasks.findIndex(t => t.id === args.taskId);

  if (taskIndex === -1) {
    return `Error: Task with ID "${args.taskId}" not found`;
  }

  const task = tasks[taskIndex];
  const updates = [];

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

  tasks[taskIndex] = task;
  const saved = saveKanbanTasks(tasks);

  if (!saved) {
    return `Error: Failed to save task update`;
  }

  return `Task "${task.title}" updated: ${updates.join(', ')}`;
}

async function handleDeleteTask(args) {
  const tasks = loadKanbanTasks();
  const taskIndex = tasks.findIndex(t => t.id === args.taskId);

  if (taskIndex === -1) {
    return `Error: Task with ID "${args.taskId}" not found`;
  }

  const deletedTask = tasks[taskIndex];

  const subtasks = tasks.filter(t => t.parentTaskId === args.taskId);
  if (subtasks.length > 0) {
    return `Warning: Task "${deletedTask.title}" has ${subtasks.length} subtask(s). ` +
      `Delete or reassign subtasks first: ${subtasks.map(t => t.id).join(', ')}`;
  }

  tasks.splice(taskIndex, 1);
  const saved = saveKanbanTasks(tasks);

  if (!saved) {
    return `Error: Failed to save after deletion`;
  }

  return `Deleted task "${deletedTask.title}" (ID: ${args.taskId})` +
    (args.reason ? `\nReason: ${args.reason}` : '');
}

async function handleGetWorkload(args) {
  const tasks = loadKanbanTasks();

  let filteredTasks = tasks;
  if (args.projectPath) {
    filteredTasks = tasks.filter(t => t.projectPath === args.projectPath);
  }

  const workload = {};

  filteredTasks.forEach(task => {
    if (task.assignedAgent) {
      const id = task.assignedAgent.id;

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

  const workloadArray = Object.values(workload)
    .sort((a, b) => b.in_progress - a.in_progress);

  const summary = {
    totalAgents: workloadArray.length,
    agentWorkloads: workloadArray,
    unassignedTasks: filteredTasks.filter(t => !t.assignedAgent).length,
  };

  return JSON.stringify(summary, null, 2);
}

async function handleGetSessionContext(args) {
  const { agentId, messageLimit = 10, includeToolResults = false } = args;

  if (!agentId) {
    return `Error: agentId is required`;
  }

  const session = loadChatSession(agentId, messageLimit);

  if (!session) {
    return `No session found for agent ${agentId}. The agent may not have any chat history yet.`;
  }

  // Build a readable context summary
  const contextSummary = {
    agentId: session.agentId,
    sessionId: session.sessionId,
    totalMessages: session.messageCount,
    messagesReturned: session.recentMessages.length,
    lastUpdated: session.lastUpdated ? new Date(session.lastUpdated).toISOString() : null,
    tokenUsage: session.tokens,
    conversation: session.recentMessages.map(m => {
      const entry = {
        role: m.role,
        content: m.content,
        timestamp: new Date(m.timestamp).toISOString(),
      };

      // Add tool call info if present
      if (m.hasToolCalls && m.toolCallsSummary?.length > 0) {
        entry.toolsUsed = m.toolCallsSummary;
      }

      // Add attachment indicator
      if (m.hasAttachments) {
        entry.hasAttachments = true;
      }

      return entry;
    }),
  };

  // Add summary of what happened in the conversation
  const userMessages = session.recentMessages.filter(m => m.role === 'user');
  const assistantMessages = session.recentMessages.filter(m => m.role === 'assistant');
  const toolCalls = session.recentMessages
    .filter(m => m.toolCallsSummary?.length > 0)
    .flatMap(m => m.toolCallsSummary);

  contextSummary.quickSummary = {
    userMessages: userMessages.length,
    assistantMessages: assistantMessages.length,
    toolsUsed: [...new Set(toolCalls)], // Unique tools
    lastUserMessage: userMessages[userMessages.length - 1]?.content?.slice(0, 200) || null,
    lastAssistantMessage: assistantMessages[assistantMessages.length - 1]?.content?.slice(0, 200) || null,
  };

  return JSON.stringify(contextSummary, null, 2);
}

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS = [
  {
    name: 'kanban_list_agents',
    description: 'List all available agents from the sidebar. Use this FIRST before creating tasks to see which agents exist and their IDs. Agents can be assigned to tasks by name (e.g., "Magnus", "Mei", "Laura") or by ID.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Filter agents by project path. Omit to see all agents.',
        },
      },
    },
  },
  {
    name: 'kanban_list_tasks',
    description: 'List all Kanban tasks. Use this to understand the current project context, see what tasks exist, and check workload before creating new tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'Filter by status. Omit to see all tasks.',
        },
        projectPath: {
          type: 'string',
          description: 'Filter by project path. Omit to see all projects.',
        },
        agentId: {
          type: 'string',
          description: 'Filter by assigned agent ID. Omit to see all agents.',
        },
        includeCompleted: {
          type: 'boolean',
          default: true,
          description: 'Whether to include completed (done) tasks.',
        },
      },
    },
  },
  {
    name: 'kanban_move_task',
    description: 'Move a task to a different status column. Use this to mark a task as complete when finished, or to change task status. This is how you signal that your work on a task is done.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to move',
        },
        newStatus: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'The new status column',
        },
        completionNote: {
          type: 'string',
          description: 'Note when marking as done (e.g., "All tests passing, feature complete")',
        },
      },
      required: ['taskId', 'newStatus'],
    },
  },
  {
    name: 'kanban_create_task',
    description: 'Create a new Kanban task. Use this to break down complex tasks into smaller subtasks, or to create related tasks. When creating a subtask, set the parentTaskId to link it to the parent task.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Short title for the task (shown on card)',
        },
        prompt: {
          type: 'string',
          description: 'Full prompt/description for the task',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress'],
          default: 'todo',
          description: 'Initial status. Usually "todo" for new tasks.',
        },
        projectPath: {
          type: 'string',
          description: 'Absolute path to the project directory',
        },
        projectName: {
          type: 'string',
          description: 'Display name of the project',
        },
        branch: {
          type: 'string',
          description: 'Git branch for this task',
        },
        parentTaskId: {
          type: 'string',
          description: 'ID of parent task if this is a subtask',
        },
        assignedAgentId: {
          type: 'string',
          description: 'ID of agent to assign (exact UUID). Use kanban_list_agents to get agent IDs.',
        },
        assignedAgentName: {
          type: 'string',
          description: 'Name of agent to assign (e.g., "Magnus", "Mei", "Laura"). Supports fuzzy matching - will find "Agent Magnus" if you pass "Magnus".',
        },
      },
      required: ['title', 'prompt', 'projectPath', 'projectName'],
    },
  },
  {
    name: 'kanban_update_task',
    description: 'Update task metadata like title, description, progress percentage, or notes. Use this to track progress or add context to a task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to update',
        },
        title: {
          type: 'string',
          description: 'New title for the task',
        },
        prompt: {
          type: 'string',
          description: 'Updated prompt/description',
        },
        progress: {
          type: 'number',
          minimum: 0,
          maximum: 100,
          description: 'Progress percentage (0-100)',
        },
        notes: {
          type: 'string',
          description: 'Additional notes to append',
        },
        blockedBy: {
          type: 'string',
          description: 'ID of task that blocks this one',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'kanban_delete_task',
    description: 'Delete a Kanban task. Use with caution - this permanently removes the task. Consider moving to "done" instead if the work was completed.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'The ID of the task to delete',
        },
        reason: {
          type: 'string',
          description: 'Reason for deletion (for audit trail)',
        },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'kanban_get_workload',
    description: 'Get workload summary for agents. Use this to understand which agents are busy and which have capacity for new tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Get workload for specific agent. Omit for all agents.',
        },
        projectPath: {
          type: 'string',
          description: 'Filter to a specific project.',
        },
      },
    },
  },
  {
    name: 'kanban_get_session_context',
    description: 'Get the conversation context for an agent. Use this to understand what has been discussed, what decisions were made, and what the user requested. Essential for coordinating multi-step tasks and understanding prior context before taking actions.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The ID of the agent whose session context to retrieve. This is the agent you want to understand the conversation history for.',
        },
        messageLimit: {
          type: 'number',
          default: 10,
          minimum: 1,
          maximum: 50,
          description: 'Number of recent messages to retrieve. Default is 10. Use more for complex tasks that need full context.',
        },
      },
      required: ['agentId'],
    },
  },
];

// =============================================================================
// MAIN SERVER
// =============================================================================

const server = new Server(
  {
    name: 'kanban-tools',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Handle tool listing
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: TOOLS };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    let result;

    switch (name) {
      case 'kanban_list_agents':
        result = await handleListAgents(args || {});
        break;
      case 'kanban_list_tasks':
        result = await handleListTasks(args || {});
        break;
      case 'kanban_move_task':
        result = await handleMoveTask(args);
        break;
      case 'kanban_create_task':
        result = await handleCreateTask(args);
        break;
      case 'kanban_update_task':
        result = await handleUpdateTask(args);
        break;
      case 'kanban_delete_task':
        result = await handleDeleteTask(args);
        break;
      case 'kanban_get_workload':
        result = await handleGetWorkload(args || {});
        break;
      case 'kanban_get_session_context':
        result = await handleGetSessionContext(args || {});
        break;
      default:
        return {
          content: [{ type: 'text', text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }

    return {
      content: [{ type: 'text', text: result }],
    };
  } catch (error) {
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[KanbanMCP] Server started');
}

main().catch(console.error);
