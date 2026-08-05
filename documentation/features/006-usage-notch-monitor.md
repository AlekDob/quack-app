---
type: feature-doc
project: quack-20
stack: Electron (apps/desktop) + React/Vite (apps/web)
created: 2026-08-04
startDate: 2026-08-04
endDate:
last_verified: 2026-08-05
status: active
tags: [usage, limits, notch, macos, electron, providers]
---

## Usage Notch Monitor

**Purpose:** Keeps provider quota information visible in a compact macOS notch overlay. The compact surface is a black pill at the top-center of the primary display; hovering expands it into a read-only panel showing valid Codex, Claude and Cursor limits.

The overlay is a single window. It previously used a second window for the brand mark (to avoid a one-frame mark jump during Electron's macOS bounds update), but two windows share one window level: every `setBounds` re-ordered the panel above the mark, so the logo vanished behind the black circle. The mark now lives inside the panel, pinned top-center.

**Scope:** macOS desktop only. On MacBook displays with a physical cutout the pill visually merges with the notch; on Macs without one or external displays it behaves as a virtual notch.

### Files

| Type             | Path                                                                                                                                                                                                         | Exports/Purpose                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| Desktop manager  | `apps/desktop/src/usageNotchManager.ts`                                                                                                                                                                      | `UsageNotchManager` — creates, positions, resizes and disposes the always-on-top overlay; listens for display changes.          |
| Geometry         | `apps/desktop/src/usageNotchGeometry.ts`                                                                                                                                                                     | Pure compact/expanded dimensions and primary-display centering.                                                                 |
| Desktop IPC      | `apps/desktop/src/usageNotchIpc.ts`                                                                                                                                                                          | Validated enable/presentation/state handlers for the main renderer and overlay.                                                 |
| Overlay preload  | `apps/desktop/src/usageNotchPreload.ts`                                                                                                                                                                      | Narrow bridge exposing only WebSocket discovery and presentation changes.                                                       |
| Overlay UI       | `apps/web/src/components/usage-notch/UsageNotchSurface.tsx`                                                                                                                                                  | Hover surface, disclosure motion, seven-day token summary, provider cards, progress tracks and empty state.                     |
| Token chart      | `apps/web/src/components/usage-notch/UsageNotchTokenChart.tsx`                                                                                                                                               | Pure seven-day selection/scaling helper and compact, accessible CSS bar chart, with prompt-activity fallback and hover details. |
| Statistics fetch | `apps/web/src/lib/serverReactQuery.ts`                                                                                                                                                                       | Shared `fetchProfileTokenStats` and `fetchProfileStats` functions used by Profile and the overlay.                              |
| Desktop entry    | `apps/web/src/main.tsx`                                                                                                                                                                                      | Selects `?surface=usage-notch` before creating the normal router.                                                               |
| Preference       | `apps/web/src/appSettings.ts`                                                                                                                                                                                | `enableUsageNotch` (default `true`).                                                                                            |
| Settings         | `apps/web/src/components/settings/ProviderUsageSettingsPanel.tsx`                                                                                                                                            | macOS-only “Usage in notch” switch and reset action.                                                                            |
| Contracts        | `packages/contracts/src/ipc.ts`                                                                                                                                                                              | `DesktopUsageNotchState` and `DesktopBridge.usageNotch`.                                                                        |
| Tests            | `apps/desktop/src/usageNotchGeometry.test.ts`, `apps/desktop/src/usageNotchManager.test.ts`, `apps/web/src/components/usage-notch/UsageNotchTokenChart.test.ts`, `apps/web/src/lib/serverReactQuery.test.ts` | Bounds, lifecycle, cleanup, chart scaling/fallback and statistics-fetch coverage.                                               |

### Data flow

`UsageNotchCoordinator` reads `settings.enableUsageNotch` → Electron IPC creates or disposes `UsageNotchManager` → the manager creates a transparent panel `BrowserWindow` (the brand mark is rendered inside it, pinned top-center) → the panel calls `server.listProviderUsage`, `stats.getProfileTokenStats` and `stats.getProfileStats` through the WebSocket native API → quota snapshots are normalized with `normalizeServerProviderUsageRateLimit` and formatted with `deriveProviderUsageDisplayRows` → only `ok` snapshots with visible limits render. `ProfileTokenStats.heatmap` supplies the local, cross-provider token totals for the seven-day chart when available; otherwise the chart uses the existing prompt-activity heatmap and labels the series as prompts. Neither series is provider quota history.

On hover-in the panel changes bounds immediately while its content is transparent, then fades in over 180 ms. The mark stays at the same screen position because the panel is always centered on the primary display. On hover-out the panel fades out first and returns to compact bounds after the fade completes. The shared 220 ms disclosure motion still controls the internal content reveal. A short 100 ms intent delay prevents accidental collapse while moving across the surface.

The first provider refresh renders two pulsing skeleton cards. The initial profile reads render a matching bar-chart skeleton. Once successful data has been received, subsequent 60-second refreshes keep the last usable cards and chart visible rather than flashing either skeleton again. A failed refresh never clears the previous valid data; a successful empty quota result hides provider cards. If token telemetry is unavailable, the chart falls back to prompt activity so the notch still reflects local usage without presenting prompts as tokens.

### Interaction model

- Compact state: 40 × 40 DIP black hover target, with the logo centered in the notch.
- Expanded state: up to 760 × 286 DIP, responsive provider grid with an internal scroll limit.
- The expanded panel starts with a `Today · <value>` line typed like the provider quota rows and seven thin 4 px vertical tracks that reuse the same rounded track/fill language as those rows. Zero days render as an empty track (no fixed baseline block); non-empty days keep a 6 % floor so a tiny day stays visible. The panel starts with this summary, ending on the current local day. It prefers all token telemetry recorded by Quack and explicitly falls back to prompt counts when token telemetry is unavailable; it does not estimate external API spend or quota consumption.
- Hovering or keyboard-focusing a daily bar opens a compact tooltip with its local date and exact token/prompt count.
- Opening and closing use a panel-only fade; the logo does not fade.
- First load uses independent skeletons for provider cards and the local-usage chart while their read-only requests are in flight.
- Hover-out uses a 100 ms intent delay followed by a 180 ms fade-out.
- No click actions, links, buttons, navigation or credential access.
- Disclosure content uses the shared `disclosureMotion.ts` classes and respects reduced-motion preferences.

### State and contracts

- `enableUsageNotch: boolean` is persisted with app settings and defaults to `true`.
- `DesktopUsageNotchState` contains `supported`, `enabled`, `presentation` (`compact`/`expanded`) and the current primary `displayId`.
- The main renderer exposes only `getState` and `setEnabled` through `DesktopBridge.usageNotch`.
- The overlay preload exposes only `getWsUrl` and `setPresentation`; it does not receive filesystem, clipboard, browser, notification or AppSnap capabilities.
- `visibleOnFullScreen: true` switches macOS to the accessory activation policy (no Dock icon, no Cmd+Tab), so the window factory calls `app.dock.show()` right after to restore the regular policy.
- No new IPC or contract fields are required: the overlay reuses the existing profile-statistics RPCs and keeps token/prompt metric selection inside the web surface.

### Regression: app dropped from Dock/Cmd+Tab, logo vanishing (2026-08-05)

Two bugs shipped together in the notch polish pass:

1. **Whole app lost its Dock icon and Cmd+Tab entry.** `createUsageNotchWindow()` called `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`. That option is process-wide on macOS: Electron switches the _entire app's_ activation policy from regular (`Foreground`) to accessory (`UIElement`) the moment any window sets it, and the switch persists even after the window is destroyed. Reproduced in isolation with a throwaway Electron probe (`lsappinfo` reported `type="Foreground"` → `type="UIElement"` immediately after the call; `alwaysOnTop`/`focusable:false` alone had no effect). Fixed by calling `app.dock.show()` right after creating the notch window, which restores the regular policy without disabling `visibleOnFullScreen`.
2. **Logo disappearing behind the black pill.** The brand mark lived in its own `BrowserWindow` (`createUsageNotchLogoWindow`) stacked on top of the panel window. Both windows share one native window level, so every `#applyBounds()` call (`setBounds` on the panel) re-ordered the panel above the logo window, hiding it behind the black circle. Fixed by deleting the logo window entirely — the mark is now a pinned `<img>` inside `UsageNotchSurface`, which can never be occluded by its own sibling content.

Removed as part of the fix: `createUsageNotchLogoWindow`, the `usage-notch-logo` surface route, `UsageNotchLogoSurface.tsx`, and the manager's `createLogoWindow` option (and its duplicate `setAlwaysOnTop`/`setVisibleOnAllWorkspaces` calls, which the window factory already applies).

### Verification

- The current implementation keeps the notch code and documentation together: the chart is local CSS/React, the data path reuses existing statistics RPCs, and no provider credentials or external quota-history storage is introduced.
- `bunx vitest run src/usageNotchManager.test.ts src/usageNotchGeometry.test.ts` (apps/desktop): 2 test files, 4 tests passed.
- `bunx vitest run src/components/usage-notch` (apps/web): 1 test file, 4 tests passed.
- `bun typecheck` (repo-wide): passed — also fixed two pre-existing `exactOptionalPropertyTypes` errors surfaced by the same run, in `apps/web/src/lib/fileReferenceContextMenu.ts` and `apps/web/src/components/usage-notch/UsageNotchTokenChart.tsx`.
- `bun fmt` / `bun lint`: passed.
- Manual: Dock/Cmd+Tab and logo persistence require a full desktop rebuild + relaunch to verify against the packaged app (not yet done post-fix).
