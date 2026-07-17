---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-03
last_verified: 2026-07-17
tags: [file-tree, explorer, git, indent, layout, light-theme, design-system, cursor-style, drag-drop, filter, performance, content-visibility]
---

## Explorer file tree (layout + filter + git decorations)

**Purpose:** Cursor/VS Code-style file explorer: per-type icon tints, theme-aware git filename colors, indent guides, **fuzzy name filter** with ancestor visibility, **expand/collapse all**, and stable row alignment. Color is confined to the explorer panel — topbar/composer/tabs stay neutral chrome. Also owns **always-on render lightening** (row `content-visibility`, per-row git subscribe) so a large open tree does not tax chat switches — pairs with chat-switch chrome freeze (`081`).

**Stack:** React 19, `FileTree.tsx`, `fileIcons.ts`, `gitStatusStore.ts`, tokens in `App.css`

### Files

| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Tree UI | `src/components/FileTree.tsx` | Memoized `Node`; per-row git subscribe; filter context; `--tree-depth`; git badge/dot; file-row pointer drag (055) |
| Defer | `src/deferDuringChatSwitch.ts` | Queue `listDir` while chat-switch veil is up (`081`) |
| Tests | `src/deferDuringChatSwitch.test.ts` | Defer/dedupe regression |
| Toolbar | `src/components/FileTreeToolbar.tsx` | Filter input, expand-all, collapse-all icon buttons |
| Filter walk | `src/fileTreeWalk.ts` | `buildTreeFilter`, `collectAllDirs` — recursive scans (skips heavy dirs) |
| Fuzzy | `src/fuzzyMatch.ts` | `fuzzyMatch`, `normalizeFilterQuery` (shared with command palette) |
| Heavy dirs | `src/heavyDirs.ts` | `isHeavyDir` — mirrors `search.rs` `HEAVY_DIRS` for walks |
| Icons | `src/fileIcons.ts` | `fileIconName()` shape + `fileIconTint()` CSS class suffix |
| Git palette | `src/gitStatusStore.ts` | `statusTone`, `statusClass`, `statusColor` (CSS vars); shared watch |
| Reveal | `src/revealInTree.ts` | `autoRevealInTree` — expand ancestors + scroll row into view |
| Store | `src/store.ts` | `toggleDir`, `setExpandedDirs`, `openFile` / `setActiveTab` → `autoRevealInTree` |
| Styles | `src/App.css` | `.tree-shell`, `.tree-toolbar*`, `.tree-filter*`, `--tree-indent-step`, `--git-*`, row `content-visibility` |
| Source control | `src/components/SourceControlPanel.tsx` | Same `statusClass` as tree (no hardcoded hex) |

### Filter toolbar

| Control | Behavior |
|---------|----------|
| **Filter files…** | Debounced (180ms) fuzzy filter; empty → normal lazy tree |
| **Expand all** (▼) | `collectAllDirs` → `setExpandedDirs` — all folders except heavy dirs |
| **Collapse all** (▶) | `setExpandedDirs([])` + clears filter query |

**CSS:** `.tree-shell` (flex column) → `.tree-toolbar` → scrollable `.tree`.

### Fuzzy filter rules

| Rule | Detail |
|------|--------|
| Match target | **Entry name only** (`e.name`) — never full relative path |
| Algorithm | Subsequence fuzzy (`fuzzyMatch`) — same as command palette |
| Quotes | `normalizeFilterQuery` strips wrapping `"…"` / `'…'` |
| Visible set | Match + all **ancestor** folder paths up to workspace root |
| Folder match | Folder name matches → entire subtree added to visible set (`addDescendants`) |
| Render | `TreeFilterContext` — non-visible nodes return `null`; ancestor dirs force-expanded |
| Highlight | `.tree-name--filter-match` on direct matches |
| Empty | `"No matching files."` when filter active and zero visible root children |
| Refresh | `fsBus` `dir` event on workspace root re-runs active filter |

**Gotcha:** matching on concatenated paths (`apps/client/.../slash.md`) falsely matches unrelated queries by stitching letters across `/` segments — fixed by name-only matching (2026-07-13).

