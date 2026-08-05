---
type: recap
project: synara
date: 2026-08-05
tags: [browser, automation, background, focus, electron]
---

# Background browser automation

Implemented the background-first browser runtime requested for agent sessions.

## Outcome

Agent browser tools no longer ask the renderer to open the agent's browser panel. They resolve a native Electron runtime in the existing persistent browser partition, so the user can continue working in another thread or pane.

## Safety behavior

- There is one canonical runtime per logical browser tab.
- Existing human-control epochs, input correlation, download leases, idempotency, and abort behavior remain in place.
- Background OAuth popups are denied before a child window is created. The agent receives `humanActionRequired` instead of stealing focus.
- Runtime activity and attention reasons are represented as ephemeral browser state.

## Compatibility

The renderer-owned `<webview>` path remains available for manually visible browser tabs. `BrowserPanel` selects native bounds when the manager promotes a background runtime, and keeps the existing renderer adoption handshake otherwise. Legacy host options and the `show` input remain accepted so older callers do not fail schema/type validation.

## Verification

- Focused desktop browser-manager tests: passed.
- `bun fmt`: passed.
- `bun lint`: passed with warnings only (0 errors).
- `bun typecheck`: passed.
