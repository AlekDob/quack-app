---
type: pattern
project: quack-app
created: 2026-01-08
last_verified: 2026-03-06
tags: [mcp, architecture, tools, code-intel]
---

# MCP Server Integration

Location: /src-tauri/node-sdk/

6 MCP servers: brain-mcp-server.js, kanban-mcp-server.js, semantic-search-mcp-server.js, ide-mcp-server.js, memory-prompt-hook.js, code-intel-mcp-server.js

Backend manager: mcp.rs - process management, stdio/HTTP/SSE transport

Transport types: stdio (default), HTTP, SSE

All servers expose tools accessible by Claude Agent SDK

## I 6 Server

### 1. brain-mcp-server.js
**Tools**: search, create_entity, add_observation, get_backlinks, read_canvas, create_canvas

### 2. kanban-mcp-server.js
**Tools**: list_tasks, create_task, move_task, get_workload, get_session_context

### 3. semantic-search-mcp-server.js
**Tools**: semantic_search_code, index_project, get_index_status

### 4. ide-mcp-server.js
**Tools**: ide_open, ide_open_multiple, ide_show_diff, ide_focus, ide_arrange_side_by_side, ide_sync_focus, ide_get_context

### 5. memory-prompt-hook.js
**Uso**: Inietta memorie rilevanti nel prompt

### 6. code-intel-mcp-server.js (NEW - 2026-03-05)
**Tools**: code_outline, code_find_definition, code_find_references, code_get_imports
**Engine**: tree-sitter (AST parsing) + walkdir file discovery
**Languages**: TypeScript, JavaScript, Swift (added 2026-03-06). Extensible to Rust/Python/Go
**Purpose**: Semantic code navigation for agents — replaces repetitive Grep/Read that waste ~15K tokens
**Modules**: `lib/code-intel/` — walker.js, parser.js, outline.js, definitions.js, references.js, imports.js
**Registration**: `.mcp.json` (project root) — loaded by SDK via settingSources

## Registration Methods

### Method 1: `.mcp.json` (project root) — RECOMMENDED
The SDK loads this automatically via `settingSources: ['project']`.
```json
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

### Method 2: `options.mcpServers` (programmatic)
Passed in stream-claude.js. Works for ide-tools but was unreliable for new servers.
The SDK's `settingSources` loading takes priority.

### Method 3: `~/.quack/mcp/.mcp.json` (global)
For servers available across ALL projects.

## Come Funziona la Comunicazione

```
Claude Agent SDK
      | (tool_use)
mcp.rs (Rust) ---> spawn process ---> brain-mcp-server.js
      |<--------- stdio (JSON-RPC) ----------|
```

Il backend Rust gestisce il lifecycle dei processi MCP e fa da proxy tra Claude e i server.

## UI Colors

| Server | Color | Hex |
|--------|-------|-----|
| brain | vibrant rose | #E84A7F |
| ide-tools | purple | #a855f7 |
| code-intel | cyan | #06b6d4 |
| other MCP | orange | #f97316 |

Colors defined in: `ToolWidgets.tsx`, `StreamMessage.tsx`, `ToolCallMinimal.tsx`
