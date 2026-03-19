---
type: gotcha
project: quack-app
created: 2026-03-19
last_verified: 2026-03-19
tags: [tauri, drag-region, empty-state, window, ux]
---
# Empty state has no drag region (window not movable on first launch)

## Problem
When Quack launches with zero projects, the `TerminalSidebar` is not rendered (conditional: `terminals.length > 0 || persistedProjects.size > 0`). Since all `data-tauri-drag-region` attributes live inside the sidebar (`sidebar-header-top` and `sidebar-header`), the window becomes completely non-draggable on first launch.

The old `TitleBar` component was removed in favor of native macOS decorations + sidebar drag regions, but no fallback was added for the empty state.

## Fix
Added an invisible 40px-tall absolute-positioned div with `data-tauri-drag-region` at the top of the empty state container in `App.tsx`. This provides a draggable area when the sidebar is hidden.

```tsx
<div
  data-tauri-drag-region
  style={{
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: '40px',
    zIndex: 10,
  }}
/>
```

## Key insight
Any view that hides the sidebar must provide its own drag region. Check for this pattern whenever adding new full-screen states that bypass the sidebar.

## Files
- `src/App.tsx` — empty state block (around line 11489+)
