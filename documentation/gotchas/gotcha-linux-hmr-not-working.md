---
type: gotcha
created: 2026-04-11
tags: [linux, vite, hmr, hot-reload, tauri, webview, dev-server]
---

# Gotcha: Linux HMR not working with `npm run dev:linux`

## Symptom

Running `npm run dev:linux` starts the Tauri app successfully, but editing React/TypeScript source files does not trigger hot module replacement (HMR). The webview shows stale code until a full manual restart.

## Root Cause

Two issues combine to break HMR on Linux:

1. **Missing `hmr` block in Vite config** — Without explicit HMR WebSocket settings, Vite auto-detects the connection parameters. Inside Tauri's WebKitGTK webview, this auto-detection fails silently and the HMR WebSocket never connects.

2. **`host` defaults to `localhost`** — When `TAURI_DEV_HOST` is unset (the common case on Linux), Vite binds to `localhost`. On many Linux distros, `localhost` resolves to IPv6 `::1`, which WebKitGTK may not connect to. The fix is to default to `'127.0.0.1'` explicitly.

## Fix

Add explicit `hmr` configuration and a fallback host in `vite.config.ts`:

```ts
server: {
  port: 5174,
  strictPort: true,
  host: process.env.TAURI_DEV_HOST || '127.0.0.1',
  hmr: {
    protocol: 'ws',
    host: process.env.TAURI_DEV_HOST || '127.0.0.1',
    port: 5174,
  },
  watch: { /* ... */ },
},
```

## Key Details

- This does **not** affect macOS or Windows, where HMR works without explicit config.
- The `hmr.port` must match the `server.port` since Tauri proxies through the same port.
- `TAURI_DEV_HOST` is set by Tauri when using mobile dev targets; for desktop Linux it is typically unset.

## Related

- `scripts/dev-linux.sh` — the script that runs `cargo tauri dev`
- `documentation/bugs/fix-linux-projects-disappear-on-restart.md` — another Linux-specific issue
