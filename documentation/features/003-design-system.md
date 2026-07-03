---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS (no Tailwind)
created: 2026-06-28
last_verified: 2026-07-03
tags: [design-system, theming, tokens, dark, light, liquid-glass, accent, monochrome, macos, window, composer, cursor-style, tool-icon-tints]
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
| Tool icons | `--tool-read`, `--tool-bash`, `--tool-search`, `--tool-edit`, `--tool-web`, `--tool-task`, `--tool-todo` (glyph only — see `features/006`) |
| Skill / image | `--skill`, `--skill-bg`, `--img`, `--img-bg` (full-pill exceptions) |
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
- `.liquid-glass` utility (`@supports` fallback + reduced-motion) for STATIC surfaces only. Applied to topbar, `.menu-dropdown`, `.palette`, `WorkspaceColorPopover`, **model catalog/visibility modals** (`.model-browser.liquid-glass`). Never on scrollable lists.

### Native window (macOS)
- `titleBarStyle: "Overlay"` + `hiddenTitle: true` → native rounded corners + shadow + traffic lights. `data-os="macos"` insets the topbar (78px) for the lights and hides custom window controls. **Gotcha:** Overlay is macOS-only; `lib.rs` strips decorations on Win/Linux to avoid a double title bar. Earlier `transparent:true` + CSS `border-radius` did NOT work (borderless window has no native rounding/shadow).

### Composer pill (Cursor-style, roomier "spaceship" pass)
- `.ai-composer-shell` wraps `.ai-composer-meta` + `.ai-input-row`; CSS `order` puts textarea on top, controls below, permission/queue on top. Textarea transparent inside the pill.
- **Scale (2026-07-01):** shell `radius-md` + soft rest shadow (`0 1px 2px`) that lifts on `:focus-within` (`0 4px 16px`); input-row pad `8px 12px 2px`; textarea **transparent** (flush with the shell — no white-field-on-grey), `14px`/`1.5`, min-height 22. Placeholder is `Message {activeAgent ?? "Jack"}…`.
- **Two-group toolbar, single row** (`.ai-composer-meta`, gap 5, pad `2px 10px 8px`): LEFT = `+` attach (`.ai-attach-btn`, opens hidden `<input type=file>` → `appendImages`) + subagent pill; `.ai-composer-spacer` splits; RIGHT = model chip · effort · permission mode · mic · send.
- **Uniform pills:** model chip, effort, permission mode, context indicator all normalized to one look (`.ai-composer-shell` scope: 28px height, `radius-full`, 11px, weight 500, shared hover). Model chip trimmed to `● {modelId} ▾` (no "Model" label / provider suffix). Send/stop 28×28 icon buttons.
- **Effort + thinking = one control** (`EffortPopover.tsx`, `.ai-effort-pop`): pill shows `effort: {label}`; the popover (astronave-style surface, upward) holds a Claude-desktop-style effort slider (Faster→Smarter over default/low/medium/high/xhigh/max, `accent-color: --fg`) AND a thinking segmented toggle (auto/on/off). Replaced the two separate `MetaFlag` pills + the ⚙ tune gate (both removed).
- **Send/Stop** are 30×30 icon buttons (`.ai-send-btn`): send = `arrow-up` on monochrome `--primary-bg`; stop = `stop` icon on red.
- **Subagent pill** (`SubagentPill.tsx`, `.ai-agent-pill`): "who the message goes to". Default = Jack (`AIIcon` duck) `· PM`; picking a discovered subagent shows its duck avatar `· Agent`. Active target is DERIVED from `attachedAgents` (no parallel state); menu opens upward, resets to Jack via the top item. Menu only when Claude Code + agents exist.
- **Mic** (`ComposerMic.tsx`, `.ai-mic-btn`): Web Speech API dictation, appends finalised transcript to the input, pulses while listening; renders `null` when the API is absent (e.g. WKWebView) — no dead control.
- **Hint row** (`.ai-composer-hint`): `@ mentions · / commands · Shift+Enter for newline · ↑ to recall`, shown only when the input is empty and idle.
- Neutral chrome preserved end-to-end: colour only on the `+236/-35` diff counts and semantic states — no accent hue introduced. Adapted from `spaceship-ai`'s composer *coreografia*, not its palette.

### Floating-pill tabs (Cursor-style)
- Editor tabs (`.tab-bar`/`.tab`): the bar has `gap:4px` + `padding:6px 8px`; each tab is a `radius-sm` pill, **no** vertical `border-right` dividers. Active = raised surface (`--bg`) + hairline trace (`--shadow-sm` + inset 1px border), **no accent underline** (brand: zero-orange). `.tab-add`/`.tab-list-btn` rounded to match.
- Agent-mode context tabs (`.agent-context-tabs`/`.agent-context-tab`, Changes/Files) use the SAME pill treatment (full-width `flex:1` pills, active = raised + hairline) instead of the old bottom-border indicator.
- The removed `.tabs-pane.focused .tab-bar` accent box-shadow is gone (no orange line under the focused pane).

### Chat reading type + stream spacing (spaceship pass, 2026-07-01)
- Message body `.ai-msg-body .md-preview` is **13.5px** / line-height **1.6**; headings h1–h4 17/15/14/13; code blocks 13px; fallback `.ai-msg` 14px.
- **Vertical rhythm** (was cramped): messages `gap: 14px`; paragraphs `margin-bottom: 10px`; tool groups `.ai-tcalls` gap 7 / margin 8 (inline 10); `.ai-tcall-wrap` gap 7 / margin 8.
- **Gutters:** panel `.ai-panel` `padding: 0 5px`; stream `.ai-messages` asymmetric `8px 28px 8px 8px` (tight left, wide right so text + tool rows clear the nav rail). Assistant body `.ai-msg-assistant .ai-msg-body` = `padding: 0 8px`, **no left rail** (removed the hairline rule).
- Assistant identity header = **Jack** (duck avatar 32px + name 14px + "Project Manager" 10px) — full feature in `features/005-jack-duck-identity.md`.
- Composer controls (subagent pill, mic, effort popover, uniform toolbar): full detail in `features/022-chat-composer.md`. Navigation rail: `features/021-chat-nav-rail.md`.

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

### Model modals (catalog + visibility)
- **Choose a model** + **Manage models** share one shell: `.model-browser.liquid-glass`
  (760px catalog / 520px visibility). Cursor-style neutral chrome — pill search, pill header
  actions, uppercase provider sections, card rows (catalog) or `settings-toggle` rows (visibility).
- Light shell `#fcfcfd`; dark = charcoal gradient + rgba cards. Full pattern:
  `documentation/design/model-modal-pattern.md`. Feature wiring: `features/025-model-selector.md`.

### No emoji (enforced)
- Zero emoji in chrome — full rules in `design/directives.md`. Theme toggle uses
  sun/moon/monitor icons; composer Stop/Send-now are text. Minor leftover: SFTP `✓/✗`.

### Config
- Theme persisted: localStorage `lcp.theme` (`theme.ts`). Default = system, dark-first feel.
- `data-os` set once at boot from `navigator.platform`.
