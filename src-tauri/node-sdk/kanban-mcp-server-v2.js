#!/usr/bin/env node

/**
 * Kanban MCP Server V2 (stdio-based) - Multi-Project Agent Architecture
 *
 * This is a standalone MCP server that provides Kanban task management tools.
 * It runs as a separate process and communicates via stdin/stdout.
 *
 * V2 Changes:
 * - Multi-project agents (agents can work on multiple projects)
 * - Auto-create agents when creating sessions
 * - Enhanced security (cryptographic IDs, file locking, path validation)
 *
 * Tools provided:
 * - kanban_create_agent: Create a new multi-project agent
 * - kanban_create_session: Create a session (auto-creates agent if needed)
 * - kanban_list_agents: List agents, optionally filtered by project
 * - kanban_list_sessions: List sessions with flexible filtering
 * - kanban_move_session: Move session between status columns
 * - kanban_update_session: Update session metadata
 * - kanban_delete_agent: Delete agent with session handling
 * - kanban_delete_session: Delete a single session
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  kanbanCreateAgent,
  kanbanCreateSession,
  kanbanListAgents,
  kanbanListSessions,
  kanbanMoveSession,
  kanbanUpdateSession,
  kanbanDeleteAgent,
  kanbanDeleteSession,
} from './kanban-tools-v2.js';

// =============================================================================
// MCP SERVER INITIALIZATION
// =============================================================================

const server = new Server(
  {
    name: 'kanban-tools-v2',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

const TOOLS = [
  {
    name: 'kanban_create_agent',
    description: 'Create a new agent that can work on multiple projects. Agent is not bound to any specific project - projects are assigned via sessions.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the agent (e.g., "Sophie", "Magnus")',
        },
        avatar: {
          type: 'string',
          description: 'Avatar filename (e.g., "duck1.jpeg")',
        },
        personality: {
          type: 'object',
          properties: {
            role: { type: 'string' },
            communicationStyle: { type: 'string' },
            notes: { type: 'string' },
          },
          description: 'Agent personality configuration',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'kanban_create_session',
    description: 'Create a new session for an agent on a specific project. If the agent does not exist, it will be created automatically with default settings.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Absolute path to the project directory',
        },
        projectName: {
          type: 'string',
          description: 'Display name of the project',
        },
        agentName: {
          type: 'string',
          description: 'Name of the agent (e.g., "Sophie", "Magnus"). Will auto-create if not found.',
        },
        title: {
          type: 'string',
          description: 'Title for the session (shown on Kanban card)',
        },
        description: {
          type: 'string',
          description: 'Full description/prompt for the session',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress'],
          default: 'todo',
          description: 'Initial status. Usually "todo" for new sessions.',
        },
      },
      required: ['projectPath', 'projectName', 'agentName', 'title'],
    },
  },
  {
    name: 'kanban_list_agents',
    description: 'List all agents. If projectPath is provided, only returns agents that have sessions in that project.',
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
    name: 'kanban_list_sessions',
    description: 'List sessions. Filter by agent ID, project path, or status. Use this to see current workload and context.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'Filter by agent ID. Omit to see all agents.',
        },
        projectPath: {
          type: 'string',
          description: 'Filter by project path. Omit to see all projects.',
        },
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'Filter by status. Omit to see all statuses.',
        },
        includeCompleted: {
          type: 'boolean',
          default: true,
          description: 'Whether to include completed (done) sessions.',
        },
      },
    },
  },
  {
    name: 'kanban_move_session',
    description: 'Move a session to a different status column. Use this to mark work as complete or change session status.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The ID of the session to move',
        },
        newStatus: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done'],
          description: 'The new status column',
        },
        completionNote: {
          type: 'string',
          description: 'Optional note when marking as done',
        },
      },
      required: ['sessionId', 'newStatus'],
    },
  },
  {
    name: 'kanban_update_session',
    description: 'Update session metadata like title or description. Use this to track progress or add context.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The ID of the session to update',
        },
        title: {
          type: 'string',
          description: 'New title for the session',
        },
        notes: {
          type: 'string',
          description: 'Additional notes or context',
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'kanban_delete_agent',
    description: 'Delete an agent. Sessions can be archived (marked as done) or deleted entirely.',
    inputSchema: {
      type: 'object',
      properties: {
        agentId: {
          type: 'string',
          description: 'The ID of the agent to delete',
        },
        deleteMode: {
          type: 'string',
          enum: ['archive', 'delete'],
          default: 'archive',
          description: 'How to handle sessions: "archive" marks them as done, "delete" removes them',
        },
      },
      required: ['agentId'],
    },
  },
  {
    name: 'kanban_delete_session',
    description: 'Delete a single session permanently. Use with caution - consider moving to "done" instead.',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'The ID of the session to delete',
        },
        reason: {
          type: 'string',
          description: 'Reason for deletion (audit trail)',
        },
      },
      required: ['sessionId'],
    },
  },
];

// =============================================================================
// MCP REQUEST HANDLERS
// =============================================================================

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  console.error(`[KanbanMCP-V2] Tool call: ${name}`);
  console.error(`[KanbanMCP-V2] Args: ${JSON.stringify(args, null, 2)}`);

  try {
    let result;

    switch (name) {
      case 'kanban_create_agent':
        result = await kanbanCreateAgent.handler(args);
        break;
      case 'kanban_create_session':
        result = await kanbanCreateSession.handler(args);
        break;
      case 'kanban_list_agents':
        result = await kanbanListAgents.handler(args);
        break;
      case 'kanban_list_sessions':
        result = await kanbanListSessions.handler(args);
        break;
      case 'kanban_move_session':
        result = await kanbanMoveSession.handler(args);
        break;
      case 'kanban_update_session':
        result = await kanbanUpdateSession.handler(args);
        break;
      case 'kanban_delete_agent':
        result = await kanbanDeleteAgent.handler(args);
        break;
      case 'kanban_delete_session':
        result = await kanbanDeleteSession.handler(args);
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return result;
  } catch (error) {
    console.error(`[KanbanMCP-V2] Error executing ${name}:`, error);
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
});

// =============================================================================
// START SERVER
// =============================================================================

async function main() {
  console.error('[KanbanMCP-V2] Starting Kanban MCP Server V2 (Multi-Project Agent Architecture)');

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error('[KanbanMCP-V2] Server started and ready to receive requests');
}

main().catch((error) => {
  console.error('[KanbanMCP-V2] Fatal error:', error);
  process.exit(1);
});
