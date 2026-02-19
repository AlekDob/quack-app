---
type: decision
project: quack-app
created: 2026-02-19
last_verified: 2026-02-19
tags: [sdk, claude-agent-sdk, upgrade, dependency]
---
# Decision: SDK v0.2.47 Upgrade — No Code Changes Needed

## Context
Upgraded `@anthropic-ai/claude-agent-sdk` from v0.2.12 (skill) / v0.2.32-0.2.37 (app) to v0.2.47. This spans 35 versions with significant new APIs.

## New APIs Available (not adopted yet)

| API | Why Not Needed Now |
|-----|-------------------|
| `debug` / `debugFile` | We use `console.error("[DEBUG]...")` on stderr — doesn't interfere with stdout JSON parsing |
| `sessionId` (custom UUID) | Our `sessionId` in stream-claude.js is the resume ID; mapping is handled Rust-side |
| `additionalDirectories` | Project Groups inject context via `QUACK_GROUP_CONTEXT_START` block in CLAUDE.md |
| `close()` | Process termination handled by Rust (`kill_process`) |
| `reconnectMcpServer` / `toggleMcpServer` | MCP servers configured at session start, no runtime toggle needed |
| `promptSuggestion()` | Could feed chat input suggestions — future feature, not priority |
| `stop_reason` | Could show in UI why agent stopped — future feature, not priority |
| `TeammateIdle` / `TaskCompleted` hooks | No multi-agent team orchestration in Quack yet |
| MCP tool `annotations` | We don't define custom MCP tools with the SDK currently |

## What Was Updated
1. **Skill docs** (`skill.md`): v3.1.0 → v4.0.0 — comprehensive rewrite covering all 35 versions
2. **Dependencies**: `package.json` (root), `src-tauri/node-sdk/package.json`, `.agents/skills/.../templates/package.json` — all set to `^0.2.47`
3. **npm install**: Both root and node-sdk lock files updated

## Future Opportunities
- `promptSuggestion()` → chat input autocomplete/suggestions
- `stop_reason` → show "Context full" / "Max tokens" / "End of turn" in UI
- `sessionId` → 1:1 correlation between Quack sessions and SDK sessions for analytics
- `debugFile` → opt-in SDK debug logging without stderr noise
