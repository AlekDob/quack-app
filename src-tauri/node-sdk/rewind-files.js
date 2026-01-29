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
    // We need to use a real prompt to establish the connection, but we'll interrupt immediately
    const stream = query({
      prompt: 'REWIND_OPERATION', // Minimal prompt to establish connection
      options: {
        resume: sessionId,
        enableFileCheckpointing: true,
        persistSession: false, // Don't modify the session
      },
    });

    console.error(`[REWIND] Query object created, waiting for init...`);

    if (typeof stream.rewindFiles !== 'function') {
      console.error(`[REWIND] rewindFiles method NOT found. Stream methods:`, Object.keys(stream));
      throw new Error('rewindFiles method not available on query object. SDK version may not support this feature.');
    }

    console.error(`[REWIND] Found rewindFiles method on stream object`);

    // We need to wait for the stream to initialize before calling control methods
    // Start consuming the stream in the background and call rewindFiles
    let initReceived = false;

    // Create a promise that resolves when we get the init message
    const waitForInit = (async () => {
      for await (const event of stream) {
        console.error(`[REWIND] Received event:`, event.type, event.subtype || '');
        if (event.type === 'system' && event.subtype === 'init') {
          initReceived = true;
          console.error(`[REWIND] Init received, session is ready`);
          return;
        }
      }
    })();

    // Give the stream a moment to initialize
    // We race between init and a timeout
    const initTimeout = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout waiting for session init')), 10000);
    });

    try {
      await Promise.race([waitForInit, initTimeout]);
    } catch (timeoutError) {
      // If we timeout waiting for init, try to proceed anyway
      console.error(`[REWIND] Warning: ${timeoutError.message}, attempting rewind anyway...`);
    }

    // Now call rewindFiles
    console.error(`[REWIND] Calling stream.rewindFiles with UUID: ${userMessageId}`);
    console.error(`[REWIND] Dry run: ${dryRun}`);

    try {
      const rewindResult = await stream.rewindFiles(userMessageId, { dryRun });
      console.error(`[REWIND] Rewind result:`, JSON.stringify(rewindResult));

      // Check if rewind was successful
      if (rewindResult && rewindResult.canRewind === false) {
        throw new Error(rewindResult.error || 'Cannot rewind to this checkpoint');
      }

      if (dryRun) {
        console.error(`[REWIND] Dry run preview completed`);
        emitEvent({
          type: 'rewind_preview',
          sessionId,
          userMessageId,
          canRewind: rewindResult?.canRewind ?? true,
          filesChanged: rewindResult?.filesChanged || [],
          insertions: rewindResult?.insertions,
          deletions: rewindResult?.deletions,
        });
      } else {
        console.error(`[REWIND] Rewind completed successfully`);
        emitEvent({
          type: 'rewind_completed',
          sessionId,
          userMessageId,
          success: true,
          filesChanged: rewindResult?.filesChanged || [],
          insertions: rewindResult?.insertions,
          deletions: rewindResult?.deletions,
        });
      }
    } catch (rewindError) {
      console.error(`[REWIND] rewindFiles threw error:`, rewindError.message);
      throw rewindError;
    } finally {
      // Close the stream/connection
      if (typeof stream.close === 'function') {
        console.error(`[REWIND] Closing stream...`);
        stream.close();
      }
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
