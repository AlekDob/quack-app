---
type: gotcha
project: quack-app
created: 2026-03-30
last_verified: 2026-03-30
tags: [file-explorer, css, flex-wrap, indentation, ui]
---

# Gotcha: Explorer row icons clipped on deep indentation

## Trigger

File explorer rows at deep nesting levels (depth 3+). The count badge, Reveal in Finder icon, and @ mention button get clipped by the right edge of the panel.

## Why it happens

`explorer-row` uses `display: flex` with `marginLeft: depth * 24px` for indentation. At deep levels, available width shrinks but all items (expander, icon, name, count, actions) stay on one line. `explorer-name` has `flex: 1` so it shrinks, but the right-side elements get pushed out of view.

## Fix applied

1. Added `flex-wrap: wrap` to `.explorer-row` in both `App.css` and `FileExplorer.compact.css`
2. Changed `.explorer-count` from `margin-left: auto` to `margin-left: 0.25rem` + `flex-shrink: 0` — stays near the name instead of being pushed to the far right
3. Added `flex-shrink: 0` to `.explorer-file-actions` — prevents compression, wraps below instead

## Known limitation

`flex-wrap: wrap` alone may not always force actions to wrap because `explorer-name` with `flex: 1` absorbs available space. For deeply nested items, the action row pattern (separate div below, like `repo-action-row` in RepositoryGroup.tsx) would be more robust but requires JSX restructuring.

## Files

- `src/App.css` — `.explorer-row`, `.explorer-count`, `.explorer-file-actions`
- `src/components/FileExplorer.compact.css` — `.file-explorer .explorer-row`
