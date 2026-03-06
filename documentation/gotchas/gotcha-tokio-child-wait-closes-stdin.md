---
type: gotcha
project: quack-app
created: 2026-03-06
last_verified: 2026-03-06
tags: [rust, tokio, process, stdin, MCP, stdio]
---
# Tokio child.wait() Closes stdin Before Waiting

## The Problem
MCP stdio server connection test always failed with "Process exited with error code: 1", even though the server worked perfectly when started normally via `start_mcp_server`.

## Root Cause
Tokio's `Child::wait()` **closes stdin before waiting** to prevent deadlocks (child might block reading stdin while parent blocks waiting for exit). For short-lived commands this is fine, but for **long-running stdio servers** (MCP, LSP, etc.) that stay alive by reading stdin, closing stdin causes immediate EOF and process exit.

From Tokio docs:
> "The stdin handle to the child process, if any, will be closed before waiting."

## The Trap
```rust
// BAD: stdin gets closed, MCP server sees EOF, exits with code 1
let mut child = Command::new("node").args(&["mcp-server.js"])
    .stdin(Stdio::piped()).spawn()?;
child.wait().await?; // closes stdin first!
```

## Solution
Use `try_wait()` in a polling loop. It's non-blocking and does NOT close stdin.

```rust
// GOOD: stdin stays open, MCP server stays alive
let mut child = Command::new("node").args(&["mcp-server.js"])
    .stdin(Stdio::piped()).spawn()?;

for _ in 0..10 {
    tokio::time::sleep(Duration::from_millis(200)).await;
    match child.try_wait() {
        Ok(Some(status)) => return /* process exited early */,
        Ok(None) => continue,     // still running - good
        Err(e) => return /* error */,
    }
}
// Process survived 2s - test passed
child.kill().await.ok();
```

## Key Rule
**Never use `child.wait()` to test if a long-running stdio process is alive.** Use `try_wait()` polling instead.

## Key Files
- `src-tauri/src/mcp.rs` — `test_stdio_connection()` uses try_wait polling
