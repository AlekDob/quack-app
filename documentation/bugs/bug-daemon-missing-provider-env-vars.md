---
type: gotcha
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [daemon, provider, ollama, custom, env-vars, stream-daemon]
---
# Daemon Path Doesn't Pass Provider Env Vars

## Symptom

Custom/Ollama providers (e.g. GLM-5:CLOUD via Ollama) fail with "model does not exist" when using the daemon backend. The same model works on the legacy (spawn-per-message) path.

## Root Cause

The daemon (`stream-daemon.js`) is a **persistent** Node.js process started once. The legacy path (`stream-claude.js`) is spawned per-message, so Rust can inject `ANTHROPIC_BASE_URL` / `ANTHROPIC_API_KEY` as process env vars on the `Command`.

For the daemon path:
1. `claude_cli.rs` was **not** including `provider`, `providerBaseUrl`, `providerApiKey` in the JSON query sent to the daemon
2. `stream-daemon.js` was **not** reading these fields or setting env vars per-query

## Fix

**`claude_cli.rs`** — Added provider fields to daemon query JSON:
```rust
if let Some(ref prov) = request.provider {
    query_cmd["provider"] = serde_json::Value::String(prov.clone());
}
// + providerBaseUrl, providerApiKey
```

**`stream-daemon.js`** — Per-query env var management:
- Destructure `provider, providerBaseUrl, providerApiKey` from query command
- Before SDK call: save original env vars, set provider-specific ones
- In `finally` block: restore original env vars (daemon is persistent, must not leak state between queries)

## Key Insight

Daemon is persistent → env vars must be set/restored **per-query**, not per-process. This is fundamentally different from the legacy path where each query spawns a fresh process.

## Files

| File | Change |
|------|--------|
| `src-tauri/src/claude_cli.rs` | Pass provider fields in daemon query JSON |
| `src-tauri/node-sdk/stream-daemon.js` | Per-query env var set/restore for provider |
