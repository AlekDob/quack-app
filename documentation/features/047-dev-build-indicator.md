---
type: feature
project: quack-desktop
created: 2026-07-08
last_verified: 2026-07-08
tags: [dev, tauri, icons, branding, quack-v1]
---

# 047 — Dev Build Indicator

**Purpose:** Make `npm run tauri dev` unmistakable at a glance — distinct from the
production `.dmg` / release bundle — via a **DEV app icon** (Dock / taskbar) and
**in-app chrome** (badge, border, window title). Production builds show none of
this.

## Why it exists

Alek runs Quack dev and production side by side on macOS. Without a visual delta
the Dock icon and window chrome look identical, so it's easy to edit or test in the
wrong instance.

## What the user sees (dev only)

| Surface | Indicator |
|---|---|
| **Dock / taskbar icon** | Same duck mark with an amber **DEV** band across the bottom + subtle amber ring |
| **Top bar** | Pill badge `DEV` next to the "Quack" wordmark |
| **Window frame** | 3px inset border in `--warn` around the whole app |
| **OS window title** | Suffix `[DEV]` (e.g. `file.ts — project — Quack [DEV]`) |
| **Splash** | Small `DEV` pill beside the version string on boot |

**Not shown:** a top-right corner ribbon (removed — redundant with the top-bar badge).

## Detection model

| Layer | Signal | Notes |
|---|---|---|
| **Frontend** | `import.meta.env.DEV` | `true` when Vite dev server is running (`tauri dev` or `npm run dev`) |
| **Rust / icons** | `PROFILE == "debug"` in `build.rs` | Embeds dev icon assets at compile time; release profile unchanged |

Frontend and backend are intentionally aligned for `tauri dev` (debug Rust + Vite
DEV). A Vite-only session (`npm run dev`, no Tauri shell) still shows UI badges
but has no custom Dock icon.

## Components

| File | Role |
|---|---|
| `src/devMode.ts` | `IS_DEV` — single frontend export |
| `src/components/TopBar.tsx` | `DEV` pill in `.topbar-brand` |
| `src/App.tsx` | `app-dev` class + `[DEV]` in `setTitle` |
| `src/components/Splash.tsx` | DEV pill on splash wordmark |
| `src/App.css` | `.dev-badge`, `.app-dev` (warn border) |
| `src-tauri/build.rs` | Debug-only `TAURI_CONFIG` merge → dev icon paths |
| `src-tauri/icons/*-dev.*` | Generated icon variants (PNG, ICNS, ICO) |

## Icon pipeline

Dev icons are **derived** from the production set:

1. Amber band (`--warn` / `#f59e0b`) across the bottom with white **DEV** text.
2. Thin amber ring around the icon edge.
3. Outputs: `32x32-dev.png`, `128x128-dev.png`, `128x128@2x-dev.png`, `icon-dev.icns`, `icon-dev.ico`.

**Regenerate** after changing the base icon (from repo root, requires Pillow +
ImageMagick + macOS `iconutil`):

```bash
python3 scripts/generate-dev-icons.py
```

In **debug** builds, `build.rs` sets:

```json
{"identifier":"dev.getcodetta.app.dev","bundle":{"icon":["icons/32x32-dev.png","icons/128x128-dev.png","icons/128x128@2x-dev.png","icons/icon-dev.icns","icons/icon-dev.ico"]}}
```

via `TAURI_CONFIG` before `tauri_build::build()`. The dev identifier lets
`npm run tauri dev` launch while `/Applications/Quack.app` is already open
(single-instance only dedupes within the same identifier). On macOS,
`tauri-codegen` embeds `icon-dev.icns` as `app_icon` when `dev` cfg is active,
and Tauri applies it to the Dock on `RunEvent::Ready`. Release builds skip the
merge entirely.

## Styling rules

- All colors via CSS tokens (`--warn`, `--primary-fg`) — no hardcoded hex in TSX.
- Badge copy is English UI: `DEV`.

## Gotchas

- **Requires a Rust rebuild** after icon or `build.rs` changes — HMR does not
  refresh the Dock icon. Restart `npm run tauri dev`.
- **`tauri dev` exits immediately** if production Quack is already open and
  single-instance is active — debug builds now **skip** the single-instance
  plugin (`lib.rs` `#[cfg(not(debug_assertions))]`) so dev can run beside
  `/Applications/Quack.app`. A second **dev** window still dedupes only in
  release builds.
- **`npm run build` (frontend only)** sets `import.meta.env.DEV = false` — no UI
  badges in the static `dist/` bundle even if served manually.
- **Release / `tauri build`** uses production icons and no dev chrome.
- Dev icon PNGs are **committed binaries**; rerun the generator script when the
  production duck icon changes.

## Verify

1. `npm run tauri dev` → Dock icon shows DEV band; top bar badge; amber border;
   title ends with `[DEV]`.
2. `npm run tauri build` + open `.dmg` → none of the above; normal icon.
