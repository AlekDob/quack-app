---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19), WKWebView iframe (srcDoc)
created: 2026-07-07
last_verified: 2026-07-07
tags: [editor, html, preview, iframe, drawer, agent-tool, split, sandbox, prev-tab]
---

## HTML preview (drawer + agent tab + editor split)

**Purpose:** Render live HTML in Quack — for workspace `.html` files (mockups, PDF
source pages, module covers) and for agent-generated markup shown during a chat turn.
Three surfaces share one sandboxed iframe component:

1. **Tool-result drawer** — quick slide-over from a chat tool chip (agent HTML).
2. **Virtual `prev:` tab** — persistent browser tab stashed in memory (agent HTML).
3. **Editor split/preview** — `.html` files get **Edit | Split | Preview** like
   `.mmd` Mermaid tabs (default **Preview**).

**Stack:** React 19, `<iframe sandbox srcDoc>` inside Tauri WKWebView. No new Rust
commands, no asset protocol, no Tailwind.

**Scope:** Static HTML via `srcDoc` (inline CSS/JS, relative assets only when scripts
allowed). **Not** a general external URL browser — live `https://…` navigation is
out of scope (WebFetch still renders fetched pages as markdown in the drawer).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/htmlPreview.ts` | Key helpers, in-memory stash, tool detection, `requestHtmlPreviewDrawer()` |
| Service | `src/chatFileLinks.ts` | Clickable file paths in chat markdown, `resolveChatFilePath`, auto-open dedupe |
| Service | `src/editorHtmlView.ts` | `isHtmlPath`, `readEditorHtmlView`, `writeEditorHtmlView` — view pref + default `preview` |
| Component | `src/components/HtmlPreviewFrame.tsx` | Reusable sandboxed `<iframe srcDoc>` |
| Component | `src/components/HtmlPreviewPane.tsx` | Body for `prev:` virtual tabs; `openHtmlPreviewTab()` helper |
| Component | `src/components/ToolResultDrawer.tsx` | `variant: "browser"` body branch + **Open in tab** action |
| Service | `src/toolDrawer.ts` | `ToolDrawerVariant` includes `"browser"`; `html?`, `onOpenInTab?` on `ToolDrawerData` |
| Component | `src/components/chatToolRender.tsx` | `HtmlPreviewOpen` context; `ShowHtmlPreview` tool row; globe chip on `.html` edits |
| Component | `src/components/AIChatPanel.tsx` | Provides `HtmlPreviewOpen` → `openHtmlPreviewTab(wsId, chatId, …)` |
| Component | `src/components/EditorPane.tsx` | Wires `.html` → `HtmlPreviewFrame` in `preview-half` |
| Component | `src/components/FileEditorPane.tsx` | Same split/preview for modal editors |
| Component | `src/components/EditorTabToolbar.tsx` | Unchanged API — `showDiagramView` now true for `.html` too |
| Component | `src/components/WorkspaceShell.tsx` | Portals `HtmlPreviewPane` for open `prev:` keys |
| Component | `src/components/PaneNode.tsx` | Tab label + globe icon for `prev:` tabs |
| Store | `src/store.ts` | `parseKey` → `htmlPreview`; `openHtmlPreview()` |
| Config | `src/App.css` | `.html-preview-frame`, `.html-preview-pane`, `.tool-drawer--browser`, `.ai-tcall-preview` |

### Surfaces compared
| Surface | Trigger | Persistence | Scripts in iframe |
|---------|---------|-------------|-------------------|
| **Drawer** | Click HTML preview tool chip; globe on Write/Edit `.html` | Session-only | **Off** (empty sandbox) |
| **`prev:` tab** | Drawer **Open in tab**; `openHtmlPreviewTab()` | Until tab closed | **On** (`allow-scripts allow-same-origin`) |
| **Editor preview** | Open `.html` from tree; Edit/Split/Preview toolbar | File on disk | **On** |

### Virtual tab keys (`prev:`)
Pattern mirrors `crev:` compose-review tabs:

```
prev:{wsId}|{chatId}|{previewId}
```

- `previewId` — usually the tool-call id (`call.id`).
- Payload stashed in module-level `Map` (`stashHtmlPreview` / `htmlPreviewPayload`).
- Not written to disk; closing the tab drops the stash entry only when the key is
  garbage-collected (map retains until overwrite — same as `composeReview.ts`).

`openHtmlPreview(wsId, chatId, previewId, html, title)` in the store focuses an
existing tab or inserts into the active editor pane (same focus rules as `openComposeReview`).

### Agent tool contract
Quack recognises these tool names (case-insensitive):

| Name pattern | Example |
|--------------|---------|
| Exact | `ShowHtmlPreview`, `HtmlPreview`, `PreviewHtml` |
| Substring | `*html_preview*`, `*htmlpreview*` (MCP tools) |

**HTML source** (first match wins):

| Location | Keys |
|----------|------|
| Tool arguments | `html`, `content`, `body`, `srcdoc`, `source` |
| Tool result string | Full HTML if it looks like markup (`<!DOCTYPE`, `<html`, or contains `</`) |

**Title:** argument `title` or `name`; fallback `"HTML preview"`.

**Chat UI:** dedicated chip — globe icon, label **HTML preview**, click → drawer.
While streaming: spinner; when done with no HTML: check mark.

**Write/Edit `.html`:** existing `EditDiffCard` keeps diff available via non-html
tools; for `.html` the chip **auto-opens the file tab** (preview default) when the
tool completes. Clicking the chip also opens the tab (not the diff modal). Globe
button still opens the drawer with live HTML from the tool args.

**Chat prose:** paths like `` `preview-quack.html` ``, `documentation/foo.md`, or
bare `045-html-preview.md` in assistant messages are **clickable links** that call
`openFile` (resolved against the workspace root). See `chatFileLinks.ts`.

### Drawer (`ToolResultDrawer`)
Extends the existing read/bash drawer (`006-chat-tool-render.md`):

```ts
requestToolDrawer({
  title: "Modulo Gare - Cover",
  html: "<!DOCTYPE html>…",
  variant: "browser",
  onOpenInTab: () => openHtmlPreviewTab(wsId, chatId, id, html, title),
});
```

| Chrome | Behaviour |
|--------|-----------|
| Head | Title + optional subtitle |
| **Open in tab** | Shown when `html` + `onOpenInTab` set; closes drawer after open |
| Body | Full-bleed `HtmlPreviewFrame` (no padding) |

CSS: `.tool-drawer--browser .tool-drawer-body` — flex column, `overflow: hidden`.

### Editor view modes (`.html`)
Same toolbar segmented control as markdown/mermaid (`027-editor-tab-toolbar.md`):

| Mode | Editor | Preview |
|------|--------|---------|
| `edit` | Monaco | hidden |
| `split` | Monaco left | `HtmlPreviewFrame` right (live `onChange`) |
| `preview` | hidden | full width |

| Key | Type | Default |
|-----|------|---------|
| `lcp.editorHtmlView` | `"edit" \| "split" \| "preview"` | `"preview"` |

Separate from `lcp.editorMdView` and `lcp.editorMermaidView`.

### Data flow

**Agent drawer:**
```
Tool completes with HTML
  → ToolCallRow (isHtmlPreviewTool)
  → click chip
  → requestHtmlPreviewDrawer(html, title, …)
  → ToolResultDrawer → HtmlPreviewFrame (sandbox, no scripts)
