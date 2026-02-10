---
type: pattern
project: quack-app
created: 2026-01-09
migrated: true
---

# pattern-tool-widget-styling

## Tool Widget Styling Pattern

All tool widgets in Quack follow a consistent pattern for styling chat tool results.

### File Structure
- **Component**: `src/components/{WidgetName}.tsx`
- **Styles**: `src/components/ToolWidgets.css` (shared styles)
- **Integration**: `src/components/StreamMessage.tsx`

### Base CSS Classes
- `.tool-widget` - Container with border, rounded corners, margin
- `.tool-widget-header` - Clickable header with padding, flex layout
- `.tool-widget-title` - Icon + title with gap, font styling
- `.tool-widget-content` - Expandable content area with background
- `.tool-widget-loading .spinner` - Loading animation

### Status Colors
```typescript
const statusColors = {
  pending: '#f59e0b',    // Amber
  running: '#3b82f6',    // Blue  
  completed: '#10b981',  // Green
  error: '#ef4444',      // Red
  unknown: '#6b7280',    // Gray
};
```

### Tool-Specific Colors (getToolColor)
- WebFetch/Search: `#10b981` (green)
- Brain tools: `#E84A7F` (rose)
- Kanban: `#06b6d4` (cyan)
- Bash: `#f59e0b` (amber)
- File ops: `#3b82f6` (blue)
- Edit/Write: `#ec4899` (pink)
- TodoWrite: `#14b8a6` (teal)

### Widget Integration in StreamMessage.tsx
1. Import widget component
2. Create memoized version: `const MemoizedWidget = memo(Widget)`
3. Add case in tool rendering logic (around line 397)
4. Match by `toolName` (lowercase tool name)
5. Return `<React.Fragment>` with GIF + Widget

### Example Widget Structure
```tsx
interface WidgetProps {
  data: SomeType;
  isLoading: boolean;
  defaultExpanded?: boolean;
}

export const Widget: React.FC<WidgetProps> = ({ data, isLoading }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <div className="tool-widget custom-widget">
      <div className="tool-widget-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="tool-widget-title">
          <ToolIcon name="ToolName" />
          <span>Tool Name</span>
        </div>
        {isLoading && <div className="tool-widget-loading"><div className="spinner" /></div>}
      </div>
      {isExpanded && <div className="tool-widget-content">...</div>}
    </div>
  );
};
```

### Files Modified for New Widgets
1. Create `src/components/{WidgetName}.tsx`
2. Add CSS to `src/components/ToolWidgets.css`
3. Import + memo in `src/components/StreamMessage.tsx`
4. Add case in tool rendering logic

[2026-01-09] Created during TaskOutputWidget implementation
