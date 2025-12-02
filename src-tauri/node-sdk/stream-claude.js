#!/usr/bin/env node

/**
 * Node.js script that uses Claude Agent SDK for real-time streaming
 * Called by Rust backend via subprocess
 *
 * Events are emitted via stdout as JSON lines
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync, existsSync } from 'fs';
import { extname, join } from 'path';
import { homedir } from 'os';

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
} = config;

/**
 * Load MCP servers from .mcp.json file in the working directory
 * Returns: { [serverName]: { command, args, env } } or undefined
 */
function loadMCPServersFromFile(workingDir) {
  const mcpJsonPath = join(workingDir || process.cwd(), '.mcp.json');

  console.error(`[MCP] Looking for .mcp.json at: ${mcpJsonPath}`);

  if (!existsSync(mcpJsonPath)) {
    console.error(`[MCP] .mcp.json not found at ${mcpJsonPath}`);
    return undefined;
  }

  try {
    const mcpConfig = JSON.parse(readFileSync(mcpJsonPath, 'utf8'));

    if (!mcpConfig.mcpServers || typeof mcpConfig.mcpServers !== 'object') {
      console.error(`[MCP] .mcp.json found but no mcpServers configured`);
      return undefined;
    }

    const servers = {};
    const serverNames = Object.keys(mcpConfig.mcpServers);

    console.error(`[MCP] Found ${serverNames.length} MCP servers in .mcp.json:`);

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
    console.error(`[MCP] Error reading .mcp.json: ${error.message}`);
    return undefined;
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

// Streaming input generator for messages with images
async function* generateMessages() {
  // Build message content with text and images
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

    const options = {
      model: modelId,
      // Enable automatic reading of CLAUDE.md and project settings
      settingSources: ['project', 'user', 'local'],
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

    if (resolvedMcpServers && Object.keys(resolvedMcpServers).length > 0) {
      options.mcpServers = resolvedMcpServers;
      console.error(`[MCP] Loaded ${Object.keys(resolvedMcpServers).length} MCP servers:`, Object.keys(resolvedMcpServers).join(', '));
    } else {
      console.error(`[MCP] No MCP servers configured - using SDK defaults only`);
    }

    console.error(`[DEBUG] Final Options:`, JSON.stringify(options, null, 2));

    // Query Claude with streaming input mode (supports images)
    // Use AsyncGenerator if we have attachments, otherwise use simple prompt
    const stream = query({
      prompt: attachments && attachments.length > 0 ? generateMessages() : prompt,
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
  } catch (error) {
    emitError(error);
    process.exit(1);
  }
}

main();
