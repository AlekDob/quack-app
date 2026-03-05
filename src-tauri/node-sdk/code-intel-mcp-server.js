#!/usr/bin/env node
// Brain: code-intel-mcp-server
// MCP server exposing code intelligence tools via tree-sitter

import { writeFileSync, appendFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// Debug: log to file to diagnose MCP server startup
const debugLog = join(homedir(), 'code-intel-debug.log');
function log(msg) {
  try {
    appendFileSync(debugLog, `[${new Date().toISOString()}] ${msg}\n`);
  } catch { /* ignore */ }
}

try {
  writeFileSync(debugLog, `[${new Date().toISOString()}] STARTING code-intel-mcp-server\n`);
} catch { /* ignore */ }

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { getOutline } from './lib/code-intel/outline.js';
import { findDefinition } from './lib/code-intel/definitions.js';
import { findReferences } from './lib/code-intel/references.js';
import { getImports } from './lib/code-intel/imports.js';

log('Modules imported successfully');

// --- Tool Definitions ---

const TOOLS = [
  {
    name: 'code_outline',
    description:
      'Get a structured outline of symbols (functions, classes, types, interfaces) in a file. ' +
      'Returns name, kind, line numbers, and whether each symbol is exported.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute path to the source file',
        },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'code_find_definition',
    description:
      'Find where a symbol (function, class, type, variable) is defined across the project. ' +
      'Returns file path, line number, kind, and a code preview for each definition.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol name to find the definition of',
        },
        projectPath: {
          type: 'string',
          description: 'Root directory of the project to search',
        },
        fileExtensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'File extensions to search (default: .ts, .tsx, .js, .jsx)',
        },
      },
      required: ['symbol', 'projectPath'],
    },
  },
  {
    name: 'code_find_references',
    description:
      'Find all references to a symbol across the project. Each reference is classified ' +
      'as import, call, type_reference, definition, assignment, or other.',
    inputSchema: {
      type: 'object',
      properties: {
        symbol: {
          type: 'string',
          description: 'Symbol name to find references for',
        },
        projectPath: {
          type: 'string',
          description: 'Root directory of the project to search',
        },
        includeDefinition: {
          type: 'boolean',
          description: 'Include definition sites in results (default: true)',
        },
        maxResults: {
          type: 'number',
          description: 'Maximum number of references to return (default: 50)',
        },
        fileExtensions: {
          type: 'array',
          items: { type: 'string' },
          description: 'File extensions to search (default: .ts, .tsx, .js, .jsx)',
        },
      },
      required: ['symbol', 'projectPath'],
    },
  },
  {
    name: 'code_get_imports',
    description:
      'Analyze all import statements in a file. Returns source module, imported symbols, ' +
      'whether the import is default/namespace, and resolved file paths for relative imports.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: {
          type: 'string',
          description: 'Absolute path to the source file',
        },
        resolveRelative: {
          type: 'boolean',
          description: 'Resolve relative import paths to absolute paths (default: true)',
        },
      },
      required: ['filePath'],
    },
  },
];

// --- Tool Handlers ---

function handleCodeOutline(args) {
  const { filePath } = args;
  const symbols = getOutline(filePath);

  if (symbols.length === 0) {
    return `No symbols found in: ${filePath}`;
  }

  let output = `## Outline: ${filePath}\n\n`;
  output += `**${symbols.length} top-level symbols**\n\n`;

  for (const sym of symbols) {
    const exportTag = sym.exported ? ' [exported]' : '';
    output += `- **${sym.kind}** \`${sym.name}\`${exportTag} (L${sym.line}-${sym.endLine})\n`;

    for (const child of sym.children) {
      output += `  - **${child.kind}** \`${child.name}\` (L${child.line}-${child.endLine})\n`;
    }
  }

  return output;
}

function handleFindDefinition(args) {
  const { symbol, projectPath, fileExtensions } = args;
  const result = findDefinition(symbol, projectPath, fileExtensions);

  if (result.definitions.length === 0) {
    return `No definitions found for \`${symbol}\` in ${projectPath}`;
  }

  let output = `## Definitions of \`${symbol}\`\n\n`;
  output += `**${result.definitions.length} definition(s) found**\n\n`;

  for (const def of result.definitions) {
    const exportTag = def.exported ? ' [exported]' : '';
    output += `### ${def.file}:${def.line}${exportTag}\n`;
    output += `- **Kind**: ${def.kind}\n`;
    output += `- **Preview**: \`${def.preview}\`\n\n`;
  }

  return output;
}

function handleFindReferences(args) {
  const { symbol, projectPath, includeDefinition, maxResults, fileExtensions } = args;
  const result = findReferences(symbol, projectPath, {
    includeDefinition,
    maxResults,
    fileExtensions,
  });

  if (result.references.length === 0) {
    return `No references found for \`${symbol}\` in ${projectPath}`;
  }

  let output = `## References to \`${symbol}\`\n\n`;
  output += `**${result.totalCount} total occurrence(s), showing ${result.references.length}**\n\n`;

  // Group by file
  const byFile = new Map();
  for (const ref of result.references) {
    if (!byFile.has(ref.file)) byFile.set(ref.file, []);
    byFile.get(ref.file).push(ref);
  }

  for (const [file, refs] of byFile) {
    output += `### ${file}\n`;
    for (const ref of refs) {
      output += `- L${ref.line} [${ref.context}]: \`${ref.preview}\`\n`;
    }
    output += '\n';
  }

  return output;
}

function handleGetImports(args) {
  const { filePath, resolveRelative } = args;
  const result = getImports(filePath, resolveRelative);

  if (result.imports.length === 0) {
    return `No imports found in: ${filePath}`;
  }

  let output = `## Imports: ${filePath}\n\n`;
  output += `**${result.imports.length} import(s)**\n\n`;

  for (const imp of result.imports) {
    const typeTag = imp.isNamespace ? ' (namespace)' : imp.isDefault ? ' (default)' : '';
    output += `- **\`${imp.source}\`**${typeTag} (L${imp.line})\n`;

    if (imp.resolvedPath) {
      output += `  - Resolved: ${imp.resolvedPath}\n`;
    }

    if (imp.symbols.length > 0) {
      const names = imp.symbols.map((s) => {
        if (s.alias) return `${s.name} as ${s.alias}`;
        if (s.isDefault) return `${s.name} (default)`;
        return s.name;
      });
      output += `  - Symbols: ${names.join(', ')}\n`;
    }
  }

  return output;
}

// --- Server Setup ---

const server = new Server(
  { name: 'code-intel', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  log('ListTools called');
  return { tools: TOOLS };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  log(`CallTool: ${name} with args ${JSON.stringify(args)}`);

  try {
    let text;
    switch (name) {
      case 'code_outline':
        text = handleCodeOutline(args);
        break;
      case 'code_find_definition':
        text = handleFindDefinition(args);
        break;
      case 'code_find_references':
        text = handleFindReferences(args);
        break;
      case 'code_get_imports':
        text = handleGetImports(args);
        break;
      default:
        text = `Unknown tool: ${name}`;
    }

    return { content: [{ type: 'text', text }] };
  } catch (error) {
    log(`Error in ${name}: ${error.message}`);
    return {
      content: [{ type: 'text', text: `Error: ${error.message}` }],
      isError: true,
    };
  }
});

// --- Start ---

async function main() {
  log('Starting stdio transport...');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  log('Server connected and running');
}

main().catch((error) => {
  log(`Fatal error: ${error.message}`);
  process.exit(1);
});
