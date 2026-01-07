#!/usr/bin/env node

/**
 * Node.js script that uses Claude Agent SDK for real-time streaming
 * Called by Rust backend via subprocess
 *
 * Events are emitted via stdout as JSON lines
 * Responses (e.g., AskUserQuestion answers) are received via stdin as JSON lines
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, existsSync } from 'fs';
import { extname, join, dirname } from 'path';
import { homedir } from 'os';
import { createInterface } from 'readline';
import { fileURLToPath } from 'url';

// Get the directory of this script for kanban-mcp-server.js path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// =============================================================================
// BIDIRECTIONAL COMMUNICATION SYSTEM
// =============================================================================

/**
 * Pending requests waiting for responses from frontend
 * Key: requestId, Value: { resolve, reject, timeout }
 */
const pendingRequests = new Map();

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Set up stdin listener for receiving responses from frontend
 * Messages are JSON lines with format: { requestId: string, ...data }
 */
const stdinReader = createInterface({
  input: process.stdin,
  terminal: false,
});

stdinReader.on('line', (line) => {
  try {
    const message = JSON.parse(line);
    console.error(`[STDIN] Received message:`, JSON.stringify(message, null, 2));

    if (message.requestId && pendingRequests.has(message.requestId)) {
      const { resolve, timeout } = pendingRequests.get(message.requestId);
      clearTimeout(timeout);
      pendingRequests.delete(message.requestId);
      resolve(message);
    } else {
      console.error(`[STDIN] Unknown requestId or no pending request:`, message.requestId);
    }
  } catch (error) {
    console.error(`[STDIN] Failed to parse message:`, error.message, line);
  }
});

stdinReader.on('close', () => {
  console.error(`[STDIN] Stream closed`);
});

/**
 * Send a request to frontend and wait for response
 * @param {string} type - Request type (e.g., 'ask_user_question')
 * @param {object} data - Request data
 * @param {number} timeoutMs - Timeout in milliseconds (0 = no timeout)
 * @returns {Promise<object>} Response from frontend
 */
