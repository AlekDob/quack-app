---
type: pattern
created: 2026-01-09
---

# Tool Widget Styling Pattern

All tool widgets in Quack follow a consistent pattern for styling chat tool results.

## File Structure

- **Component**: `src/components/{WidgetName}.tsx`
- **Styles**: `src/components/ToolWidgets.css` (shared styles)
- **Integration**: `src/components/StreamMessage.tsx`

## Base CSS Classes

- `.tool-widget` -- Container with border, rounded corners, margin
- `.tool-widget-header` -- Clickable header with padding, flex layout
- `.tool-widget-title` -- Icon + title with gap, font styling
- `.tool-widget-content` -- Expandable content area with background
- `.tool-widget-loading .spinner` -- Loading animation

## Status Colors

- pending: #f59e0b (Amber), running: #3b82f6 (Blue), completed: #10b981 (Green), error: #ef4444 (Red)

## Tool-Specific Colors (getToolColor)

MCP tools have distinctive colors; core SDK tools share unified green (#22c55e).

| Category | Color | Hex |
|----------|-------|-----|
| MCP Brain | vibrant rose | #E84A7F |
| MCP IDE | purple | #a855f7 |
| MCP Code-intel | cyan | #06b6d4 |
| MCP Visualizer | fuchsia | #d946ef |
| MCP PostHog | pink/magenta | #ec4899 |
| Other MCP | orange | #f97316 |
| Skill | gold/amber | #fbbf24 |
| Agent Teams (primitives) | lilac | #C084FC |
| Agent Teams (messages) | cyan | #06B6D4 |
| Agent Teams (tasks) | amber | #F59E0B |
| Cron/automation | teal | #14b8a6 |
| Worktree | green | #22c55e |
| Core SDK tools | green | #22c55e |

Each MCP category also has a distinctive SVG icon in `ToolIcon` (same file).

## Steps to Add New Widget

1. Create `src/components/{WidgetName}.tsx`
2. Add CSS to `src/components/ToolWidgets.css`
3. Import + memo in `src/components/StreamMessage.tsx`
4. Add case in tool rendering logic
