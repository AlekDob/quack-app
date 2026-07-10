---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), Monaco, plain CSS
created: 2026-07-01
last_verified: 2026-07-10
tags: [editor, markdown, mermaid, html, preview, split, git-diff, toolbar, monaco, spaceship-pattern]
---

## Editor tab toolbar (markdown + mermaid + html views + git Changes + Save)
**Purpose:** Replace the floating markdown preview toggle with a dedicated toolbar row under the breadcrumb. Markdown (`.md`/`.mdx`), Mermaid (`.mmd`), and HTML (`.html`/`.htm`) files get **Edit | Split | Preview**; all tracked files get a **Changes** diff (HEAD vs buffer) with **Inline | Split** layout; **Save** is always visible in the tab chrome. Same toolbar is reused in modal inline editors (`FileEditorPane`).
**Pattern source:** `spaceship-ai` `EditorPane` toolbar — adapted to Quack neutral chrome (`design/directives.md`).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/EditorTabToolbar.tsx` | Shared toolbar: diagram segmented control (md/mmd/html), Changes toggle, diff layout toggle, Save |
| Component | `src/components/EditorPane.tsx` | Main workspace editor tab — wires toolbar, md views, diff, Monaco |
| Component | `src/components/FileEditorPane.tsx` | Modal/slide-in editor (skills, instructions, agent file popup) |
| Component | `src/components/SimpleMonacoEditor.tsx` | Lightweight Monaco wrapper for `FileEditorPane` |
| Component | `src/components/DiffView.tsx` | Monaco `DiffEditor` wrapper (inline vs side-by-side) |
| Component | `src/components/MarkdownPreview.tsx` | Rendered preview pane for `.md`/`.mdx` (split + preview-only); copyable fenced code blocks — see `049-markdown-renderer.md` |
| Component | `src/components/MermaidPreview.tsx` | Rendered SVG diagram pane for `.mmd` (split + preview-only) |
| Component | `src/components/HtmlPreviewFrame.tsx` | Sandboxed iframe preview for `.html` (split + preview-only) |
| Component | `src/components/EditorBreadcrumbs.tsx` | Path + symbol breadcrumb (unchanged; sits above toolbar) |
| Service | `src/editorMdView.ts` | `readEditorMdView` / `writeEditorMdView` — `edit` \| `split` \| `preview` (markdown) |
| Service | `src/editorMermaidView.ts` | `isMermaidPath`, `readEditorMermaidView` / `writeEditorMermaidView` — same modes; default `preview` |
| Service | `src/editorHtmlView.ts` | `isHtmlPath`, `readEditorHtmlView` / `writeEditorHtmlView` — same modes; default `preview` |
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
    ├── [md] preview-half      ← MarkdownPreview (split or preview-only)
    ├── [mmd] editor-half      ← Monaco (hidden in preview-only; default is preview)
    └── [mmd] preview-half     ← MermaidPreview (split or preview-only)
```

Modal editors (`FileEditorPane`) use the same toolbar below an optional back/subtitle bar; body classes are `cust-editor-body` / `cust-editor-body-split`.

### Markdown preview typography (`.md-preview`)

Document preview (editor tab, Customizations Instructions, whiteboard export) uses the
base `.md-preview` scale in `App.css` — **not** the tighter chat overrides
(`.ai-msg-body .md-preview`).

| Element | Size (2026-07-04 pass) |
|---------|------------------------|
| Body | 14px / line-height 1.6 |
| h1 | 20px + bottom border |
| h2 | 17px + bottom border |
| h3 | 15px |
| h4 | 14px |
| h5 / h6 | 13px / 12px (h6 dimmed) |

Headings use `margin: 18px 0 6px` (down from 24/8) so long docs like `CLAUDE.md` read
less shouty in split/preview panes. Chat bubbles keep their own smaller scale — see
`003-design-system.md`.

### Toolbar controls
| Control | When visible | Action |
|---------|--------------|--------|
| **Edit · Split · Preview** | `.md` / `.mdx` / `.mmd`, not in Changes mode | Switch diagram layout; persisted `lcp.editorMdView` (md) or `lcp.editorMermaidView` (mmd) |
| **Changes** | File has git diff vs HEAD (in workspace repo) | Toggle full-file diff view |
| **Inline · Split** | Changes mode active | Toggle Monaco diff layout; persisted `lcp.editorDiffSideBySide` |
| **Save** | Always | `store.saveFile` (main tab) or `fs.writeFile` (modal); disabled when clean |

### Markdown view modes
| Mode | Editor | Preview | Scroll-sync |
|------|--------|---------|-------------|
| `edit` | Monaco | hidden | — |
| `split` | Monaco left | `MarkdownPreview` right | editor → preview (`requestMdPreviewScroll`) |
| `preview` | hidden | full width | — |

### Mermaid view modes (`.mmd`)
Same toolbar control; preview pane is `MermaidPreview` (lazy `mermaid` render). Default mode is **`preview`** (not `edit`). No editor↔preview scroll-sync. See `042-mermaid-preview.md`.

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
| `lcp.editorMermaidView` | `"edit" \| "split" \| "preview"` | `"preview"` |
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
- `documentation/features/017-media-preview.md` — binary media tabs (separate from markdown/mermaid preview)
- `documentation/features/042-mermaid-preview.md` — `.mmd` diagram render, lazy mermaid chunk
