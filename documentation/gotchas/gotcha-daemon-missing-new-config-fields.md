---
type: gotcha
project: quack-app
created: 2026-02-28
last_verified: 2026-02-28
tags: [daemon, stream-daemon, stream-claude, dual-path, config-fields, system-prompt]
---
# Daemon Path Doesn't Get New Config Fields Automatically

## Symptom

New features that depend on config fields passed from Rust to Node.js (e.g. `debugMode`, `provider`, custom flags) work in the legacy spawn-per-message path (`stream-claude.js`) but are silently ignored in the daemon path (`stream-daemon.js`).

The agent doesn't know about the new mode/feature even though the frontend UI shows it correctly.

## Root Cause

Quack has **two parallel code paths** for sending messages to the Claude Agent SDK:

| Path | File | How it works |
|------|------|-------------|
| Legacy (spawn) | `stream-claude.js` | New Node.js process per message. Config passed as CLI arg. |
| Daemon | `stream-daemon.js` | Persistent process. Config passed as JSON query command via stdin. |

When adding a new config field, you must update **BOTH**:
1. **Rust** (`claude_cli.rs`) — two `permission_mode` mapping blocks + two config JSON builders
2. **Node.js** — destructuring + usage in both `stream-claude.js` AND `stream-daemon.js`

## Checklist for New Config Fields

1. `claude_cli.rs` — Add field to `ClaudeCliRequest` struct (~line 894)
2. `claude_cli.rs` — Pass in daemon query JSON (`query_cmd["field"]`, ~line 1907)
3. `claude_cli.rs` — Pass in SDK config JSON (`config["field"]`, ~line 2102)
4. `stream-claude.js` — Destructure from `config` (~line 131)
5. `stream-daemon.js` — Destructure from `cmd` in `handleQuery()` (~line 189)
6. Both JS files — Use the field (e.g. in `systemPrompt.append`)

## Real Example: Debug Mode

Added `debugMode: true` flag for Debug permission mode:
- **Forgot** to destructure and use it in `stream-daemon.js`
- Frontend showed "Debug Mode" correctly, but agent said "modalita' normale"
- The system prompt debug instructions were only injected in `stream-claude.js`

## Key Insight

Always grep for the field name across BOTH JS files after adding it. The daemon is the **primary path** in production — if it's missing there, the feature is effectively broken.

## Files

| File | What to check |
|------|--------------|
| `src-tauri/src/claude_cli.rs` | Both query_cmd AND config JSON builders |
| `src-tauri/node-sdk/stream-claude.js` | Config destructuring + usage |
| `src-tauri/node-sdk/stream-daemon.js` | Cmd destructuring in handleQuery() + usage |
