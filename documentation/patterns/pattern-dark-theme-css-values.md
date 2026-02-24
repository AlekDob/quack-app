---
type: pattern
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [css, theme, dark, design, ui]
---

# Dark Theme CSS Reference Values

## Overview

Quack uses a consistent dark theme across all views (Kanban, Automation, etc.). When building new views, reuse these exact values to maintain visual consistency.

## Core Values

| Element | Value | Notes |
|---------|-------|-------|
| App background | `#0f111a` | Applied at app level, views use `transparent` |
| View background | `transparent` | Lets app bg show through |
| Card background | `rgba(255, 255, 255, 0.06)` | Subtle glass effect |
| Card hover | `rgba(255, 255, 255, 0.09)` | Slightly brighter on hover |
| Card border | `rgba(255, 255, 255, 0.08)` | Thin border, 1px |
| Modal background | `#141620` | Slightly lighter than app bg |
| Accent color | `#f28c52` | Orange, Quack brand |
| Accent hover | `#e07a42` | Darker orange on hover |
| Success/done | `#22c55e` | Green for completed states |
| Text primary | `rgba(255, 255, 255, 0.9)` | Main text |
| Text secondary | `rgba(255, 255, 255, 0.5)` | Labels, hints |
| Text muted | `rgba(255, 255, 255, 0.3)` | Timestamps, metadata |

## CSS Template for New Views

```css
.my-view {
  background: transparent;
  color: rgba(255, 255, 255, 0.9);
}

.my-card {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 12px;
}

.my-card:hover {
  background: rgba(255, 255, 255, 0.09);
}

.my-button-primary {
  background: #f28c52;
  color: white;
}

.my-button-primary:hover {
  background: #e07a42;
}
```

## Reference Files

- `src/components/kanban/KanbanView.css` — canonical dark theme implementation
- `src/components/automation/AutomationView.css` — follows the same values
