---
type: gotcha
project: quack-app
created: 2026-03-05
last_verified: 2026-03-05
tags: [mcp, sdk, registration, settings-sources]
---

# MCP Server Registration: .mcp.json vs options.mcpServers

## Problem

When adding a new MCP server to Quack, registering it programmatically via `options.mcpServers` in `stream-claude.js` may NOT work, even though existing servers (like `ide-tools`) registered the same way DO work.

The debug log shows the server starts and `ListTools` is called, but tools don't appear in the agent's tool list.

## Root Cause

The Claude Agent SDK with `settingSources: ['project', 'user', 'local']` loads MCP servers from settings files (`.mcp.json`, user settings) INDEPENDENTLY from `options.mcpServers`. The interaction between these two sources is unpredictable — some servers from `options.mcpServers` may work while others silently don't.

## Fix

**Always register new MCP servers in `.mcp.json`** (project root), not in `options.mcpServers`.

```json
// .mcp.json (project root)
{
  "mcpServers": {
    "code-intel": {
      "type": "stdio",
      "command": "node",
      "args": ["./src-tauri/node-sdk/code-intel-mcp-server.js"]
    }
  }
}
```

The SDK loads `.mcp.json` automatically via `settingSources: ['project']`. This is the documented, reliable method.

## Diagnosis Checklist

1. Server works standalone? `echo '{"jsonrpc":"2.0","id":1,"method":"initialize",...}' | node server.js`
2. File exists in `target/debug/node-sdk/`? (Tauri copies at build time)
3. Debug log at `~/code-intel-debug.log` updated? (If stale timestamp → server NOT spawned)
4. `.mcp.json` has the server? → If not, add it there instead of `options.mcpServers`

## Key Insight

The `type: "stdio"` field should always be explicitly included in `.mcp.json` entries, even though the SDK docs say it's inferred. Being explicit prevents ambiguity.
