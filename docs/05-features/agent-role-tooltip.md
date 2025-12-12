# Agent Role/Mission Tooltip Feature

**Status**: Implemented
**Date**: 2025-12-12
**Component**: `TerminalActivityBar` + `Tooltip`

## Overview

Displays agent role/mission information in a tooltip when hovering over the terminal name in the sidebar.

## Implementation

### Components Created

1. **Tooltip Component** (`/src/components/Tooltip.tsx`)
   - Reusable tooltip with glassmorphism design
   - Supports 4 positions: top, bottom, left, right
   - Smooth fade-in animation
   - Automatic arrow positioning
   - Dark theme with backdrop-blur

2. **Tooltip Styles** (`/src/components/Tooltip.css`)
   - Glassmorphism effects matching Quack design
   - Position-specific arrow styling
   - Responsive sizing (180px-300px width)
   - WCAG AA accessible contrast

### Updated Components

**TerminalActivityBar** (`/src/components/TerminalActivityBar.tsx`)
- Added tooltip wrapper around terminal name
- Displays agent role (from `terminal.personality.role`)
- Displays "Working on" status (from `terminal.workingOn`)
- Only shows tooltip when data is available
- Memoized tooltip content for performance

## Features

### Tooltip Content

The tooltip displays:
1. **Role/Mission** (bold) - from `terminal.personality.role`
2. **Working On** - from `terminal.workingOn`

Example:
```
Backend Performance Specialist
Working on: API optimization
```

### Design

- **Background**: `rgba(20, 24, 36, 0.96)` with backdrop-blur
- **Border**: `1px solid rgba(255, 255, 255, 0.1)`
- **Border Radius**: `12px`
- **Shadow**: `0 8px 24px rgba(0, 0, 0, 0.4)`
- **Animation**: Smooth fade-in on hover
- **Arrow**: Positioned based on tooltip direction

### Accessibility

- **Keyboard Navigation**: Tooltip shows on focus
- **Screen Readers**: Content is accessible via aria-describedby
- **Contrast**: WCAG AA compliant (4.5:1 minimum)
- **Motion**: Respects `prefers-reduced-motion`

## Usage

### Basic Usage

```tsx
import Tooltip from './Tooltip'

<Tooltip content="Simple text" position="right">
  <button>Hover me</button>
</Tooltip>
```

### Complex Content

```tsx
<Tooltip
  content={
    <>
      <strong>Role Title</strong>
      <p>Description line 1</p>
      <p>Description line 2</p>
    </>
  }
  position="right"
>
  <span>Hover target</span>
</Tooltip>
```

### Conditional Display

```tsx
<Tooltip
  content={tooltipContent}
  show={!!tooltipContent}
>
  <span>Name</span>
</Tooltip>
```

## Testing

All tests pass (5/5):
- Renders children correctly
- Displays tooltip content
- Applies position classes
- Conditional rendering (show prop)
- Complex content support

Run tests:
```bash
npm test -- src/components/Tooltip.test.tsx
```

## File Changes

### New Files
- `/src/components/Tooltip.tsx` - Tooltip component (45 lines)
- `/src/components/Tooltip.css` - Tooltip styles (100 lines)
- `/src/components/Tooltip.test.tsx` - Component tests (48 lines)

### Modified Files
- `/src/components/TerminalActivityBar.tsx`
  - Added Tooltip import
  - Added tooltip content memoization
  - Wrapped terminal-name with Tooltip

## Performance

- **Memoization**: Tooltip content is memoized to prevent unnecessary re-renders
- **Conditional Rendering**: Tooltip only renders when content exists
- **CSS Transitions**: GPU-accelerated opacity transitions
- **Zero Runtime Cost**: When no tooltip data, component passes through children

## Browser Compatibility

- Chrome/Edge: Full support
- Safari: Full support (backdrop-filter)
- Firefox: Full support
- Tauri WebView: Full support

## Future Enhancements

1. Add tooltip delay configuration
2. Support for multiple tooltip styles (info, warning, error)
3. Mobile touch support (long-press to show)
4. Tooltip positioning collision detection
5. Animation customization options

## Related

- **Architecture**: `/docs/01-architecture.md`
- **Component Pattern**: Follows Quack's glassmorphism design
- **Type Definitions**: `TerminalInfo.personality.role` in `/src/types.ts`
