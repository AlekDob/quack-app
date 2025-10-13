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
    };

    if (thinkingMode) {
      options.thinkingMode = thinkingMode;
    }

    if (cwd) {
      options.cwd = cwd;
    }

    if (sessionId) {
      options.resume = sessionId;
    }

    if (agents && Array.isArray(agents) && agents.length > 0) {
      // Transform agents to SDK format
      options.agents = agents.map(agent => ({
        name: agent.name,
        description: agent.description,
        model: agent.model,
        path: agent.filePath,
      }));
    }

    // Query Claude with streaming
    const stream = query({
      prompt,
      options,
    });

    // Stream events
    for await (const event of stream) {
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
