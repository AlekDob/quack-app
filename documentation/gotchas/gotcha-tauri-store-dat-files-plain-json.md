---
type: gotcha
project: quack-app
created: 2026-03-01
last_verified: 2026-03-01
tags: [tauri-store, dat-files, remote-api, rust]
---
# Gotcha: Tauri Store `.dat` Files Are Plain JSON — Readable Without the Store Plugin

## Problem

When the Axum HTTP server (remote API) needs to read Tauri Store data (e.g., repo ordering, agent ordering), you might think you need `tauri_plugin_store` at runtime. You don't.

## Solution

Tauri Store `.dat` files are **plain JSON files** stored in the app data directory. They can be read with `std::fs::read_to_string` + `serde_json::from_str` — no Tauri Store runtime needed.

```rust
fn read_dat_store(filename: &str) -> serde_json::Value {
    get_app_data_dir()
        .map(|dir| dir.join(filename))
        .and_then(|path| std::fs::read_to_string(&path).ok())
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or(serde_json::json!({}))
}
```

## Key Files and Their Keys

| File | Key | Format |
|------|-----|--------|
| `.quack-repo-order.dat` | `repository-order` | `{ order: ["repo-name", ...], colors: {...} }` or `["repo-name", ...]` (legacy) |
| `.quack-agent-order.dat` | `agent-order-${repoPath}` | `{ "${branch}-main": ["agentId1", ...] }` |
| `quack-remote.json` | `enabled`, `token`, `port` | Individual keys |
| `quack-automations.json` | `jobs` | Array of job objects |

## App Data Directory

- **macOS**: `~/Library/Application Support/com.quack.terminal/`
- **Windows**: `%APPDATA%/com.quack.terminal/`
- **Linux**: `~/.local/share/com.quack.terminal/`

Same directory where `quack-agents.json` lives.

## Why This Matters

The `get_app_data_dir()` helper was extracted from `get_agents_storage_path()` to avoid duplicating the platform-specific path logic. All storage helpers in `remote_api.rs` use it.
