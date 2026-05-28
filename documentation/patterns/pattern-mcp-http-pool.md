---
type: pattern
project: quack-app
created: 2026-05-27
last_verified: 2026-05-27
tags: [mcp, performance, scaling, node-sdk, architecture]
---

# Pattern: MCP HTTP Server Pool

## Problem

In the per-session **stdio** model, every Quack session causes the native `claude` binary (Claude Agent SDK 0.3.150) to **fork one Node process per MCP server**. With 3 internal servers (`ide-tools`, `code-intel`, `visualizer`) and N sessions, you get **3·N child processes**. Measured 2026-05-27:

| Sessions | MCP Node procs | Auxiliary RAM |
|---|---|---|
| 1 | 3 | ~180 MB |
| 3 | 9 | ~540 MB |
| 10 | 30 | ~1.8 GB |

This scales linearly with sessions and is a primary cause of "Mac va a palla con Quack" complaints.

## Solution

Spawn each internal MCP server **once at daemon boot** in HTTP mode, share it across all sessions via the `type: 'http'` MCP config:

```
┌─ stream-daemon.js (1 per Quack instance) ─────────────┐
│                                                       │
│  McpPool ── HTTP ── visualizer  127.0.0.1:47821       │
│           ── HTTP ── code-intel  127.0.0.1:47822       │
│           ── HTTP ── ide-tools   127.0.0.1:47823       │
│                                                       │
│  Session 1 ──┐                                        │
│  Session 2 ──┼─► all use the same 3 URLs              │
│  Session N ──┘                                        │
└───────────────────────────────────────────────────────┘
```

## Implementation

### 1. Dual-transport MCP servers

Each server (`visualizer-mcp-server.js`, `code-intel-mcp-server.js`, `ide-mcp-server.js`) supports both transports via CLI flag:

```bash
node visualizer-mcp-server.js                  # stdio (default, retro-compat)
node visualizer-mcp-server.js --http --port 0  # HTTP, OS-assigned port
```

In HTTP mode the server prints `MCP_HTTP_PORT=<port>` on stdout for the parent to pick up, then logs on stderr only.

### 2. Per-session transport (critical)

The MCP SDK's `StreamableHTTPServerTransport` with `sessionIdGenerator` is **single-session** — calling `initialize` twice on the same transport throws `"Server already initialized"`. To serve N concurrent sessions:

```js
const sessions = new Map(); // session-id → { server, transport }

httpServer.on('request', async (req, res) => {
  const sid = req.headers['mcp-session-id'];
  let transport;

  if (sid && sessions.has(sid)) {
    transport = sessions.get(sid).transport;
  } else if (!sid && isInitializeRequest(body)) {
    const server = serverFactory();
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => sessions.set(id, { server, transport }),
      onsessionclosed: (id) => sessions.delete(id),
    });
    await server.connect(transport);
  } else {
    // 404 unknown session OR 400 missing session-id + not initialize
  }

  await transport.handleRequest(req, res, body);
});
```

Callers pass a `serverFactory: () => createMcpServer()` (not a Server instance) so each session gets a fresh Server.

### 3. McpPool lifecycle

```js
// stream-daemon.js (boot)
mcpPool = new McpPool({
  scriptPaths: {
    'ide-tools':  '/.../ide-mcp-server.js',
    'code-intel': '/.../code-intel-mcp-server.js',
    'visualizer': '/.../visualizer-mcp-server.js',
  },
});
await mcpPool.start();   // spawn + read MCP_HTTP_PORT + /health probe

// per-query
options.mcpServers = {
  ...resolvedMcpServers,
  ...mcpPool.toMcpConfig(),  // { 'visualizer': { type:'http', url:'...' }, ... }
};

// shutdown
await mcpPool.stop();    // SIGTERM, 3s grace, then SIGKILL stragglers
```

### 4. Crash recovery

Sliding-window restart with exponential backoff:

- Window: 60 seconds
- Cap: 5 restarts per server in the window
- Backoff: `[250ms, 500ms, 1s, 2s, 4s]`
- Past the cap: server marked `dead`, `toMcpConfig()` omits it (sessions lose those tools but stay alive)

Crash event log (NDJSON) at `~/.quack/logs/mcp-pool.log` for forensics.

### 5. Opt-in via env var

```bash
QUACK_MCP_POOL=1 ./quack       # use pool
./quack                        # default: legacy stdio (zero behaviour change)
```

This lets us ship the code without forcing the migration, and rollback by unsetting the env var.

## Numbers (validated 2026-05-27)

| Test | Result |
|---|---|
| Pool boot (3 servers, health-checked) | ~250ms |
| 5 concurrent MCP sessions, 4 RPC each (20 total) | 125ms wall clock, 6ms avg/client |
| Distinct `mcp-session-id` per client | 5/5 |
| Crash recovery (SIGKILL → restart) | new PID in <500ms |
| `pnpm tsc --noEmit` | EXIT 0 |
| `cargo check` | EXIT 0 (7 pre-existing warnings) |

## Files

- `src-tauri/node-sdk/lib/mcp-http-transport.js` — shared HTTP transport helper (`startHttpTransport`, `parseHttpArgs`)
- `src-tauri/node-sdk/lib/mcp-pool.js` — `McpPool` class (spawn, health, restart, stop)
- `src-tauri/node-sdk/visualizer-mcp-server.js` — dual transport, v1.1.0
- `src-tauri/node-sdk/code-intel-mcp-server.js` — dual transport, v1.1.0
- `src-tauri/node-sdk/ide-mcp-server.js` — dual transport, v1.1.0
- `src-tauri/node-sdk/stream-daemon.js` — `bootMcpPool()` + `toMcpConfig()` wiring + shutdown

## When NOT to use

- External user MCP servers (configured via `.mcp.json` or `~/.claude/mcp_servers.json`): leave as stdio/sse — those are gated by user config and lifecycle.
- Skill-defined MCP servers (declared inside a skill): usually short-lived, keep stdio.
- Servers that rely on per-process `cwd` (none of the 3 internal ones do; verified with grep `process.cwd` in `lib/code-intel/`, `code-intel-mcp-server.js`, `ide-mcp-server.js`, `visualizer-mcp-server.js` — zero matches).

## Related

- WS6 — workstream `documentation/workstreams/06-mcp-http-pool.md`
- Pre-WS6 snapshot diagnosis: `documentation/diary/2026-05-27.md` 18:30 entry
- Memory leak prevention guide: `documentation/guide/memory-leak-prevention.md`
- SDK 0.3.150 upgrade: `documentation/patterns/pattern-sdk-version-upgrade.md`
