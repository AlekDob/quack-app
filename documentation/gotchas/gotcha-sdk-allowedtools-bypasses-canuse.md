---
type: gotcha
project: quack-app
created: 2026-04-03
last_verified: 2026-04-03
tags: [sdk, permissions, allowedTools, canUseTool, ask-mode]
---
# SDK allowedTools bypasses canUseTool callback

## Trigger
You add a new permission mode that relies on `canUseTool` to prompt the user, but tools execute without ever calling the callback.

## Root Cause
The Claude Agent SDK evaluates permissions in this order:

1. **Hooks** (PreToolUse)
2. **Deny rules** (disallowedTools)
3. **Permission mode** (bypassPermissions auto-approves here)
4. **Allow rules** (`allowedTools`) — **if tool is in this list, it's auto-approved HERE**
5. **`canUseTool` callback** — only reached if nothing above resolved it

Quack's `defaultAllowedTools` includes Write, Edit, Bash, etc. In `permissionMode: 'default'`, these tools are approved at step 4 before `canUseTool` is ever called.

## Fix
For Ask mode, use a reduced `allowedTools` list with only read-only tools:
```js
const askModeAllowedTools = ['Read', 'Glob', 'Grep', 'AskUserQuestion', 'ExitPlanMode', 'TodoWrite'];
const resolvedAllowedTools = askMode ? askModeAllowedTools : baseAllowedTools;
```

## Files
- `src-tauri/node-sdk/stream-daemon.js` — `resolvedAllowedTools` (affects both query() and persistent subprocess paths)
- `src-tauri/src/claude_cli.rs` — passes `askMode: true` flag to daemon

## Source
Anthropic SDK docs: https://platform.claude.com/docs/en/agent-sdk/permissions
