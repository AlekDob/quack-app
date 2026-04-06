---
type: pattern
project: quack-app
created: 2026-02-24
last_verified: 2026-04-06
tags: [css, theme, dark, design, ui, accent-color, css-variables]
---

# Dark Theme CSS Reference Values

## Overview

Quack uses a consistent dark theme across all views (Kanban, Automation, etc.). When building new views, reuse these CSS variables to maintain visual consistency. **Never hardcode accent hex values** -- always use `var(--accent-*)` tokens so the user's chosen accent color propagates everywhere.

## Core Values

| Element | Value | Notes |
|---------|-------|-------|
| App background | `var(--bg-base)` / `#0f1115` | Applied at app level, views use `transparent` |
| View background | `transparent` | Lets app bg show through |
| Card background | `var(--bg-elevated)` | Subtle glass effect |
| Card hover | `var(--bg-hover)` | Slightly brighter on hover |
| Card border | `var(--border-default)` | Thin border, 1px |
| Modal background | `var(--bg-surface)` | Slightly lighter than app bg |
| Accent color | `var(--accent-color)` | User-customizable (default: `#f28c52`) |
| Accent hover | `var(--accent-hover)` | Lighter shade, auto-derived |
| Accent gradient end | `var(--accent-gradient-end)` | Darker shade for gradients |
| Accent surface | `var(--accent-surface)` | 10% opacity tint |
| Accent border | `var(--accent-border)` | 25% opacity border |
| Success/done | `var(--semantic-success)` | Green for completed states |
| Text primary | `var(--text-primary)` | Main text |
| Text secondary | `var(--text-secondary)` | Labels, hints |
| Text muted | `var(--text-tertiary)` | Timestamps, metadata |

## CSS Template for New Views

```css
.my-view {
  background: transparent;
  color: var(--text-primary);
}

.my-card {
  background: var(--bg-elevated);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-md);
}

.my-card:hover {
  background: var(--bg-hover);
}

.my-button-primary {
  background: var(--accent-color);
  color: white;
}

.my-button-primary:hover {
  background: var(--accent-hover);
}

/* For rgba with custom opacity, use --accent-rgb */
.my-badge {
  background: rgba(var(--accent-rgb), 0.15);
  color: var(--accent-color);
}

/* For gradients */
.my-gradient {
  background: linear-gradient(135deg, var(--accent-color), var(--accent-gradient-end));
}
```

## Accent Color System

The accent color is user-customizable via Settings > Appearance. All derived values are auto-computed by `applyAccentColor()` in `src/utils/accentColor.ts`. See `documentation/features/046-accent-color-theming.md` for full details.

**Do NOT hardcode these hex values in new code:**
- `#f28c52`, `#FF6B35`, `#f7931e`, `#e67339`, `#e67a40`, `#ffecd9`

**Exceptions** (contexts that cannot use CSS variables):
- PixiJS canvas (WebGL requires resolved hex)
- xterm.js SearchAddon (API accepts only hex strings)
- Mermaid themeVariables (requires hex at init time)

## Reference Files

- `src/index.css` — design tokens source of truth (`:root` block)
- `src/utils/accentColor.ts` — runtime accent color application
- `src/components/kanban/KanbanView.css` — canonical dark theme implementation
- `src/components/automation/AutomationView.css` — follows the same values
