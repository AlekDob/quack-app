---
type: gotcha
project: quack-app
created: 2026-04-13
last_verified: 2026-04-13
tags: [vercel-ai-sdk, tool-use, zod, openai, schema]
---

# Vercel AI SDK v6: tool() requires inputSchema, not parameters

## Problem

When defining tools with `tool()` from the Vercel AI SDK v6, using `parameters` instead of `inputSchema` causes OpenAI to reject the tool with:

```
Invalid schema for function 'fileRead': schema must be a JSON Schema of 'type: "object"', got 'type: "None"'
```

The tool call silently fails and `generateText()` throws an error.

## Root Cause

In Vercel AI SDK v6, the `tool()` function accepts two different field names:
- `inputSchema` (v6+) — Zod schema is automatically converted to JSON Schema
- `parameters` (v4-v5 legacy) — Zod object is passed raw WITHOUT conversion

With `parameters`, the serialized schema contains `{ _def: { typeName: "ZodObject" }, "~standard": { vendor: "zod" } }` instead of `{ type: "object", properties: { ... } }`. OpenAI's API receives `type: "None"` and rejects it.

## Fix

Always use `inputSchema`:

```js
// CORRECT
const fileRead = tool({
  description: 'Read a file',
  inputSchema: z.object({
    path: z.string().describe('Relative path'),
  }),
  execute: async ({ path }) => { ... },
});

// WRONG — DO NOT USE
const fileRead = tool({
  description: 'Read a file',
  parameters: z.object({ path: z.string() }),
  execute: async ({ path }) => { ... },
});
```

## Detection

- Error only appears at runtime when `generateText()` sends tool definitions to OpenAI
- No compile-time or import-time error — the tool object is created successfully
- Check `~/.quack/daemon-diag.log` for the `Agentic failed` message
- The fallback to chat mode masks the error (user gets a response but no tool use)

## Affected Files

- `src-tauri/node-sdk/vercel-tools.js` — all tool definitions
