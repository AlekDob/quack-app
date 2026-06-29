---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-29
last_verified: 2026-06-29
tags: [file-tree, explorer, icons, file-type, monochrome, brand, design-system, dry]
---

## File-Type Icons (per-type icons in the file explorer)
**Purpose:** Give each file in the explorer tree a distinct icon by type (VS Code-style recognizability) WITHOUT breaking the neutral-chrome brand rule — icons differ by **shape**, never by color. Folders keep the `folder` icon; files map to a shape via their name/extension.
**Stack:** React 19, TypeScript strict, shared SVG `Icon` registry (no icon library)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Map | `src/fileIcons.ts` | `fileIconName(name)` — single source of truth: file name/ext → `IconName` |
| Registry | `src/components/Icon.tsx` | `Icon` + `IconName`; holds the 4 added shapes `braces`/`image`/`file-code`/`lock` |
| Component | `src/components/FileTree.tsx` | `Node` row renders `fileIconName(entry.name)` for files (`folder` for dirs) |

### Data Flow
- A tree `Node` renders its icon: `name={entry.is_dir ? "folder" : fileIconName(entry.name)}` (FileTree.tsx, `tree-icon` span).
- `fileIconName(name)` resolves in 3 steps: (1) exact lowercased filename → `BY_NAME`; (2) extension after the last dot → `BY_EXT`; (3) fallback `"file"`.
- Leading-dot files with no real extension (`.prettierrc`, `.DS_Store`) read as config → `"settings"`.

### Mapping (shape per category)
| Category | Examples | Icon |
|---|---|---|
| Source code | js, ts, tsx, py, rs, go, vue, swift… | `file-code` |
| Web markup | html, htm, xml | `globe` |
| Styles | css, scss, sass, less, styl | `hash` |
| Data | json, jsonc, json5, `package.json` | `braces` |
| Config | yaml, toml, ini, conf, `Dockerfile`, `Makefile`, dotfiles | `settings` |
| Docs / text | md, mdx, txt, pdf, doc(x), `README.md`, `LICENSE` | `file-text` |
| Shell | sh, bash, zsh, ps1, bat | `terminal` |
| Images | png, jpg, gif, svg, webp, ico, avif… | `image` |
| Secrets / locks | .env, pem, key, `*.lock` files | `lock` |
| Git dotfiles | .gitignore, .gitattributes, .gitmodules | `git-branch` |
| Fallback | anything unmapped | `file` |

### State
- None. Pure function, computed per render from `entry.name`. No store, no subscription, no memo (the call is O(1) lookups).

### Notes / gotchas
- **BRAND DECISION (with Alek):** icons are **monochrome distinct shapes**, NOT colored like VS Code's Seti theme. This upholds the CLAUDE.md rule "chrome monochrome — color only on per-project workspace badges + semantic states". A future "subtle tint" option would only add a per-category CSS color class on the icon; the shape map here would not change. See [003-design-system.md](003-design-system.md).
- **DRY:** never branch on extension at a call-site — always call `fileIconName()`. The two lookup tables (`BY_NAME`, `BY_EXT`) are the only place type→icon knowledge lives.
- **New icons follow the registry contract:** every shape added to `Icon.tsx` uses `stroke=currentColor` + `viewBox 0 0 24 24` so it inherits the row's color and sizing — that's WHY the icons stay monochrome for free.
- `BY_NAME` wins over `BY_EXT` so recognizable-by-name files (`package.json` → braces, `yarn.lock` → lock) don't fall through to their generic extension.
