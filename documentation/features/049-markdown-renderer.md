---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), plain CSS
created: 2026-07-10
last_verified: 2026-07-10
tags: [markdown, md-preview, copy, code-block, chat, shell, syntax, cursor-style]
---

## Markdown renderer (chat + preview panes)
**Purpose:** Dependency-free Markdown → HTML for assistant prose, editor split preview, tool drawers, subagent transcripts, and user message bars. Fenced code blocks render as **copyable pills** with a copy icon row underneath (Cursor-style); single-line shell commands get light token coloring.
**Stack:** `src/markdown.ts` (parse + render) + `src/components/MarkdownPreview.tsx` (React mount + delegated clicks).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/markdown.ts` | `renderMarkdown(md) → HTML`, `tokenize`, `Block` type; fenced blocks via `renderCodeBlock` |
| Component | `src/components/MarkdownPreview.tsx` | Renders HTML; copy + file-link clicks; optional editor scroll-sync (`interactive`) |
| Service | `src/chatFileLinks.ts` | `enrichMarkdownWithFileLinks` — workspace paths → clickable pills when `onFileOpen` set |
| Config | `src/App.css` | `.md-preview`, `.md-code-block*`, `.md-tok-cmd` / `.md-tok-arg`; chat overrides under `.ai-msg-body .md-preview` |

### Surfaces (who mounts `MarkdownPreview`)
| Surface | `interactive` | `onFileOpen` |
|---------|---------------|--------------|
| Assistant chat (`AIChatPanel`) | `false` | yes — open file tab |
| User turns (`UserMessageBar`) | `false` | no |
| Editor split / preview (`EditorPane`) | `true` | no — click-to-jump source line |
| Tool drawer — `.md` reads, WebFetch (`ToolResultDrawer`) | `false` | no |
| Subagent transcript (`SubagentTranscriptView`) | `false` | no |
| Session transcript pane (`SessionTranscriptPane`) | `false` | no |
| Whiteboard export preview | `false` | no |

### Data flow
```
Markdown string
  → tokenize() / renderMarkdown()     (markdown.ts — HTML string)
  → enrichMarkdownWithFileLinks()     (optional — chat only)
  → MarkdownPreview dangerouslySetInnerHTML
  → delegated click:
       [data-md-copy]  → clipboard.writeText(code.textContent)
       [data-file-link] → onFileOpen(path)
       [data-source-line] → setEditorGoto (interactive only)
```

### Markdown subset supported
| Construct | Notes |
|-----------|-------|
| Headings `#`–`######` | `md-anchor` class on headings for interactive jump |
| Paragraphs | Soft-wrap; consecutive non-block lines merge |
| Fenced code ` ```lang ` | Copyable pill UI — see below |
| Inline code `` ` `` | Escaped; not copy-pill (plain `<code>` chip) |
| Bold / italic | `**` / `*` / `__` / `_` |
| Links / images | URL scheme allowlist (`https`, `mailto`, `file`, …) |
| Lists `ul` / `ol` | |
| Task lists `- [ ]` / `- [x]` | `.md-tasklist` |
| GFM tables | `.md-table-wrap` horizontal scroll |
| Blockquotes | Recursive inner render |
| HR | `---` / `***` / `___` |
| Auto-linkify | Bare `https://` and emails in prose (post-escape) |

### Copyable code blocks (2026-07-10)
Replaces the old hover-revealed top-right **Copy** text button.

**DOM structure:**
```
.md-code-block[.md-code-block--single][data-source-line]
  .md-code-pill
    pre > code.lang-{lang}
  .md-code-actions
    button.md-code-copy-btn[data-md-copy]
      svg.md-code-copy-icon
```

| Variant | When | Visual |
|---------|------|--------|
| Single-line | `text` has no `\n` | Pill: `border-radius: var(--radius-full)`; inline-block width |
| Multi-line | fenced block with newlines | Card: `border-radius: var(--radius-md)`; full width |
| Shell highlight | single-line + lang empty or `bash`/`sh`/`shell`/`zsh`/`console` | First token `.md-tok-cmd` (`--tool-bash`); rest `.md-tok-arg` (`--tool-search`) |

**Copy interaction:**
- Click `[data-md-copy]` → `navigator.clipboard.writeText(code.textContent)`
- Button gets `.is-copied` + `aria-label`/`title` = "Copied" for 1.5s
- No await on clipboard — optimistic UI; silent no-op on failure

**Not in scope (v1):**
- Inline `` `command` `` copy pills
- Full syntax highlighter (Monaco/hljs) — shell single-line only
- Mermaid / HTML inside `.md` fences (see `042`, `045`)

### Key functions (`markdown.ts`)
- `renderMarkdown(md: string) → string` — main entry; emits safe escaped HTML
- `tokenize(md: string) → Block[]` — block parser (not CommonMark-complete)
- `renderCodeBlock(b: Block) → string` — pill + copy row HTML
- `highlightShellLine(text: string) → string` — first-token + rest spans
- `inlineMd(s: string) → string` — inline transforms inside paragraphs

### CSS tokens (code blocks)
| Class | Role |
|-------|------|
| `.md-code-block` | Outer wrapper; margin 10px 0 14px |
| `.md-code-pill` | `--bg-alt` fill + `--border`; contains `<pre>` |
| `.md-code-actions` | Flex row, `justify-content: flex-end`, copy below pill |
| `.md-code-copy-btn` | 28×24 icon button; `--fg-muted` → `--fg` on hover |
| `.md-tok-cmd` / `.md-tok-arg` | Shell token colors (`--tool-bash`, `--tool-search`) |

Chat scope (`.ai-msg-body .md-preview`) uses tighter padding on pills — see `003-design-system.md`.

### Related features
| Doc | Relationship |
|-----|--------------|
| `027-editor-tab-toolbar.md` | Editor split preview typography (base `.md-preview` scale) |
| `003-design-system.md` | Chat vs document type scale |
| `006-chat-tool-render.md` | Drawer mounts `MarkdownPreview` for `.md` reads + WebFetch |
| `030-user-message-bar.md` | User prompts rendered via same renderer |
| `041-mention-file-preview.md` | `@` autocomplete is composer-only; not markdown |
| `045-html-preview.md` | Raw agent HTML never routed through this renderer |

### Gotchas
- `data-source-line` on `.md-code-block` wrapper (not `<pre>`) — interactive click-to-jump uses `closest("[data-source-line]")`
- Copy extracts `code.textContent` — shell highlight spans are stripped automatically
- `MarkdownPreview` inline `<style>` for copy was removed (2026-07-10); all rules live in `App.css`
- Legacy bare `<pre>` rules in `.md-preview` still apply to non-fenced contexts; fenced blocks reset margins inside `.md-code-pill`
