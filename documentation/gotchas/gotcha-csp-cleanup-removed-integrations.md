---
type: gotcha
project: quack-app
created: 2026-03-24
last_verified: 2026-03-24
tags: [csp, tauri, security, third-party, cleanup]
---
# CSP domains must be cleaned when removing third-party integrations

## Symptom

A third-party widget or service (e.g. Crisp chat, analytics, CDN) is removed from the codebase, but its domains remain in the CSP in `src-tauri/tauri.conf.json`. The app works fine but carries unnecessary network permissions.

## Root Cause

Tauri's CSP is a manual whitelist in `tauri.conf.json`. Removing the JS code that loads a third-party service does **not** automatically remove the CSP entries that allowed it. Orphan domains silently stay in `script-src`, `connect-src`, `frame-src`, etc.

## Example (Crisp removal)

Before (7 Crisp domains spread across CSP directives):
```
script-src: https://client.crisp.chat
connect-src: https://client.crisp.chat https://storage.crisp.chat wss://client.relay.crisp.chat wss://stream.relay.crisp.chat
frame-src: https://game.crisp.chat
img-src: https://client.crisp.chat https://image.crisp.chat https://storage.crisp.chat
style-src: https://client.crisp.chat
font-src: https://client.crisp.chat
```

After (all removed): none of the above remain.

## Fix

When removing any third-party integration, search `tauri.conf.json` for all domains related to that service across **all** CSP directives and remove them:

```bash
grep -i "service-name" src-tauri/tauri.conf.json
```

## Why It Matters

Orphan CSP domains are a security risk — they grant the app permission to load scripts, connect to WebSockets, or render iframes from domains that no longer serve any purpose. If a domain gets compromised after removal, the CSP still allows it.

## Key Lesson

When removing a third-party integration from a Tauri app: **code removal + CSP cleanup are one atomic operation**. Never do one without the other.

## Files
- `src-tauri/tauri.conf.json` — CSP definition (single long line, search carefully)
