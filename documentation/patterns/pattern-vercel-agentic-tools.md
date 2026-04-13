---
type: pattern
project: quack-app
created: 2026-04-13
last_verified: 2026-04-13
tags: [vercel-ai-sdk, tool-use, agentic, openai, google]
---

# Pattern: Vercel AI SDK Agentic Tool Use

## Problem

Non-Anthropic models (GPT-5.3-Codex, o3, Gemini, etc.) could only do simple chat through the Vercel AI SDK path. To be useful as coding assistants, they need filesystem access — read files, write files, list directories, search code.

## Solution

Use the Vercel AI SDK's built-in agentic loop: `generateText()` with `tools` and `maxSteps`. The SDK handles the tool-call-execute-feed-back cycle automatically — no manual loop required.

Pattern source: **Meow project** (same generateText + tools + maxSteps approach).

## Core Pattern

```js
import { generateText } from 'ai';

const result = await generateText({
  model,
  system: systemPrompt,
  messages,
  tools: buildVercelTools(projectRoot),
  maxSteps: 10,
  onStepFinish: ({ toolCalls }) => {
    // emit tool_use events for frontend display
  },
});
```

## Critical: inputSchema, NOT parameters

In Vercel AI SDK v6, tool schemas MUST use `inputSchema` (not `parameters`):

```js
// CORRECT — generates proper JSON Schema for OpenAI
const fileRead = tool({
  description: 'Read a file',
  inputSchema: z.object({
    path: z.string().describe('Relative path'),
  }),
  execute: async ({ path }) => { ... },
});

// WRONG — sends raw Zod object, OpenAI gets type: "None"
const fileRead = tool({
  description: 'Read a file',
  parameters: z.object({ ... }),  // DO NOT USE
  execute: async ({ path }) => { ... },
});
```

With `parameters`, the Zod schema is NOT converted to JSON Schema. OpenAI receives `type: "None"` and rejects the tool definition.

## Critical: stopWhen, NOT maxSteps

`maxSteps` does NOT exist in Vercel AI SDK v6. It is silently ignored. The default is `stepCountIs(1)` which means only 1 LLM call — the model calls a tool but never gets to synthesize the result.

```js
// CORRECT — enables multi-step: tool call → execute → model reads result → responds
const result = await generateText({
  model, tools, messages,
  stopWhen: stepCountIs(10),
});

// WRONG — maxSteps is silently ignored, SDK defaults to stepCountIs(1)
const result = await generateText({
  model, tools, messages,
  maxSteps: 10,  // DO NOT USE — does nothing in v6
});
```

## Tool Factory

`buildVercelTools(projectRoot)` returns four tools scoped to the given project directory:

| Tool | Description | inputSchema fields |
|------|-------------|--------|
| `fileRead` | Read file contents (max 512KB) | `{ path: string }` |
| `fileWrite` | Write content to a file | `{ path: string, content: string }` |
| `listDirectory` | List directory contents (max 200 entries) | `{ path: string }` |
| `searchFiles` | Recursive grep with glob filter (max 30 results) | `{ pattern: string, glob: string }` |

All tools use Zod schemas via `inputSchema` for automatic JSON Schema conversion.

## Mode Selection

Automatic routing in `stream-vercel.js`:

```
if (registryEntry.toolUse === true && cwd is provided)
  -> runAgenticQuery()   // generateText + tools
else
  -> runChatQuery()      // streamText (no tools, streaming)
```

## Agentic Fallback

If `generateText()` with tools fails (e.g. provider doesn't support tool schemas), the code automatically falls back to `streamText()` without tools:

```js
try {
  await generateText({ model, tools, maxSteps: 10, ... });
} catch (agenticErr) {
  // Fallback to chat mode — user always gets a response
  const chatResult = streamText({ model, messages, ... });
}
```

## Security: safePath

All filesystem tools validate paths through `safePath(projectRoot, relativePath)`:

1. **Empty path rejection** — `safePath` throws on empty/blank paths
2. **Trailing separator check** — `rootWithSep = root + '/'` prevents sibling-dir escape (`/project-evil`)
3. **Path resolution** — `path.resolve()` collapses `..` traversals
4. **Prefix check** — resolved path must start with `rootWithSep` or equal root exactly
5. **File size limits** — 512KB read, grep skips large files

## Logging

The Vercel path uses `vlog()` which writes to both:
- `console.error('[INFO] [DAEMON:VERCEL] ...')` — captured by Rust at info level (visible in console)
- `diag()` — writes to `~/.quack/daemon-diag.log` (file, always available)

## Key Files

| File | Role |
|------|------|
| `src-tauri/node-sdk/vercel-tools.js` | Tool definitions (Zod + inputSchema, safePath, grepFiles) |
| `src-tauri/node-sdk/stream-vercel.js` | Agentic mode (generateText) + chat mode (streamText) + fallback |
| `src-tauri/node-sdk/stream-daemon.js` | Entry point; passes `cwd`, vlog routing |
| `src-tauri/node-sdk/model-registry.js` | Model catalog with `toolUse` flag per entry |

## Critical: call.input, NOT call.args

In Vercel AI SDK v6, `onStepFinish` provides `step.toolCalls[i]` where arguments are in `call.input` (NOT `call.args`). `call.args` is `undefined`.

```js
// CORRECT
const callArgs = call.input || {};

// WRONG — undefined in v6
const callArgs = call.args || {};
```

## Tool Event Protocol (Frontend Compatibility)

The frontend expects Claude SDK event format. For each tool call, emit TWO events:

1. **tool_use** (type: assistant) — starts loading spinner
2. **tool_result** (type: user, matching tool_use_id) — stops spinner, shows result

Tool names must be mapped to Claude SDK conventions:
- `fileWrite` → `Write`, `fileRead` → `Read`, `listDirectory` → `Glob`, `searchFiles` → `Grep`
- `input.path` must be mapped to `input.file_path` for EditSummaryBar/ChangesPanel detection

## Conversation History

The daemon maintains in-memory conversation history for Vercel sessions:
- Key: session ID extracted from queryId (`session-XXXXX`)
- Max 20 messages (10 user + 10 assistant)
- Resets on daemon restart
- Enables multi-turn context (e.g. "read this file" → "now modify it")

## System Prompt

Built from project's CLAUDE.md (truncated, agent rules stripped) + tool-first instructions.
Tool instructions have CRITICAL priority — placed before CLAUDE.md content to prevent
agent rules like "explain before acting" from overriding tool-use behavior.

## Constraints

- `MAX_AGENTIC_STEPS = 10` — prevents runaway tool loops
- No streaming in agentic mode — `generateText` returns full result
- File size cap: 512KB for reads, grep skips files over 512KB
- `searchFiles` does recursive walk in JS (no external binary dependency)
- `IGNORED_DIRS` (module-level Set): node_modules, .git, target, dist, build, .next, .nuxt, .cache, coverage, __pycache__
