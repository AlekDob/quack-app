#!/usr/bin/env node

/**
 * Node.js Sidecar Wrapper for Quack App
 *
 * This is a minimal Node.js executable that bundles Node.js runtime
 * and acts as a sidecar binary for the Tauri app.
 *
 * It receives the path to stream-claude.js as the first argument
 * and forwards all execution to that script.
 */

const { spawn } = require('child_process');
const path = require('path');

// Parse arguments
const args = process.argv.slice(2);

if (args.length === 0) {
  console.error('Usage: node-sidecar <script-path> [arguments]');
  process.exit(1);
}

const scriptPath = args[0];
const scriptArgs = args.slice(1);

// Log for debugging
console.error(`[Sidecar] Executing script: ${scriptPath}`);
console.error(`[Sidecar] Arguments: ${scriptArgs.join(' ')}`);

// Spawn the actual Node.js process with the script
const child = spawn(process.execPath, [scriptPath, ...scriptArgs], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Ensure Node modules can be found
    NODE_PATH: path.join(path.dirname(scriptPath), 'node_modules')
  }
});

// Forward exit code
child.on('exit', (code) => {
  console.error(`[Sidecar] Process exited with code: ${code}`);
  process.exit(code || 0);
});

// Handle errors
child.on('error', (error) => {
  console.error('[Sidecar] Failed to start Node.js process:', error);
  process.exit(1);
});