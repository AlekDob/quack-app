---
type: feature-doc
project: synara
stack: Electron / React / TypeScript
created: 2026-08-05
startDate: 2026-08-05
endDate:
last_verified: 2026-08-05
status: active
tags: [browser, automation, background, focus, electron, oauth]
---

## Background browser automation

**Purpose:** Let an agent use Quack's persistent browser session without changing the user's active thread, split pane, dock, composer focus, or macOS application focus.

### Problem

Browser automation previously required a renderer-owned WebView to be visible. The desktop host therefore sent an open-panel request whenever an agent needed a runtime. In a single-chat surface this navigated to the agent's thread; in a split surface it could focus or replace a pane. That was correct for keeping the visible page and CDP target identical, but disruptive when the user was working elsewhere.

### Current design

The desktop browser manager now distinguishes the logical browser tab from the surface that currently displays it:

- `background-native`: a native `WebContentsView` owns the agent runtime but is detached from the window content tree;
- `visible-native`: that same native runtime has been promoted into the browser dock;
- `visible-renderer`: the existing manually opened `<webview>` path;
- `none`: no live runtime is attached.

The background runtime uses the existing `persist:synara-browser` partition, so cookies and login state remain compatible with the integrated browser. It is still one canonical runtime per `(threadId, tabId)`; the implementation does not create a hidden duplicate WebView that could diverge from the visible page.

### Agent behavior

- `browser_open` defaults to background operation. The legacy `show` input is still decoded for wire compatibility but no longer routes or focuses the user's UI.
- Snapshot, navigation, input, screenshot, wait, evaluate, and tab operations resolve the canonical automation runtime directly.
- The desktop `requestOpenPanel` callback is no longer used by the production host path.
- Human input still advances the existing control epoch and interrupts an in-flight agent action with `BrowserInterruptedByHuman`.
- Background OAuth popups are denied before Electron creates a child window. The tool returns `humanActionRequired`; the user must explicitly open the relevant thread's browser and complete sign-in.

### State contract

`ThreadBrowserState` carries two desktop-only fields:

- `runtimeSurface` describes native/renderer ownership;
- `automation` reports `idle`, `running`, or `attention-required` with a bounded reason (`oauth`, `download`, `popup`, or `error`).

These fields are ephemeral. They are not persisted as thread messages or used to restore conversation history.

### Files

| Area              | Files                                                                                                             | Responsibility                                                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Shared contract   | `packages/contracts/src/ipc.ts`                                                                                   | Runtime surface and automation activity state                                  |
| Tool contract     | `packages/contracts/src/browserAutomationToolInputs.ts`, `packages/contracts/src/browserAutomationToolOutputs.ts` | Background-default `show` semantics and physical scope                         |
| Desktop runtime   | `apps/desktop/src/browserManager.ts`                                                                              | Canonical native background runtime, promotion, teardown, OAuth popup deferral |
| Automation host   | `apps/desktop/src/browserAutomation/desktopBrowserAutomationHost.ts`                                              | Direct background runtime resolution and attention state                       |
| Browser UI        | `apps/web/src/components/BrowserPanel.tsx`                                                                        | Native surface bounds vs renderer WebView adoption                             |
| Provider guidance | `apps/server/src/agentGateway/harnessPolicy.ts`, `packages/shared/src/browserAutomationCatalogue.ts`              | Tell agents that browser actions do not reveal the UI                          |

### Regression coverage

- `apps/desktop/src/browserAutomation/browserManagerAutomation.test.ts` continues to cover renderer adoption, download leases, window-open correlation, human-control epochs, and projected navigation.
- Desktop typecheck covers the compatibility options retained for existing host fixtures.
- Full verification on 2026-08-05: `bun fmt`, `bun lint` (0 errors; existing warnings remain), and `bun typecheck` passed.

### Follow-up

`automation.phase` is consumed by a dedicated composer browser pill (`apps/web/src/components/chat/ComposerBrowserActivityPill.tsx`): a `running` or `attention-required` phase renders a compact Browser marker above the composer, with the reason as its status label and the active tab host when available. Clicking it opens the thread's browser panel in the right dock. The marker disappears as soon as the phase returns to `idle`. Browser state no longer occupies a row in the generic activity strip, so the signal remains visible even when that strip is collapsed. The implementation still never auto-opens a panel or popup; any human-required browser step is taken only through an explicit UI action.
