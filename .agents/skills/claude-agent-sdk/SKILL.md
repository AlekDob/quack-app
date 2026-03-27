---
name: claude-agent-sdk
description: |
  Build autonomous AI agents with Claude Agent SDK v0.2.85. Structured outputs, 14 hook events (incl. TeammateIdle/TaskCompleted), MCP tool annotations, Task System, prompt suggestions, taskBudget, reloadPlugins, agentProgressSummaries. Prevents 14 documented errors.

  Use when: building coding agents, SRE systems, security auditors, or troubleshooting CLI not found, structured output validation, session forking errors, MCP config issues, subagent cleanup, task system setup.
user-invocable: true
---

# Claude Agent SDK - Complete Reference & Error Prevention Guide

**Package**: @anthropic-ai/claude-agent-sdk@0.2.85
**Breaking Changes**: v0.1.45 - Structured outputs (Nov 2025), v0.1.0 - No default system prompt, settingSources required

---

## What's New in v0.1.45+ (Nov 2025)

**Major Features:**

### 1. Structured Outputs (v0.1.45, Nov 14, 2025)
- **JSON schema validation** - Guarantees responses match exact schemas
- **`outputFormat` parameter** - Define output structure with JSON schema or Zod
- **Access validated results** - Via `message.structured_output`
- **Beta header required**: `structured-outputs-2025-11-13`
- **Type safety** - Full TypeScript inference with Zod schemas

**Example:**
```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

const schema = z.object({
  summary: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  confidence: z.number().min(0).max(1)
});

const response = query({
  prompt: "Analyze this code review feedback",
  options: {
    model: "claude-sonnet-4-5",
    outputFormat: {
      type: "json_schema",
      json_schema: {
        name: "AnalysisResult",
        strict: true,
        schema: zodToJsonSchema(schema)
      }
    }
  }
});

for await (const message of response) {
  if (message.type === 'result' && message.structured_output) {
    // Guaranteed to match schema
    const validated = schema.parse(message.structured_output);
    console.log(`Sentiment: ${validated.sentiment}`);
  }
}
```

**Zod Compatibility (v0.1.71+):** SDK supports both Zod v3.24.1+ and Zod v4.0.0+ as peer dependencies. Import remains `import { z } from "zod"` for either version.

### 2. Plugins System (v0.1.27)
- **`plugins` array** - Load local plugin paths
- **Custom plugin support** - Extend agent capabilities

### 3. Hooks System (v0.1.0+)

**All 14 Hook Events:**

| Hook | When Fired | Use Case |
|------|------------|----------|
| `PreToolUse` | Before tool execution | Validate, modify, or block tool calls |
| `PostToolUse` | After tool execution | Log results, trigger side effects |
| `Notification` | Agent notifications | Display status updates |
| `UserPromptSubmit` | User prompt received | Pre-process or validate input |
| `SubagentStart` | Subagent spawned | Track delegation, log context |
| `SubagentStop` | Subagent completed | Aggregate results, cleanup |
| `PreCompact` | Before context compaction | Save state before truncation |
| `PermissionRequest` | Permission needed | Custom approval workflows |
| `Stop` | Agent stopping | Cleanup, final logging |
| `SessionStart` | Session begins | Initialize state |
| `SessionEnd` | Session ends | Persist state, cleanup |
| `Error` | Error occurred | Custom error handling |
| `TeammateIdle` | Teammate goes idle (v0.2.33+) | Reassign work, monitor team health |
| `TaskCompleted` | Task finished (v0.2.33+) | Aggregate results, trigger next steps |

**Hook Configuration:**
```typescript
const response = query({
  prompt: "...",
  options: {
    hooks: {
      PreToolUse: async (input) => {
        console.log(`Tool: ${input.toolName}`);
        return { allow: true };  // or { allow: false, message: "..." }
      },
      PostToolUse: async (input) => {
        await logToolUsage(input.toolName, input.result);
      }
    }
  }
});
```

### 4. Additional Options
- **`fallbackModel`** - Automatic model fallback on failures
- **`maxThinkingTokens`** - Control extended thinking budget
- **`strictMcpConfig`** - Strict MCP configuration validation
- **`continue`** - Resume with new prompt (differs from `resume`)
- **`permissionMode: 'plan'`** - New permission mode for planning workflows

