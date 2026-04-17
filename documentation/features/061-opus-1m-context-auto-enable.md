---
type: feature-doc
project: quack-app
stack: Tauri (Rust + Web) — Node.js SDK daemon
created: 2026-04-17
last_verified: 2026-04-17
tags: [opus, 1m-context, claude-max, oauth, model-mapping, sdk-daemon, bugfix]
---

## Opus 1M Context Auto-Enable
**Purpose:** Auto-append `[1m]` suffix to Opus 4.6+ model IDs in the SDK daemon to bypass the broken client-side `isOneMContextBlocked()` gate that blocks 1M context for Claude Max OAuth users.
**Stack:** Node.js (Claude Agent SDK daemon) inside Tauri runtime

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | src-tauri/node-sdk/stream-daemon.js | `getModelId(model)` — normalizes model aliases and force-enables `[1m]` suffix for Opus 4.6–4.9 |
| Config | ~/.claude.json | Stale subscription cache read by bundled `cli.js` gate (external, not modified) |

### Data Flow
Frontend model selection (e.g. `opus47`) → Rust (`claude_cli.rs`) → stream-daemon.js `getModelId()` → regex match `claude-opus-4-[6-9]` → append `[1m]` → SDK `query({ model })` → Anthropic API accepts 1M context

### Key Functions
- `getModelId(model: string) → string` — resolves alias to API model ID and auto-appends `[1m]` for Opus 4.6+ when suffix missing

### State
- `has1MSuffix`: boolean — tracks whether caller passed explicit `[1m]` (request)
- `resolved`: string — mapped API model ID pre-suffix (request)
- `isOpus`: boolean — regex match for Opus 4.6–4.9 families (request)

### External Dependencies
- Anthropic API: accepts `[1m]` suffix on Max subscriptions server-side
- Claude Agent SDK bundled `cli.js`: contains broken `isOneMContextBlocked()` gate (bypassed, not patched)

### Config
- Regex gate: `/claude-opus-4-[6-9]/` — matches Opus 4.6 through 4.9 (default: always on for matched models)

### Related Brain Entries
- `documentation/gotchas/gotcha-oauth-betas-rejection.md`
- Upstream ref: `anthropics/claude-code#45449`
- Breadcrumb in code: `// Brain: gotcha-oauth-betas-rejection + anthropic/claude-code#45449`

### Verification
- Opus 4.7 reports 1M context window on Claude Max OAuth subscription after fix
