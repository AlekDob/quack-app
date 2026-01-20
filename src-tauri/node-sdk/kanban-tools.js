/**
 * Kanban Custom Tools for Claude Agent SDK
 *
 * These tools allow Claude to manage Kanban sessions:
 * - List sessions (context awareness)
 * - Move sessions (self-completion)
 * - Create sessions (subtask decomposition)
 * - Update sessions (progress tracking)
 * - Delete sessions (cleanup)
 * - Get workload (load balancing)
 * - Get session context (read conversation history)
 *
 * Data is stored in quack-agent-sessions.json via Tauri Store
 * Sessions are the source of truth (replaces task-based approach)
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

// Path to sessions storage (Tauri Store format)
const SESSIONS_STORE_PATH = join(getTauriStorePath(), 'quack-agent-sessions.json');

// Log path on module load for debugging
console.error(`[KanbanTools] Storage path: ${SESSIONS_STORE_PATH}`);

/**
 * Load agents from .quack/agent-personalities directory
 * Each agent is a JSON file with id, name, role fields
 */
function loadAgentsFromProject(projectPath) {
  const agentsDir = join(projectPath, '.quack', 'agent-personalities');
  const agents = [];

  try {
    if (!existsSync(agentsDir)) {
      console.error(`[KanbanTools] No agents directory at ${agentsDir}`);
      return agents;
    }

    const files = require('fs').readdirSync(agentsDir);
    for (const file of files) {
      if (!file.endsWith('.json')) continue;
      try {
        const agentPath = join(agentsDir, file);
        const agentData = JSON.parse(readFileSync(agentPath, 'utf8'));
        if (agentData.id && agentData.name) {
          agents.push({
            id: agentData.id,
            name: agentData.name,
            role: agentData.role,
          });
        }
      } catch (e) {
        console.error(`[KanbanTools] Error reading agent file ${file}: ${e.message}`);
      }
    }
    console.error(`[KanbanTools] Loaded ${agents.length} agents from ${agentsDir}`);
  } catch (error) {
    console.error(`[KanbanTools] Error loading agents: ${error.message}`);
  }

  return agents;
}

/**
 * Fuzzy match agent name to find ID
 * Searches in the project's .quack/agent-personalities directory
 */
function findAgentByName(name, projectPath) {
  if (!name) return null;

  // Load agents from project
  const agents = loadAgentsFromProject(projectPath || process.cwd());
  const lowerName = name.toLowerCase();

  // Try exact match first
  for (const agent of agents) {
    if (agent.name.toLowerCase() === lowerName || agent.id === name) {
      return agent;
    }
  }

  // Try partial match on name
  for (const agent of agents) {
    if (agent.name.toLowerCase().includes(lowerName) || lowerName.includes(agent.name.toLowerCase())) {
      return agent;
    }
  }

  // Try partial match on role (e.g., "coder" matches role "Coder")
  for (const agent of agents) {
    if (agent.role && agent.role.toLowerCase().includes(lowerName)) {
      return agent;
    }
  }

  console.error(`[KanbanTools] No agent found matching "${name}"`);
  return null;
}

/**
 * Generate unique session ID
 */
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Load sessions from storage
 */
function loadSessions() {
  try {
    if (!existsSync(SESSIONS_STORE_PATH)) {
      console.error('[KanbanTools] No sessions file found, returning empty array');
      return [];
    }

    const data = JSON.parse(readFileSync(SESSIONS_STORE_PATH, 'utf8'));
    // Tauri Store format: { agentSessions: [...] }
    const sessions = data.agentSessions || [];
    console.error(`[KanbanTools] Loaded ${sessions.length} sessions from storage`);
    return sessions;
  } catch (error) {
    console.error(`[KanbanTools] Error loading sessions: ${error.message}`);
    return [];
  }
}

/**
 * Save sessions to storage
 * IMPORTANT: Preserve agentSessionMap when saving
 */
