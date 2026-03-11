---
type: gotcha
project: quack-app
created: 2026-03-11
last_verified: 2026-03-11
tags: [btw, auth, streaming, sdk]
---
# BTW Side-Chain must use SDK streaming, not direct HTTP

## Trigger
Any new "side-chain" or "lightweight" API call that bypasses the main chat pipeline.

## Problem
The original BTW implementation (`btw.rs`) made direct HTTP calls to the Anthropic API, requiring an explicit API key. This fails when the user authenticates via Claude Code OAuth (which stores credentials in `~/.claude.json`, not in env vars or keychain).

Error: `No API key found in keychain or ANTHROPIC_API_KEY env var`

## Solution
Use `send_message_via_sdk_streaming` (same Tauri command as main chat) with a dedicated `agentId` (e.g., `btw-sidechain`). This routes through `stream-claude.js` which handles all auth methods (OAuth, API key, Bedrock env vars).

Key implementation details:
- Unique `sessionKey` per query (`btw-${Date.now()}`) to avoid event mixing
- Listen on `claude-event:btw-sidechain` for streaming events
- Use `getProviderRequestFields()` for provider abstraction
- The `btw.rs` file with direct HTTP calls is dead code

## Files
- `src/hooks/useBTW.ts` — hook using SDK streaming
- `src-tauri/src/btw.rs` — dead code (direct HTTP, do not use)
