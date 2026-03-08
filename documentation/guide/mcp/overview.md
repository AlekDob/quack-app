---
type: guide
project: quack-app
created: 2026-03-05
tags: [mcp, tools, guide]
---

# MCP Servers

MCP (Model Context Protocol) is the standard that allows AI agents to connect to external tools and services. Instead of being limited to conversation alone, an agent with MCP servers can search your codebase, manage tasks, read files, call APIs, and more — all as part of a single session.

In Quack, every agent session runs with a set of MCP servers active. Some are built-in; others you can add yourself.

## Built-in Servers

Quack ships with six MCP servers that are automatically available to all agents.

| Server | What it does |
|--------|-------------|
| **brain** | Reads and writes the Quack Brain knowledge store — gotchas, patterns, decisions, diary entries |
| **kanban** | Manages the task board: create cards, move columns, read task details |
| **semantic-search** | Searches your codebase by meaning, not just text — useful for finding related code across files |
| **ide-tools** | IDE integration: open files in tabs, show diffs, arrange windows, reveal files in Finder |
| **memory-prompt-hook** | Automatically injects project memory into the agent's context at session start |
| **code-intel** | Code intelligence powered by tree-sitter: outline a file, find definitions, find references, list imports (TypeScript, JavaScript, Swift) |

:::callout[info]
`code-intel` is the newest addition. It gives agents semantic code navigation — finding where a symbol is defined or used — without needing an external LSP.
:::

## How to See Running Servers

Open the **MCP Servers** panel from the sidebar (look for the plug icon). Each server is listed with a status indicator:

- **Green dot** — server is running and ready
- **Yellow dot** — server is starting up
- **Red dot / "failed"** — server failed to start (see Troubleshooting below)

The panel refreshes automatically. If a server was just added, restart your session to pick it up.

## Adding Custom MCP Servers

You can extend any agent with additional tools by adding servers to the `.mcp.json` file in your project root.

### Example `.mcp.json`

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "ghp_your_token_here"
      }
    },
    "fetch": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-fetch"]
    }
  }
}
```

Each entry has:

| Field | Required | Description |
|-------|----------|-------------|
| `command` | Yes | The executable to run (`node`, `npx`, `python`, etc.) |
| `args` | No | Arguments passed to the command |
| `env` | No | Environment variables (API keys, tokens, paths) |

### Using the "Edit JSON" Button

Instead of navigating to the file manually, click **Edit JSON** in the MCP Servers panel. This opens `.mcp.json` directly in a Quack tab. Save the file and restart the session to apply changes.

## Global Servers

Servers defined in `~/.quack/mcp/.mcp.json` are available across **all** your projects, without needing to add them to each repo.

This is useful for tools you always want — a web fetch server, a GitHub integration, a personal notes system.

The format is identical to the per-project `.mcp.json`.

:::callout[info]
Per-project `.mcp.json` and the global `~/.quack/mcp/.mcp.json` are merged at session start. If a server name appears in both, the project-level definition wins.
:::

## Troubleshooting

**Server shows "failed" in the panel**

Check these in order:

1. **Command not found** — make sure the binary is installed and on your `PATH`. For `npx` packages, run the install manually once: `npx -y @modelcontextprotocol/server-name`.
2. **Missing environment variables** — if the server needs an API key, verify the `env` block in `.mcp.json` has the correct variable name and value.
3. **Wrong path** — if `command` is a local script (e.g. `node ./scripts/my-server.js`), make sure the path is relative to the project root.
4. **Port conflict** — some servers use a fixed port. Check if another process is already using it.

After fixing the issue, restart the agent session. The server will be picked up fresh on the next start.

:::callout[warning]
Never commit API keys or tokens directly in `.mcp.json` if the file is tracked by Git. Use environment variables set at the OS level, or load them from a `.env` file that is in `.gitignore`.
:::
