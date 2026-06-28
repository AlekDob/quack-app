---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS (no Tailwind)
created: 2026-06-28
last_verified: 2026-06-28
tags: [design-system, theming, tokens, dark, light, liquid-glass, accent, monochrome, macos, window, composer, cursor-style]
---

## Design System (Quack chrome)
**Purpose:** The visual language of the app — CSS tokens, dark/light themes, the neutral "zero-orange" chrome, monochrome primary actions, liquid glass, the native macOS window, and the Cursor-style composer pill. All visual values flow from CSS variables in one file; rebranding = changing token values, not the architecture.
**Stack:** Plain CSS with custom properties, `[data-theme]` + `[data-os]` on `<html>`, Tauri window config

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Config | `src/App.css` | ALL tokens + every component style (~11.8k lines, single sheet) |
| Service | `src/theme.ts` | `ThemeMode`, `useTheme`, `bootstrapTheme` (also sets `data-os`), `useResolvedTheme` |
| Component | `src/components/TopBar.tsx` | Theme menu (System/Light/Dark); macOS hides custom window controls via CSS |
| Config (Rust) | `src-tauri/tauri.conf.json` | `titleBarStyle: "Overlay"` + `hiddenTitle` (native macOS rounded window) |
| Service (Rust) | `src-tauri/src/lib.rs` | `setup`: `set_decorations(false)` on non-macOS (custom chrome there) |

### Token groups (`App.css` `:root`)
| Group | Tokens |
|-------|--------|
| Surfaces | `--bg`, `--bg-alt`, `--bg-elev`, `--bg-hi`, `--bg-hover`, `--glass-bg` |
| Text | `--fg`, `--fg-dim`, `--fg-muted` |
| Borders | `--border`, `--border-strong` |
| Accent (NEUTRAL) | `--accent` (#9aa0ad dark / #6b7280 light), `--accent-rgb`, `--accent-hover`, `--accent-soft`, `--accent-fg` |
| Primary action | `--primary-bg` (=`--fg`), `--primary-fg` (=`--bg`), `--primary-bg-hover` |
| Semantic | `--ok`, `--warn`, `--err`, `--info` (+ `-bg` variants) |
| Radius | `--radius-xs/sm/md/lg/full` (5/8/14/20/999), `--radius-window` (12) |
| Shadow / blur | `--shadow-sm/md/lg`, `--blur-light/medium/heavy` |
| Motion | `--ease-default/spring`, `--duration-fast/normal/slow` |
| Type | `--font` (General Sans/Inter), `--mono` (JetBrains Mono) |

### Key decisions baked in (see decisions/)
- **Rebrand on tokens, NOT a Tailwind/shadcn rewrite** — `decisions/002-ui-styling-rebrand-not-rewrite.md`.
- **Zero-orange chrome (Cursor-style):** `--accent` is NEUTRAL grey. Real color lives only on per-project workspace badges (`features/002-workspace-colors.md`) and semantic states.
- **Primary = monochrome:** action buttons use `--primary-bg` (=`--fg`) → near-white in dark, near-black in light. Orange is gone from chrome.
- **Selection = neutral:** active rows/tabs use `--bg-hi` + a thin accent trace, never a full fill.

### Liquid glass
- `.liquid-glass` utility (`@supports` fallback + reduced-motion) for STATIC surfaces only. Applied to topbar, `.menu-dropdown`, `.palette`, `WorkspaceColorPopover`. Never on scrollable lists.

### Native window (macOS)
- `titleBarStyle: "Overlay"` + `hiddenTitle: true` → native rounded corners + shadow + traffic lights. `data-os="macos"` insets the topbar (78px) for the lights and hides custom window controls. **Gotcha:** Overlay is macOS-only; `lib.rs` strips decorations on Win/Linux to avoid a double title bar. Earlier `transparent:true` + CSS `border-radius` did NOT work (borderless window has no native rounding/shadow).

### Composer pill (Cursor-style)
- `.ai-composer-shell` wraps `.ai-composer-meta` + `.ai-input-row`; CSS `order` puts textarea on top, controls below, permission/queue on top. Textarea transparent inside the pill. Meta pills (model/effort/thinking) homologated to one size (`5px 12px`, 11px, `radius-full`). Buttons compact 30px.

### Config
- Theme persisted: localStorage `lcp.theme` (`theme.ts`). Default = system, dark-first feel.
- `data-os` set once at boot from `navigator.platform`.