```

**Agent tab:**
```
HtmlPreviewOpen(previewId, html, title)
  → openHtmlPreviewTab → store.openHtmlPreview
  → stashHtmlPreview + insert prev: tab
  → WorkspaceShell portal → HtmlPreviewPane → HtmlPreviewFrame (scripts on)
```

**File editor:**
```
openFile(.html) → readFile → store buffer
  → EditorPane → readEditorHtmlView() (default preview)
  → HtmlPreviewFrame srcDoc={file.contents}
```

### Security
| Context | Sandbox | Rationale |
|---------|-----------|-----------|
| Agent drawer | `sandbox=""` | Untrusted model output — no JS |
| Agent tab / file preview | `allow-scripts allow-same-origin` | Trusted workspace HTML (covers, local mockups) |

**Never** route raw agent HTML through `MarkdownPreview` (`dangerouslySetInnerHTML`
with URL guards) — always use `HtmlPreviewFrame`.

Tauri CSP is `null` — `srcDoc` and `data:` URLs work (same as PDF in `017`). External
stylesheets/fonts linked from HTML load when scripts are allowed; cross-origin
navigation inside the iframe is not a supported product feature.

### vs related features
| | HTML (this) | Mermaid (`042`) | Media (`017`) |
|---|-------------|-----------------|---------------|
| Extension | `.html`, `.htm` | `.mmd` | images, PDF |
| Renderer | iframe `srcDoc` | mermaid SVG | `<img>` / PDF iframe |
| Default view | Preview | Preview | N/A (read-only tab) |
| Agent surface | Drawer + `prev:` tab | — | — |
| Classifier | `isHtmlPath` in editor | `isMermaidPath` | `mediaKindOf` |

### Gotchas
- **Relative assets in drawer / agent tab:** agent HTML with `assets/logo.png` won't
  resolve in `srcDoc` (no base URL). Prefer Write to disk + editor preview, or inline
  assets.
- **Editor file preview:** `HtmlPreviewFrame` injects `<base href="file://…/">` from the
  open file's directory so sibling `theme.css` and `assets/*` resolve. Includes
  `color-scheme: light` meta so dark Quack chrome doesn't bleed when CSS is slow/missing.
- **Preview default on `.html`:** first open skips Monaco — same rationale as `.mmd`.
- **`prev:` stash is in-memory:** restarting Quack loses stashed HTML for tabs that
  were open in layout restore (tab key may reopen with empty pane — error state shown).
- **Auto-open:** successful Write/Edit on `.html` opens the file tab once per tool
  call id (`consumeAutoHtmlOpen`). `ShowHtmlPreview` auto-opens the browser drawer.
- **Relative paths:** chat links and tool `file_path` values are resolved via
  `resolveChatFilePath(wsRoot, path)` before `openFile`.
- **Not in `mediaKindOf`:** `.html` stays a text buffer in the store; do not route
  through `MediaPreviewPane`.

### Related docs
- `006-chat-tool-render.md` — drawer variants, tool chips, `HtmlPreviewOpen`
- `027-editor-tab-toolbar.md` — shared Edit/Split/Preview control
- `042-mermaid-preview.md` — parallel editor preview pattern
- `017-media-preview.md` — PDF iframe precedent (orthogonal)
- `038-compose-review.md` — virtual tab registration pattern (`crev:` → `prev:`)
