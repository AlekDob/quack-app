---
type: gotcha
project: quack-app
created: 2026-04-09
last_verified: 2026-04-09
tags: [iframe, sandbox, links, htmlvisualizer, postmessage]
---

# Gotcha: External Links Silently Blocked in Sandboxed Iframe

## Trigger

Any `<a href="https://...">` click inside an HtmlVisualizer iframe does nothing.

## Why

The iframe uses `sandbox="allow-scripts"` WITHOUT `allow-top-navigation`. This means:
- JavaScript runs (auto-resize, interactivity)
- But navigation is blocked — clicking external links is silently ignored by the browser

Adding `allow-top-navigation` is NOT the fix — it would let the iframe navigate the parent Tauri window away from the app.

## Solution

The injected script in `htmlVisualizerUtils.ts` intercepts all `<a>` clicks:
- `href="#id"` → `scrollIntoView()` (anchor navigation)
- `href="http/https/mailto"` → `parent.postMessage({ type: 'quack-viz-link-click', url })` to parent

`HtmlVisualizer.tsx` listens for `quack-viz-link-click` and calls `invoke('open_external_url', { url })` which opens in the system browser via Rust command with scheme whitelist.

## Key Files

- `src/components/chat/htmlVisualizerUtils.ts` — injected script with link interception
- `src/components/chat/HtmlVisualizer.tsx` — postMessage handler + invoke
- `src-tauri/src/reveal.rs` — `open_external_url` Rust command with scheme whitelist
