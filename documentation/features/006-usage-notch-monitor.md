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

The overlay is intentionally split into two coordinated windows. The panel window owns the hover area and provider content; a separate transparent logo window owns the brand mark. Keeping the mark outside the resizable panel prevents Electron's macOS bounds update (which can apply the new `x` before the new width) from producing a one-frame logo jump to the left.

**Scope:** macOS desktop only. On MacBook displays with a physical cutout the pill visually merges with the notch; on Macs without one or external displays it behaves as a virtual notch.

### Files

| Type | Path | Exports/Purpose |
| ---- | ---- | --------------- |
| Desktop manager | `apps/desktop/src/usageNotchManager.ts` | `UsageNotchManager` — creates, positions, resizes and disposes the always-on-top overlay; listens for display changes. |
| Geometry | `apps/desktop/src/usageNotchGeometry.ts` | Pure compact/expanded dimensions and primary-display centering. |
| Desktop IPC | `apps/desktop/src/usageNotchIpc.ts` | Validated enable/presentation/state handlers for the main renderer and overlay. |
| Overlay preload | `apps/desktop/src/usageNotchPreload.ts` | Narrow bridge exposing only WebSocket discovery and presentation changes. |
| Overlay UI | `apps/web/src/components/usage-notch/UsageNotchSurface.tsx` | Hover surface, disclosure motion, provider cards, progress tracks and empty state. |
| Logo UI | `apps/web/src/components/usage-notch/UsageNotchLogoSurface.tsx` | Fixed 40 × 40 transparent surface containing the brand mark. |
| Desktop entry | `apps/web/src/main.tsx` | Selects `?surface=usage-notch` or `?surface=usage-notch-logo` before creating the normal router. |
| Preference | `apps/web/src/appSettings.ts` | `enableUsageNotch` (default `true`). |
| Settings | `apps/web/src/components/settings/ProviderUsageSettingsPanel.tsx` | macOS-only “Usage in notch” switch and reset action. |
| Contracts | `packages/contracts/src/ipc.ts` | `DesktopUsageNotchState` and `DesktopBridge.usageNotch`. |
| Tests | `apps/desktop/src/usageNotchGeometry.test.ts`, `apps/desktop/src/usageNotchManager.test.ts` | Bounds, platform guard, lifecycle and cleanup coverage. |

### Data flow

`UsageNotchCoordinator` reads `settings.enableUsageNotch` → Electron IPC creates or disposes `UsageNotchManager` → the manager creates a transparent panel `BrowserWindow` plus a fixed, click-through logo `BrowserWindow` → the panel calls the existing `server.listProviderUsage` RPC through the WebSocket native API → snapshots are normalized with `normalizeServerProviderUsageRateLimit` and formatted with `deriveProviderUsageDisplayRows` → only `ok` snapshots with visible limits render.

On hover-in the panel changes bounds immediately while its content is transparent, then fades in over 180 ms. The logo window remains stationary throughout. On hover-out the panel fades out first and returns to compact bounds after the fade completes. The shared 220 ms disclosure motion still controls the internal content reveal. A short 100 ms intent delay prevents accidental collapse while moving across the surface.

The first provider refresh renders two pulsing skeleton cards. Once a successful snapshot has been received, subsequent 60-second refreshes keep the last usable provider cards visible rather than flashing the skeleton again. A failed refresh never clears the previous valid data; a successful empty result hides all provider cards.

### Interaction model

- Compact state: 40 × 40 DIP black hover target, with a fixed logo centered in the notch.
- Expanded state: up to 760 × 286 DIP, responsive provider grid with an internal scroll limit.
- Opening and closing use a panel-only fade; the logo does not move or fade.
- First load uses skeleton provider cards while the read-only usage request is in flight.
- Hover-out uses a 100 ms intent delay followed by a 180 ms fade-out.
- No click actions, links, buttons, navigation or credential access.
- Disclosure content uses the shared `disclosureMotion.ts` classes and respects reduced-motion preferences.

### State and contracts

- `enableUsageNotch: boolean` is persisted with app settings and defaults to `true`.
- `DesktopUsageNotchState` contains `supported`, `enabled`, `presentation` (`compact`/`expanded`) and the current primary `displayId`.
- The main renderer exposes only `getState` and `setEnabled` through `DesktopBridge.usageNotch`.
- The overlay preload exposes only `getWsUrl` and `setPresentation`; it does not receive filesystem, clipboard, browser, notification or AppSnap capabilities.
- The logo window is click-through (`setIgnoreMouseEvents(true)`) and has no IPC or data access.

### Verification

- `bun run --filter @synara/desktop test -- usageNotchGeometry usageNotchManager`: 2 test files, 4 tests passed.
- The manager test covers creation, compact/expanded bounds for both windows, click-through logo setup and cleanup.
- `bun run --filter @synara/desktop typecheck`: passed.
- Desktop Electron build: passed, including `usageNotchPreload.js`.
- Repository-wide typecheck currently reports an unrelated existing `workspaceRoot` optional-property error in `apps/web/src/components/chat/InlineMentionChip.tsx`.
- Repository-wide formatting currently reports unrelated pre-existing issues in `apps/web/src/components/chat/MessagesTimeline.tsx` and `apps/web/src/index.css`.
