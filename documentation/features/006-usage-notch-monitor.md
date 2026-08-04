---
type: feature-doc
project: quack-20
stack: Electron (apps/desktop) + React/Vite (apps/web)
created: 2026-08-04
startDate: 2026-08-04
endDate:
last_verified: 2026-08-04
status: active
tags: [usage, limits, notch, macos, electron, providers]
---

## Usage Notch Monitor

**Purpose:** Keeps provider quota information visible in a compact macOS notch overlay. The compact surface is a black pill at the top-center of the primary display; hovering expands it into a read-only panel showing valid Codex, Claude and Cursor limits.

**Scope:** macOS desktop only. On MacBook displays with a physical cutout the pill visually merges with the notch; on Macs without one or external displays it behaves as a virtual notch.

### Files

| Type | Path | Exports/Purpose |
| ---- | ---- | --------------- |
| Desktop manager | `apps/desktop/src/usageNotchManager.ts` | `UsageNotchManager` — creates, positions, resizes and disposes the always-on-top overlay; listens for display changes. |
| Geometry | `apps/desktop/src/usageNotchGeometry.ts` | Pure compact/expanded dimensions and primary-display centering. |
| Desktop IPC | `apps/desktop/src/usageNotchIpc.ts` | Validated enable/presentation/state handlers for the main renderer and overlay. |
| Overlay preload | `apps/desktop/src/usageNotchPreload.ts` | Narrow bridge exposing only WebSocket discovery and presentation changes. |
| Overlay UI | `apps/web/src/components/usage-notch/UsageNotchSurface.tsx` | Hover surface, disclosure motion, provider cards, progress tracks and empty state. |
| Desktop entry | `apps/web/src/main.tsx` | Selects `?surface=usage-notch` before creating the normal router. |
| Preference | `apps/web/src/appSettings.ts` | `enableUsageNotch` (default `true`). |
| Settings | `apps/web/src/components/settings/ProviderUsageSettingsPanel.tsx` | macOS-only “Usage in notch” switch and reset action. |
| Contracts | `packages/contracts/src/ipc.ts` | `DesktopUsageNotchState` and `DesktopBridge.usageNotch`. |
| Tests | `apps/desktop/src/usageNotchGeometry.test.ts`, `apps/desktop/src/usageNotchManager.test.ts` | Bounds, platform guard, lifecycle and cleanup coverage. |

### Data flow

`UsageNotchCoordinator` reads `settings.enableUsageNotch` → Electron IPC creates or disposes `UsageNotchManager` → manager creates a transparent `BrowserWindow` with the restricted notch preload → overlay calls the existing `server.listProviderUsage` RPC through the WebSocket native API → snapshots are normalized with `normalizeServerProviderUsageRateLimit` and formatted with `deriveProviderUsageDisplayRows` → only `ok` snapshots with visible limits render.

On hover-in the overlay keeps the previous valid snapshot visible, requests a forced read-only refresh, and starts a 60-second interval. The interval is cancelled on hover-out. A failed refresh never clears the previous valid data; a successful empty result hides all provider cards.

### Interaction model

- Compact state: 220 × 32 DIP, no text, hover target only.
- Expanded state: up to 760 × 286 DIP, responsive provider grid with an internal scroll limit.
- Hover-out uses a short anti-flicker delay.
- No click actions, links, buttons, navigation or credential access.
- Disclosure content uses the shared `disclosureMotion.ts` classes and respects reduced-motion preferences.

### State and contracts

- `enableUsageNotch: boolean` is persisted with app settings and defaults to `true`.
- `DesktopUsageNotchState` contains `supported`, `enabled`, `presentation` (`compact`/`expanded`) and the current primary `displayId`.
- The main renderer exposes only `getState` and `setEnabled` through `DesktopBridge.usageNotch`.
- The overlay preload exposes only `getWsUrl` and `setPresentation`; it does not receive filesystem, clipboard, browser, notification or AppSnap capabilities.

### Verification

- `bun run --filter @synara/desktop test -- usageNotchGeometry usageNotchManager`: 2 test files, 4 tests passed.
- `bun run --filter @synara/desktop typecheck`: passed.
- Desktop Electron build: passed, including `usageNotchPreload.js`.
- Repository-wide typecheck currently reports an unrelated existing `workspaceRoot` optional-property error in `apps/web/src/components/chat/InlineMentionChip.tsx`.
- Repository-wide formatting currently reports unrelated pre-existing issues in `apps/web/src/components/chat/MessagesTimeline.tsx` and `apps/web/src/index.css`.
