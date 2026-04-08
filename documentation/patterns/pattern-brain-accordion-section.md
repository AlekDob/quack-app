---
type: pattern
project: quack-app
created: 2026-04-08
last_verified: 2026-04-08
tags: [brain, accordion, file-explorer, documentation, sort-by-modified]
---

# Brain Accordion Section Pattern

## Problem
Developers need quick access to project documentation (gotchas, patterns, bugs, diary, decisions) without leaving the workspace context or opening a separate Brain tab.

## Solution
Reuse the existing `FileExplorer` component inside a new accordion section, rooted at `{rootPath}/documentation`, with `sortBy="modified"` to surface recently-changed docs first.

## Key Design Decisions

### Shared Tree Cache (zero App.tsx changes)
The `explorerTree` in App.tsx is `Record<string, DirectoryEntry[]>` keyed by absolute path. The Brain explorer writes to the same cache via the shared `onLoadChildren` callback. No collisions because paths are unique (`/project/src/...` vs `/project/documentation/...`).

### Lazy Load on First Expand
The Brain section doesn't load `documentation/` at mount time. A `useEffect` watches `focusedSection === 'brain'` and triggers the initial load + badge count only on first expand. The `brainLoaded` flag prevents re-fetching.

### Sort by Modification Date
- Rust `DirectoryEntry` now includes `modified_at: Option<u64>` (epoch seconds from file metadata)
- `FileExplorer` accepts `sortBy?: 'name' | 'modified'` prop (default: `'name'`)
- `sortEntries()` callback sorts dirs first, then by `modified_at` descending
- Applied to both root entries and recursive child entries

### Badge Count
Uses `search_files_recursive` with query `.md` to find all markdown/mermaid files, then filters client-side for `.md` and `.mmd` extensions.

## Files Involved
| File | Change |
|------|--------|
| `src/components/SidePanelAccordion.tsx` | Brain section render, local state, lazy-load useEffects |
| `src/components/FileExplorer.tsx` | `sortBy` prop, `sortEntries()` function |
| `src-tauri/src/fs.rs` | `modified_at` field on `DirectoryEntry` |
| `src/types.ts` | `modified_at?: number` on `DirectoryEntry` |

## Reuse Guidance
To add another scoped FileExplorer section (e.g., `.claude/` config browser):
1. Add section ID to `sectionIds` array
2. Add category color to `CATEGORY_COLORS`
3. Add icon to `icons` object
4. Add local `loaded`/`loading` state
5. Compute root path from `rootPath` prop
6. Render `<FileExplorer rootPath={scopedRoot} sortBy="modified" ...sharedProps />`
