---
type: api
project: quack-app
created: 2026-01-08
migrated: true
---

# MCP Server Integration

Location: /src-tauri/node-sdk/

5 MCP servers: brain-mcp-server.js (57K), kanban-mcp-server.js (38K), semantic-search-mcp-server.js (28K), ide-mcp-server.js (21K), memory-prompt-hook.js (10K)

Backend manager: mcp.rs (42.6K LOC) - process management, stdio/HTTP/SSE transport

Transport types: stdio (default), HTTP, SSE

All servers expose tools accessible by Claude Agent SDK

## Cosa sono gli MCP Server?

MCP (Model Context Protocol) e uno standard per esporre "tools" a modelli AI. In Quack, abbiamo 5 server Node.js che danno a Claude accesso a funzionalita specifiche.

## I 5 Server

### 1. brain-mcp-server.js (57K LOC)
**Tools**: search, create_entity, add_observation, get_backlinks, read_canvas, create_canvas
**Uso**: Gestione knowledge graph

### 2. kanban-mcp-server.js (38K LOC)
**Tools**: list_tasks, create_task, move_task, get_workload, get_session_context
**Uso**: Automazione task management

### 3. semantic-search-mcp-server.js (28K LOC)
**Tools**: semantic_search_code, index_project, get_index_status
**Uso**: Ricerca semantica nel codice

### 4. ide-mcp-server.js (21K LOC)
**Tools**: ide_open, ide_open_multiple, ide_show_diff, ide_focus
**Uso**: Integrazione con VS Code, Cursor, etc.

### 5. memory-prompt-hook.js (10K LOC)
**Uso**: Inietta memorie rilevanti nel prompt

## Come Funziona la Comunicazione

```
Claude Agent SDK
      |
      v (tool_use)
mcp.rs (Rust) ---> spawn process ---> brain-mcp-server.js
      |                                      |
      |<--------- stdio (JSON-RPC) ----------|
```

Il backend Rust gestisce il lifecycle dei processi MCP e fa da proxy tra Claude e i server.
