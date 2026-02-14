---
type: pattern
created: 2026-01-08
---

# MCP Server Integration

Location: /src-tauri/node-sdk/

5 MCP servers: brain-mcp-server.js, kanban-mcp-server.js, semantic-search-mcp-server.js, ide-mcp-server.js, memory-prompt-hook.js

Backend manager: mcp.rs - process management, stdio/HTTP/SSE transport

Transport types: stdio (default), HTTP, SSE

All servers expose tools accessible by Claude Agent SDK

## I 5 Server

### 1. brain-mcp-server.js
**Tools**: search, create_entity, add_observation, get_backlinks, read_canvas, create_canvas

### 2. kanban-mcp-server.js
**Tools**: list_tasks, create_task, move_task, get_workload, get_session_context

### 3. semantic-search-mcp-server.js
**Tools**: semantic_search_code, index_project, get_index_status

### 4. ide-mcp-server.js
**Tools**: ide_open, ide_open_multiple, ide_show_diff, ide_focus

### 5. memory-prompt-hook.js
**Uso**: Inietta memorie rilevanti nel prompt

## Come Funziona la Comunicazione

```
Claude Agent SDK
      | (tool_use)
mcp.rs (Rust) ---> spawn process ---> brain-mcp-server.js
      |<--------- stdio (JSON-RPC) ----------|
```

Il backend Rust gestisce il lifecycle dei processi MCP e fa da proxy tra Claude e i server.
