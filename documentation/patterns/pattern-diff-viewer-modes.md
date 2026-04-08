---
type: pattern
project: quack-app
created: 2026-04-08
last_verified: 2026-04-08
tags: [diff-viewer, split-view, fullscreen, portal, unified-diff]
---

# DiffViewer Multi-Mode Pattern

## Problem
Inline diffs in chat have a 200px max-height and single-column layout, making it hard to review large edits or compare old vs new side-by-side.

## Solution
Three composable view modes in `DiffViewer.tsx`:

### 1. Unified (default)
Standard inline diff -- removed lines (red) followed by added lines (green).

### 2. Split (side-by-side)
Two 50% columns: left = old (removed), right = new (added). Unchanged lines mirrored on both sides.

**Key function**: `buildSplitRows(lines: DiffLine[]) -> SplitRow[]`
- Buffers consecutive removed/added lines
- On `unchanged` line: flushes buffer, pairing removed[i] with added[i]
- Excess lines get `null` on the shorter side (rendered as `.diff-line-empty`)

### 3. Fullscreen (overlay)
Portal-based overlay (`createPortal` to `document.body`) with:
- Backdrop blur + dark overlay
- 1200px max-width centered container
- No max-height (full scroll)
- Larger font (12px vs 10px inline)
- Escape key + click-outside to close

### Composition
Split + Fullscreen combine freely. The `DiffContent` component is shared between inline and fullscreen rendering to avoid duplication.

## Files
| File | Role |
|------|------|
| `src/components/DiffViewer.tsx` | Component: `buildSplitRows`, `DiffContent`, `DiffViewer` |
| `src/components/DiffViewer.css` | Styles: `.diff-split`, `.diff-fullscreen-overlay`, `.diff-viewer--fullscreen` |

## Header Buttons
Two toggle buttons in `.diff-viewer-header`, both 22x22px fixed size:
1. Split toggle (split-pane SVG icon)
2. Fullscreen toggle (expand/collapse SVG icon, changes icon based on state)

CSS: `.diff-view-toggle:first-of-type { margin-left: auto }` pushes both buttons right.

## Gotchas
- Fullscreen uses `createPortal` so it escapes any parent `overflow: hidden`
- `splitRows` is memoized and only computed when `splitMode` is true
- Escape listener is added/removed via `useEffect` tied to `fullscreen` state
- Both buttons share the same `.diff-view-toggle` class; `.active` adds blue accent
