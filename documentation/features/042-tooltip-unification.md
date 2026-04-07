---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18)
created: 2026-04-05
last_verified: 2026-04-05
tags: [tooltip, keyboard-shortcut, ui-consistency, portal-rendering]
---

## Tooltip Unification
**Purpose:** Single tooltip system replacing 4 legacy patterns (native title, CSS data-tooltip, action-icon-tooltip spans, custom CSS) with a consistent portal-rendered component.
**Stack:** React 18, TypeScript strict, CSS custom properties

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/KeyboardShortcutTooltip.tsx` | `KeyboardShortcutTooltip` — unified tooltip with optional kbd badge |
| Config | `src/components/KeyboardShortcutTooltip.css` | Dark glassmorphism styles, fixed positioning, z-index max |

### Consumers
| Type | Path | Usage |
|------|------|-------|
| Component | `src/components/ActionIcons.tsx` | Sidebar icons: Kanban, Automation, Office, Whiteboard, Git, Terminal, Store, Telegram, Side Panel |
| Component | `src/components/ChatInput.tsx` | Attach files button |
| Component | `src/components/ChatView.tsx` | Update Brain, BTW, Quick Loop buttons |
| Component | `src/components/SidebarViewToggle.tsx` | Projects / Task Hub toggle |
| Component | `src/components/TerminalSidebar.tsx` | New Project, Create Group, Favorites toggle |
| Component | `src/components/featureMap/AnnotationToolbar.tsx` | Select (1), Lasso (2), Post-it (3), Group (4), Image (5), selection badge, Create Component |

### Data Flow
[MouseEnter/Focus on wrapper] → [getBoundingClientRect() calculates position] → [createPortal to document.body] → [CSS transition opacity+scale]

### Key Functions
- `KeyboardShortcutTooltip({ children, label, shortcut?, position?, delay? }) → ReactElement` — wraps any element with hover/focus tooltip
- `updatePosition() → void` — calculates fixed coords from wrapper rect, clamps to viewport
- `showTooltip() → void` — triggers position calc, applies optional delay, sets visible
- `hideTooltip() → void` — clears timeout, hides tooltip

### Props Interface
- `label`: string — tooltip text (required)
- `shortcut`: string — keyboard shortcut badge, e.g. "⌘K" (optional, omit for label-only)
- `position`: "top" | "bottom" | "left" | "right" — placement relative to wrapper (default: "bottom")
- `delay`: number — ms before showing (default: 0, instant)

### State
- `isVisible`: boolean — tooltip show/hide (component)
- `tooltipPos`: { top: number, left: number } — fixed coordinates (component)

### Design Decisions
- **Portal rendering**: `createPortal(tooltip, document.body)` avoids `overflow: hidden` clipping from parent containers
- **Fixed positioning**: independent of scroll context, recalculates on scroll/resize events
- **z-index 2147483647**: max 32-bit int ensures tooltip always on top (sidebars, modals, drawers)
- **No delay by default**: instant feedback, unlike browser native tooltips (~400ms)
- **Viewport clamping**: 8px padding prevents edge clipping

### Patterns Replaced
| Legacy Pattern | Problem | Replaced With |
|----------------|---------|---------------|
| Native `title` attribute | Slow 400ms delay, unstyled, no shortcut badge | `<KeyboardShortcutTooltip label="...">` |
| CSS `[data-tooltip]::after` | Clipped by `overflow: hidden`, no portal | Portal-rendered fixed tooltip |
| `.action-icon-tooltip` spans | Inconsistent positioning, z-index fights | Unified component |
| Custom per-component CSS tooltips | Duplicated styles, maintenance burden | Single CSS file |