async function requestFromFrontend(type, data, timeoutMs = 0) {
  const requestId = generateRequestId();

  return new Promise((resolve, reject) => {
    let timeout = null;

    if (timeoutMs > 0) {
      timeout = setTimeout(() => {
        pendingRequests.delete(requestId);
        reject(new Error(`Request ${requestId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    }

    pendingRequests.set(requestId, { resolve, reject, timeout });

    // Emit request to frontend via stdout
    const request = {
      type,
      requestId,
      ...data,
    };

    console.log(JSON.stringify(request));
    console.error(`[STDIN] Sent request ${requestId} of type ${type}`);
  });
}

/**
 * Map friendly model names to official API model IDs
 * Must match mapping in src/services/claudeSDK.ts (frontend)
 */
function getModelId(model) {
  const modelMap = {
    'haiku': 'claude-haiku-4-5',                 // Haiku 4.5 (latest)
    'sonnet': 'claude-sonnet-4-5-20250929',      // Sonnet 4.5 (latest)
    'opus': 'claude-opus-4-5-20251101',          // Opus 4.5 (latest)
  };

  return modelMap[model] || model; // Return as-is if not in map (allows full model IDs)
}

// Parse command line arguments
const args = process.argv.slice(2);
const config = JSON.parse(args[0] || '{}');

const {
  prompt,
  model = 'sonnet',
  permissionMode, // No default - let SDK use its default (auto-approve) when undefined
  thinkingMode,
  cwd,
  sessionId,
  agents,
  attachments, // Array of file paths for images/attachments
  outputFormat, // Structured outputs configuration (beta)
  effort, // Effort parameter: 'low' | 'medium' | 'high' (SDK 0.1.54+)
  mcpServers, // MCP servers configuration (passed from Rust backend or loaded from .mcp.json)
  allowedTools, // Tools allowed for this session (passed from frontend via Rust backend)
} = config;

// DEBUG: Log what we received from Rust
console.error(`[DEBUG] Raw config received:`, JSON.stringify(config, null, 2).substring(0, 500));
console.error(`[DEBUG] allowedTools from config:`, allowedTools);

/**
 * Load global MCP servers from ~/.quack/mcp/.mcp.json
 * These are Quack's built-in servers available in ALL projects
 * Returns: { [serverName]: { command, args, env } } or {}
 */
function loadGlobalMCPServers() {
  const globalMcpPath = join(homedir(), '.quack', 'mcp', '.mcp.json');

  console.error(`[MCP] Looking for global MCP servers at: ${globalMcpPath}`);

  if (!existsSync(globalMcpPath)) {
    console.error(`[MCP] No global .mcp.json found`);
    return {};
  }

  try {
    const globalConfig = JSON.parse(readFileSync(globalMcpPath, 'utf8'));

    if (!globalConfig.mcpServers || typeof globalConfig.mcpServers !== 'object') {
      return {};
    }

    const servers = {};

    for (const [name, config] of Object.entries(globalConfig.mcpServers)) {
      if (config.type === 'sse' || config.type === 'http') {
        servers[name] = {
          type: config.type,
          url: config.url,
          headers: config.headers,
        };
        console.error(`  - ${name} (${config.type}, global): ${config.url}`);
      } else {
        servers[name] = {
          command: config.command,
          args: config.args || [],
          env: config.env,
        };
        console.error(`  - ${name} (stdio, global): ${config.command} ${(config.args || []).join(' ')}`);
      }
    }

    console.error(`[MCP] Loaded ${Object.keys(servers).length} global MCP servers`);
    return servers;
  } catch (error) {
    console.error(`[MCP] Error reading global .mcp.json: ${error.message}`);
    return {};
  }
}

/**
 * Load MCP servers from .mcp.json file in the working directory
 * Also loads global servers from ~/.quack/mcp/.mcp.json
 * Project-local servers override global servers with same name
 * Returns: { [serverName]: { command, args, env } } or undefined
 */
function loadMCPServersFromFile(workingDir) {
  // First load global servers (available in all projects)
  const globalServers = loadGlobalMCPServers();

  const mcpJsonPath = join(workingDir || process.cwd(), '.mcp.json');

  console.error(`[MCP] Looking for project .mcp.json at: ${mcpJsonPath}`);

  if (!existsSync(mcpJsonPath)) {
    console.error(`[MCP] Project .mcp.json not found at ${mcpJsonPath}`);
    // Return global servers if any
    return Object.keys(globalServers).length > 0 ? globalServers : undefined;
  }

  try {
    const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf8'));

    if (!mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== 'object') {
      console.error(`[MCP] Project .mcp.json found but no mcpServers configured`);
      return Object.keys(globalServers).length > 0 ? globalServers : undefined;
    }

    // Start with global servers
    const servers = { ...globalServers };
    const serverNames = Object.keys(mcpConfig.mcpServers);

    console.error(`[MCP] Found ${serverNames.length} MCP servers in project .mcp.json:`);

    for (const [name, config] of Object.entries(mcpConfig.mcpServers)) {
      // Handle different transport types
      if (config.type === 'sse' || config.type === 'http') {
        // SSE/HTTP transport
        servers[name] = {
          type: config.type,
          url: config.url,
          headers: config.headers,
        };
        console.error(`  - ${name} (${config.type}): ${config.url}`);
      } else {
        // stdio transport (default)
        servers[name] = {
          command: config.command,
          args: config.args || [],
          env: config.env,
        };
        console.error(`  - ${name} (stdio): ${config.command} ${(config.args || []).join(' ')}`);
      }
    }

    return Object.keys(servers).length > 0 ? servers : undefined;
  } catch (error) {
    console.error(`[MCP] Error reading project .mcp.json: ${error.message}`);
    return Object.keys(globalServers).length > 0 ? globalServers : undefined;
  }
}

// Emit event via stdout
function emitEvent(event) {
  console.log(JSON.stringify(event));
}

// Emit error via stderr
function emitError(error) {
  console.error(JSON.stringify({
    type: 'error',
    error: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined,
  }));
}

// Convert file path to base64 image content block
function fileToImageBlock(filePath) {
  try {
    const ext = extname(filePath).toLowerCase();
    const mimeTypes = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };

    const mediaType = mimeTypes[ext];
    if (!mediaType) {
      console.error(`[WARNING] Unsupported image type: ${ext} for file ${filePath}`);
      return null;
    }

    const data = readFileSync(filePath, 'base64');
    return {
      type: 'image',
      source: {
        type: 'base64',
        media_type: mediaType,
        data,
      },
    };
  } catch (error) {
    console.error(`[ERROR] Failed to read image file ${filePath}:`, error.message);
    return null;
  }
}

// Create message content with text and optional images
function createMessageContent(text, imagePaths = []) {
  const content = [{ type: 'text', text }];

  if (imagePaths && imagePaths.length > 0) {
    for (const path of imagePaths) {
      const imageBlock = fileToImageBlock(path);
      if (imageBlock) {
        content.push(imageBlock);
      }
    }
  }

  return content;
}

// Streaming input generator for messages
// IMPORTANT: SDK MCP servers REQUIRE streaming input mode (async generator)
// See: https://platform.claude.com/docs/en/agent-sdk/custom-tools
async function* generateMessages() {
  // Build message content with text and optional images
  const content = createMessageContent(prompt, attachments);

  yield {
    type: 'user',
    message: {
      role: 'user',
      content,
    },
  };
}

/**
 * Verify authentication is available before initializing SDK
 * Returns: { hasAuth: boolean, authMethod: string, error?: string }
 */
function checkAuthentication() {
  // Priority 1: Check for ANTHROPIC_API_KEY
  if (process.env.ANTHROPIC_API_KEY) {
    const keyPreview = process.env.ANTHROPIC_API_KEY.substring(0, 8) + '...';
    console.error(`[Auth] ANTHROPIC_API_KEY found: ${keyPreview}`);
    return { hasAuth: true, authMethod: 'ANTHROPIC_API_KEY' };
  }

  // Priority 2: Check for Claude Code credentials in multiple locations
  // Claude Code can store credentials in several places
  const credentialPaths = [
    join(homedir(), '.claude.json'),                          // New OAuth format
    join(homedir(), '.claude', '.credentials.json'),          // Standard format
    join(homedir(), '.config', 'claude-code', 'auth.json'),  // Alternative location
  ];

  for (const credsPath of credentialPaths) {
    try {
      if (!existsSync(credsPath)) continue;

      const creds = JSON.parse(readFileSync(credsPath, 'utf8'));

      // Check for OAuth account (new format)
      if (creds.oauthAccount && typeof creds.oauthAccount === 'object') {
        console.error(`[Auth] Claude Code OAuth found at ${credsPath}`);
        return { hasAuth: true, authMethod: 'Claude Code OAuth' };
      }

      // Check for standard credentials
      if (creds.session_key || creds.access_token || creds.api_key) {
        console.error(`[Auth] Claude Code credentials found at ${credsPath}`);
        return { hasAuth: true, authMethod: 'Claude Code credentials' };
      }
    } catch (err) {
      console.error(`[Auth] Could not check ${credsPath}:`, err.message);
    }
  }

  // Priority 3: Check for Bedrock/Vertex environment variables
  if (process.env.CLAUDE_CODE_USE_BEDROCK === '1') {
    console.error('[Auth] Amazon Bedrock authentication enabled');
    return { hasAuth: true, authMethod: 'Amazon Bedrock' };
  }

  if (process.env.CLAUDE_CODE_USE_VERTEX === '1') {
    console.error('[Auth] Google Vertex AI authentication enabled');
    return { hasAuth: true, authMethod: 'Google Vertex AI' };
  }

  // No authentication found
  console.error('[Auth] No authentication found');
  return {
    hasAuth: false,
    authMethod: 'none',
    error: 'No authentication method available. Please either:\n' +
           '  1. Set ANTHROPIC_API_KEY environment variable\n' +
           '  2. Run: claude login (to authenticate with Claude Code)\n' +
           '  3. Configure Amazon Bedrock or Google Vertex AI'
  };
}

async function main() {
  try {
    // Check authentication and log warnings, but don't block
    const authCheck = checkAuthentication();

    if (!authCheck.hasAuth) {
      // Log warning but let SDK try anyway (SDK has its own auth resolution)
      console.error('[Auth] WARNING: No explicit authentication found');
      console.error('[Auth] SDK will attempt to use default authentication methods');
      console.error('[Auth] If this fails, please either:');
      console.error('[Auth]   1. Set ANTHROPIC_API_KEY environment variable');
      console.error('[Auth]   2. Run: claude login (to authenticate with Claude Code)');
      console.error('[Auth]   3. Configure Amazon Bedrock or Google Vertex AI');
    } else {
      console.error(`[Auth] Using authentication method: ${authCheck.authMethod}`);
    }

    // Build SDK options
    const modelId = getModelId(model);
    console.error(`[DEBUG] Model mapping: "${model}" → "${modelId}"`);

    // Default tools if not provided by frontend
    const defaultAllowedTools = [
      'Skill',        // Required to enable Skills from .claude/skills/
      'Task',         // Subagents
      'Read',
      'Write',
      'Edit',
      'Bash',
      'Glob',
      'Grep',
      'WebFetch',
      'WebSearch',
      'TodoWrite',
      'NotebookEdit',
      'SlashCommand',
      'BashOutput',
      'KillShell',
      'ExitPlanMode',
      'AskUserQuestion', // Interactive questions to user (SDK v0.1.71+)
      // Kanban Tools - Custom MCP tools for task management
      'mcp__kanban-tools__kanban_list_tasks',
      'mcp__kanban-tools__kanban_move_task',
      'mcp__kanban-tools__kanban_create_task',
      'mcp__kanban-tools__kanban_update_task',
      'mcp__kanban-tools__kanban_delete_task',
      'mcp__kanban-tools__kanban_get_workload',
    ];

    // Use allowedTools from config if provided, otherwise use defaults
    const resolvedAllowedTools = allowedTools && Array.isArray(allowedTools) && allowedTools.length > 0
      ? allowedTools
      : defaultAllowedTools;

    console.error(`[DEBUG] Using ${resolvedAllowedTools.length} allowed tools:`, resolvedAllowedTools.slice(0, 5).join(', ') + '...');

    const options = {
      model: modelId,
      // Enable automatic reading of CLAUDE.md and project settings
      settingSources: ['project', 'user', 'local'],

      // =============================================================================
      // TOOLS CONFIGURATION (SDK v0.1.76)
      //
      // Using the claude_code preset for ALL default tools (55+)
      // AskUserQuestion is handled via canUseTool callback when Claude invokes it.
      //
      // From SDK docs:
      // - `tools`: { type: 'preset', preset: 'claude_code' } for default tools
      // - `allowedTools`: filters which tools Claude can actually use
      // - `canUseTool`: permission callback fires when tools need approval
      // =============================================================================

      // Use preset to get all Claude Code tools
      tools: {
        type: 'preset',
        preset: 'claude_code'
      },

      // allowedTools filters from the preset - includes AskUserQuestion
      allowedTools: resolvedAllowedTools,

      // 🗣️ Inject AskUserQuestion instructions into ALL projects via system prompt append
      systemPrompt: {
        type: 'preset',
        preset: 'claude_code',
        append: `

## Interactive Questions (AskUserQuestion Tool)

You have access to the AskUserQuestion tool. USE IT when you need user input to make a decision instead of asking in plain text.

**ALWAYS use AskUserQuestion when:**
- User must choose between 2-4 implementation approaches
- Selecting technologies, libraries, or patterns
- Confirming potentially destructive actions
- Getting preferences for ambiguous requirements
- The user asks you to help them choose something

**Do NOT use it for:**
- Open-ended questions needing detailed text responses
- Questions with more than 4 options
- Simple confirmations inferrable from context

**Example:** If user asks "help me choose a database", you MUST use AskUserQuestion with options like:
- PostgreSQL (relational, ACID compliant)
- MongoDB (document-based, flexible schema)
- SQLite (lightweight, embedded)

IMPORTANT: Do NOT list options in plain text. Use the AskUserQuestion tool to present interactive choices.
`
      },

      // =============================================================================
      // PERMISSION CALLBACK - Handles AskUserQuestion and other permission requests
      // NOTE: AskUserQuestion does NOT appear in "Available Tools" list - it's handled
      // internally by the SDK and only triggers when Claude decides to ask the user
      // =============================================================================
      canUseTool: async (toolName, input, options) => {
        console.error(`[canUseTool] 🔧 PERMISSION REQUEST for tool: ${toolName}`);
        console.error(`[canUseTool] Input:`, JSON.stringify(input, null, 2).substring(0, 500));

        // Handle AskUserQuestion tool - requires user interaction
        if (toolName === 'AskUserQuestion') {
          console.error(`[canUseTool] AskUserQuestion detected, forwarding to frontend`);
          console.error(`[canUseTool] Questions:`, JSON.stringify(input.questions, null, 2));

          try {
            // Send request to frontend and wait for user's answers (no timeout)
            // The frontend will receive this event and show the widget
            // The requestId is used to match the response when user answers
            const response = await requestFromFrontend('ask_user_question', {
              questions: input.questions,
              // Include any tool context if available from SDK
              toolContext: options?.signal ? 'with_signal' : 'no_signal',
            }, 0); // 0 = no timeout, wait indefinitely

            console.error(`[canUseTool] Received answers from frontend:`, JSON.stringify(response.answers, null, 2));

            // Return the answers to the SDK
            // The answers format should match what SDK expects:
            // { "Question text": "Selected option label" }
            return {
              behavior: 'allow',
              updatedInput: {
                questions: input.questions,
                answers: response.answers,
              },
            };
          } catch (error) {
            console.error(`[canUseTool] Error getting answers:`, error.message);
            // Deny if we couldn't get answers
            return {
              behavior: 'deny',
              message: `Failed to get user answers: ${error.message}`,
            };
          }
        }

        // Default: allow all other tools
        return {
          behavior: 'allow',
          updatedInput: input,
        };
      },
    };

    // Only add permissionMode if explicitly provided (not undefined)
    // When undefined, SDK uses default behavior (auto-approve)
    if (permissionMode !== undefined) {
      options.permissionMode = permissionMode;
      console.error(`[DEBUG] Using permissionMode: ${permissionMode}`);
    } else {
      console.error(`[DEBUG] permissionMode not set - SDK will use default (auto-approve)`);
    }

    if (thinkingMode) {
      options.thinkingMode = thinkingMode;
    }

    if (cwd) {
      options.cwd = cwd;
      console.error(`[DEBUG] Working directory: ${cwd}`);
    } else {
      console.error(`[DEBUG] No working directory specified, using default`);
    }

    if (sessionId) {
      options.resume = sessionId;
      console.error(`[DEBUG] Resuming session: ${sessionId}`);
    } else {
      console.error(`[DEBUG] Starting new session`);
    }

    console.error(`[DEBUG] Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
    console.error(`[DEBUG] Attachments:`, attachments ? attachments.length : 0);

    if (agents && Array.isArray(agents) && agents.length > 0) {
      // Transform agents to SDK format
      options.agents = agents.map(agent => ({
        name: agent.name,
        description: agent.description,
        model: agent.model,
        path: agent.filePath,
      }));
      console.error(`[DEBUG] Using ${agents.length} agent(s)`);
    }

    // Add structured outputs if provided (beta feature)
    if (outputFormat) {
      options.outputFormat = outputFormat;
      console.error(`[DEBUG] Using structured outputs with schema:`, JSON.stringify(outputFormat, null, 2));
    }

    // Add effort parameter if provided (SDK 0.1.54+)
    // Controls quality vs speed/cost tradeoff: 'low', 'medium', 'high'
    if (effort) {
      options.effort = effort;
      console.error(`[DEBUG] Using effort level: ${effort}`);
    }

    // Load MCP servers: priority is passed config > .mcp.json file
    let resolvedMcpServers = mcpServers;
    if (!resolvedMcpServers && cwd) {
      console.error(`[MCP] No mcpServers in config, loading from .mcp.json...`);
      resolvedMcpServers = loadMCPServersFromFile(cwd);
    }

    // Always add Kanban Tools, IDE Tools, and Semantic Search MCP servers (stdio-based for reliability)
    // Note: SDK MCP servers (createSdkMcpServer) have a known bug with "Stream closed" errors
    // See: https://github.com/anthropics/claude-code/issues/6710
    // Using stdio transport instead for stability
    const kanbanMcpServerPath = join(__dirname, 'kanban-mcp-server.js');
    const ideMcpServerPath = join(__dirname, 'ide-mcp-server.js');
    const semanticSearchMcpServerPath = join(__dirname, 'semantic-search-mcp-server.js');
    console.error(`[MCP] Kanban MCP server path: ${kanbanMcpServerPath}`);
    console.error(`[MCP] IDE MCP server path: ${ideMcpServerPath}`);
    console.error(`[MCP] Semantic Search MCP server path: ${semanticSearchMcpServerPath}`);

    // Merge MCP servers: file-based servers + built-in Quack servers (kanban, ide, semantic-search)
    options.mcpServers = {
      ...(resolvedMcpServers || {}),
      'kanban-tools': {
        command: 'node',
        args: [kanbanMcpServerPath],
      },
      'ide-tools': {
        command: 'node',
        args: [ideMcpServerPath],
      },
      'semantic-search': {
        command: 'node',
        args: [semanticSearchMcpServerPath],
      },
    };

    const builtInServerCount = 3; // kanban-tools + ide-tools + semantic-search
    if (resolvedMcpServers && Object.keys(resolvedMcpServers).length > 0) {
      console.error(`[MCP] Loaded ${Object.keys(resolvedMcpServers).length + builtInServerCount} MCP servers:`, Object.keys(options.mcpServers).join(', '));
    } else {
      console.error(`[MCP] Using built-in MCP servers only (kanban-tools, ide-tools, semantic-search)`);
    }

    console.error(`[DEBUG] Final Options:`, JSON.stringify(options, null, 2));

    // Query Claude with streaming input mode
    // IMPORTANT: SDK MCP servers REQUIRE streaming input mode (async generator)
    // We ALWAYS use the generator when MCP servers are configured
    // See: https://platform.claude.com/docs/en/agent-sdk/custom-tools
    const hasMcpServers = options.mcpServers && Object.keys(options.mcpServers).length > 0;
    const useStreamingInput = hasMcpServers || (attachments && attachments.length > 0);

    console.error(`[DEBUG] Using streaming input mode: ${useStreamingInput} (MCP servers: ${hasMcpServers}, attachments: ${attachments?.length || 0})`);

    const stream = query({
      prompt: useStreamingInput ? generateMessages() : prompt,
      options,
    });

    // Stream events
    for await (const event of stream) {
      // Log slash command info from system events
      if (event.type === 'system' && event.subtype === 'init') {
        console.error(`[DEBUG] System initialized - Session: ${event.session_id}`);
        if (event.slash_commands) {
          console.error(`[DEBUG] Available slash commands:`, event.slash_commands);
        }
        // Log MCP server connection status
        if (event.mcp_servers) {
          console.error(`[MCP] Server status:`, JSON.stringify(event.mcp_servers, null, 2));
          const failedServers = event.mcp_servers.filter(s => s.status !== 'connected');
          if (failedServers.length > 0) {
            console.error(`[MCP] ⚠️ Failed to connect to servers:`, failedServers);
          }
        }
      }

      // Log agent/subagent events for debugging
      if (event.type === 'agent') {
        console.error(`[DEBUG] 🤖 Subagent event:`, JSON.stringify(event, null, 2));
      }

      // Log Task tool invocations (subagent delegation)
      if (event.type === 'assistant' && event.message?.content) {
        const taskTools = event.message.content.filter(
          (block) => block.type === 'tool_use' && block.name?.toLowerCase() === 'task'
        );
        if (taskTools.length > 0) {
          console.error(`[DEBUG] 🎯 Task tool invocation detected:`, JSON.stringify(taskTools, null, 2));
        }
      }

      emitEvent(event);
    }

    // Success - emit final complete event
    emitEvent({
      type: 'complete',
    });

    // 🦆 IMPORTANT: Exit process cleanly to avoid hanging
    // MCP servers may keep event loop open, so we need explicit exit
    process.exit(0);
  } catch (error) {
    emitError(error);
    process.exit(1);
  }
}

main();
