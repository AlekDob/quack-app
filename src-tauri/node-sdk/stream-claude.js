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
  outputFormat, // Structured outputs configuration
} = config;

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
    const options = {
      model,
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

    // Add structured outputs if provided
    if (outputFormat) {
      options.outputFormat = outputFormat;
      console.error(`[DEBUG] Using structured outputs with schema:`, JSON.stringify(outputFormat, null, 2));
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
