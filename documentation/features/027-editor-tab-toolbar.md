---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), Monaco, plain CSS
created: 2026-07-01
last_verified: 2026-07-01
tags: [editor, markdown, preview, split, git-diff, toolbar, monaco, spaceship-pattern]
---

## Editor tab toolbar (markdown views + git Changes + Save)
**Purpose:** Replace the floating markdown preview toggle with a dedicated toolbar row under the breadcrumb. Markdown files get **Edit | Split | Preview**; all tracked files get a **Changes** diff (HEAD vs buffer) with **Inline | Split** layout; **Save** is always visible in the tab chrome. Same toolbar is reused in modal inline editors (`FileEditorPane`).
**Pattern source:** `spaceship-ai` `EditorPane` toolbar — adapted to Quack neutral chrome (`design/directives.md`).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/EditorTabToolbar.tsx` | Shared toolbar: md segmented control, Changes toggle, diff layout toggle, Save |
| Component | `src/components/EditorPane.tsx` | Main workspace editor tab — wires toolbar, md views, diff, Monaco |
| Component | `src/components/FileEditorPane.tsx` | Modal/slide-in editor (skills, instructions, agent file popup) |
| Component | `src/components/SimpleMonacoEditor.tsx` | Lightweight Monaco wrapper for `FileEditorPane` |
| Component | `src/components/DiffView.tsx` | Monaco `DiffEditor` wrapper (inline vs side-by-side) |
| Component | `src/components/MarkdownPreview.tsx` | Rendered preview pane (split + preview-only) |
| Component | `src/components/EditorBreadcrumbs.tsx` | Path + symbol breadcrumb (unchanged; sits above toolbar) |
| Service | `src/editorMdView.ts` | `readEditorMdView` / `writeEditorMdView` — `edit` \| `split` \| `preview` |
| Service | `src/editorSettings.ts` | Global editor prefs incl. `lightColorTheme` / `darkColorTheme` — see feature 033 |
| Service | `src/editorMonoFont.ts` | Monaco `fontFamily` from `--mono` (JetBrains Mono stack) |
| Service | `src/editorDiffPrefs.ts` | `readDiffSideBySide` / `writeDiffSideBySide` — diff layout pref |
| Service | `src/editorGitDiff.ts` | `computeGitDiffPair(gitRoot, absPath, current) → GitDiffPair \| null` |
| Hook | `src/hooks/useGitDiffPair.ts` | React hook wrapping `computeGitDiffPair` |
| Config | `src/App.css` | `.editor-tab-toolbar`, `.editor-tab-segmented`, `.editor-body-split`, `.cust-editor-*` |
| Icon | `src/components/Icon.tsx` | `columns-2`, `git-compare` |

### Layout (editor tab)
```
editor-host (flex column)
├── EditorBreadcrumbs          ← path + symbol (24px)
├── EditorTabToolbar           ← controls right-aligned (32px)
└── editor-body
    ├── [Changes] DiffView     ← when showDiff
    ├── [md] editor-half       ← Monaco (hidden in preview-only)
    └── [md] preview-half      ← MarkdownPreview (split or preview-only)
```

Modal editors (`FileEditorPane`) use the same toolbar below an optional back/subtitle bar; body classes are `cust-editor-body` / `cust-editor-body-split`.

### Toolbar controls
| Control | When visible | Action |
|---------|--------------|--------|
| **Edit · Split · Preview** | `.md` / `.mdx`, not in Changes mode | Switch markdown layout; persisted `lcp.editorMdView` |
| **Changes** | File has git diff vs HEAD (in workspace repo) | Toggle full-file diff view |
| **Inline · Split** | Changes mode active | Toggle Monaco diff layout; persisted `lcp.editorDiffSideBySide` |
| **Save** | Always | `store.saveFile` (main tab) or `fs.writeFile` (modal); disabled when clean |

### Markdown view modes
| Mode | Editor | Preview | Scroll-sync |
|------|--------|---------|-------------|
| `edit` | Monaco | hidden | — |
| `split` | Monaco left | `MarkdownPreview` right | editor → preview (`requestMdPreviewScroll`) |
| `preview` | hidden | full width | — |

### Git Changes (all file types)
- **Pair:** `git.show(root, "HEAD", relPath)` vs current buffer (`editorGitDiff.ts`).
- **New file at HEAD:** `git_show` returns `""` → diff shows all lines as added.
- **Button hidden** when `computeGitDiffPair` returns `null` (not in repo, path outside workspace root, or no diff).
- **Gutter:** inline git gutter decorations in `EditorPane` remain independent (unchanged).

### Diff layout (Monaco)
| Pref | `renderSideBySide` | Notes |
|------|-------------------|-------|
| Inline (default) | `false` | Better for narrow panes |
| Split | `true` | Two columns (HEAD left, working right) |

**Gotcha:** Monaco 0.44+ auto-falls back to inline when `useInlineViewWhenSpaceIsLimited` is true (default). `DiffView` sets `useInlineViewWhenSpaceIsLimited: false` and remounts via `key` on toggle — without this, **Split** looks identical to Inline.

### Data flow
`EditorPane`: `file.contents` → `useGitDiffPair(wsRoot, path, contents)` → toolbar `hasGitChanges` → user toggles `showDiff` → `DiffView` with `diffSideBySide` pref.

`FileEditorPane`: same hook when `gitRoot` prop is passed (`CustomizationsModal`, `SkillsPane`, `FilePopupModal`).

### State / persistence
| Key | Type | Default |
|-----|------|---------|
| `lcp.editorMdView` | `"edit" \| "split" \| "preview"` | `"edit"` |
| `lcp.editorDiffSideBySide` | `boolean` | `false` (inline) |

Per-tab ephemeral: `showDiff` (resets on file path change).

### Surfaces using `FileEditorPane`
| Host | `gitRoot` |
|------|-----------|
| `CustomizationsModal` (Instructions) | workspace `root` |
| `SkillsPane` (SKILL.md) | workspace `root` |
| `FilePopupModal` (Agent Mode files) | workspace `root` |

User-scoped skills under `~/.claude/skills` are outside `gitRoot` → no Changes button (expected).

### CSS notes
- Segmented pills: `.editor-tab-segmented` with `border-radius: var(--radius-full)`.
- Active segment: `.editor-tab-seg.active` uses `border-radius: var(--radius-full)` to hug the pill container.
- Save: monochrome `--primary-bg` / `--primary-fg` (brand rule).
- Removed: `.editor-preview-toggle` (floating overlay on breadcrumb).

### Related docs
- `documentation/design/directives.md` — neutral chrome, pill segmented controls
- `documentation/features/033-editor-color-themes.md` — Monaco syntax theme per light/dark (`EditorPane`, `DiffView`, `SimpleMonacoEditor`)
- `documentation/features/006-chat-tool-render.md` — `DiffModal` (global diff from git panel / tool chips; uses same `DiffView`)
- `documentation/features/017-media-preview.md` — binary media tabs (separate from markdown preview)