function saveSessions(sessions) {
  try {
    // Ensure directory exists
    const dir = getTauriStorePath();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Read existing data to preserve agentSessionMap
    let existingData = { agentSessionMap: {} };
    if (existsSync(SESSIONS_STORE_PATH)) {
      try {
        existingData = JSON.parse(readFileSync(SESSIONS_STORE_PATH, 'utf8'));
      } catch (e) {
        console.error(`[KanbanTools] Warning: Could not read existing data: ${e.message}`);
      }
    }

    // Tauri Store format - preserve agentSessionMap
    const data = {
      agentSessions: sessions,
      agentSessionMap: existingData.agentSessionMap || {},
    };
    writeFileSync(SESSIONS_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.error(`[KanbanTools] Saved ${sessions.length} sessions to storage (preserved agentSessionMap)`);
    return true;
  } catch (error) {
    console.error(`[KanbanTools] Error saving sessions: ${error.message}`);
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
 * Generate unique attachment ID
 */
function generateAttachmentId() {
  return `att-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

// ============================================================
// KANBAN TOOLS DEFINITIONS
// ============================================================

/**
 * Tool: kanban_list_tasks
 * Purpose: Claude can see all sessions for context awareness
 */
const kanbanListTasks = tool(
  'kanban_list_tasks',
  'List all Kanban sessions/tasks. Use this to understand the current project context, see what sessions exist, and check workload before creating new tasks.',
  {
    status: z.enum(['todo', 'in_progress', 'done']).optional()
      .describe('Filter by status. Omit to see all sessions.'),
    projectPath: z.string().optional()
      .describe('Filter by project path. Omit to see all projects.'),
    agentId: z.string().optional()
      .describe('Filter by assigned agent ID. Omit to see all agents.'),
    includeCompleted: z.boolean().optional().default(true)
      .describe('Whether to include completed (done) sessions.'),
  },
  async (args) => {
    const sessions = loadSessions();

    let filtered = sessions.filter(session => {
      // Filter by status
      if (args.status && session.status !== args.status) return false;

      // Filter by project
      if (args.projectPath && session.projectPath !== args.projectPath) return false;

      // Filter by agent
      if (args.agentId && session.agentId !== args.agentId) return false;

      // Exclude completed if requested
      if (!args.includeCompleted && session.status === 'done') return false;

      return true;
    });

    // Sort by createdAt descending (newest first)
    filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    // Format output for Claude - map session fields to task-like structure
    const summary = {
      total: filtered.length,
      byStatus: {
        todo: filtered.filter(s => s.status === 'todo').length,
        in_progress: filtered.filter(s => s.status === 'in_progress').length,
        done: filtered.filter(s => s.status === 'done').length,
      },
      tasks: filtered.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        projectName: s.projectName,
        projectPath: s.projectPath,
        agentId: s.agentId,
        claudeSessionId: s.claudeSessionId,
        initialPrompt: s.initialPrompt,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
        completedAt: s.completedAt,
        messageCount: s.messageCount,
        totalCost: s.totalCost,
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
 * Purpose: Claude can move sessions between columns (including self-completion)
 */
const kanbanMoveTask = tool(
  'kanban_move_task',
  'Move a session to a different status column. Use this to mark a session as complete when finished, or to change session status. This is how you signal that your work on a task is done.',
  {
    taskId: z.string().describe('The ID of the session to move'),
    newStatus: z.enum(['todo', 'in_progress', 'done'])
      .describe('The new status column'),
    completionNote: z.string().optional()
      .describe('Note when marking as done (e.g., "All tests passing, feature complete")'),
  },
  async (args) => {
    const sessions = loadSessions();
    const sessionIndex = sessions.findIndex(s => s.id === args.taskId);

    if (sessionIndex === -1) {
      return {
        content: [{
          type: 'text',
          text: `Error: Session with ID "${args.taskId}" not found`,
        }],
      };
    }

    const session = sessions[sessionIndex];
    const previousStatus = session.status;

    // Update session
    session.status = args.newStatus;
    session.updatedAt = Date.now();

    // Set timestamps based on new status
    if (args.newStatus === 'done') {
      session.completedAt = Date.now();
    }

    // Save
    sessions[sessionIndex] = session;
    const saved = saveSessions(sessions);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: `Error: Failed to save session update`,
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
        text: `Session "${session.title}" moved from ${previousStatus} to ${args.newStatus}` +
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
 * Tool: kanban_create_task
 * Purpose: Claude can create sessions for task management
 */
const kanbanCreateTask = tool(
  'kanban_create_task',
  'Create a new Kanban session/task. Use this to create new work items. The agentId field is REQUIRED - specify either assignedAgentId (UUID) or assignedAgentName (will be fuzzy matched).',
  {
    title: z.string().describe('Short title for the session (shown on card)'),
    prompt: z.string().describe('Full prompt/description for the task - will be set as initialPrompt'),
    status: z.enum(['todo', 'in_progress']).default('todo')
      .describe('Initial status. Usually "todo" for new tasks.'),
    projectPath: z.string().optional()
      .describe('Absolute path to the project directory. If not provided, uses current working directory.'),
    projectName: z.string().optional()
      .describe('Display name of the project. If not provided, derives from projectPath.'),
    assignedAgentId: z.string().optional()
      .describe('UUID of agent to assign (e.g., "09748e66-bf76-463c-8dc6-a3041fa7ed76")'),
    assignedAgentName: z.string().optional()
      .describe('Name of agent to assign (e.g., "Magnus", "Coder"). Will be fuzzy matched.'),
    attachments: z.array(attachmentSchema).optional()
      .describe('Image attachments for the task. Each attachment should have path (absolute file path) and optionally name, mimeType.'),
  },
  async (args) => {
    // Resolve projectPath - use provided or fallback to cwd
    const projectPath = args.projectPath || process.cwd();

    // Derive projectName from path if not provided
    const projectName = args.projectName || projectPath.split('/').pop() || 'Unknown Project';

    console.error(`[KanbanTools] Creating task in project: ${projectName} (${projectPath})`);

    // Resolve agent ID
    let agentId = args.assignedAgentId;

    // If no ID provided, try to find by name using project's agent config
    if (!agentId && args.assignedAgentName) {
      const agent = findAgentByName(args.assignedAgentName, projectPath);
      if (agent) {
        agentId = agent.id;
        console.error(`[KanbanTools] Matched agent name "${args.assignedAgentName}" to ID "${agentId}"`);
      }
    }

    // Agent ID is required
    if (!agentId) {
      return {
        content: [{
          type: 'text',
          text: `Error: Agent ID is required. Provide either assignedAgentId (UUID) or assignedAgentName (e.g., "Magnus", "Coder")`,
        }],
      };
    }

    const sessions = loadSessions();

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

    // Create new session (AgentSession format)
    const newSession = {
      id: generateSessionId(),
      title: args.title,
      agentId: agentId,
      projectPath: projectPath,  // Use resolved projectPath (with cwd fallback)
      projectName: projectName,  // Use resolved projectName (derived from path if needed)
      status: args.status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      // Initial prompt and attachments for when session is opened
      initialPrompt: args.prompt,
      initialAttachments: processedAttachments.length > 0 ? processedAttachments : undefined,
    };

    // Add to sessions
    sessions.push(newSession);
    const saved = saveSessions(sessions);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: `Error: Failed to save new session`,
        }],
      };
    }

    // Emit event for frontend
    emitKanbanEvent('task_created', {
      task: newSession,
      session: newSession,
    });

    const attachmentInfo = processedAttachments.length > 0
      ? `\nAttachments: ${processedAttachments.length} image(s)`
      : '';

    return {
      content: [{
        type: 'text',
        text: `Created session "${newSession.title}" (ID: ${newSession.id}) in ${args.status}\nAgent ID: ${agentId}` +
              attachmentInfo,
      }],
    };
  }
);

/**
 * Tool: kanban_update_task
 * Purpose: Claude can update session metadata (title, notes, etc.)
 */
const kanbanUpdateTask = tool(
  'kanban_update_task',
  'Update session metadata like title or initial prompt. Use this to track progress or add context to a session.',
  {
    taskId: z.string().describe('The ID of the session to update'),
    title: z.string().optional().describe('New title for the session'),
    prompt: z.string().optional().describe('Updated initial prompt'),
  },
  async (args) => {
    const sessions = loadSessions();
    const sessionIndex = sessions.findIndex(s => s.id === args.taskId);

    if (sessionIndex === -1) {
      return {
        content: [{
          type: 'text',
          text: `Error: Session with ID "${args.taskId}" not found`,
        }],
      };
    }

    const session = sessions[sessionIndex];
    const updates = [];

    // Apply updates
    if (args.title !== undefined) {
      session.title = args.title;
      updates.push(`title: "${args.title}"`);
    }
    if (args.prompt !== undefined) {
      session.initialPrompt = args.prompt;
      updates.push('prompt updated');
    }

    // Always update timestamp
    session.updatedAt = Date.now();

    // Save
    sessions[sessionIndex] = session;
    const saved = saveSessions(sessions);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: `Error: Failed to save session update`,
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
        text: `Session "${session.title}" updated: ${updates.join(', ')}`,
      }],
    };
  }
);

/**
 * Tool: kanban_delete_task
 * Purpose: Claude can delete sessions (cleanup)
 */
const kanbanDeleteTask = tool(
  'kanban_delete_task',
  'Delete a Kanban session. Use with caution - this permanently removes the session. Consider moving to "done" instead if the work was completed.',
  {
    taskId: z.string().describe('The ID of the session to delete'),
    reason: z.string().optional()
      .describe('Reason for deletion (for audit trail)'),
  },
  async (args) => {
    const sessions = loadSessions();
    const sessionIndex = sessions.findIndex(s => s.id === args.taskId);

    if (sessionIndex === -1) {
      return {
        content: [{
          type: 'text',
          text: `Error: Session with ID "${args.taskId}" not found`,
        }],
      };
    }

    const deletedSession = sessions[sessionIndex];

    // Remove session
    sessions.splice(sessionIndex, 1);
    const saved = saveSessions(sessions);

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
      title: deletedSession.title,
      reason: args.reason,
    });

    return {
      content: [{
        type: 'text',
        text: `Deleted session "${deletedSession.title}" (ID: ${args.taskId})` +
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
    const sessions = loadSessions();

    // Filter by project if specified
    let filteredSessions = sessions;
    if (args.projectPath) {
      filteredSessions = sessions.filter(s => s.projectPath === args.projectPath);
    }

    // Build workload map grouped by agentId
    const workload = {};

    filteredSessions.forEach(session => {
      const id = session.agentId;
      if (!id) return;

      // Filter by agent if specified
      if (args.agentId && id !== args.agentId) return;

      if (!workload[id]) {
        workload[id] = {
          agentId: id,
          projectName: session.projectName,
          todo: 0,
          in_progress: 0,
          done: 0,
          sessions: [],
        };
      }

      workload[id][session.status]++;
      workload[id].sessions.push({
        id: session.id,
        title: session.title,
        status: session.status,
      });
    });

    // Convert to array and sort by in_progress count
    const workloadArray = Object.values(workload)
      .sort((a, b) => b.in_progress - a.in_progress);

    // Summary
    const summary = {
      totalAgents: workloadArray.length,
      agentWorkloads: workloadArray,
      unassignedSessions: filteredSessions.filter(s => !s.agentId).length,
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
 * Tool: kanban_get_session_context
 * Purpose: Claude can read conversation history from a session
 */
const kanbanGetSessionContext = tool(
  'kanban_get_session_context',
  'Get the conversation history from a session. Use this to understand what work has been done and continue from where it left off.',
  {
    sessionId: z.string().describe('The ID of the session to get context from'),
    maxMessages: z.number().optional().default(20)
      .describe('Maximum number of recent messages to return'),
  },
  async (args) => {
    const sessions = loadSessions();
    const session = sessions.find(s => s.id === args.sessionId);

    if (!session) {
      return {
        content: [{
          type: 'text',
          text: `Error: Session with ID "${args.sessionId}" not found`,
        }],
      };
    }

    // Try to load messages from quack-agent-messages.json
    const messagesPath = join(getTauriStorePath(), 'quack-agent-messages.json');
    let sessionMessages = [];

    try {
      if (existsSync(messagesPath)) {
        const messagesData = JSON.parse(readFileSync(messagesPath, 'utf8'));
        // Messages are stored by agentChatId (which corresponds to session's claudeSessionId or id)
        const messageKey = session.claudeSessionId || session.id;
        sessionMessages = messagesData[messageKey] || [];

        // Limit to maxMessages
        if (sessionMessages.length > args.maxMessages) {
          sessionMessages = sessionMessages.slice(-args.maxMessages);
        }
      }
    } catch (error) {
      console.error(`[KanbanTools] Error loading messages: ${error.message}`);
    }

    const context = {
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        agentId: session.agentId,
        projectPath: session.projectPath,
        projectName: session.projectName,
        claudeSessionId: session.claudeSessionId,
        initialPrompt: session.initialPrompt,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      messageCount: sessionMessages.length,
      messages: sessionMessages.map(m => ({
        role: m.role,
        content: m.content?.substring(0, 500), // Truncate long content
        timestamp: m.timestamp,
        toolCalls: m.toolCalls?.map(tc => tc.name),
      })),
    };

    return {
      content: [{
        type: 'text',
        text: JSON.stringify(context, null, 2),
      }],
    };
  }
);

/**
 * Tool: kanban_list_agents
 * Purpose: Claude can see available agents in the project
 */
const kanbanListAgents = tool(
  'kanban_list_agents',
  'List all available agents from the project. Use this FIRST before creating tasks to see which agents exist and their IDs.',
  {
    projectPath: z.string()
      .describe('Absolute path to the project directory'),
  },
  async (args) => {
    const agents = loadAgentsFromProject(args.projectPath);

    if (agents.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No agents found in ${args.projectPath}/.quack/agent-personalities/\n\nCreate agent personality files to assign tasks.`,
        }],
      };
    }

    const summary = {
      projectPath: args.projectPath,
      totalAgents: agents.length,
      agents: agents.map(a => ({
        id: a.id,
        name: a.name,
        role: a.role,
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
    version: '2.0.0',
    tools: [
      kanbanListAgents,
      kanbanListTasks,
      kanbanMoveTask,
      kanbanCreateTask,
      kanbanUpdateTask,
      kanbanDeleteTask,
      kanbanGetWorkload,
      kanbanGetSessionContext,
    ],
  });
}

// Export individual tools for testing
export {
  kanbanListAgents,
  kanbanListTasks,
  kanbanMoveTask,
  kanbanCreateTask,
  kanbanUpdateTask,
  kanbanDeleteTask,
  kanbanGetWorkload,
  kanbanGetSessionContext,
};