### Layout model

- Each row sets `--tree-depth` (0 = workspace root children) and `padding-left: calc(8px + depth × --tree-indent-step)`.
- **Indent guides:** `::before` pseudo on `.tree-row` draws vertical hairlines per depth step (Cursor-like).
- **No horizontal scroll:** `.tree { overflow-x: hidden }` + `.tree-name { flex: 1; min-width: 0 }` — long names ellipsize.
- **Icon alignment:** `.tree-icon` / `.tree-caret` are `display: flex` + centered; SVG `display: block`.
- **Toolbar buttons:** `.tree-toolbar-btn { padding: 0; flex center }` — overrides global `button` padding so chevrons stay centered.
- **Reveal scroll:** `scrollIntoView({ block: "nearest", inline: "nearest" })`.

### Performance (2026-07-17)

| Technique | What it does |
|---|---|
| `.tree-row { content-visibility: auto; contain-intrinsic-size: auto 22px }` | Browser skips layout/paint for off-screen rows (light virtualization without flattening the recursive tree) |
| `.tree { contain: content }` | Isolates tree layout from the rest of the shell |
| `memo(Node)` + stable `onContext` | Parent re-renders (filter toolbar, root refresh) do not rebuild every row |
| Per-row git `useSyncExternalStore` | `gitRowKey(wsId, path, isDir)` — only rows whose git chrome key changed re-render. **Was:** root `setGitTick` → every `Node` |
| Deferred `listDir` during chat switch | `runOrDeferDuringChatSwitch` — see `081` |

Still recursive React children (not a flat windowed list). Full virtualization is a possible follow-up if huge expanded trees remain hot.

### Git decorations

| Surface | Behavior |
|---------|----------|
| File row name | `.git-status--{tone}` on `.tree-name` when file has git status |
| File badge | `M` / `U` / … on right edge, same tone class |
| Folder dot | `.tree-name--dirty-dir` + `.tree-git-dot` (`--warn`) when subtree has changes |

**Tones** (`statusTone`): `conflict`, `added` (incl. untracked `U`), `modified`, `deleted`, `renamed`, `neutral`.

Use `statusClass(f)` at call-sites — never inline hex.

`FileTree` still calls `startGitStatusWatch` once; Nodes subscribe via `subscribeGitStatus` + key snapshot (no tree-wide tick).

### Auto-reveal in tree

- `autoRevealInTree(wsId, path)` — no-op for paths outside workspace root.
- Wired from `store.openFile`, `store.setActiveTab`, `store.openFileAt`.
- `openFileAndReveal` remains a named helper; `openFile` already reveals.

### Related

- Chat-switch chrome freeze: [081-chat-switch-chrome-freeze.md](081-chat-switch-chrome-freeze.md)
- Chat switch veil: [075-chat-switch-loader.md](075-chat-switch-loader.md)
- File-tree pointer drag (composer + editor): [055-file-composer-drag.md](055-file-composer-drag.md)
- Per-type shapes + tint map: [013-file-type-icons.md](013-file-type-icons.md)
- Token groups: [003-design-system.md](003-design-system.md)
- Shared git watch / numstat: [077-fs-watcher-git-status.md](077-fs-watcher-git-status.md)
- Tab/pane drop hit-test (shared with tree drag): `src/tabDropTarget.ts`

### Notes / gotchas

- **Flat sibling listing:** after an expanded folder, siblings at the *parent* depth continue the list (VS Code behaviour).
- **Brand:** explorer tints are an intentional exception — color on glyphs + git semantics only.
- **Heavy dirs:** `list_dir` still shows `node_modules` etc. as direct children; walks for filter/expand-all skip them via `heavyDirs.ts`.
- **Filter + click:** directory rows ignore toggle while filter is active (forced expand).
- **No HTML5 DnD** on tree rows — pointer drag only (Tauri 2).
- **Stable `onContext`:** inline `(t) => setMenu(t)` on every root map broke `memo(Node)` — use `useCallback`.
