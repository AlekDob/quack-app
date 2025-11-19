# MCP Dynamic Loading - User-Configurable MCP Servers

**Date**: 2025-01-XX
**Status**: Implemented ✅
**Impact**: Breaking Change (but improvement)

## 🎯 Problem

Previously, MCP tools were **hardcoded** in `/src/services/claudeSDK.ts`:

```typescript
// ❌ OLD APPROACH - Hardcoded tools
const allowedTools = [
  'mcp__context7__resolve-library-id',
  'mcp__context7__get-library-docs',
  'mcp__puppeteer__puppeteer_navigate',
  // ... 20+ hardcoded tool names
];
sdkOptions.allowedTools = allowedTools;
```

**Problems with this approach:**
1. ❌ Users can't add new MCP servers without modifying code
2. ❌ Each MCP server addition requires updating the hardcoded list
3. ❌ Not scalable - what if a user adds 10 MCP servers?
4. ❌ Defeats the purpose of `.mcp.json` configuration
5. ❌ Requires recompilation for each new MCP server

## ✅ Solution

**Remove the hardcoded `allowedTools` array entirely!**

According to [Claude Agent SDK documentation](https://docs.claude.com/en/docs/agent-sdk/streaming-vs-single-mode), if you **don't specify** `allowedTools`, the SDK automatically loads **ALL tools** from the configured MCP servers.

```typescript
// ✅ NEW APPROACH - Dynamic loading
// Add MCP servers if available
if (mcpServers && Object.keys(mcpServers).length > 0) {
  sdkOptions.mcpServers = mcpServers;
  console.log('🔌 MCP servers loaded:', Object.keys(mcpServers).join(', '));
  console.log('🦆 All MCP tools will be automatically available from these servers');
}

// No allowedTools specified = ALL tools from MCP servers are available!
```

## 🔄 How It Works

### 1. User Configuration (`.mcp.json`)
Users configure their MCP servers in `.mcp.json`:

```json
{
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp"],
      "env": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }
    },
    "puppeteer": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-puppeteer"]
    },
    "my-custom-server": {
      "command": "npx",
      "args": ["-y", "@my-org/custom-mcp-server"]
    }
  }
}
```

### 2. Automatic Loading (`claudeSDK.ts`)
The SDK wrapper automatically loads MCP servers:

```typescript
// Load MCP servers from .mcp.json (via Tauri backend)
let mcpServers = options.mcpServers;
if (!mcpServers) {
  mcpServers = await loadMCPServers(workingDirectory);
}

// Pass to SDK - it will load ALL tools from these servers
if (mcpServers && Object.keys(mcpServers).length > 0) {
  sdkOptions.mcpServers = mcpServers;
}
```

### 3. Tauri Backend (`mcp.rs`)
The Rust backend reads MCP configs from both:
- Global: `~/.mcp.json`
- Project: `.mcp.json`

```rust
#[tauri::command]
pub async fn list_mcp_servers(
    app: AppHandle,
    working_dir: Option<String>,
) -> Result<Vec<MCPServer>, String> {
    let mut all_servers = Vec::new();

    // Read global MCP config from ~/.mcp.json
    if let Ok(global_path) = get_global_mcp_config_path() {
        if let Ok(global_config) = read_mcp_config(&global_path) {
            let global_servers = config_to_servers(global_config, "global");
            all_servers.extend(global_servers);
        }
    }

    // Read project MCP config from .mcp.json
    let project_path = get_mcp_config_path(&app, working_dir)?;
    if let Ok(project_config) = read_mcp_config(&project_path) {
        let project_servers = config_to_servers(project_config, "project");
        all_servers.extend(project_servers);
    }

    Ok(all_servers)
}
```

## 🎉 Benefits

1. ✅ **User-Configurable**: Each user can add MCP servers in `.mcp.json` without code changes
2. ✅ **Scalable**: Works with any number of MCP servers
3. ✅ **Dynamic**: New tools automatically available when MCP servers are added
4. ✅ **No Recompilation**: Just update `.mcp.json` and restart the app
5. ✅ **True Plugin System**: MCP servers are real plugins now, not hardcoded integrations

## 🛡️ Security & Restrictions

**Q: How do I restrict which tools users can use?**

**A:** Use `.claude/settings.json` or `.claude/settings.local.json` for permissions:

```json
{
  "permissions": {
    "allow": [
      "mcp__puppeteer__puppeteer_navigate",
      "mcp__context7__resolve-library-id"
    ],
    "deny": [
      "mcp__puppeteer__puppeteer_evaluate" // Block arbitrary JS execution
    ]
  }
}
```

**Q: Won't this allow users to run any MCP server?**

**A:** Yes, but that's the point! Users can:
- Install MCP servers they trust
- Configure them in `.mcp.json`
- Use them without modifying Quack's code

This is the same model as VSCode extensions, Claude Code plugins, and other plugin systems.

## 📝 Migration Guide

### For Developers

**No code changes needed!** The SDK wrapper automatically loads MCP servers from `.mcp.json`.

If you were previously hardcoding `allowedTools`:
```typescript
// ❌ BEFORE - Remove this
const allowedTools = ['mcp__foo__bar', 'mcp__baz__qux'];
sdkOptions.allowedTools = allowedTools;

// ✅ AFTER - Just pass mcpServers, SDK handles the rest
if (mcpServers && Object.keys(mcpServers).length > 0) {
  sdkOptions.mcpServers = mcpServers;
}
```

### For Users

1. Add MCP servers to `.mcp.json`:
   ```json
   {
     "mcpServers": {
       "server-name": {
         "command": "npx",
         "args": ["-y", "@scope/mcp-server-package"]
       }
     }
   }
   ```

2. Set environment variables (if needed):
   ```bash
   export API_KEY="your-key"
   ```

3. Restart Quack

4. Use the MCP tools - they're automatically available!

## 🔍 Verification

Check SDK console logs when initializing:

```
[claudeSDK:stream-123] Starting stream for session: stream-123
🔌 MCP servers loaded: context7, puppeteer, memory
🦆 All MCP tools will be automatically available from these servers
```

## 📚 References

- [Claude Agent SDK - MCP Integration](https://docs.claude.com/en/docs/agent-sdk/streaming-vs-single-mode)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Quack MCP Setup Guide](../../MCP_SETUP.md)
- [Quack MCP Configuration Guide](./MCP_CONFIGURATION.md)

## 🦆 The Quack Way

This change embodies Quack's philosophy:
- **User Empowerment**: Users control their tools
- **Plugin Architecture**: True extensibility without code changes
- **AI-First**: MCP servers extend AI capabilities dynamically
- **Developer Friendly**: Simple `.mcp.json` configuration

**"Each user must be able to load their own [MCP servers]"** - @alekdob
