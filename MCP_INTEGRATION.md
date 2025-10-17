# MCP (Model Context Protocol) Integration

## Overview

Quack now supports MCP (Model Context Protocol) servers integration, allowing Claude to interact with external tools and services directly from the app.

## Features

- **Visual MCP Management**: Dedicated tab in the side panel for managing MCP servers
- **Server Templates**: Pre-configured templates for common MCP servers (GitHub, Slack, Filesystem, Database, etc.)
- **Real-time Status**: Monitor server status (Running, Stopped, Starting, Error)
- **Environment Variables**: Secure configuration with support for system environment variables
- **Connection Testing**: Test server configurations before enabling them
- **Auto-loading**: Enabled servers are automatically passed to Claude Agent SDK

## Architecture

### Frontend Components

- **MCPPanel** (`src/components/MCPPanel.tsx`)
  - Main management interface with server list
  - Add/Edit/Delete server actions
  - Template quick-start buttons

- **MCPServerCard** (`src/components/MCPServerCard.tsx`)
  - Individual server display with controls
  - Status indicators and enable/disable toggle
  - Test connection and edit actions

- **MCPServerModal** (`src/components/MCPServerModal.tsx`)
  - Add/Edit server configuration dialog
  - Template selector for quick setup
  - Environment variables editor

- **useMCPServers** (`src/hooks/useMCPServers.ts`)
  - Custom React hook for MCP state management
  - CRUD operations for servers
  - Connection testing

### Backend (Rust)

- **mcp.rs** (`src-tauri/src/mcp.rs`)
  - `list_mcp_servers` - List all configured servers
  - `get_mcp_server` - Get single server by ID
  - `save_mcp_server` - Add or update server
  - `delete_mcp_server` - Remove server
  - `get_mcp_templates` - Get predefined templates
  - `test_mcp_connection` - Validate server configuration

### Integration with Claude SDK

- **claudeSDK.ts** (`src/services/claudeSDK.ts`)
  - Automatically loads enabled MCP servers from `.mcp.json`
  - Passes servers to Claude Agent SDK via `mcpServers` option
  - Supports both automatic and manual MCP configuration

## Configuration Format

MCP servers are stored in `.mcp.json` file at the project root:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-filesystem"],
      "env": {
        "ALLOWED_PATHS": "/path/to/projects"
      }
    },
    "github": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

## Available Templates

1. **Filesystem**
   - Access local files and directories
   - Command: `npx @modelcontextprotocol/server-filesystem`
   - Env: `ALLOWED_PATHS` (comma-separated paths)

2. **GitHub**
   - Interact with GitHub repositories
   - Command: `npx @modelcontextprotocol/server-github`
   - Env: `GITHUB_TOKEN` (GitHub API token)

3. **Slack**
   - Send and receive Slack messages
   - Command: `npx @modelcontextprotocol/server-slack`
   - Env: `SLACK_TOKEN` (Slack API token)

4. **PostgreSQL**
   - Query PostgreSQL databases
   - Command: `npx @modelcontextprotocol/server-postgres`
   - Env: `DATABASE_URL` (PostgreSQL connection string)

5. **Puppeteer**
   - Browser automation with Puppeteer
   - Command: `npx @modelcontextprotocol/server-puppeteer`
   - No env variables required

## Usage

### Adding a New MCP Server

1. Open the MCP tab in the side panel
2. Click "+ Add Server" button
3. Choose a template or configure manually:
   - Enter Server ID (unique identifier)
   - Enter Server Name (display name)
   - Configure Command and Arguments
   - Add Environment Variables (KEY=value format, one per line)
4. Click "Add Server" to save

### Editing an Existing Server

1. Open the MCP tab
2. Click "Edit" on the server card
3. Modify configuration as needed
4. Click "Update Server" to save changes

### Testing a Server Connection

1. Open the MCP tab
2. Click "Test" on the server card
3. System will validate configuration
4. Result will be shown in an alert

### Enabling/Disabling a Server

1. Open the MCP tab
2. Toggle the switch on the server card
3. Enabled servers are automatically loaded when Claude SDK is initialized

## Environment Variables

Environment variables support system variable substitution using `${VAR}` syntax:

```json
{
  "env": {
    "GITHUB_TOKEN": "${GITHUB_TOKEN}",
    "CUSTOM_PATH": "/fixed/path/value"
  }
}
```

The `${GITHUB_TOKEN}` will be replaced with the actual value from system environment variables.

## Server Status

- **Stopped** (Gray): Server is disabled or not running
- **Starting** (Yellow): Server is initializing
- **Running** (Green): Server is active and connected
- **Error** (Red): Server encountered an error

## Integration with Claude Agent SDK

When you chat with Claude in Quack:

1. Enabled MCP servers are automatically loaded from `.mcp.json`
2. Servers are passed to Claude Agent SDK via the `mcpServers` option
3. Claude can now use tools provided by these MCP servers
4. Tool usage is displayed in the chat interface

## Development Notes

### TypeScript Types

All MCP-related types are defined in `src/types.ts`:

```typescript
export type MCPServerType =
  | 'filesystem'
  | 'github'
  | 'slack'
  | 'database'
  | 'puppeteer'
  | 'playwright'
  | 'custom';

export type MCPServerStatus =
  | 'stopped'
  | 'starting'
  | 'running'
  | 'error';

export interface MCPServer {
  id: string;
  name: string;
  type: MCPServerType;
  command: string;
  args: string[];
  env?: Record<string, string>;
  enabled: boolean;
  status: MCPServerStatus;
  error?: string;
}
```

### Adding New Templates

To add a new MCP server template:

1. Edit `src-tauri/src/mcp.rs`
2. Add template to the `get_mcp_templates` function:

```rust
MCPTemplate {
    id: "my-server".to_string(),
    name: "My Server".to_string(),
    description: "Description of my server".to_string(),
    template_type: "custom".to_string(),
    icon: "custom-icon".to_string(),
    config: MCPServerConfig {
        command: "npx".to_string(),
        args: vec!["@my-org/server-package".to_string()],
        env: Some({
            let mut env = HashMap::new();
            env.insert("CONFIG_KEY".to_string(), "${CONFIG_KEY}".to_string());
            env
        }),
    },
}
```

## Troubleshooting

### Server won't start

- Check command and arguments are correct
- Verify environment variables are set
- Ensure required npm packages are installed (`npx` will auto-install)

### Connection test fails

- Validate server configuration syntax
- Check environment variable names
- Ensure command is executable

### Servers not showing in Claude

- Verify servers are enabled (toggle switch)
- Check `.mcp.json` file exists and is valid
- Restart Claude chat session

## Resources

- [Claude Agent SDK MCP Documentation](https://docs.claude.com/en/api/agent-sdk/mcp)
- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [Official MCP Servers](https://github.com/modelcontextprotocol/servers)

## Future Enhancements

- [ ] Server process management (start/stop servers directly)
- [ ] Real-time server health monitoring
- [ ] Server logs viewer
- [ ] Import/export server configurations
- [ ] Community template marketplace
- [ ] Per-chat server selection
- [ ] MCP server discovery
