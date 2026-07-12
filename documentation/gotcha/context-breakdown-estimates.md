---
type: gotcha
created: 2026-07-12
last_verified: 2026-07-12
tags: [claude-code, context, usage, popover, estimate]
---

# Context popover breakdown is hybrid (live total + estimated segments)

**Problem:** The composer **Context Usage** popover shows a Cursor-style segmented
bar (system prompt, tools, rules, skills, MCP, subagents, conversation). Users
may expect numbers identical to Claude Code's `/context` slash command.

**Reality:** Only the **hero total** (`context.used` / `context.window` / `%`)
comes from the live last-API snapshot (same source as the ring). Per-category
rows are **estimated** except **Conversation**, which is computed as:

```text
conversation = contextUsed − sum(static segment estimates)
```

**Static segment sources:**

| Segment | How Quack estimates |
|---|---|
| System prompt | Fixed `3_500` tokens |
| Tool definitions | Fixed `8_700` tokens |
| Rules | `loadWorkspaceRules` char/4 |
| Skills / Subagents | `claude_context_assets` `effective_tokens` |
| MCP | `claude_mcp_list` count × `600` |

Rows display `~` prefix when estimated (`fmtSegCount` in `SessionUsagePopover`).

**Why not parse `/context` yet:** CC's breakdown is produced by internal
`analyzeContext` at runtime (per MCP server tool defs, deferred tools, compact
buffer, invoked skill bodies, path-scoped rules). Quack has no structured API
for it today — only the aggregate usage fields in stream-json / JSONL.

**Impact:** Segment proportions are directionally useful (spot bloated skills,
many MCP servers, heavy rules) but will not match CC `/context` token-for-token.

**Mitigation:** Usage tab → **Context** view (`020-context-optimizer.md`) ranks
individual skills/agents with real scan weights + visibility toggles. Popover
footer links to Usage dashboard for plan limits and billing.

**Related:** `documentation/features/023-session-usage-panel.md`
