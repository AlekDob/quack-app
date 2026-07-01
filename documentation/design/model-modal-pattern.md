---
type: design-pattern
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-01
tags: [design, model-browser, modal, liquid-glass, cursor-style, light-theme, dark-theme]
---

# Model modal pattern (catalog + visibility)

Operational style guide for **Choose a model** (`ModelBrowser`) and **Manage models** (`ManageModelsModal`). Both surfaces share one CSS vocabulary so light/dark themes stay aligned with Settings and the command palette.

Reference implementation: `src/App.css` (block starting at `.model-browser`), live components in `src/components/ModelBrowser.tsx` and `ManageModelsModal.tsx`.

## When to use this pattern

| Surface | Classes | Width |
|---------|---------|-------|
| Full model catalog | `model-browser liquid-glass` | `min(760px, 92vw)` |
| Visibility toggles | `model-browser liquid-glass manage-models-modal` | `min(520px, 92vw)` |
| Quick pick (composer) | `model-picker-pop` | 288px popover — **not** this doc; see `features/025-model-selector.md` |

**Rule:** any new model-related modal MUST reuse `model-browser` + `liquid-glass`. Do not introduce a third modal skin (no bespoke `.manage-models-head`, no separate color stack).

## Shell anatomy

```
settings-backdrop
└── .model-browser.liquid-glass[.manage-models-modal]
    ├── .model-browser-head[.model-browser-head-stacked]
    │   ├── .model-browser-title (+ optional .model-browser-head-sub)
    │   └── .model-browser-head-actions
    │       ├── .model-browser-configure (pill action)
    │       └── .settings-close (X)
    ├── .model-browser-toolbar
    │   ├── .model-browser-search (pill input)
    │   └── .settings-segmented (catalog only — provider filter pills)
    └── .model-browser-list (scrollable — NO glass on this node)
        └── .model-browser-section
            ├── .model-browser-section-title (uppercase label)
            └── rows: .model-card (catalog) | .manage-models-row (visibility)
```

### Backdrop + focus

- Portal to `document.body` via `createPortal`.
- Outer: `settings-backdrop` — click dismisses.
- Inner: `useModalFocus` + `tabIndex={-1}`; stop propagation on `mousedown`.
- Close control: `settings-close` with `Icon name="x"` — same as Settings modal.

## Visual language (Cursor-style neutral)

1. **Monochrome chrome** — no orange/accent on cards, filters, or primary actions. Selection = `--bg-hi` + hairline border, not a colored fill.
2. **Liquid glass on the shell only** — `.liquid-glass` on the outer modal frame. The scrollable `.model-browser-list` stays opaque/token-based; never blur a scrolling region.
3. **Pill controls** — search field and header actions use `border-radius: var(--radius-full)`. Segmented provider tabs are nested pills inside a pill track.
4. **Soft elevation** — `box-shadow: var(--shadow-lg)` on shell; cards/rows lift with subtle border on hover, not heavy drop shadows per row.
5. **Section rhythm** — uppercase 11px section titles (`letter-spacing: 0.05em`), 6–8px gap between rows, section dividers via `border-bottom: 1px solid var(--border)`.

## Row treatments

### Catalog row (`.model-card`)

- Padding `11px 13px`, `radius-md`, `background: var(--bg-alt)`.
- Hover: `--bg-hi` + `border-color: var(--border)`.
- Selected: inset 1px trace (`box-shadow: inset 0 0 0 1px var(--border-strong)`).
- Left: name + optional description; right: context metadata — no colored badges.

### Visibility row (`.manage-models-row`)

- Same footprint as a compact card: `8px 10px`, `radius-md`.
- Label: `.manage-models-row-label` with ellipsis.
- Toggle: **reuse** `.settings-toggle` / `.settings-toggle-knob` from Settings — never invent a second switch style.

## Theme overrides (explicit surfaces)

Token defaults are not enough for the intended Cursor-like softness. Theme blocks in `App.css` set explicit values:

### Light (`:root[data-theme="light"]`)

| Element | Treatment |
|---------|-----------|
| Shell `.model-browser.liquid-glass`, `.manage-models-modal.liquid-glass` | `#fcfcfd` background, soft shadow `0 24px 64px rgba(15,17,21,0.12)` |
| Search / segmented track | `#ffffff` fill, `rgba(0,0,0,0.08)` border |
| Cards / manage rows | `#ffffff` base; hover `#f8f9fb` |
| Configure pill | white fill, grey border; hover `#f5f6f8` |

### Dark (`:root[data-theme="dark"]`)

| Element | Treatment |
|---------|-----------|
| Shell | Gradient `rgba(28,31,38,0.97)` → `rgba(18,20,26,0.98)`, deep shadow |
| Search / segmented | `rgba(255,255,255,0.04)` fill |
| Cards / manage rows | `rgba(255,255,255,0.035)`; hover `0.06` |

**When adding a new child control inside these modals:** extend the existing `:root[data-theme="light|dark"] .model-browser…` blocks (comma-group `.manage-models-modal` where shared). Do not hardcode colors on the component.

## Header variants

| Variant | Use |
|---------|-----|
| `.model-browser-head` | Single-line title (catalog) |
| `.model-browser-head.model-browser-head-stacked` | Title + subtitle (manage modal) |

Subtitle copy uses `.model-browser-head-sub` (`12.5px`, `--fg-dim`).

## Checklist (before shipping UI changes)

- [ ] Shell uses `model-browser liquid-glass` (+ `manage-models-modal` if narrow).
- [ ] Backdrop is `settings-backdrop`; close is `settings-close`.
- [ ] Search uses `model-browser-search` (pill).
- [ ] List scrolls inside `.model-browser-list` only.
- [ ] No hardcoded hex/rgba on components — theme block or CSS variable.
- [ ] Toggles are `settings-toggle`, not custom switches.
- [ ] Verified in **both** light and dark via theme menu.
- [ ] User-facing strings in **English** (app rule).

## Related docs

- Tokens + global rules: `features/003-design-system.md`, `design/directives.md`
- Feature wiring: `features/025-model-selector.md`
- Cursor provider backend: `features/026-cursor-cli-bridge.md`
