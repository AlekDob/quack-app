---
type: design-directives
project: quack-desktop
created: 2026-06-28
last_verified: 2026-07-01
tags: [design, directives, ui, brand, rules, no-emoji, tokens, cursor-style]
---

# Quack — Design Directives

Operational do/don't for any UI work. The *reference* (tokens, file map, gotchas)
lives in `features/003-design-system.md`; this file is the **rules** you follow
while building. When in doubt, match Cursor's restraint.

## Hard rules (never break)

1. **NO emoji anywhere in the app chrome.** Use SVG icons (`src/components/Icon.tsx`).
   This includes toggles, buttons, status, menus, empty states. Emoji are allowed
   only inside user-authored content, never in our UI. (Past offenders fixed:
   theme toggle ☀🌙⚙, composer `◼ Stop` / `⏭ Send now`.)
2. **All visual values via CSS variables** (`src/App.css`). Never hardcode a color,
   radius, shadow, blur, or font. If a token is missing, add it — don't inline.
3. **Zero-orange chrome.** `--accent` is a NEUTRAL grey. Real color appears ONLY on
   per-project workspace badges (chosen palette) and semantic states (ok/warn/err).
4. **Primary actions are monochrome** — `--primary-bg` (= `--fg`): near-white in
   dark, near-black in light. Not colored.
5. **Selections = neutral** `--bg-hi` (+ optional thin trace). Never a full accent fill.

## Look & feel

- **Premium minimal, dark-first**, with a full light sibling. Match Apple/Vercel/Cursor restraint.
- **Liquid glass** (`.liquid-glass` / `--glass-bg` + blur) on STATIC surfaces only —
  topbar, dropdowns, palette, popovers, modals. NEVER on scrollable lists.
- **Radii:** `--radius-xs/sm/md/lg/full` (5/8/14/20/999); window = `--radius-window` (12).
  Pills (`radius-full`) for chips/toggles; `radius-sm` for buttons/rows; `radius-lg` for modals.
- **Density:** dense where it's functional (editor, file tree, tabs); airy where it's
  conversational (chat, empty states, modals). Don't inflate an IDE like a landing page.
- **Motion:** use `--ease-*` / `--duration-*`; respect `prefers-reduced-motion`.

## Component patterns (the established ones)

- **Rows / list items (palette, settings nav):** compact, `radius-sm`, small margin,
  leading icon, trailing hint; active = `--bg-hi` rounded, no accent bar.
- **Toggles / segmented:** pill, icon + label, active = `--bg-hi` (neutral).
- **Composer:** one pill (`.ai-composer-shell`); textarea on top, controls below;
  advanced (effort/thinking) collapse behind a `⚙` icon only when narrow (container query).
- **Top bar:** Quack logo + name; command center (search) centered VS Code-style.
- **Native macOS window:** `titleBarStyle: Overlay` + `hiddenTitle`; custom chrome on Win/Linux.
- **Model modals:** reuse `.model-browser.liquid-glass` for catalog + visibility — pill search,
  `settings-close`, `settings-toggle` for visibility rows; theme-specific surfaces in `App.css`.
  See `design/model-modal-pattern.md`. Do not fork a third modal style.

## Workflow

- **Surgical CSS-first.** Rebrand/restyle by changing token values, not by rewriting
  components or adding a framework (no Tailwind/shadcn — see `decisions/002`).
- **Verify in the running app** (`npm run tauri dev`) — visual changes go in via HMR.
- After non-trivial UI work: update `features/003-design-system.md` if a pattern
  changed, and add a `diary/` entry.

## Don't

- Don't add emoji, hardcoded colors, or a second styling system.
- Don't put accent (orange) back into the chrome — it lives on projects + semantics only.
- Don't apply glass to scrollable content. Don't underline active tabs with accent.
