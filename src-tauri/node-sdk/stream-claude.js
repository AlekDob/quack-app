#!/usr/bin/env node

/**
 * Node.js script that uses Claude Agent SDK for real-time streaming
 * Called by Rust backend via subprocess
 *
 * Events are emitted via stdout as JSON lines
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

// Parse command line arguments
const args = process.argv.slice(2);
const config = JSON.parse(args[0] || '{}');

const {
  prompt,
  model = 'sonnet',
  permissionMode = 'default',
  thinkingMode,
  cwd,
  sessionId,
  agents,
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

async function main() {
  try {
    // Build SDK options
    const options = {
      model,
      permissionMode,
      // Enable automatic reading of CLAUDE.md and project settings
      settingSources: ['project', 'user', 'local'],
    };

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

    // Query Claude with streaming
    const stream = query({
      prompt,
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
