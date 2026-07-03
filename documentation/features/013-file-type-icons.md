---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-29
last_verified: 2026-07-03
tags: [file-tree, explorer, icons, file-type, tints, brand, design-system, dry]
---

## File-Type Icons (per-type icons in the file explorer)
**Purpose:** Give each file in the explorer tree a distinct icon by type (VS Code-style recognizability). **Shape** comes from the shared `Icon` registry; **tint** (glyph color) is applied via CSS class — confined to the explorer panel, not global chrome.
**Stack:** React 19, TypeScript strict, shared SVG `Icon` registry (no icon library)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Map | `src/fileIcons.ts` | `fileIconName()`, `fileIconTint()` — name/ext → shape + tint class suffix |
| Registry | `src/components/Icon.tsx` | `Icon` + `IconName`; shapes `braces`/`image`/`file-code`/`lock` (+ symmetric `braces` paths for 14px) |
| Component | `src/components/FileTree.tsx` | `tree-icon tree-icon--{tint}` + `fileIconName()` per row |
| Tokens | `src/App.css` | `--tree-tint-*` per category; light/dark siblings |

### Data Flow
- Row icon: `className={`tree-icon tree-icon--${fileIconTint(name, isDir)}`}` + `name={isDir ? "folder" : fileIconName(name)}`.
- `fileIconName(name)` — (1) `BY_NAME` exact match; (2) extension → `BY_EXT`; (3) dotfile w/o ext → `settings`; (4) fallback `file`.
- `fileIconTint(name, isDir)` — folders: `FOLDER_TINT` by name (`src`, `node_modules`, `public`, `.git`, …); files: `NAME_TINT` then `EXT_TINT`; fallback `default` / `folder`.

### Mapping (shape per category)
| Category | Examples | Icon shape |
|---|---|---|
| Source code | js, ts, tsx, py, rs, go, vue, swift… | `file-code` |
| Web markup | html, htm, xml | `globe` |
| Styles | css, scss, sass, less, styl | `hash` |
| Data | json, jsonc, json5, `package.json` | `braces` |
| Config | yaml, toml, ini, conf, `Dockerfile`, dotfiles | `settings` |
| Docs / text | md, mdx, txt, pdf, doc(x), `README.md`, `LICENSE` | `file-text` |
| Shell | sh, bash, zsh, ps1, bat | `terminal` |
| Images | png, jpg, gif, svg, webp, ico, avif… | `image` |
| Secrets / locks | .env, pem, key, `*.lock` files | `lock` |
| Git dotfiles | .gitignore, .gitattributes, .gitmodules | `git-branch` |
| Fallback | anything unmapped | `file` |

### Tint classes (glyph color only)
| Tint suffix | Examples | Token |
|---|---|---|
| `code-ts` | `.ts`, `.tsx` | `--tree-tint-code-ts` |
| `code-js` | `.js`, `.jsx` | `--tree-tint-code-js` |
| `data` | `.json` | `--tree-tint-data` |
| `doc` | `.md` | `--tree-tint-doc` |
| `image` | `.png`, `.svg` | `--tree-tint-image` |
| `folder-src` | `src`, `lib`, `app` | `--tree-tint-folder-src` |
| `folder-modules` | `node_modules` | `--tree-tint-folder-modules` |
| `folder-public` | `public`, `assets` | `--tree-tint-folder-public` |
| … | see `fileIcons.ts` `EXT_TINT` / `FOLDER_TINT` | `--tree-tint-*` in `App.css` |

Full tree layout, git filename colors, indent guides: [034-explorer-tree.md](034-explorer-tree.md).

### State
- None. Pure functions, computed per render from `entry.name`. O(1) lookups.

### Notes / gotchas
- **Brand (2026-07-03):** explorer icon **tints** are allowed — color on the glyph only inside the file panel. Chrome (topbar, tabs, composer) stays neutral; per-project color remains on workspace badges.
- **DRY:** never branch on extension at a call-site — always `fileIconName()` + `fileIconTint()`.
- **Registry contract:** shapes use `stroke=currentColor`, `viewBox 0 0 24 24`; tint class sets `color` on `.tree-icon`.
- `BY_NAME` wins over `BY_EXT` for recognizable filenames (`package.json` → braces + data tint).