### 5. New Thinking API (v0.2.48+)

The `thinkingMode` option has been **removed** from the SDK. Replace it with the new `thinking` config:

**Old API (deprecated):**
```typescript
options.thinkingMode = 'auto'; // No longer exists
```

**New API:**
```typescript
// Adaptive thinking - Claude decides when and how much to think (default for Opus 4.6)
options.thinking = { type: 'adaptive' };

// Fixed thinking budget (older models)
options.thinking = { type: 'enabled', budgetTokens: 10000 };

// Disable extended thinking entirely
options.thinking = { type: 'disabled' };

// Control thinking depth with effort levels
options.effort = 'low' | 'medium' | 'high' | 'max'; // 'max' is Opus 4.6 only
```

**ThinkingConfig Type:**
```typescript
type ThinkingConfig =
  | { type: 'adaptive' }                              // Claude decides (Opus 4.6+ default)
  | { type: 'enabled', budgetTokens?: number }        // Fixed budget
  | { type: 'disabled' };                             // No thinking
```

**Model Discovery (v0.2.49+):**
```typescript
// SDK model info now includes:
// - supportsEffort: boolean
// - supportedEffortLevels: string[]
// - supportsAdaptiveThinking: boolean
```

### 6. Task System (v0.2.19+)
- **`CLAUDE_CODE_ENABLE_TASKS=true`** - Opt into the new task system via env var
- Enables structured task management within agent sessions
- Use via `env` option: `env: { CLAUDE_CODE_ENABLE_TASKS: "true" }`

### 7. Model Support (v0.2.45+)
- **Claude Sonnet 4.6** added as supported model
- Available models: `claude-opus-4-5`, `claude-sonnet-4-5`, `claude-sonnet-4-6`, `claude-haiku-4-5`
- AgentDefinition `model` field: `'sonnet' | 'opus' | 'haiku' | 'inherit'`

📚 **Docs**: https://platform.claude.com/docs/en/agent-sdk/structured-outputs

---

## The Complete Claude Agent SDK Reference

## Table of Contents

