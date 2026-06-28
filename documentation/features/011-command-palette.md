---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-06-28
tags: [command-palette, search, fuzzy, files, commands, symbols, cursor-style, ctrl-p]
---

## Command Palette
**Purpose:** The Ctrl/⌘P overlay to jump anywhere — switch workspace, open a file, run a
command, jump to a symbol, or full-text search. Cursor-style rows: leading type icon,
label, trailing hint. Opened from the centered top-bar search or the shortcut.
**Stack:** React 19, TypeScript strict, fuzzy match + command history scoring

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/CommandPalette.tsx` | The overlay: input, modes, fuzzy filter, `iconForCategory`, keyboard nav |
| Service | `src/actions.ts` | `commands` registry (`CommandSpec`) — the runnable command list |
| Service | `src/commandHistory.ts` | `recordCommand` / `scoreCommand` — recency boosts frequent picks |
| Service | `src/ipc.ts` | `search` (files / symbols) for the file & `@`-symbol modes |
| Service | `src/paletteBus.ts` | `onPaletteOpen` — lets shortcuts open the palette in a given mode |
| Config | `src/App.css` | `.palette*` styles (Cursor-style rows) |

### Modes (prefix-driven)
| Prefix | Mode | Source |
|--------|------|--------|
| (none) | mixed: workspaces + files + commands | registry + recent files |
| `>` | commands only | `actions.commands` |
| `@` | symbols in the active file | `ipc.search` (symbols) |
| `?` | full-text content search | `ipc.search` (text, debounced) |

### Row anatomy (Cursor-style)
- `.palette-item` — compact (`7px 10px`), `radius-sm`, small margin; active = `--bg-hi`
  rounded (NO accent bar — zero-orange brand).
- `.palette-item-icon` — leading type icon via `iconForCategory(category)`:
  workspace→folder, file→file-text, symbol→code, git→git-branch, search→search, else→command.
- `.palette-item-label` — flex, ellipsis. `.palette-item-hint` — trailing, mono, `margin-left:auto`.
- The old uppercase text category column (`.palette-item-cat`) is `display:none` (kept for back-compat).

### Key functions
- `fuzzy(query, text) → boolean` — char-by-char subsequence match
- `iconForCategory(cat) → Icon name` — category → leading glyph
- `scoreCommand` / `recordCommand` — history-weighted ranking of commands

### Notes
- The top-bar command center (`.topbar-search`, centered VS-Code-style) is the mouse entry
  point; `onPaletteOpen` + the shortcut are the keyboard ones. See `003-design-system.md`.
