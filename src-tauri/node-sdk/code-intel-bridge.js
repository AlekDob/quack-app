#!/usr/bin/env node
// Brain: pattern-code-intel-language-extension
// Bridge script: accepts JSON on stdin, calls code-intel functions, returns JSON on stdout.
// Called from Rust (code_intel.rs) via tokio::process::Command.

import { getOutline } from './lib/code-intel/outline.js';
import { findDefinition } from './lib/code-intel/definitions.js';
import { findReferences } from './lib/code-intel/references.js';

let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => (input += chunk));
process.stdin.on('end', () => {
  try {
    const { action, args } = JSON.parse(input);
    let result;

    switch (action) {
      case 'outline':
        result = getOutline(args.filePath);
        break;

      case 'findDefinition':
        result = findDefinition(
          args.symbol,
          args.projectPath,
          args.fileExtensions,
        );
        break;

      case 'findReferences':
        result = findReferences(args.symbol, args.projectPath, {
          maxResults: args.maxResults || 50,
          includeDefinition: true,
        });
        break;

      default:
        result = { error: `Unknown action: ${action}` };
    }

    process.stdout.write(JSON.stringify(result));
  } catch (err) {
    process.stdout.write(JSON.stringify({ error: err.message }));
    process.exitCode = 1;
  }
});