1. [Core Query API](#core-query-api)
2. [Tool Integration](#tool-integration-built-in--custom)
3. [MCP Servers](#mcp-servers-model-context-protocol)
4. [Subagent Orchestration](#subagent-orchestration)
5. [Session Management](#session-management)
6. [Permission Control](#permission-control)
7. [Sandbox Settings](#sandbox-settings-security-critical)
8. [File Checkpointing](#file-checkpointing)
9. [Filesystem Settings](#filesystem-settings)
10. [Query Object Methods](#query-object-methods)
11. [Message Types & Streaming](#message-types--streaming)
12. [Error Handling](#error-handling)
13. [Known Issues](#known-issues-prevention)

---

## Core Query API

**Key signature:**
```typescript
query(prompt: string | AsyncIterable<SDKUserMessage>, options?: Options)
  -> AsyncGenerator<SDKMessage>
```

**Critical Options:**
- `outputFormat` - Structured JSON schema validation (v0.1.45+)
- `settingSources` - Filesystem settings loading ('user'|'project'|'local')
- `canUseTool` - Custom permission logic callback
- `agents` - Programmatic subagent definitions
- `mcpServers` - MCP server configuration
- `permissionMode` - 'default'|'acceptEdits'|'bypassPermissions'|'plan'
- `betas` - Enable beta features (e.g., 1M context window)
- `sandbox` - Sandbox settings for secure execution
- `enableFileCheckpointing` - Enable file state snapshots
- `systemPrompt` - System prompt (string or preset object)
- `sessionId` - Custom UUID for conversations instead of auto-generated (v0.2.33+)
- `debug` / `debugFile` - Programmatic debug logging control (v0.2.30+)
- `additionalDirectories` - Load CLAUDE.md from extra directories (v0.2.20+, requires `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1` in `env`)

### Extended Context (1M Tokens)

Enable 1 million token context window:

```typescript
const response = query({
  prompt: "Analyze this large codebase",
  options: {
    betas: ['context-1m-2025-08-07'],  // Enable 1M context
    model: "claude-sonnet-4-5"
  }
});
```

### System Prompt Configuration

Two forms of systemPrompt:

```typescript
// 1. Simple string
systemPrompt: "You are a helpful coding assistant."

// 2. Preset with optional append (preserves Claude Code defaults)
systemPrompt: {
  type: 'preset',
  preset: 'claude_code',
  append: "\n\nAdditional context: Focus on security."
}
```

**Use preset form** when you want Claude Code's default behaviors plus custom additions.

---

## Tool Integration (Built-in + Custom)

**Tool Control:**
- `allowedTools` - Whitelist (takes precedence)
- `disallowedTools` - Blacklist
- `canUseTool` - Custom permission callback (see Permission Control section)

**Built-in Tools:** Read, Write, Edit, Bash, Grep, Glob, WebSearch, WebFetch, Task, NotebookEdit, BashOutput, KillBash, ListMcpResources, ReadMcpResource, AskUserQuestion

### AskUserQuestion Tool (v0.1.71+)

Enable user interaction during agent execution:

```typescript
const response = query({
  prompt: "Review and refactor the codebase",
  options: {
    allowedTools: ["Read", "Write", "Edit", "AskUserQuestion"]
  }
});

// Agent can now ask clarifying questions
// Questions appear in message stream as tool_call with name "AskUserQuestion"
```

**Use cases:**
- Clarify ambiguous requirements mid-task
- Get user approval before destructive operations
- Present options and get selection

### Tools Configuration (v0.1.57+)

**Three forms of tool configuration:**

```typescript
// 1. Exact allowlist (string array)
tools: ["Read", "Write", "Grep"]

// 2. Disable all tools (empty array)
tools: []

// 3. Preset with defaults (object form)
tools: { type: 'preset', preset: 'claude_code' }
```

**Note:** `allowedTools` and `disallowedTools` still work but `tools` provides more flexibility.

---

## MCP Servers (Model Context Protocol)

**Server Types:**
- **In-process** - `createSdkMcpServer()` with `tool()` definitions
- **External** - stdio, HTTP, SSE transport

**Tool Definition:**
```typescript
tool(name: string, description: string, zodSchema, handler)
```

**Tool Annotations (v0.2.27+):**
```typescript
tool("read_data", "Read data from source", schema, handler, {
  annotations: {
    readOnlyHint: true,       // Tool only reads, doesn't modify
    destructiveHint: false,   // Tool is not destructive
    openWorldHint: true,      // Tool accesses external resources
    idempotentHint: true      // Safe to retry without side effects
  }
})
```

**Handler Return:**
```typescript
{ content: [{ type: "text", text: "..." }], isError?: boolean }
```

### External MCP Servers (stdio)

```typescript
const response = query({
  prompt: "List files and analyze Git history",
  options: {
    mcpServers: {
      // Filesystem server
      "filesystem": {
        command: "npx",
        args: ["@modelcontextprotocol/server-filesystem"],
        env: {
          ALLOWED_PATHS: "/Users/developer/projects:/tmp"
        }
      },
      // Git operations server
      "git": {
        command: "npx",
        args: ["@modelcontextprotocol/server-git"],
        env: {
          GIT_REPO_PATH: "/Users/developer/projects/my-repo"
        }
      }
    },
    allowedTools: [
      "mcp__filesystem__list_files",
      "mcp__filesystem__read_file",
      "mcp__git__log",
      "mcp__git__diff"
    ]
  }
});
```

### External MCP Servers (HTTP/SSE)

```typescript
const response = query({
  prompt: "Analyze data from remote service",
  options: {
    mcpServers: {
      "remote-service": {
        url: "https://api.example.com/mcp",
        headers: {
          "Authorization": "Bearer your-token-here",
          "Content-Type": "application/json"
        }
      }
    },
    allowedTools: ["mcp__remote-service__analyze"]
  }
});
```

### MCP Tool Naming Convention

**Format**: `mcp__<server-name>__<tool-name>`

**CRITICAL:**
- Server name and tool name MUST match configuration
- Use double underscores (`__`) as separators
- Include in `allowedTools` array

**Examples:** `mcp__weather-service__get_weather`, `mcp__filesystem__read_file`

---

## Subagent Orchestration

### AgentDefinition Type

```typescript
type AgentDefinition = {
  description: string;        // When to use this agent
  prompt: string;             // System prompt for agent
  tools?: string[];           // Allowed tools (optional)
  model?: 'sonnet' | 'opus' | 'haiku' | 'inherit';  // Model (optional)
  skills?: string[];          // Skills to load (v0.2.10+)
  maxTurns?: number;          // Maximum turns before stopping (v0.2.10+)
}
```

**Field Details:**

- **description**: When to use agent (used by main agent for delegation)
- **prompt**: System prompt (defines role, inherits main context)
- **tools**: Allowed tools (if omitted, inherits from main agent)
- **model**: Model override (`haiku`/`sonnet`/`opus`/`inherit`)
- **skills**: Skills to load for agent (v0.2.10+)
- **maxTurns**: Limit agent to N turns before returning control (v0.2.10+)

**Usage:**
```typescript
agents: {
  "security-checker": {
    description: "Security audits and vulnerability scanning",
    prompt: "You check security. Scan for secrets, verify OWASP compliance.",
    tools: ["Read", "Grep", "Bash"],
    model: "sonnet",
    skills: ["security-best-practices"],  // Load specific skills
    maxTurns: 10  // Limit to 10 turns
  }
}
```

### ⚠️ Subagent Cleanup Warning

**Known Issue**: Subagents don't stop when parent agent stops ([Issue #132](https://github.com/anthropics/claude-agent-sdk-typescript/issues/132))

When a parent agent is stopped (via cancellation or error), spawned subagents continue running as orphaned processes. This can lead to:
- Resource leaks
- Continued tool execution after parent stopped
- RAM out-of-memory in recursive scenarios ([Claude Code Issue #4850](https://github.com/anthropics/claude-code/issues/4850))

**Workaround**: Implement cleanup in Stop hooks:

```typescript
const response = query({
  prompt: "Deploy to production",
  options: {
    agents: {
      "deployer": {
        description: "Handle deployments",
        prompt: "Deploy the application",
        tools: ["Bash"]
      }
    },
    hooks: {
      Stop: async (input) => {
        // Manual cleanup of spawned processes
        console.log("Parent stopped - cleaning up subagents");
        // Implement process tracking and termination
      }
    }
  }
});
```

**Enhancement Tracking**: [Issue #142](https://github.com/anthropics/claude-agent-sdk-typescript/issues/142) proposes auto-termination

---

## Session Management

**Options:**
- `resume: sessionId` - Continue previous session
- `forkSession: true` - Create new branch from session
- `continue: prompt` - Resume with new prompt (differs from `resume`)

**Session Forking Pattern (Unique Capability):**

```typescript
// Explore alternative without modifying original
const forked = query({
  prompt: "Try GraphQL instead of REST",
  options: {
    resume: sessionId,
    forkSession: true  // Creates new branch, original session unchanged
  }
});
```

**Capture Session ID:**
```typescript
for await (const message of response) {
  if (message.type === 'system' && message.subtype === 'init') {
    sessionId = message.session_id;  // Save for later resume/fork
  }
}
```

### V2 Session APIs (Preview - v0.1.54+)

**Simpler multi-turn conversation pattern:**

```typescript
import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
  unstable_v2_prompt
} from "@anthropic-ai/claude-agent-sdk";

// Create a new session
const session = await unstable_v2_createSession({
  model: "claude-sonnet-4-5",
  workingDirectory: process.cwd(),
  allowedTools: ["Read", "Grep", "Glob"]
});

// Send prompts and stream responses
const stream = unstable_v2_prompt(session, "Analyze the codebase structure");
for await (const message of stream) {
  console.log(message);
}

// Continue conversation in same session
const stream2 = unstable_v2_prompt(session, "Now suggest improvements");
for await (const message of stream2) {
  console.log(message);
}

// Resume a previous session
const resumedSession = await unstable_v2_resumeSession(session.sessionId);
```

**Note:** V2 APIs are in preview (`unstable_` prefix). The `.receive()` method was renamed to `.stream()` in v0.1.72.

---

## Permission Control

**Permission Modes:**
```typescript
type PermissionMode = "default" | "acceptEdits" | "bypassPermissions" | "plan";
```

- `default` - Standard permission checks
- `acceptEdits` - Auto-approve file edits
- `bypassPermissions` - Skip ALL checks (use in CI/CD only)
- `plan` - Planning mode (v0.1.45+)

### Custom Permission Logic

```typescript
const response = query({
  prompt: "Deploy application to production",
  options: {
    permissionMode: "default",
    canUseTool: async (toolName, input) => {
      // Allow read-only operations
      if (['Read', 'Grep', 'Glob'].includes(toolName)) {
        return { behavior: "allow" };
      }

      // Deny destructive bash commands
      if (toolName === 'Bash') {
        const dangerous = ['rm -rf', 'dd if=', 'mkfs', '> /dev/'];
        if (dangerous.some(pattern => input.command.includes(pattern))) {
          return {
            behavior: "deny",
            message: "Destructive command blocked for safety"
          };
        }
      }

      // Require confirmation for deployments
      if (input.command?.includes('deploy') || input.command?.includes('kubectl apply')) {
        return {
          behavior: "ask",
          message: "Confirm deployment to production?"
        };
      }

      // Allow by default
      return { behavior: "allow" };
    }
  }
});
```

### canUseTool Callback

```typescript
type CanUseToolCallback = (
  toolName: string,
  input: any
) => Promise<PermissionDecision>;

type PermissionDecision =
  | { behavior: "allow" }
  | { behavior: "deny"; message?: string }
  | { behavior: "ask"; message?: string };
```

**Examples:**

```typescript
// Block all file writes
canUseTool: async (toolName, input) => {
  if (toolName === 'Write' || toolName === 'Edit') {
    return { behavior: "deny", message: "No file modifications allowed" };
  }
  return { behavior: "allow" };
}

// Require confirmation for specific files
canUseTool: async (toolName, input) => {
  const sensitivePaths = ['/etc/', '/root/', '.env', 'credentials.json'];
  if ((toolName === 'Write' || toolName === 'Edit') &&
      sensitivePaths.some(path => input.file_path?.includes(path))) {
    return {
      behavior: "ask",
      message: `Modify sensitive file ${input.file_path}?`
    };
  }
  return { behavior: "allow" };
}

// Log all tool usage
canUseTool: async (toolName, input) => {
  console.log(`Tool requested: ${toolName}`, input);
  await logToDatabase(toolName, input);
  return { behavior: "allow" };
}
```

---

## Sandbox Settings (Security-Critical)

**Enable sandboxed execution for Bash commands:**

```typescript
const response = query({
  prompt: "Run system diagnostics",
  options: {
    sandbox: {
      enabled: true,
      autoAllowBashIfSandboxed: true,  // Auto-approve bash in sandbox
      excludedCommands: ["rm", "dd", "mkfs"],  // Never auto-approve these
      allowUnsandboxedCommands: false  // Deny unsandboxable commands
    }
  }
});
```

### SandboxSettings Type

```typescript
type SandboxSettings = {
  enabled: boolean;
  autoAllowBashIfSandboxed?: boolean;  // Default: false
  excludedCommands?: string[];
  allowUnsandboxedCommands?: boolean;  // Default: false
  network?: NetworkSandboxSettings;
  ignoreViolations?: SandboxIgnoreViolations;
};

type NetworkSandboxSettings = {
  enabled: boolean;
  proxyUrl?: string;  // HTTP proxy for network requests
};
```

**Key Options:**
- `enabled` - Activate sandbox isolation
- `autoAllowBashIfSandboxed` - Skip permission prompts for safe bash commands
- `excludedCommands` - Commands that always require permission
- `allowUnsandboxedCommands` - Allow commands that can't be sandboxed (risky)
- `network.proxyUrl` - Route network through proxy for monitoring

**Best Practice:** Always use sandbox in production agents handling untrusted input.

---

## File Checkpointing

**Enable file state snapshots for rollback capability:**

```typescript
const response = query({
  prompt: "Refactor the authentication module",
  options: {
    enableFileCheckpointing: true  // Enable file snapshots
  }
});

// Later: rewind file changes to a specific point
for await (const message of response) {
  if (message.type === 'user' && message.uuid) {
    // Can rewind to this point later
    const userMessageUuid = message.uuid;

    // To rewind (call on Query object)
    await response.rewindFiles(userMessageUuid);
  }
}
```

**Use cases:**
- Undo failed refactoring attempts
- A/B test code changes
- Safe exploration of alternatives

---

## Filesystem Settings

**Setting Sources:**
```typescript
type SettingSource = 'user' | 'project' | 'local';
```

- `user` - `~/.claude/settings.json` (global)
- `project` - `.claude/settings.json` (team-shared)
- `local` - `.claude/settings.local.json` (gitignored overrides)

**Default:** NO settings loaded (`settingSources: []`)

### Settings Priority

When multiple sources loaded, settings merge in this order (highest priority first):

1. **Programmatic options** (passed to `query()`) - Always win
2. **Local settings** (`.claude/settings.local.json`)
3. **Project settings** (`.claude/settings.json`)
4. **User settings** (`~/.claude/settings.json`)

**Example:**

```typescript
// .claude/settings.json
{
  "allowedTools": ["Read", "Write", "Edit"]
}

// .claude/settings.local.json
{
  "allowedTools": ["Read"]  // Overrides project settings
}

// Programmatic
const response = query({
  options: {
    settingSources: ["project", "local"],
    allowedTools: ["Read", "Grep"]  // ← This wins
  }
});

// Actual allowedTools: ["Read", "Grep"]
```

**Best Practice:** Use `settingSources: ["project"]` in CI/CD for consistent behavior.

---

## Query Object Methods

The `query()` function returns a `Query` object with these methods:

```typescript
const q = query({ prompt: "..." });

// Async iteration (primary usage)
for await (const message of q) { ... }

// Runtime model control
await q.setModel("claude-opus-4-5");           // Change model mid-session
await q.setMaxThinkingTokens(4096);            // Set thinking budget

// Introspection
const models = await q.supportedModels();     // List available models
const commands = await q.supportedCommands(); // List available commands
const account = await q.accountInfo();        // Get account details

// MCP server management
const status = await q.mcpServerStatus();     // Check MCP server status
// Returns: { [serverName]: { status: 'connected' | 'failed' | 'disabled', config?, scope?, tools?, error? } }
await q.reconnectMcpServer("server-name");    // Reconnect a failed MCP server (v0.2.21+)
await q.toggleMcpServer("server-name", true); // Enable/disable MCP server (v0.2.21+)

// Prompt suggestions (v0.2.47+)
const suggestions = await q.promptSuggestion(); // Get prompt suggestions based on conversation context

// Lifecycle control
await q.close();                               // Forcefully terminate running query (v0.2.15+)

// File operations (requires enableFileCheckpointing)
await q.rewindFiles(userMessageUuid);         // Rewind to checkpoint
```

**Use cases:**
- Dynamic model switching based on task complexity
- Monitoring and managing MCP server health at runtime
- Adjusting thinking budget for reasoning tasks
- Generating follow-up prompt suggestions for users
- Gracefully terminating long-running queries

---

## Message Types & Streaming

**Message Types:**
- `system` - Session init/completion (includes `session_id`)
- `system` (subtype `task_started`) - Subagent task registered (v0.2.45+)
- `assistant` - Agent responses
- `tool_call` - Tool execution requests
- `tool_result` - Tool execution results
- `task_notification` - Task completion with `tool_use_id` for correlation (v0.2.47+)
- `error` - Error messages
- `result` - Final result (includes `structured_output` for v0.1.45+, `stop_reason` for v0.2.31+)

**Result Stop Reasons (v0.2.31+):**

`SDKResultSuccess` and `SDKResultError` now include a `stop_reason` field:
```typescript
if (message.type === 'result') {
  console.log(message.stop_reason);
  // "end_turn" | "max_tokens" | "stop_sequence" | "tool_use" | etc.
}
```

**Streaming Pattern:**
```typescript
for await (const message of response) {
  if (message.type === 'system' && message.subtype === 'init') {
    sessionId = message.session_id;  // Capture for resume/fork
  }
  if (message.type === 'system' && message.subtype === 'task_started') {
    console.log("Subagent task registered");  // v0.2.45+
  }
  if (message.type === 'result' && message.structured_output) {
    const validated = schema.parse(message.structured_output);
    console.log(`Stop reason: ${message.stop_reason}`);  // v0.2.31+
  }
}
```

---

## Error Handling

**Error Codes:**

| Error Code | Cause | Solution |
|------------|-------|----------|
| `CLI_NOT_FOUND` | Claude Code not installed | Install: `npm install -g @anthropic-ai/claude-code` |
| `AUTHENTICATION_FAILED` | Invalid API key | Check ANTHROPIC_API_KEY env var |
| `RATE_LIMIT_EXCEEDED` | Too many requests | Implement retry with backoff |
| `CONTEXT_LENGTH_EXCEEDED` | Prompt too long | Use session compaction, reduce context |
| `PERMISSION_DENIED` | Tool blocked | Check permissionMode, canUseTool |
| `TOOL_EXECUTION_FAILED` | Tool error | Check tool implementation |
| `SESSION_NOT_FOUND` | Invalid session ID | Verify session ID |
| `MCP_SERVER_FAILED` | Server error | Check server configuration |

---

## Known Issues Prevention

This skill prevents **14** documented issues:

### Issue #1: CLI Not Found Error
**Error**: `"Claude Code CLI not installed"`
**Source**: SDK requires Claude Code CLI
**Why It Happens**: CLI not installed globally
**Prevention**: Install before using SDK: `npm install -g @anthropic-ai/claude-code`

### Issue #2: Authentication Failed
**Error**: `"Invalid API key"`
**Source**: Missing or incorrect ANTHROPIC_API_KEY
**Why It Happens**: Environment variable not set
**Prevention**: Always set `export ANTHROPIC_API_KEY="sk-ant-..."`

### Issue #3: Permission Denied Errors
**Error**: Tool execution blocked
**Source**: `permissionMode` restrictions
**Why It Happens**: Tool not allowed by permissions
**Prevention**: Use `allowedTools` or custom `canUseTool` callback

### Issue #4: Context Length Exceeded (Session-Breaking)
**Error**: `"Prompt too long"`
**Source**: Input exceeds model context window ([Issue #138](https://github.com/anthropics/claude-agent-sdk-typescript/issues/138))
**Why It Happens**: Large codebase, long conversations

**⚠️ Critical Behavior**: Once a session hits context limit:
1. All subsequent requests to that session return "Prompt too long"
2. `/compact` command fails with same error
3. **Session is permanently broken and must be abandoned**

**Prevention Strategies**:

```typescript
// 1. Proactive session forking (create checkpoints before hitting limit)
const checkpoint = query({
  prompt: "Checkpoint current state",
  options: {
    resume: sessionId,
    forkSession: true  // Create branch before hitting limit
  }
});

// 2. Monitor time and rotate sessions proactively
const MAX_SESSION_TIME = 80 * 60 * 1000;  // 80 minutes (before 90-min crash)
let sessionStartTime = Date.now();

function shouldRotateSession() {
  return Date.now() - sessionStartTime > MAX_SESSION_TIME;
}

// 3. Start new sessions before hitting context limits
if (shouldRotateSession()) {
  const summary = await getSummary(currentSession);
  const newSession = query({
    prompt: `Continue with context: ${summary}`
  });
  sessionStartTime = Date.now();
}
```

**Note**: SDK auto-compacts, but if limit is reached, session becomes unrecoverable

### Issue #5: Tool Execution Timeout
**Error**: Tool doesn't respond
**Source**: Long-running tool execution
**Why It Happens**: Tool takes too long (>5 minutes default)
**Prevention**: Implement timeout handling in tool implementations

### Issue #6: Session Not Found
**Error**: `"Invalid session ID"`
**Source**: Session expired or invalid
**Why It Happens**: Session ID incorrect or too old
**Prevention**: Capture `session_id` from `system` init message

### Issue #7: MCP Server Connection Failed
**Error**: Server not responding
**Source**: Server not running or misconfigured
**Why It Happens**: Command/URL incorrect, server crashed
**Prevention**: Test MCP server independently, verify command/URL

### Issue #8: Subagent Definition Errors
**Error**: Invalid AgentDefinition
**Source**: Missing required fields
**Why It Happens**: `description` or `prompt` missing
**Prevention**: Always include `description` and `prompt` fields

### Issue #9: Settings File Not Found
**Error**: `"Cannot read settings"`
**Source**: Settings file doesn't exist
**Why It Happens**: `settingSources` includes non-existent file
**Prevention**: Check file exists before including in sources

### Issue #10: Tool Name Collision
**Error**: Duplicate tool name
**Source**: Multiple tools with same name
**Why It Happens**: Two MCP servers define same tool name
**Prevention**: Use unique tool names, prefix with server name

### Issue #11: Zod Schema Validation Error
**Error**: Invalid tool input
**Source**: Input doesn't match Zod schema
**Why It Happens**: Agent provided wrong data type
**Prevention**: Use descriptive Zod schemas with `.describe()`

### Issue #12: Filesystem Permission Denied
**Error**: Cannot access path
**Source**: Restricted filesystem access
**Why It Happens**: Path outside `workingDirectory` or no permissions
**Prevention**: Set correct `workingDirectory`, check file permissions

### Issue #13: MCP Server Config Missing `type` Field
**Error**: `"Claude Code process exited with code 1"` (cryptic, no context)
**Source**: [GitHub Issue #131](https://github.com/anthropics/claude-agent-sdk-typescript/issues/131)
**Why It Happens**: URL-based MCP servers require explicit `type: "http"` or `type: "sse"` field
**Prevention**: Always specify transport type for URL-based MCP servers

```typescript
// ❌ Wrong - missing type field (causes cryptic exit code 1)
mcpServers: {
  "my-server": {
    url: "https://api.example.com/mcp"
  }
}

// ✅ Correct - type field required for URL-based servers
mcpServers: {
  "my-server": {
    url: "https://api.example.com/mcp",
    type: "http"  // or "sse" for Server-Sent Events
  }
}
```

**Diagnostic Clue**: If you see "process exited with code 1" with no other context, check your MCP server configuration for missing `type` fields.

### Issue #14: MCP Tool Result with Unicode Line Separators
**Error**: JSON parse error, agent hangs
**Source**: [GitHub Issue #137](https://github.com/anthropics/claude-agent-sdk-typescript/issues/137)
**Why It Happens**: Unicode U+2028 (line separator) and U+2029 (paragraph separator) are valid in JSON but break JavaScript parsing
**Prevention**: Escape these characters in MCP tool results

```typescript
// MCP tool handler - sanitize external data
tool("fetch_content", "Fetch text content", {}, async (args) => {
  const content = await fetchExternalData();

  // ✅ Sanitize Unicode line/paragraph separators
  const sanitized = content
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');

  return {
    content: [{ type: "text", text: sanitized }]
  };
});
```

**When This Matters**: External data sources (APIs, web scraping, user input) that may contain these characters

**Related**: [MCP Python SDK Issue #1356](https://github.com/modelcontextprotocol/python-sdk/issues/1356)

---

## Official Documentation

- **Agent SDK Overview**: https://platform.claude.com/docs/en/api/agent-sdk/overview
- **TypeScript API**: https://platform.claude.com/docs/en/api/agent-sdk/typescript
- **Structured Outputs**: https://platform.claude.com/docs/en/agent-sdk/structured-outputs
- **GitHub (TypeScript)**: https://github.com/anthropics/claude-agent-sdk-typescript
- **CHANGELOG**: https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md

---

**Token Efficiency**:
- **Without skill**: ~15,000 tokens (MCP setup, permission patterns, session APIs, sandbox config, hooks, structured outputs, error handling)
- **With skill**: ~4,500 tokens (comprehensive v0.2.12 coverage + error prevention + advanced patterns)
- **Savings**: ~70% (~10,500 tokens)

**Errors prevented**: 14 documented issues with exact solutions (including 2 community-sourced gotchas)
**Key value**: V2 Session APIs, Sandbox Settings, File Checkpointing, Query methods (close, reconnectMcpServer, toggleMcpServer, promptSuggestion), AskUserQuestion tool, structured outputs (v0.1.45+), session forking, canUseTool patterns, complete hooks system (14 events incl. TeammateIdle/TaskCompleted), Zod v4 support, subagent cleanup patterns, MCP tool annotations, Task System, stop_reason, debug logging, Sonnet 4.6 support

---

**Last verified**: 2026-02-22 | **Skill version**: 4.1.0 | **Changes**: Updated to SDK v0.2.48+ — added New Thinking API section: `thinkingMode` removed, replaced by `thinking` config (`adaptive`/`enabled`/`disabled`), `effort` levels (`low`/`medium`/`high`/`max`), model discovery fields for thinking support (v0.2.49+)
