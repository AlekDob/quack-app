#!/usr/bin/env node

/**
 * Rewind Files Script - Uses Claude Agent SDK to restore files to a previous state
 *
 * This script is called by Rust backend to perform file rewind operations.
 * It requires file checkpointing to be enabled in the original session.
 *
 * Usage: node rewind-files.js '{"sessionId": "...", "userMessageId": "..."}'
 *
 * Events are emitted via stdout as JSON lines
 */

import { query } from '@anthropic-ai/claude-agent-sdk';

// Output helpers
function emitEvent(event) {
  process.stdout.write(JSON.stringify(event) + '\n');
}

function emitError(error) {
  emitEvent({
    type: 'error',
    error: error.message || String(error),
  });
}

async function main() {
  try {
    // Parse config from command line argument
    const configArg = process.argv[2];
    if (!configArg) {
      throw new Error('Missing config argument. Usage: node rewind-files.js \'{"sessionId": "...", "userMessageId": "..."}\'');
    }

    const config = JSON.parse(configArg);
    const { sessionId, userMessageId, dryRun = false } = config;

    if (!sessionId) {
      throw new Error('sessionId is required');
    }
    if (!userMessageId) {
      throw new Error('userMessageId is required');
    }

    console.error(`[REWIND] Starting rewind operation`);
    console.error(`[REWIND] Session: ${sessionId}`);
    console.error(`[REWIND] Target message UUID: ${userMessageId}`);
    console.error(`[REWIND] Dry run: ${dryRun}`);

    // Emit start event
    emitEvent({
      type: 'rewind_started',
      sessionId,
      userMessageId,
      dryRun,
    });

    // Create a query with resume to get access to the session
    // We use a minimal prompt that won't execute - we just need the query object
    const stream = query({
      prompt: '', // Empty prompt - we just need the query object
      options: {
        resume: sessionId,
        enableFileCheckpointing: true,
        // Don't actually send anything - we just want the query methods
        persistSession: false, // Don't modify the session
      },
    });

    // Get the query control object from the stream
    // The stream itself has the rewindFiles method
    console.error(`[REWIND] Calling rewindFiles...`);

    // Note: The SDK's rewindFiles is called on the stream/query object
    // We need to consume at least one event to get the full query object
    let queryObject = null;

    // The stream is an async iterator - we need to get the query object differently
    // Actually, looking at the SDK types, rewindFiles is on the Query object returned by query()
    // The query() function returns AsyncIterable<SDKEvent> & Query
    // So 'stream' itself has the rewindFiles method!

    if (typeof stream.rewindFiles === 'function') {
      console.error(`[REWIND] Found rewindFiles method on stream object`);

      if (dryRun) {
        // For dry run, we just validate the operation is possible
        emitEvent({
          type: 'rewind_preview',
          sessionId,
          userMessageId,
          canRewind: true,
          message: 'Dry run - rewind operation is available',
        });
      } else {
        // Execute the rewind
        await stream.rewindFiles(userMessageId);
        console.error(`[REWIND] Rewind completed successfully`);

        emitEvent({
          type: 'rewind_completed',
          sessionId,
          userMessageId,
          success: true,
        });
      }
    } else {
      throw new Error('rewindFiles method not available on query object. SDK version may not support this feature.');
    }

    // Success
    emitEvent({
      type: 'complete',
    });

    process.exit(0);
  } catch (error) {
    console.error(`[REWIND] Error:`, error.message);
    emitError(error);
    process.exit(1);
  }
}

main();
