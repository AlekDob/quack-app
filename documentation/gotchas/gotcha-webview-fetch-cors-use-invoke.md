---
type: gotcha
project: quack-app
created: 2026-04-06
last_verified: 2026-04-06
tags: [cors, fetch, tauri, invoke, webview, remote-api]
---

# Webview fetch() to localhost triggers CORS — use Tauri invoke

## Problem

`fetch('http://127.0.0.1:6770/api/execute')` from the Tauri webview triggers a CORS preflight (OPTIONS request). The axum server returns 405 because it has no CORS middleware on API routes. The POST never fires.

## Why

Tauri's WebKit webview runs on `http://localhost:5174` (Vite dev) or `tauri://localhost` (prod). Any fetch to a different origin (even localhost on a different port) is cross-origin and requires CORS headers.

## Fix

Never use `fetch()` from frontend components to hit the local Remote API. Instead:

1. **Tauri `invoke()`** — call a Rust command that emits the event directly (no HTTP)
2. **Tauri `emit()`** — emit events from frontend JS if no Rust logic needed

## Example

```typescript
// BAD: CORS preflight → 405
await fetch('http://127.0.0.1:6770/api/execute', { method: 'POST', ... });

// GOOD: Tauri invoke → Rust emits event directly
await invoke('delegate_plan_to_agent', { agentId, prompt, ... });
```

## Exception

`remoteApi.ts` `executeRemoteTask()` works ONLY when called from the **axum server context** (e.g., the mobile dashboard served at `/dashboard`). It does NOT work from the main Tauri webview.

## Files

- `src/services/remoteApi.ts` — HTTP-based, works from dashboard only
- `src-tauri/src/remote_api.rs` — `delegate_plan_to_agent` Tauri command, no CORS
