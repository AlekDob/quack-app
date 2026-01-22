/**
 * Kanban Tools V2 - Multi-Project Agent Architecture
 *
 * This is a complete refactor of kanban-tools.js with support for:
 * 1. Multi-Project Agents - One agent can work on multiple projects
 * 2. Auto-Create Agents - Sessions auto-create agents if they don't exist
 * 3. Session = Sacred & Isolated - Sessions are independent work units
 *
 * Architecture Changes from V1:
 * - Agent has NO projectPath (can work on any project)
 * - Session has agentId + projectPath (binds agent to project)
 * - Agent → Project relationship is M:N (inferred from sessions)
 *
 * Tools Provided:
 * - kanban_create_agent (create multi-project agent)
 * - kanban_create_session (create session, auto-create agent if needed)
 * - kanban_list_agents (list agents, optionally filtered by project)
 * - kanban_list_sessions (list sessions, filtered by agent/project/status)
 * - kanban_move_session (move session between columns)
 * - kanban_update_session (update session metadata)
 * - kanban_delete_agent (delete agent + sessions with archive mode)
 * - kanban_delete_session (delete single session)
 */

import { tool, createSdkMcpServer } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, resolve, normalize } from 'path';
import { homedir, platform } from 'os';
import { randomUUID } from 'crypto';
import { z } from 'zod';
import lockfile from 'proper-lockfile';

// ============================================================
// STORAGE UTILITIES
// ============================================================

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

// Path to unified storage file (agents + sessions in one file)
// NOTE: Frontend uses quack-agents.json for BOTH agents and sessions
const UNIFIED_STORE_PATH = join(getTauriStorePath(), 'quack-agents.json');

console.error(`[KanbanV2] Unified storage: ${UNIFIED_STORE_PATH}`);

/**
 * Load agents from quack-agents.json
 * Format: { agents: UnifiedAgent[], sessions: AgentSession[], version: number }
 */
function loadAgents() {
  try {
    if (!existsSync(UNIFIED_STORE_PATH)) {
      console.error('[KanbanV2] No storage file found, returning empty array');
      return [];
    }

    const data = JSON.parse(readFileSync(UNIFIED_STORE_PATH, 'utf8'));
    const agents = data.agents || [];
    console.error(`[KanbanV2] Loaded ${agents.length} agents from storage`);
    return agents;
  } catch (error) {
    console.error(`[KanbanV2] Error loading agents: ${error.message}`);
    return [];
  }
}

/**
 * Save agents to quack-agents.json with file locking
 * Preserves existing sessions when saving agents
 */
