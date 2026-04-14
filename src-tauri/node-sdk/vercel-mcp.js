/**
 * MCP client bridge for Vercel AI SDK path.
 *
 * Loads user-configured MCP servers from .mcp.json (global + project)
 * and converts them to Vercel AI SDK tools compatible with generateText/streamText.
 *
 * Brain: pattern-vercel-agentic-tools
 *
 * WHY: The Claude SDK path handles MCP natively. The Vercel path needs
 * explicit MCP client management. This module bridges that gap for
 * user-configured servers only (no Quack built-ins).
 */
import { createMCPClient } from '@ai-sdk/mcp';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// === CONSTANTS ===

/** Max time to wait for a single MCP server to connect (ms) */
// WHY: npx-based servers need to download packages on first run.
// 10s was too short — context7 timed out every time.
const MCP_CONNECT_TIMEOUT = 30_000;

// === MAIN API ===

/**
 * Load MCP tools from user-configured servers.
 *
 * @param {Record<string, McpServerConfig>} mcpServers — from .mcp.json
 * @param {(msg: string) => void} log — logger function
 * @returns {Promise<{ tools: Record<string, Tool>, cleanup: () => Promise<void> }>}
 */
export async function loadMCPTools(mcpServers, log = () => {}) {
  if (!mcpServers || Object.keys(mcpServers).length === 0) {
    return { tools: {}, cleanup: async () => {} };
  }

  const clients = [];
  const allTools = {};

  const entries = Object.entries(mcpServers);
  log(`[mcp-vercel] Loading ${entries.length} MCP servers...`);

  // Connect to all servers in parallel (each with timeout)
  const results = await Promise.allSettled(
    entries.map(([name, config]) => connectServer(name, config, log)),
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const name = entries[i][0];

    if (result.status === 'rejected') {
      log(`[mcp-vercel] "${name}" failed: ${result.reason?.message || result.reason}`);
      continue;
    }

    const { client, tools } = result.value;
    clients.push(client);

    // Prefix tool names with server name to avoid collisions
    // e.g. "postgres__query" instead of just "query"
    for (const [toolName, toolDef] of Object.entries(tools)) {
      const prefixed = `mcp_${name}__${toolName}`;
      allTools[prefixed] = toolDef;
    }

    log(`[mcp-vercel] "${name}" OK: ${Object.keys(tools).length} tools`);
  }

  log(`[mcp-vercel] Total: ${Object.keys(allTools).length} MCP tools loaded`);

  return {
    tools: allTools,
    cleanup: async () => {
      for (const client of clients) {
        try {
          await client.close();
        } catch {
          // Ignore close errors — process may already be dead
        }
      }
    },
  };
}

// === INTERNALS ===

/**
 * Connect to a single MCP server with timeout.
 * @returns {{ client, tools }}
 */
async function connectServer(name, config, log) {
  const transport = buildTransport(name, config, log);

  // Capture stderr from stdio transports for diagnostics
  if (transport._process?.stderr) {
    transport._process.stderr.on('data', (chunk) => {
      log(`[mcp-vercel] "${name}" stderr: ${chunk.toString().trim()}`);
    });
  }

  // Race connection against timeout
  // Brain: gotcha-mcp-server-timeout-slow-startup
  const client = await Promise.race([
    createMCPClient({ transport }),
    rejectAfter(MCP_CONNECT_TIMEOUT, `"${name}" connection timeout (${MCP_CONNECT_TIMEOUT}ms)`),
  ]);

  const tools = await client.tools();
  log(`[mcp-vercel] "${name}" connected: ${Object.keys(tools).length} tools`);
  return { client, tools };
}

/**
 * Build the appropriate transport for a server config.
 *
 * .mcp.json format:
 * - stdio: { command, args?, env? }
 * - SSE:   { type: 'sse', url, headers? }
 * - HTTP:  { type: 'http', url, headers? }
 */
function buildTransport(name, config, log) {
  if (config.type === 'sse') {
    log(`[mcp-vercel] "${name}" → SSE: ${config.url}`);
    return { type: 'sse', url: config.url, headers: config.headers };
  }

  if (config.type === 'http') {
    log(`[mcp-vercel] "${name}" → HTTP: ${config.url}`);
    return { type: 'http', url: config.url, headers: config.headers };
  }

  // Default: stdio (command + args)
  // Brain: gotcha-shell-env-gui-launch
  // ALWAYS inherit process.env (includes login PATH with nvm/npx from Rust inject).
  // Without this, child processes can't find npx/node binaries when launched from GUI.
  log(`[mcp-vercel] "${name}" → stdio: ${config.command} ${(config.args || []).join(' ')}`);
  return new StdioClientTransport({
    command: config.command,
    args: config.args || [],
    env: { ...process.env, ...(config.env || {}) },
  });
}

/** Promise that rejects after ms with a descriptive message */
function rejectAfter(ms, message) {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms),
  );
}
