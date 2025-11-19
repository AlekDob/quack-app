# MCP Setup for Quack

Quick setup guide for Model Context Protocol (MCP) servers in Quack.

## ✅ What's Already Configured

The following MCP servers are already configured:

- **Context7** - Context management and caching (`.mcp.json`)
- **Puppeteer** - Browser automation (`.mcp.json`)
- **Memory** - Persistent memory storage (`~/.mcp.json` and `.mcp.json`)

## 🔑 Environment Variables

Set up your API keys (if needed):

```bash
# Add to ~/.zshrc or ~/.bashrc
export CONTEXT7_API_KEY="your-context7-key-here"

# Reload shell
source ~/.zshrc  # or source ~/.bashrc
```

**Note**: Puppeteer and Memory don't require API keys.

To get a Context7 API key:
1. Go to https://upstash.com/
2. Sign up for an account
3. Create a Context7 database
4. Get your API key from the dashboard

## ✅ Verification

Test that MCP servers are configured:

```bash
# Check configuration files
cat ~/.mcp.json
cat .mcp.json

# Verify servers are installed
npx -y @upstash/context7-mcp --version
npx @modelcontextprotocol/server-puppeteer --version

# Check environment variables
echo $CONTEXT7_API_KEY
```

## 📚 Usage in Code

**MCP servers are fully automatic!** 🎉

The Claude Agent SDK automatically loads all MCP servers from your `.mcp.json` configuration files and makes ALL their tools available. You don't need to specify any tools in code.

```typescript
import { streamClaudeMessage } from "@/services/claudeSDK";

// All MCP tools from .mcp.json are automatically available!
// No need to specify allowedTools - just use the SDK normally
const stream = streamClaudeMessage(
  "Open a browser and navigate to example.com",
  {
    model: "sonnet",
    workingDirectory: "/path/to/your/project"
  }
);

for await (const event of stream) {
  if (event.type === "event" && event.event?.type === "assistant") {
    console.log(event.event.message);
  }
}
```

**Why no `allowedTools`?**
- Each user can configure their own MCP servers in `.mcp.json`
- Hardcoding tools would prevent users from adding new MCP servers
- The SDK automatically discovers and loads all tools from configured servers
- If you need to restrict tools, use `.claude/settings.json` permissions instead

## 🛠️ Available Tools

**All tools from your configured MCP servers are automatically available!**

The exact list of available tools depends on which MCP servers you have configured in your `.mcp.json` files. Here are the tools from the pre-configured servers:

### Context7 Tools (Library Documentation)
- `mcp__context7__resolve-library-id` - Find Context7-compatible library ID
- `mcp__context7__get-library-docs` - Get up-to-date library documentation

### Puppeteer Tools (Browser Automation)
- `mcp__puppeteer__puppeteer_navigate` - Navigate to URL
- `mcp__puppeteer__puppeteer_screenshot` - Take screenshot
- `mcp__puppeteer__puppeteer_click` - Click element
- `mcp__puppeteer__puppeteer_fill` - Fill form fields
- `mcp__puppeteer__puppeteer_select` - Select dropdown option
- `mcp__puppeteer__puppeteer_hover` - Hover over element
- `mcp__puppeteer__puppeteer_evaluate` - Run JavaScript in page

### Memory Tools (Knowledge Graph)
- `mcp__memory__create_entities` - Create entities in knowledge graph
- `mcp__memory__create_relations` - Create relations between entities
- `mcp__memory__add_observations` - Add observations to entities
- `mcp__memory__delete_entities` - Delete entities
- `mcp__memory__delete_observations` - Delete observations
- `mcp__memory__delete_relations` - Delete relations
- `mcp__memory__read_graph` - Read entire knowledge graph
- `mcp__memory__search_nodes` - Search for nodes
- `mcp__memory__open_nodes` - Open specific nodes

**Adding more MCP servers?** Just update `.mcp.json` - their tools will automatically become available!

## 🔧 Adding More MCP Servers

To add new MCP servers, edit `.mcp.json`:

```json
{
  "mcpServers": {
    "your-server": {
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

## 📖 Full Documentation

For complete MCP documentation, see:
- `docs/05-features/MCP_CONFIGURATION.md` - Complete MCP guide
- `.claude/skills/claude-agent-sdk-expert/references/mcp-and-tools.md` - SDK integration

## 🆘 Troubleshooting

### "Insufficient credits" or API errors

Check that your API keys are set correctly:
```bash
echo $CONTEXT7_API_KEY
```

### MCP server not found

1. Check if it's in `.mcp.json`
2. Verify the package is installed: `npx -y <package-name> --version`
3. Check environment variables are set

### Tools not showing up

**This is normal!** MCP tools don't appear in Claude Code's "Available Tools" list in the UI. They are loaded dynamically by the SDK at runtime.

To verify MCP tools are working:
1. Check that your MCP server is listed in `.mcp.json`
2. Look at the SDK console logs - you should see "🔌 MCP servers loaded: [server names]"
3. Try using the tools in a query - they'll work even if not shown in UI
4. Restart the application after changing `.mcp.json`

### Server shows "Running" but I can't use the tools

1. Check the server is in `.mcp.json` (not just in Claude Code's settings)
2. Verify environment variables are set (e.g., `echo $CONTEXT7_API_KEY`)
3. Look at SDK console logs for MCP server initialization messages
4. Try restarting the application

## 🔗 Resources

- [Context7 MCP](https://www.npmjs.com/package/@upstash/context7-mcp)
- [Puppeteer MCP](https://www.npmjs.com/package/@modelcontextprotocol/server-puppeteer)
- [Memory MCP](https://www.npmjs.com/package/@modelcontextprotocol/server-memory)
- [MCP Documentation](https://modelcontextprotocol.io)
- [MCP Servers Registry](https://github.com/modelcontextprotocol/servers)
- [Claude Agent SDK](https://github.com/anthropics/claude-agent-sdk)
