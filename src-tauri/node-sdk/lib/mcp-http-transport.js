// Brain: ws6-mcp-http-pool
// Shared helper for booting an MCP server with StreamableHTTPServerTransport.
// Used by visualizer, code-intel, and ide-tools MCP servers so each one can
// expose itself over HTTP (in addition to the legacy stdio transport).
//
// Why: in the per-session stdio model, each Quack session forks 3 MCP servers
// (one per server type). Switching to HTTP lets a single pool serve all sessions.

import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import http from 'node:http';

/**
 * Parse `--http --port N` flags from process.argv.
 * @returns {{useHttp: boolean, port: number}}
 */
export function parseHttpArgs(argv) {
  const args = argv.slice(2);
  const useHttp = args.includes('--http');
  const portIdx = args.indexOf('--port');
  const portStr = portIdx >= 0 ? args[portIdx + 1] : undefined;
  const port = portStr ? parseInt(portStr, 10) : 0;
  return { useHttp, port };
}

function isInitializeRequest(body) {
  if (!body) return false;
  if (Array.isArray(body)) return body.some((b) => b && b.method === 'initialize');
  return body.method === 'initialize';
}

/**
 * Start an HTTP MCP server with **per-session transport** (multi-client safe).
 *
 * Spawns a Node http.Server bound to 127.0.0.1 on `port` (0 = OS-assigned).
 * For each new MCP session (initialize without session-id), creates a fresh
 * Server instance + StreamableHTTPServerTransport, indexed by session-id.
 * Subsequent requests with the same session-id reuse that transport.
 *
 * Why: the MCP SDK's StreamableHTTPServerTransport with `sessionIdGenerator`
 * is single-session — calling `initialize` twice on the same transport throws
 * "Server already initialized". To serve N concurrent Quack sessions sharing
 * one MCP server process, we instantiate one transport per session.
 *
 * Endpoints:
 *   GET  /health → { status, name, version, sessions }
 *   ALL  /mcp    → MCP JSON-RPC (POST messages, GET SSE stream)
 *
 * @param {object} options
 * @param {() => import('@modelcontextprotocol/sdk/server/index.js').Server | import('@modelcontextprotocol/sdk/server/index.js').Server} options.server
 *        Either an MCP Server (used as a factory by calling .clone-like), or a factory function.
 *        For backwards compatibility we accept a Server instance — but since we cannot
 *        clone a Server in MCP SDK, callers should pass a factory function instead.
 *        Use { serverFactory: () => createMcpServer() } when calling.
 * @param {() => import('@modelcontextprotocol/sdk/server/index.js').Server} options.serverFactory
 * @param {number} options.port
 * @param {string} options.name
 * @param {string} options.version
 * @returns {Promise<{port: number, httpServer: http.Server, sessions: Map<string, {server, transport}>}>}
 */
export async function startHttpTransport({ server, serverFactory, port, name, version }) {
  const logPrefix = `[${name.toUpperCase()}-MCP]`;

  // Resolve a factory: if caller passed a Server instance instead of a factory,
  // build a synthetic factory that returns it once then complains for new sessions.
  let factory = serverFactory;
  if (!factory) {
    if (!server) throw new Error('startHttpTransport requires serverFactory or server');
    let usedOnce = false;
    factory = () => {
      if (usedOnce) {
        throw new Error('startHttpTransport: caller passed a Server instance but multiple sessions requested. Pass serverFactory: () => createMcpServer() instead.');
      }
      usedOnce = true;
      return server;
    };
  }

  /** @type {Map<string, {server: any, transport: StreamableHTTPServerTransport}>} */
  const sessions = new Map();

  async function newSession() {
    const newServer = factory();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sid) => {
        sessions.set(sid, { server: newServer, transport });
      },
      onsessionclosed: (sid) => {
        sessions.delete(sid);
      },
    });
    await newServer.connect(transport);
    return transport;
  }

  const httpServer = http.createServer(async (req, res) => {
    if (req.url === '/health' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', name, version, sessions: sessions.size }));
      return;
    }

    if (req.url?.startsWith('/mcp')) {
      let parsedBody;
      if (req.method === 'POST') {
        let body = '';
        try {
          for await (const chunk of req) body += chunk;
          parsedBody = body ? JSON.parse(body) : undefined;
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'invalid JSON body', detail: String(err) }));
          return;
        }
      }

      const sid = req.headers['mcp-session-id'];
      let transport;
      try {
        if (sid && sessions.has(sid)) {
          transport = sessions.get(sid).transport;
        } else if (!sid && isInitializeRequest(parsedBody)) {
          transport = await newSession();
        } else if (sid && !sessions.has(sid)) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32001, message: 'Unknown session' }, id: null }));
          return;
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ jsonrpc: '2.0', error: { code: -32600, message: 'Missing session-id and not initialize' }, id: null }));
          return;
        }

        await transport.handleRequest(req, res, parsedBody);
      } catch (err) {
        console.error(`${logPrefix} handleRequest error:`, err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      }
      return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  });

  const actualPort = await new Promise((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, '127.0.0.1', () => {
      resolve(httpServer.address().port);
    });
  });

  // Machine-readable port announcement on stdout for parent (stream-daemon) pickup
  process.stdout.write(`MCP_HTTP_PORT=${actualPort}\n`);
  console.error(`${logPrefix} HTTP transport ready on 127.0.0.1:${actualPort} (POST /mcp, GET /health) — per-session transport`);

  const shutdown = (signal) => {
    console.error(`${logPrefix} received ${signal}, shutting down (${sessions.size} active sessions)`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000).unref();
  };
  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  return { port: actualPort, httpServer, sessions };
}