async function saveAgents(agents) {
  let release;
  try {
    const dir = getTauriStorePath();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Ensure file exists before locking
    if (!existsSync(UNIFIED_STORE_PATH)) {
      writeFileSync(UNIFIED_STORE_PATH, JSON.stringify({ agents: [], sessions: [], version: 2 }, null, 2), 'utf8');
    }

    // Acquire lock with timeout
    release = await lockfile.lock(UNIFIED_STORE_PATH, {
      retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
      stale: 5000, // Consider lock stale after 5 seconds
    });

    // Read existing data to preserve sessions
    let existingData = { agents: [], sessions: [], version: 2 };
    try {
      existingData = JSON.parse(readFileSync(UNIFIED_STORE_PATH, 'utf8'));
    } catch (e) {
      console.error(`[KanbanV2] Could not read existing data, starting fresh`);
    }

    const data = {
      agents: agents,
      sessions: existingData.sessions || [], // Preserve existing sessions
      version: 2, // V2 = Multi-Project Agent Architecture
    };
    writeFileSync(UNIFIED_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.error(`[KanbanV2] Saved ${agents.length} agents to storage (preserved ${data.sessions.length} sessions)`);
    return true;
  } catch (error) {
    console.error(`[KanbanV2] Error saving agents: ${error.message}`);
    return false;
  } finally {
    if (release) {
      try {
        await release();
      } catch (err) {
        console.error(`[KanbanV2] Error releasing lock: ${err.message}`);
      }
    }
  }
}

/**
 * Load sessions from quack-agents.json (unified storage)
 * Format: { agents: [], sessions: [], version: 2 }
 */
function loadSessions() {
  try {
    if (!existsSync(UNIFIED_STORE_PATH)) {
      console.error('[KanbanV2] No unified storage file found, returning empty array');
      return [];
    }

    const data = JSON.parse(readFileSync(UNIFIED_STORE_PATH, 'utf8'));
    const sessions = data.sessions || [];
    console.error(`[KanbanV2] Loaded ${sessions.length} sessions from unified storage`);
    return sessions;
  } catch (error) {
    console.error(`[KanbanV2] Error loading sessions: ${error.message}`);
    return [];
  }
}

/**
 * Save sessions to quack-agents.json (unified storage) with file locking
 * Preserves existing agents when saving sessions
 */
async function saveSessions(sessions) {
  let release;
  try {
    const dir = getTauriStorePath();
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }

    // Ensure file exists before locking
    if (!existsSync(UNIFIED_STORE_PATH)) {
      writeFileSync(UNIFIED_STORE_PATH, JSON.stringify({ agents: [], sessions: [], version: 2 }, null, 2), 'utf8');
    }

    // Acquire lock with timeout
    release = await lockfile.lock(UNIFIED_STORE_PATH, {
      retries: { retries: 5, minTimeout: 100, maxTimeout: 1000 },
      stale: 5000, // Consider lock stale after 5 seconds
    });

    // Read existing data to preserve agents
    let existingData = { agents: [], sessions: [], version: 2 };
    try {
      existingData = JSON.parse(readFileSync(UNIFIED_STORE_PATH, 'utf8'));
    } catch (e) {
      console.error(`[KanbanV2] Could not read existing data, starting fresh`);
    }

    const data = {
      agents: existingData.agents || [], // Preserve existing agents
      sessions: sessions,
      version: 2,
    };
    writeFileSync(UNIFIED_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
    console.error(`[KanbanV2] Saved ${sessions.length} sessions to unified storage (preserved ${data.agents.length} agents)`);
    return true;
  } catch (error) {
    console.error(`[KanbanV2] Error saving sessions: ${error.message}`);
    return false;
  } finally {
    if (release) {
      try {
        await release();
      } catch (err) {
        console.error(`[KanbanV2] Error releasing lock: ${err.message}`);
      }
    }
  }
}

/**
 * Emit event to frontend via stdout (captured by Rust backend)
 */
function emitKanbanEvent(eventType, payload) {
  const event = {
    type: 'kanban_event',
    eventType,
    payload,
    timestamp: Date.now(),
  };
  console.log(JSON.stringify(event));
}

// ============================================================
// ID GENERATION (Cryptographically Secure)
// ============================================================

function generateAgentId() {
  return `agent-${randomUUID()}`;
}

function generateSessionId() {
  return `session-${randomUUID()}`;
}

function generateColor() {
  const colors = ['#FF6B35', '#004E89', '#F7931E', '#00D9FF', '#A239EA', '#00C49A'];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ============================================================
// AGENT MANAGEMENT HELPERS
// ============================================================

/**
 * Find agent by ID or fuzzy-match name
 */
function findAgent(idOrName) {
  if (!idOrName) return null;

  const agents = loadAgents();
  const query = idOrName.toLowerCase();

  // Try exact ID match first
  const exactMatch = agents.find(a => a.id === idOrName);
  if (exactMatch) return exactMatch;

  // Try exact name match
  const exactNameMatch = agents.find(a => a.name.toLowerCase() === query);
  if (exactNameMatch) return exactNameMatch;

  // Try partial match
  const partialMatch = agents.find(a =>
    a.name.toLowerCase().includes(query) || query.includes(a.name.toLowerCase())
  );
  if (partialMatch) return partialMatch;

  console.error(`[KanbanV2] No agent found matching "${idOrName}"`);
  return null;
}

/**
 * Validate and sanitize project path to prevent directory traversal
 */
function validateProjectPath(projectPath) {
  if (!projectPath || typeof projectPath !== 'string') {
    throw new Error('Invalid project path: must be a non-empty string');
  }

  // Normalize and resolve the path
  const normalizedPath = normalize(resolve(projectPath));

  // Check for directory traversal patterns
  if (normalizedPath.includes('..') || normalizedPath !== resolve(projectPath)) {
    throw new Error('Invalid project path: directory traversal detected');
  }

  // Ensure it's an absolute path
  if (!normalizedPath.startsWith('/') && !normalizedPath.match(/^[A-Z]:\\/)) {
    throw new Error('Invalid project path: must be an absolute path');
  }

  return normalizedPath;
}

/**
 * Auto-create agent if it doesn't exist
 * Used when creating sessions with agentName
 */
async function autoCreateAgent(name, projectPath) {
  // Validate project path to prevent directory traversal
  const validatedPath = validateProjectPath(projectPath);

  console.error(`[KanbanV2] Auto-creating agent: ${name} (default project: ${validatedPath})`);

  const agents = loadAgents();

  const newAgent = {
    id: generateAgentId(),
    name: name,
    color: generateColor(),
    avatar: 'duck1.jpeg',
    createdAt: Date.now(),
    lastActiveAt: Date.now(),
    defaultProjectPath: validatedPath, // Remember first project for UI
  };

  agents.push(newAgent);
  const saved = await saveAgents(agents);

  if (!saved) {
    throw new Error('Failed to save auto-created agent');
  }

  // Emit event for frontend
  emitKanbanEvent('agent_created', { agent: newAgent });

  return newAgent;
}

/**
 * Get all projects an agent is working on (derived from sessions)
 */
function getProjectsForAgent(agentId) {
  const sessions = loadSessions();
  const projectPaths = sessions
    .filter(s => s.agentId === agentId)
    .map(s => s.projectPath);

  return [...new Set(projectPaths)]; // Unique project paths
}

/**
 * Get all agents working on a project (derived from sessions)
 */
function getAgentsForProject(projectPath) {
  const sessions = loadSessions();
  const agentIds = sessions
    .filter(s => s.projectPath === projectPath)
    .map(s => s.agentId);

  const uniqueAgentIds = [...new Set(agentIds)];
  const agents = loadAgents();

  return agents.filter(a => uniqueAgentIds.includes(a.id));
}

// ============================================================
// MCP TOOLS DEFINITIONS (V2)
// ============================================================

/**
 * Tool: kanban_create_agent
 * Purpose: Create a new multi-project agent
 */
const kanbanCreateAgent = tool(
  'kanban_create_agent',
  'Create a new agent that can work on multiple projects. Agent is not bound to any specific project - projects are assigned via sessions.',
  {
    name: z.string().describe('Name of the agent (e.g., "Sophie", "Magnus")'),
    avatar: z.string().optional().describe('Avatar filename (e.g., "duck1.jpeg")'),
    personality: z.object({
      role: z.string().optional(),
      communicationStyle: z.string().optional(),
      notes: z.string().optional(),
    }).optional().describe('Agent personality configuration'),
  },
  async (args) => {
    const agents = loadAgents();

    // Check for duplicate name
    const existing = agents.find(a => a.name.toLowerCase() === args.name.toLowerCase());
    if (existing) {
      return {
        content: [{
          type: 'text',
          text: `Error: Agent with name "${args.name}" already exists (ID: ${existing.id})`,
        }],
      };
    }

    const newAgent = {
      id: generateAgentId(),
      name: args.name,
      color: generateColor(),
      avatar: args.avatar || 'duck1.jpeg',
      personality: args.personality,
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };

    agents.push(newAgent);
    const saved = await saveAgents(agents);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Failed to save agent',
        }],
      };
    }

    emitKanbanEvent('agent_created', { agent: newAgent });

    return {
      content: [{
        type: 'text',
        text: `Created agent "${newAgent.name}" (ID: ${newAgent.id})\nAgent can now work on any project by creating sessions.`,
      }],
    };
  }
);

