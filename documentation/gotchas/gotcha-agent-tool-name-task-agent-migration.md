---
type: gotcha
project: quack-app
created: 2026-04-16
last_verified: 2026-04-16
tags: [agent-sdk, tool-name, breaking-change, migration]
---

# Gotcha: Agent Tool Name Migration — "Task" → "Agent"

## Context

The `@anthropic-ai/claude-agent-sdk` emits tool names on `tool_use` events. For the `Agent` / subagent spawning tool, the wire name has flip-flopped across versions:

- Historical: `Task`
- Patch release (unintentional breaking): `Agent`
- Reverted in 0.2.69 (see CHANGELOG): **back to `Task`** for all 0.2.x
- **Announced migration**: the next minor release will migrate the wire name to `Agent` permanently

## Where this hits us

`src-tauri/src/sessions.rs::summarize_tool_use` pattern-matches on the tool name to extract the description for mobile display.

```rust
// Current (forward-compatible)
"Task" | "Agent" => input["description"].as_str().unwrap_or("").to_string(),
```

If we only matched `"Task"`, the mobile summary would silently produce an empty string as soon as the SDK bumps to the next minor.

## Rule

When pattern-matching on tool names emitted by the agent-sdk, **always match both `"Task"` and `"Agent"`** until the migration is officially complete and we've verified no 0.2.x callers remain.

## Related files

- `src-tauri/src/sessions.rs:756` — tool summary for mobile dashboard
- `src-tauri/src/remote_api_teams.rs:255` — uses `"Agent"` as fallback label (unrelated: not wire-name matching)
- `src-tauri/src/remote_api.rs:400` — same fallback usage

## Verify after next agent-sdk bump

1. Check the agent-sdk CHANGELOG entry that announces the wire-name migration
2. Run a subagent (spawn via the `Agent`/`Task` tool) and inspect `tool_use` events
3. Confirm the mobile tool summary still shows the agent description
4. Once migration is stable, the `"Task"` arm can be removed (document as a follow-up)

## References

- agent-sdk 0.2.69 CHANGELOG — original "Task" revert note
- agent-sdk 0.2.111 (bump date 2026-04-16) — still emits `Task`
