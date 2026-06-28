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

### Floating-pill tabs (Cursor-style)
- Editor tabs (`.tab-bar`/`.tab`): the bar has `gap:4px` + `padding:6px 8px`; each tab is a `radius-sm` pill, **no** vertical `border-right` dividers. Active = raised surface (`--bg`) + hairline trace (`--shadow-sm` + inset 1px border), **no accent underline** (brand: zero-orange). `.tab-add`/`.tab-list-btn` rounded to match.
- Agent-mode context tabs (`.agent-context-tabs`/`.agent-context-tab`, Changes/Files) use the SAME pill treatment (full-width `flex:1` pills, active = raised + hairline) instead of the old bottom-border indicator.
- The removed `.tabs-pane.focused .tab-bar` accent box-shadow is gone (no orange line under the focused pane).

### Chat reading type
- Message body `.ai-msg-body .md-preview` is 13px / line-height 1.55; headings h1–h4 17/15/14/13; code blocks 13px; fallback `.ai-msg` 13px. Sized for comfortable reading without dwarfing the chrome.
- Assistant identity header = **Jack** (duck avatar 32px + name 14px + "Project Manager" 10px) — full feature in `features/005-jack-duck-identity.md`. `.ai-msg-assistant .ai-msg-body` uses a discreet 1px `--border` left rule (not an accent rail).

### Top bar & command center
- Brand (`.topbar-brand`): Quack square logo (`public/quack-logo.png`, 22px) + "Quack",
  shown on ALL platforms (no longer gated to non-macOS). On macOS it sits right of the
  traffic-light inset.
- Command center (`.topbar-search`): centered VS-Code-style (`position:absolute; left:50%`),
  visible everywhere, shortcut label ⌘P (mac) / Ctrl+P. Opens the command palette.

### Settings modal
- `.settings-modal` = `radius-lg` + `shadow-lg`. Side nav (`.settings-toc`) is TRANSPARENT
  (inherits the modal grey — no white/grey bicolor) with rounded active items (`--bg-hi`,
  no accent bar). Segmented controls (`.segmented-btn`) are icon+label pills.

### Command palette
- Cursor-style rows — see `features/011-command-palette.md`. Compact rounded items, leading
  type icon (`iconForCategory`), trailing hint, active = `--bg-hi` rounded (no accent bar).

### No emoji (enforced)
- Zero emoji in chrome — full rules in `design/directives.md`. Theme toggle uses
  sun/moon/monitor icons; composer Stop/Send-now are text. Minor leftover: SFTP `✓/✗`.

### Config
- Theme persisted: localStorage `lcp.theme` (`theme.ts`). Default = system, dark-first feel.
- `data-os` set once at boot from `navigator.platform`.
