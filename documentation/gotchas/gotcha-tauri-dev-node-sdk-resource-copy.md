---
type: gotcha
project: quack-app
created: 2026-04-10
last_verified: 2026-04-10
tags: [tauri, node-sdk, dev-mode, resources, build]
---
# Tauri Dev Mode: node-sdk JS changes not picked up

## Problem

In `tauri dev`, the `node-sdk/` directory is declared as a Tauri resource in `tauri.conf.json`. Tauri copies it to `target/debug/node-sdk/` during the Rust build step. The daemon loads scripts from this target path, NOT from the source directory.

When you modify JS files in `src-tauri/node-sdk/` (e.g., `stream-daemon.js`, `stream-vercel.js`), the changes are NOT automatically picked up because:
1. Tauri only copies resources when Rust recompiles
2. Modifying JS files doesn't trigger Rust recompilation
3. Hot-reload only applies to the frontend (Vite), not to daemon scripts

## Symptoms

- Daemon logs don't show expected output from new code
- New features in JS files seem to not work despite correct source code
- `grep` confirms the source file has changes but runtime behavior is old

## Fix

### Quick (manual copy)

```bash
cp src-tauri/node-sdk/stream-daemon.js src-tauri/target/debug/node-sdk/
cp src-tauri/node-sdk/stream-vercel.js src-tauri/target/debug/node-sdk/
```

Then restart the app (`Cmd+Q` + relaunch).

### Proper (build.rs trigger)

Added `cargo:rerun-if-changed` directives in `src-tauri/build.rs` for key JS files:

```rust
println!("cargo:rerun-if-changed=node-sdk/stream-daemon.js");
println!("cargo:rerun-if-changed=node-sdk/stream-vercel.js");
println!("cargo:rerun-if-changed=node-sdk/model-registry.js");
```

This forces Rust recompilation (and resource copy) when these files change. But it only works if `tauri dev` detects the build.rs output — in practice, `touch src-tauri/src/lib.rs` may still be needed.

## Root Cause

`get_node_sdk_script()` in `claude_cli.rs` checks `resource_dir()` first (which resolves to `target/debug/`), and only falls back to `CARGO_MANIFEST_DIR/node-sdk/` if the file doesn't exist. Since the old version exists in `target/debug/`, it never reads from source.
