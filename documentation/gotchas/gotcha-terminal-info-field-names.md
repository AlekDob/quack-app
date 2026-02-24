---
type: gotcha
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [terminal, agent, fields, naming]
---

# TerminalInfo Uses Non-Obvious Field Names

## The Trap

When working with `TerminalInfo` (the terminal/agent config object), the field names are **not** what you'd expect:

| Expected | Actual | Purpose |
|----------|--------|---------|
| `name` | `label` | Agent display name |
| `projectPath` | `cwd` | Working directory |
| `icon` / `image` | `avatar` | Avatar filename |

## Why It Matters

The `terminalToUnifiedAgent` function in `App.tsx` does the conversion from `TerminalInfo` fields to the unified agent format. If you use the wrong field names when looking up an agent by terminal config, the lookup silently returns `undefined`.

## The Fix

Always reference `TerminalInfo` type definition in `src/types.ts` before accessing fields. Or use `terminalToUnifiedAgent()` to get a normalized object.

## Trigger

When creating sessions programmatically (e.g., automation, quick actions) that need to resolve which agent to use from terminal config.
