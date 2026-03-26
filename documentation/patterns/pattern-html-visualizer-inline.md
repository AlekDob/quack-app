---
type: pattern
project: quack-app
created: 2026-03-24
last_verified: 2026-03-24
tags: [visualizer, iframe, sandbox, html, inline-rendering]
---

# Pattern: HTML Visualizer (Inline Iframe)

## Trigger

When Claude generates a ` ```quack-viz ` code fence in chat, the content is rendered as interactive HTML inside a sandboxed iframe.

## Architecture

```
MarkdownText.tsx (code fence parser)
  └─ detects lang="quack-viz"
     └─ HtmlVisualizer.tsx (iframe sandbox component)
        ├─ htmlVisualizerUtils.ts → wrapHtmlForSandbox()
        ├─ CopyButton.tsx (reusable copy button)
        └─ HtmlVisualizer.css (dark theme styles)
```

## Dual Trigger: MCP Tool + Code Fence

### 1. MCP Tool (primary — auto-discoverable by Claude)

A `visualize_html` tool is registered via `visualizer-mcp-server.js` (stdio MCP server, same pattern as `ide-mcp-server.js`). Claude sees `mcp__visualizer__visualize_html` in its tool list and invokes it autonomously when visualization would help.

The tool handler is a no-op (returns confirmation text). The actual rendering happens client-side: `StreamMessage.tsx` detects `tool_use` with name `mcp__visualizer__visualize_html` and renders `<HtmlVisualizer html={input.html} title={input.title} />`.

### 2. Code Fence (fallback — provider-agnostic)

The `MarkdownText` component captures the `language` attribute from code fences. When the language is `quack-viz`, instead of rendering a syntax-highlighted code block, it routes the raw HTML string to `HtmlVisualizer`.

This works with any LLM provider (not just Anthropic) and as a fallback when the MCP tool isn't available.

## Sandbox Strategy

The iframe uses `sandbox="allow-scripts"` **without** `allow-same-origin`. In practice, **JavaScript execution is blocked** by the sandboxed environment. All visualizations must use **pure HTML + CSS + inline SVG** — no Chart.js, D3, or any JS library.

- The iframe cannot access the parent document's DOM, cookies, or storage.
- The iframe cannot make same-origin requests to the host application.
- Scripts do NOT execute reliably — the MCP tool description explicitly instructs agents to avoid JS.

## Auto-Resize via postMessage

The wrapped HTML (via `wrapHtmlForSandbox()`) injects a ResizeObserver script that posts height changes to the parent window:

1. `wrapHtmlForSandbox()` appends a `<script>` before `</body>` (using `lastIndexOf` for correct injection point).
2. The script observes `document.body` with a `ResizeObserver` and sends `{ type: 'resize', height }` via `postMessage`.
3. `HtmlVisualizer.tsx` listens for `message` events and verifies `event.source === iframeRef.current.contentWindow` before accepting the height — this prevents spoofed messages from other iframes or windows.

## useMemo for srcDoc Stability

The wrapped HTML is computed with `useMemo` keyed on the raw `html` prop. This prevents React from re-mounting the iframe on every parent re-render — without memoization, a new string reference would cause the iframe to reload, losing user interaction state (scroll position, form inputs, animation progress).

## Key Implementation Details

- **isLoaded state resets on html change**: when the `html` prop changes, `isLoaded` is reset to `false` to show a loading state while the new content renders.
- **React key collision fix**: each `HtmlVisualizer` instance uses a stable key derived from content to avoid React reconciliation issues when multiple visualizers appear in the same message.
- **Black base styles**: `wrapHtmlForSandbox()` injects minimal black-theme CSS (`#000` background, light text) so visualizations blend with Quack's UI by default. Font sizes default to 13px body text.
- **Max height 2000px**: the iframe auto-resizes up to 2000px, allowing full-height dashboards without clipping.
- **No JS rule**: the MCP tool description explicitly tells agents to use only HTML+CSS+SVG, no JavaScript.
- **CopyButton extracted**: the copy-to-clipboard button was extracted as a reusable `CopyButton` component for use in other contexts beyond the visualizer.

## Files

| File | Role |
|------|------|
| `src/components/chat/HtmlVisualizer.tsx` | Iframe sandbox component with toolbar |
| `src/components/chat/HtmlVisualizer.css` | Dark theme styles |
| `src/components/chat/htmlVisualizerUtils.ts` | `wrapHtmlForSandbox()`, `isCompleteHtmlDocument()` |
| `src/components/chat/CopyButton.tsx` | Reusable copy-to-clipboard button |
| `src/components/MarkdownText.tsx` | Code fence language detection + routing |
| `src/components/StreamMessage.tsx` | MCP tool_use detection + widget rendering |
| `src-tauri/node-sdk/visualizer-mcp-server.js` | MCP server with `visualize_html` tool |
| `src-tauri/node-sdk/stream-daemon.js` | Registers visualizer MCP server |
| `src-tauri/node-sdk/stream-claude.js` | Registers visualizer MCP server (legacy) |

## Distinctive Tool Chip

The visualizer MCP tool has a distinctive appearance in the tool bar (System Initialized widget):

- **Color**: `#d946ef` (fuchsia) — stands out from other MCP tools
- **Icon**: eye/preview SVG — conveys "visualization" at a glance
- Defined in `ToolWidgets.tsx` (`getToolColor` + `ToolIcon`)

## Brain Breadcrumb

`// Brain: quack-visualizer-inline-html` — placed in `MarkdownText.tsx`, `StreamMessage.tsx`, `stream-daemon.js`, `stream-claude.js`.
