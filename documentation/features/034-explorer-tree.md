---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-03
last_verified: 2026-07-03
tags: [file-tree, explorer, git, indent, layout, light-theme, design-system, cursor-style]
---

## Explorer file tree (layout + git decorations)
**Purpose:** Cursor/VS Code-style file explorer: colored per-type icon tints, theme-aware git filename colors, indent guides, and stable row alignment. Color is confined to the explorer panel — topbar/composer/tabs stay neutral chrome.
**Stack:** React 19, `FileTree.tsx`, `fileIcons.ts`, `gitStatusStore.ts`, tokens in `App.css`

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Tree UI | `src/components/FileTree.tsx` | Recursive `Node`; `--tree-depth` on each row; git badge/dot |
| Icons | `src/fileIcons.ts` | `fileIconName()` shape + `fileIconTint()` CSS class suffix |
| Git palette | `src/gitStatusStore.ts` | `statusTone`, `statusClass`, `statusColor` (CSS vars) |
| Reveal | `src/revealInTree.ts` | `autoRevealInTree` — expand ancestors + scroll row into view |
| Store | `src/store.ts` | `openFile` / `setActiveTab` call `autoRevealInTree` |
| Styles | `src/App.css` | `--tree-indent-step`, `--tree-tint-*`, `--git-*`, `.git-status--*` |
| Source control | `src/components/SourceControlPanel.tsx` | Same `statusClass` as tree (no hardcoded hex) |

### Layout model
- Each row sets `--tree-depth` (0 = workspace root children) and `padding-left: calc(8px + depth × --tree-indent-step)`.
- **Indent guides:** `::before` pseudo on `.tree-row` draws vertical hairlines per depth step (Cursor-like).
- **No horizontal scroll:** `.tree { overflow-x: hidden }` + `.tree-name { flex: 1; min-width: 0 }` — long names ellipsize instead of widening the row (fixes false “wrong indent” when names differ in length).
- **Icon alignment:** `.tree-icon` / `.tree-caret` are `display: flex` + centered; SVG `display: block`. Inline-SVG baseline alignment caused staggered icons when active row used `font-weight: 600` on the name.
- **Reveal scroll:** `scrollIntoView({ block: "nearest", inline: "nearest" })` — avoids horizontal jitter on long filenames.

### Git decorations
| Surface | Behavior |
|---------|----------|
| File row name | `.git-status--{tone}` on `.tree-name` when file has git status |
| File badge | `M` / `U` / … on right edge, same tone class |
| Folder dot | `.tree-name--dirty-dir` + `.tree-git-dot` (`--warn`) when subtree has changes |

**Tones** (`statusTone`): `conflict`, `added` (incl. untracked `U`), `modified`, `deleted`, `renamed`, `neutral`.

**Theme tokens** (`--git-*` in `App.css`):
| Token | Dark | Light (darker ink for contrast) |
|-------|------|----------------------------------|
| `--git-modified` | `#e2c08d` | `#92400e` |
| `--git-added` | `#73c990` | `#15803d` |
| `--git-deleted` | `#c75252` | `#b91c1c` |
| `--git-renamed` | `#9cdcfe` | `#0369a1` |
| `--git-conflict` | `#e5734f` | `#c2410c` |

Use `statusClass(f)` at call-sites — never inline `#e2c08d`-style hex (illegible on light backgrounds).

### Auto-reveal in tree
- `autoRevealInTree(wsId, path)` — no-op for paths outside workspace root (`~/.claude` assets, etc.).
- Wired from `store.openFile` (new + existing tab) and `store.setActiveTab` so switching tabs keeps the sidebar tree in sync.
- `openFileAndReveal` remains a named helper; `openFile` already reveals — avoids double-expand.

### Related
- Per-type **shapes** + tint map: [013-file-type-icons.md](013-file-type-icons.md)
- Token groups: [003-design-system.md](003-design-system.md)
- Git status fetch/watch: `gitStatusStore.ts` (`startGitStatusWatch`, `getGitStatus`)

### Notes / gotchas
- **Flat sibling listing:** after an expanded folder, siblings at the *parent* depth continue the list (VS Code behaviour). `hero-virgilio.png` in `public/` looks “under” `illustrations/` but is a sibling — indent guides make the depth obvious.
- **Brand:** explorer tints are an intentional exception — color on glyphs + git semantics only, not chrome-wide Seti theme.
- **DRY:** extension→icon/tint knowledge lives only in `fileIcons.ts`; git tone→class only in `gitStatusStore.ts`.
