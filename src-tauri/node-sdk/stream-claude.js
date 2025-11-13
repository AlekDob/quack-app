#!/usr/bin/env node

/**
 * Node.js script that uses Claude Agent SDK for real-time streaming
 * Called by Rust backend via subprocess
 *
 * Events are emitted via stdout as JSON lines
 */

import { query } from '@anthropic-ai/claude-agent-sdk';
import { readFileSync } from 'fs';
import { extname } from 'path';

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

async function main() {
  try {
    // Check if ANTHROPIC_API_KEY is present (log warning if missing, but let SDK handle it)
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('[WARN] ⚠️ ANTHROPIC_API_KEY not found in environment');
      console.error('[WARN] The SDK will attempt to use default credentials');
      console.error('[WARN] If authentication fails, please run: claude login');
      // Don't exit - let the SDK try and provide its own error message
    } else {
      console.error('[DEBUG] ✅ ANTHROPIC_API_KEY found in environment');
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
    console.error(`[DEBUG] Options:`, JSON.stringify(options, null, 2));

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
