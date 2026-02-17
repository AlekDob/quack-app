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

- WebFetch/Search: #10b981 (green)
- Brain tools: #E84A7F (rose)
- Kanban: #06b6d4 (cyan)
- Bash: #f59e0b (amber)
- File ops: #3b82f6 (blue)
- Edit/Write: #ec4899 (pink)

## Steps to Add New Widget

1. Create `src/components/{WidgetName}.tsx`
2. Add CSS to `src/components/ToolWidgets.css`
3. Import + memo in `src/components/StreamMessage.tsx`
4. Add case in tool rendering logic
