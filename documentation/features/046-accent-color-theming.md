---
type: feature-doc
project: quack-app
stack: Tauri v2 (Rust) + React 18 (TypeScript)
created: 2026-04-06
last_verified: 2026-04-06
tags: [046-accent-color-theming, appearance, theming, accent-color, css-variables, settings]
---

## Accent Color Theming
**Purpose:** User-customizable primary accent color with 10 curated presets + custom color picker. All UI elements derive color from CSS custom properties, enabling instant theme changes.
**Stack:** React 18 + TypeScript + Zustand + CSS Custom Properties

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Util | src/utils/accentColor.ts | `applyAccentColor(hex)`, `ACCENT_PRESETS`, `DEFAULT_ACCENT`, `AccentPreset` (type) -- hex-to-CSS-variable theming engine |
| Store | src/stores/settingsStore.ts | `appearance.accentColor` field, `setAccentColor()`, `resetAccentColor()` -- persisted accent color state (v8 migration) |
| Component | src/components/settings/categories/AppearanceSettings.tsx | Accent color UI -- preset grid + custom color picker popover + reset button |
| Component | src/components/settings/controls/CustomColorPicker.tsx | `CustomColorPicker` -- HSL-based color picker with S/L 2D area, hue bar, hex input. Rendered as portal with `position: fixed` (Brain: fix-custom-color-picker-webkit) |
| Bootstrap | src/App.tsx | `useLayoutEffect` applying accent color before first paint |
| Tokens | src/index.css | `:root` CSS variables -- source of truth for all accent-derived values |
| Style | src/components/settings/UnifiedSettings.css | `.accent-color-grid`, `.accent-swatch-*`, `.accent-reset-btn`, `.custom-color-picker`, `.ccp-*` styles |

### CSS Variables (source of truth in index.css :root)
| Variable | Default | Purpose |
|----------|---------|---------|
| `--accent-color` | `#f28c52` | Primary accent hex |
| `--accent-rgb` | `242, 140, 82` | RGB triplet for rgba() usage |
| `--accent-surface` | `rgba(var(--accent-rgb), 0.10)` | Subtle background tint |
| `--accent-surface-strong` | `rgba(var(--accent-rgb), 0.20)` | Stronger background tint |
| `--accent-border` | `rgba(var(--accent-rgb), 0.25)` | Accent-tinted borders |
| `--accent-text` | `#ffecd9` | Light text derived from accent |
| `--accent-gradient-end` | `#b6693d` | Darker shade for gradients |
| `--accent-hover` | `#f4a176` | Lighter shade for hover states |

### Preset Palette
| Label | Hex |
|-------|-----|
| Quack Orange (default) | `#f28c52` |
| Electric Blue | `#3b82f6` |
| Emerald | `#10b981` |
| Violet | `#8b5cf6` |
| Rose | `#f43f5e` |
| Amber | `#f59e0b` |
| Cyan | `#06b6d4` |
| Fuchsia | `#d946ef` |
| Lime | `#84cc16` |
| Sky | `#0ea5e9` |

### Data Flow
- [App.tsx mount] -> [useSettingsStore.appearance.accentColor] -> [applyAccentColor(hex)] -> [CSS :root variables set]
- [User selects preset/custom] -> [setAccentColor(hex)] -> [applyAccentColor(hex) + Zustand persist] -> [all UI updates instantly]
- [applyAccentColor] -> [hexToRgb] -> [darken/lighten] -> [document.documentElement.style.setProperty for 8 variables]

### Key Functions
- `applyAccentColor(hex: string) -> void` -- parses hex, computes derived shades, sets 8 CSS variables on :root
- `hexToRgb(hex: string) -> [r, g, b]` -- converts #rrggbb or #rgb to RGB tuple
- `darken(rgb, amount) -> [r, g, b]` -- darkens by percentage (0-1)
- `lighten(rgb, amount) -> [r, g, b]` -- lightens by mixing with white
- `CustomColorPicker({ value, onChange, onClose, anchorPos }) -> JSX` -- portal-based floating HSL picker
- `hexToHsl(hex) -> [h, s, l]` -- converts hex to HSL (in CustomColorPicker)
- `hslToHex(h, s, l) -> string` -- converts HSL to hex (in CustomColorPicker)

### State
- `appearance.accentColor`: string -- hex color (global, persisted in `settings-storage` v8)

### Migration
- v8: adds `appearance: { accentColor: '#f28c52' }` for existing users

### Exceptions (cannot use CSS variables)
| Context | Reason | Files |
|---------|--------|-------|
| PixiJS canvas | WebGL renderer requires resolved hex at draw time | FeatureMapCanvas.tsx, CanvasImage.tsx, OfficeBreakRoomLabel.tsx |
| xterm.js SearchAddon | Terminal addon API accepts only hex strings | TerminalSearchBar.tsx |
| Mermaid themeVariables | Mermaid init requires hex at config time | BrainEditor.tsx |
| Project/agent color pickers | User-chosen colors saved to store, not accent | RepositoryGroup.tsx, GroupCreationModal.tsx |

### Cross-Feature Links
| Feature | Relationship |
|---------|-------------|
| 037-unified-settings-panel | Parent -- accent color lives in Appearance category |
| pattern-dark-theme-css-values | Updated -- now references CSS variables instead of hardcoded hex |

### UX Notes
- Color change is instant (no restart required)
- Custom color picker opens as floating popover above the "Custom" swatch (portal + `position: fixed`). Built from scratch because `<input type="color">` does not work in WKWebView (Brain: fix-custom-color-picker-webkit)
- Picker features: 2D saturation/lightness area, hue slider, hex input, live preview. Closes on outside click. Auto-flips below if no space above
- Reset button only appears when color differs from default