/**
 * Tool: kanban_create_session
 * Purpose: Create a session for an agent on a specific project
 * Auto-creates agent if it doesn't exist
 */
const kanbanCreateSession = tool(
  'kanban_create_session',
  'Create a new session for an agent on a specific project. If the agent does not exist, it will be created automatically with default settings.',
  {
    projectPath: z.string().describe('Absolute path to the project directory'),
    projectName: z.string().describe('Display name of the project'),
    agentName: z.string().describe('Name of the agent (e.g., "Sophie", "Magnus"). Will auto-create if not found.'),
    title: z.string().describe('Title for the session (shown on Kanban card)'),
    description: z.string().optional().describe('Full description/prompt for the session'),
    status: z.enum(['todo', 'in_progress']).optional().default('todo')
      .describe('Initial status. Usually "todo" for new sessions.'),
  },
  async (args) => {
    // Find or create agent
    let agent = findAgent(args.agentName);

    if (!agent) {
      console.error(`[KanbanV2] Agent "${args.agentName}" not found, auto-creating...`);
      agent = await autoCreateAgent(args.agentName, args.projectPath);
    }

    const sessions = loadSessions();

    // Create new session
    const newSession = {
      id: generateSessionId(),
      title: args.title,
      agentId: agent.id,
      projectPath: args.projectPath,
      projectName: args.projectName,
      status: args.status,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messageCount: 0,
      initialPrompt: args.description,
    };

    sessions.push(newSession);
    const saved = await saveSessions(sessions);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Failed to save session',
        }],
      };
    }

    // Update agent lastActiveAt
    const agents = loadAgents();
    const agentIndex = agents.findIndex(a => a.id === agent.id);
    if (agentIndex !== -1) {
      agents[agentIndex].lastActiveAt = Date.now();
      await saveAgents(agents);
    }

    emitKanbanEvent('task_created', { task: newSession, session: newSession });

    return {
      content: [{
        type: 'text',
        text: `Created session "${newSession.title}" (ID: ${newSession.id})\n` +
              `Agent: ${agent.name}\n` +
              `Project: ${args.projectName}\n` +
              `Status: ${args.status}`,
      }],
    };
  }
);

