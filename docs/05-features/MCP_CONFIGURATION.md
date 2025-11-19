# MCP Configuration in Quack

**Date**: 2025-11-18
**Status**: ✅ CONFIGURED

## Overview

Model Context Protocol (MCP) servers extend Claude with custom tools and capabilities. This document explains how MCP configuration works in Quack and Claude Code ecosystem.

## Configuration Hierarchy

MCP servers can be configured at three levels:

### 1. Global Configuration (`~/.mcp.json`)

**Purpose**: System-wide MCP servers available to all applications using Claude SDK
**Location**: `/Users/alekdob/.mcp.json`

**Current Configuration**:
- `memory` - Persistent memory storage
- `firecrawl` - Web scraping and search

**When to use**: For tools you want available everywhere (memory, filesystem, etc.)

### 2. Project Configuration (`.mcp.json`)

**Purpose**: Project-specific MCP servers
**Location**: `/Users/alekdob/Desktop/Dev/Personal/quack-app/.mcp.json`

**Current Configuration**:
- `firecrawl` - Web scraping and search
- `memory` - Persistent memory storage

**When to use**: For project-specific tools or when testing new MCP servers

### 3. Claude Code Plugin System

**Purpose**: Pre-packaged MCP servers from Claude Code plugins
**Location**: `~/.claude/plugins/marketplaces/claude-code-templates/`

**Example**: Firecrawl is available as a plugin component
**File**: `cli-tool/components/mcps/devtools/firecrawl.json`

**When to use**: Automatically managed by Claude Code plugins

## Configuration Format

### Basic MCP Server (stdio)

```json
{
  "mcpServers": {
    "server-name": {
      "description": "Server description",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-name"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

### HTTP/SSE Server

```json
{
  "mcpServers": {
    "remote-api": {
      "type": "sse",
      "url": "https://api.example.com/mcp/sse",
      "headers": {
        "Authorization": "Bearer ${API_TOKEN}"
      }
    }
  }
}
```

## How It Works in Claude Code

1. **Claude Code loads MCP servers** from:
   - Global `~/.mcp.json`
   - Project `.mcp.json`
   - Enabled plugins

2. **Permissions** are managed in:
   - `~/.claude/settings.local.json` (global)
   - `.claude/settings.local.json` (project)

3. **Tool names** follow the pattern:
   - `mcp__{server_name}__{tool_name}`
   - Example: `mcp__firecrawl__firecrawl_search`

## Current Servers in Quack

### Firecrawl

**Purpose**: Web scraping and search capabilities
**Tools**:
- `mcp__firecrawl__firecrawl_search` - Search the web
- `mcp__firecrawl__firecrawl_scrape` - Scrape web pages
- `mcp__firecrawl__firecrawl_map` - Map website structure
- `mcp__firecrawl__firecrawl_crawl` - Crawl websites

**Configuration**:
```json
{
  "firecrawl": {
    "command": "npx",
    "args": ["-y", "firecrawl-mcp"],
    "env": {
      "FIRECRAWL_API_KEY": "${FIRECRAWL_API_KEY}"
    }
  }
}
```

**Environment Variable**:
```bash
export FIRECRAWL_API_KEY="your-api-key-here"
```

### Memory

**Purpose**: Persistent memory for AI conversations
**Tools**:
- `mcp__memory__store_memory` - Store information
- `mcp__memory__retrieve_memory` - Retrieve stored information

**Configuration**:
```json
{
  "memory": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-memory"]
  }
}
```

## Using MCP in Claude Agent SDK

### Option 1: Using Global/Project Config

The SDK automatically loads MCP servers from `.mcp.json` files:

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Search for liquid glass apple",
  options: {
    // MCP servers from .mcp.json are loaded automatically
    allowedTools: ["mcp__firecrawl__firecrawl_search"]
  }
})) {
  if (message.type === "result") {
    console.log(message.result);
  }
}
```

