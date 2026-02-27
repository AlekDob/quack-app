---
type: gotcha
project: quack-app
created: 2026-02-27
last_verified: 2026-02-27
tags: [remote-api, mdns, bonjour, pwa, networking, mobile-dashboard]
---

# Gotcha: Dashboard URL Breaks When Switching WiFi Networks

## Problem

The mobile dashboard URL uses the machine's LAN IP (e.g., `http://192.168.1.50:6769/dashboard`). When the user switches WiFi (home → office → cafe), the IP changes and the PWA bookmark stops working. The user sees a white/blank screen.

## Root Cause

Two issues:

1. **IP-based URLs are network-specific** — `192.168.1.50` at home becomes `192.168.10.131` at office
2. **Missing `?token=` in URL** — if the user navigates to `/dashboard` without the token query parameter, `window.__QUACK_TOKEN__` is injected as empty string and all API calls return 401

## Solution: mDNS (.local) Hostname

Use the machine's mDNS hostname instead of IP. The hostname resolves to the correct IP on any local network:

```
http://HQ-ALEDOB.local:6769/dashboard?token=54615b...
```

### Platform Support

| Platform | mDNS Support | Notes |
|----------|-------------|-------|
| macOS | Built-in (Bonjour) | Always works |
| Windows 10+ | Native since build 1703 | No extra software needed |
| Linux | Requires `avahi-daemon` | Usually pre-installed on Ubuntu/Fedora |
| iOS Safari | Full support | Resolves `.local` addresses |
| Android Chrome | Partial | Works on most modern devices |

### Implementation

Rust command `get_local_hostname()` in `remote_config.rs`:
- Uses `hostname::get()` crate (already a dependency)
- Appends `.local` suffix if not present
- Settings UI shows the full dashboard URL with hostname

### Fallback

If hostname is unavailable, the Settings UI falls back to IP-based URL with a warning that it may change when switching networks.

## Key Insight

The `?token=` query parameter is **required** in the dashboard URL. Without it, the server injects an empty token and the page loads but shows a blank screen (all fetches fail silently with 401).

## Files

- `src-tauri/src/remote_config.rs` — `get_local_hostname()` command
- `src/components/settings/categories/RemoteApiSettings.tsx` — "Mobile Dashboard" section with copyable URL