/**
 * Tool: kanban_list_agents
 * Purpose: List all agents, optionally filtered by project
 */
const kanbanListAgents = tool(
  'kanban_list_agents',
  'List all agents. If projectPath is provided, only returns agents that have sessions in that project.',
  {
    projectPath: z.string().optional()
      .describe('Filter agents by project path. Omit to see all agents.'),
  },
  async (args) => {
    let agents = loadAgents();

    // Filter by project if specified
    if (args.projectPath) {
      const agentsInProject = getAgentsForProject(args.projectPath);
      const agentIds = agentsInProject.map(a => a.id);
      agents = agents.filter(a => agentIds.includes(a.id));
    }

    // For each agent, get project count
    const agentsWithProjects = agents.map(agent => {
      const projects = getProjectsForAgent(agent.id);
      return {
        id: agent.id,
        name: agent.name,
        color: agent.color,
        avatar: agent.avatar,
        projectCount: projects.length,
        projects: projects.map(p => p.split('/').pop()), // Show project names
        lastActiveAt: agent.lastActiveAt,
      };
    });

    const summary = {
      total: agentsWithProjects.length,
      agents: agentsWithProjects,
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
 * Tool: kanban_list_sessions
 * Purpose: List sessions with flexible filtering
 */
const kanbanListSessions = tool(
  'kanban_list_sessions',
  'List sessions. Filter by agent ID, project path, or status. Use this to see current workload and context.',
  {
    agentId: z.string().optional()
      .describe('Filter by agent ID. Omit to see all agents.'),
    projectPath: z.string().optional()
      .describe('Filter by project path. Omit to see all projects.'),
    status: z.enum(['todo', 'in_progress', 'done']).optional()
      .describe('Filter by status. Omit to see all statuses.'),
    includeCompleted: z.boolean().optional().default(true)
      .describe('Whether to include completed (done) sessions.'),
  },
  async (args) => {
    let sessions = loadSessions();

    // Apply filters
    sessions = sessions.filter(session => {
      if (args.agentId && session.agentId !== args.agentId) return false;
      if (args.projectPath && session.projectPath !== args.projectPath) return false;
      if (args.status && session.status !== args.status) return false;
      if (!args.includeCompleted && session.status === 'done') return false;
      return true;
    });

    // Sort by createdAt descending (newest first)
    sessions.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    const summary = {
      total: sessions.length,
      byStatus: {
        todo: sessions.filter(s => s.status === 'todo').length,
        in_progress: sessions.filter(s => s.status === 'in_progress').length,
        done: sessions.filter(s => s.status === 'done').length,
      },
      sessions: sessions.map(s => ({
        id: s.id,
        title: s.title,
        status: s.status,
        agentId: s.agentId,
        projectName: s.projectName,
        projectPath: s.projectPath,
        messageCount: s.messageCount,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
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
 * Tool: kanban_move_session
 * Purpose: Move session between columns (TODO → In Progress → Done)
 */
const kanbanMoveSession = tool(
  'kanban_move_session',
  'Move a session to a different status column. Use this to mark work as complete or change session status.',
  {
    sessionId: z.string().describe('The ID of the session to move'),
    newStatus: z.enum(['todo', 'in_progress', 'done'])
      .describe('The new status column'),
    completionNote: z.string().optional()
      .describe('Optional note when marking as done'),
  },
  async (args) => {
    const sessions = loadSessions();
    const sessionIndex = sessions.findIndex(s => s.id === args.sessionId);

    if (sessionIndex === -1) {
      return {
        content: [{
          type: 'text',
          text: `Error: Session with ID "${args.sessionId}" not found`,
        }],
      };
    }

    const session = sessions[sessionIndex];
    const previousStatus = session.status;

    // Update session
    session.status = args.newStatus;
    session.updatedAt = Date.now();

    if (args.newStatus === 'done') {
      session.completedAt = Date.now();
    }

    sessions[sessionIndex] = session;
    const saved = await saveSessions(sessions);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Failed to save session update',
        }],
      };
    }

    emitKanbanEvent('task_moved', {
      taskId: args.sessionId,
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
 * Tool: kanban_update_session
 * Purpose: Update session metadata
 */
const kanbanUpdateSession = tool(
  'kanban_update_session',
  'Update session metadata like title or description. Use this to track progress or add context.',
  {
    sessionId: z.string().describe('The ID of the session to update'),
    title: z.string().optional().describe('New title for the session'),
    notes: z.string().optional().describe('Additional notes or context'),
  },
  async (args) => {
    const sessions = loadSessions();
    const sessionIndex = sessions.findIndex(s => s.id === args.sessionId);

    if (sessionIndex === -1) {
      return {
        content: [{
          type: 'text',
          text: `Error: Session with ID "${args.sessionId}" not found`,
        }],
      };
    }

    const session = sessions[sessionIndex];
    const updates = [];

    if (args.title !== undefined) {
      session.title = args.title;
      updates.push(`title: "${args.title}"`);
    }

    if (args.notes !== undefined) {
      session.initialPrompt = args.notes;
      updates.push('notes updated');
    }

    session.updatedAt = Date.now();

    sessions[sessionIndex] = session;
    const saved = await saveSessions(sessions);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Failed to save session update',
        }],
      };
    }

    emitKanbanEvent('task_updated', {
      taskId: args.sessionId,
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
 * Tool: kanban_delete_agent
 * Purpose: Delete an agent and handle orphaned sessions
 */
const kanbanDeleteAgent = tool(
  'kanban_delete_agent',
  'Delete an agent. Sessions can be archived (marked as done) or deleted entirely.',
  {
    agentId: z.string().describe('The ID of the agent to delete'),
    deleteMode: z.enum(['archive', 'delete']).default('archive')
      .describe('How to handle sessions: "archive" marks them as done, "delete" removes them'),
  },
  async (args) => {
    const agents = loadAgents();
    const agentIndex = agents.findIndex(a => a.id === args.agentId);

    if (agentIndex === -1) {
      return {
        content: [{
          type: 'text',
          text: `Error: Agent with ID "${args.agentId}" not found`,
        }],
      };
    }

    const agent = agents[agentIndex];
    const sessions = loadSessions();
    const agentSessions = sessions.filter(s => s.agentId === args.agentId);

    // Handle sessions based on mode
    let updatedSessions = [];
    if (args.deleteMode === 'archive') {
      // Archive: Mark all sessions as done
      updatedSessions = sessions.map(s => {
        if (s.agentId === args.agentId) {
          return {
            ...s,
            status: 'done',
            title: `[Archived] ${s.title}`,
            completedAt: Date.now(),
            updatedAt: Date.now(),
          };
        }
        return s;
      });
    } else {
      // Delete: Remove all agent's sessions
      updatedSessions = sessions.filter(s => s.agentId !== args.agentId);
    }

    // Delete agent
    agents.splice(agentIndex, 1);

    const agentsSaved = await saveAgents(agents);
    const sessionsSaved = await saveSessions(updatedSessions);

    if (!agentsSaved || !sessionsSaved) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Failed to save after deletion',
        }],
      };
    }

    emitKanbanEvent('agent_deleted', {
      agentId: args.agentId,
      agentName: agent.name,
      sessionsAffected: agentSessions.length,
      deleteMode: args.deleteMode,
    });

    return {
      content: [{
        type: 'text',
        text: `Deleted agent "${agent.name}" (ID: ${args.agentId})\n` +
              `Sessions affected: ${agentSessions.length} (${args.deleteMode}d)`,
      }],
    };
  }
);

/**
 * Tool: kanban_delete_session
 * Purpose: Delete a single session
 */
const kanbanDeleteSession = tool(
  'kanban_delete_session',
  'Delete a single session permanently. Use with caution - consider moving to "done" instead.',
  {
    sessionId: z.string().describe('The ID of the session to delete'),
    reason: z.string().optional().describe('Reason for deletion (audit trail)'),
  },
  async (args) => {
    const sessions = loadSessions();
    const sessionIndex = sessions.findIndex(s => s.id === args.sessionId);

    if (sessionIndex === -1) {
      return {
        content: [{
          type: 'text',
          text: `Error: Session with ID "${args.sessionId}" not found`,
        }],
      };
    }

    const deletedSession = sessions[sessionIndex];
    sessions.splice(sessionIndex, 1);

    const saved = await saveSessions(sessions);

    if (!saved) {
      return {
        content: [{
          type: 'text',
          text: 'Error: Failed to save after deletion',
        }],
      };
    }

    emitKanbanEvent('task_deleted', {
      taskId: args.sessionId,
      title: deletedSession.title,
      reason: args.reason,
    });

    return {
      content: [{
        type: 'text',
        text: `Deleted session "${deletedSession.title}" (ID: ${args.sessionId})` +
              (args.reason ? `\nReason: ${args.reason}` : ''),
      }],
    };
  }
);

// ============================================================
// CREATE MCP SERVER (V2)
// ============================================================

export function createKanbanToolsServer() {
  return createSdkMcpServer({
    name: 'kanban-tools-v2',
    version: '2.0.0',
    tools: [
      kanbanCreateAgent,
      kanbanCreateSession,
      kanbanListAgents,
      kanbanListSessions,
      kanbanMoveSession,
      kanbanUpdateSession,
      kanbanDeleteAgent,
      kanbanDeleteSession,
    ],
  });
}

// Export individual tools for testing
export {
  kanbanCreateAgent,
  kanbanCreateSession,
  kanbanListAgents,
  kanbanListSessions,
  kanbanMoveSession,
  kanbanUpdateSession,
  kanbanDeleteAgent,
  kanbanDeleteSession,
};