### Option 2: Inline Configuration

You can also configure MCP servers directly in code:

```typescript
for await (const message of query({
  prompt: "Search the web",
  options: {
    mcpServers: {
      "firecrawl": {
        command: "npx",
        args: ["-y", "firecrawl-mcp"],
        env: {
          FIRECRAWL_API_KEY: process.env.FIRECRAWL_API_KEY
        }
      }
    },
    allowedTools: ["mcp__firecrawl__firecrawl_search"]
  }
})) {
  // Handle messages
}
```

## Permissions Management

### Global Permissions (`~/.claude/settings.local.json`)

```json
{
  "permissions": {
    "allow": [
      "mcp__firecrawl__firecrawl_search",
      "mcp__firecrawl__firecrawl_scrape"
    ]
  }
}
```

### Project Permissions (`.claude/settings.local.json`)

```json
{
  "permissions": {
    "allow": [
      "Read(/Users/alekdob/Desktop/Dev/Personal/quack-app/**)"
    ]
  },
  "enableAllProjectMcpServers": true,
  "enabledMcpjsonServers": ["memory", "firecrawl"]
}
```

## Troubleshooting

### MCP Server Not Found

1. **Check configuration files**:
   ```bash
   cat ~/.mcp.json
   cat .mcp.json
   ```

2. **Verify server is installed**:
   ```bash
   npx -y firecrawl-mcp --version
   ```

3. **Check permissions**:
   - Look in `~/.claude/settings.local.json`
   - Look in `.claude/settings.local.json`

### Tools Not Showing Up

1. **Tool name format**: Must be `mcp__{server}__{tool}`
2. **Allowed tools**: Must be in `allowedTools` array
3. **Server status**: Check SDK init message for server connection status

### Environment Variables

Make sure environment variables are set:

```bash
# In ~/.zshrc or ~/.bashrc
export FIRECRAWL_API_KEY="fc-your-key-here"
```

## Adding New MCP Servers

### 1. Find the Server

Check [MCP Registry](https://github.com/modelcontextprotocol/servers) or npm:

```bash
npm search @modelcontextprotocol/server-
```

### 2. Add to Configuration

Edit `.mcp.json`:

```json
{
  "mcpServers": {
    "new-server": {
      "description": "New server description",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-new"],
      "env": {
        "API_KEY": "${API_KEY}"
      }
    }
  }
}
```

### 3. Set Environment Variables

```bash
export API_KEY="your-api-key"
```

### 4. Update Permissions

Add to `.claude/settings.local.json`:

```json
{
  "enabledMcpjsonServers": ["memory", "firecrawl", "new-server"]
}
```

### 5. Restart Application

Restart Quack or Claude Code to load new configuration.

## Best Practices

1. **Use Global for Common Tools**: Put widely-used servers in `~/.mcp.json`
2. **Use Project for Specific Tools**: Put project-specific servers in project `.mcp.json`
3. **Document Environment Variables**: List required env vars in README
4. **Test Before Committing**: Test MCP servers locally before pushing
5. **Use Descriptions**: Add clear descriptions to help identify server purpose

## Security

- **Never commit API keys**: Use environment variables
- **Use ${VAR} syntax**: Reference environment variables in config
- **Review permissions**: Only allow necessary tools
- **Audit server code**: Review MCP server source before using

## Resources

- [MCP Documentation](https://modelcontextprotocol.io)
- [MCP Servers Registry](https://github.com/modelcontextprotocol/servers)
- [Claude Agent SDK Docs](https://github.com/anthropics/claude-agent-sdk)
- [Firecrawl MCP](https://www.npmjs.com/package/firecrawl-mcp)

## Related Documentation

- `docs/01-architecture.md` - System architecture
- `.claude/skills/claude-agent-sdk-expert/references/mcp-and-tools.md` - SDK MCP integration
- `docs/02-bug-fixes/03-mcp-integration-fix.md` - MCP compilation fixes
