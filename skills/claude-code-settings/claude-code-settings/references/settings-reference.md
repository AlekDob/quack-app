# Claude Code Settings Reference

Complete schema reference for `.claude/settings.json` configuration.

Source: https://code.claude.com/docs/en/settings

## File Locations & Precedence

| Level | Location | Scope | Version Control |
|-------|----------|-------|-----------------|
| Project | `.claude/settings.json` | Shared with team | Yes (commit) |
| User-project | `~/.claude/projects/<path-hash>/settings.json` | Personal per-project | No |
| User global | `~/.claude/settings.json` | All projects | No |

**Merge order** (lowest to highest priority): project < user-project < user-global.

The `<path-hash>` for user-project settings is derived from the absolute project path. Use `claude config` CLI to manage these.

## Complete Settings Schema

```json
{
  "permissions": {
    "allow": ["<ToolRule>", ...],
    "deny": ["<ToolRule>", ...]
  },
  "hooks": {
    "<event_name>": {
      "command": "string",
      "timeout": 30000
    }
  },
  "env": {
    "KEY": "value"
  }
}
```

## Permission Rules

### Rule Syntax

```
ToolName(glob_pattern)
```

Where `ToolName` is one of the tool identifiers and `glob_pattern` is a file path glob.

### Available Tool Identifiers

| Tool ID | Description | Example |
|---------|-------------|---------|
| `Read` | Read tool, cat, head, tail | `Read(./secrets/**)` |
| `Edit` | Edit tool, sed, awk | `Edit(./generated/**)` |
| `Write` | Write tool | `Write(./dist/**)` |
| `Bash` | Shell command execution | `Bash(rm -rf *)` |
| `WebFetch` | URL fetching | `WebFetch(https://internal.*)` |
| `mcp__<server>__<tool>` | MCP server tool | `mcp__memory__save_note` |

### Glob Pattern Rules

- `./` prefix = relative to project root
- `*` = matches any single path segment
- `**` = matches any depth of path segments
- Patterns follow standard glob syntax

### Allow vs Deny

- `deny` rules are checked first — if a path matches deny, the tool is blocked
- `allow` rules can override deny rules for specific paths
- If neither matches, the tool's default permission mode applies

### Bash Permission Rules

Bash rules match against the command string:

```json
{
  "permissions": {
    "allow": [
      "Bash(npm test)",
      "Bash(npm run build)",
      "Bash(git *)"
    ],
    "deny": [
      "Bash(rm -rf *)",
      "Bash(curl *)"
    ]
  }
}
```

## Hook Events

Hooks run shell commands in response to Claude Code events.

| Event | Trigger |
|-------|---------|
| `PreToolUse` | Before any tool execution |
| `PostToolUse` | After any tool execution |
| `Notification` | When Claude sends a notification |
| `Stop` | When Claude stops |

```json
{
  "hooks": {
    "PreToolUse": {
      "command": "my-validator.sh $TOOL_NAME $TOOL_INPUT",
      "timeout": 10000
    },
    "PostToolUse": {
      "command": "my-logger.sh $TOOL_NAME $TOOL_RESULT",
      "timeout": 5000
    }
  }
}
```

## Environment Variables

Set environment variables for Claude Code sessions:

```json
{
  "env": {
    "NODE_ENV": "development",
    "DEBUG": "true"
  }
}
```

These are injected into the shell environment for all Bash tool calls.

## CLI Management

```bash
# View current config
claude config list

# Set a value
claude config set permissions.deny '["Read(./dist/**)"]'

# Add to array
claude config add permissions.deny "Read(./images/**)"

# Remove from array
claude config remove permissions.deny "Read(./images/**)"
```

## Sandbox Mode

Claude Code supports sandboxed execution:

| Mode | Network | Filesystem | Use Case |
|------|---------|------------|----------|
| `full` | Allowed | Allowed | Default development |
| `network-only` | Blocked | Allowed | Offline-safe ops |
| `sandbox` | Blocked | Read-only | Maximum safety |

Configure via CLI flag: `claude --sandbox=network-only`

## Best Practices

1. **Start with deny rules** — exclude known large/binary directories
2. **Use project-level settings** for team-shared exclusions (`.claude/settings.json`)
3. **Use user-project settings** for personal preferences
4. **Don't over-exclude** — never deny `src/`, `lib/`, `tests/`, or other code directories
5. **Review periodically** — as project structure changes, update exclusions
6. **Document exclusions** — add a note in CLAUDE.md explaining why directories are excluded
