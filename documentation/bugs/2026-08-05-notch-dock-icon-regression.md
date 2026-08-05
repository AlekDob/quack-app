---
type: bug
project: quack-20
created: 2026-08-05
last_verified: 2026-08-05
status: fixed
tags: [macos, dock, activation-policy, usage-notch, electron]
---

## App missing from Dock/Cmd+Tab; notch logo disappearing

### Symptom

- Quack does not appear in the Dock or Cmd+Tab after launch; only reachable via Spotlight/Raycast focus
- Started after the "Polish usage notch overlay" commit (`fa29a114d`)
- Separately, the notch's brand mark showed briefly then vanished, leaving an empty black circle

### Root causes

| #   | Cause                                                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `createUsageNotchWindow()` called `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`. On macOS that option is process-wide: Electron switches the whole app's activation policy from regular (`Foreground`) to accessory (`UIElement`), and it does not revert when the window is later destroyed. |
| 2   | The brand mark lived in a second `BrowserWindow` (`createUsageNotchLogoWindow`) stacked above the panel window. Both share one native window level, so every `setBounds()` on the panel re-ordered it above the logo window.                                                                                     |

Cause #1 verified with an isolated Electron probe script (`lsappinfo` reported `type="Foreground"` → `type="UIElement"` immediately after the call on an otherwise-idle app; `alwaysOnTop`/`focusable:false` alone had no effect).

### Fix

- `app.dock.show()` called right after creating the notch window, restoring the regular activation policy while keeping `visibleOnFullScreen: true`
- Logo window removed entirely; the mark is now a pinned `<img>` inside `UsageNotchSurface.tsx` (single window, can't be occluded by a sibling)
- Removed with it: `createUsageNotchLogoWindow`, `usage-notch-logo` surface route, `UsageNotchLogoSurface.tsx`, manager's `createLogoWindow` option and its duplicate `setAlwaysOnTop`/`setVisibleOnAllWorkspaces` calls

### Docs

- Feature: `documentation/features/006-usage-notch-monitor.md`
- Diary: `documentation/diary/2026-08-05.md`
