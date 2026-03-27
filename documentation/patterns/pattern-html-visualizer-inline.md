---
type: pattern
project: quack-app
created: 2026-03-24
last_verified: 2026-03-27
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

The iframe uses `sandbox="allow-scripts"` **without** `allow-same-origin`.

- **JavaScript works**: `allow-scripts` enables JS execution. The auto-resize script, anchor interception, and inline JS all run correctly. Agents can use JS for interactive features (scroll, tabs, animations).
- The iframe cannot access the parent document's DOM, cookies, or storage.
- The iframe cannot make same-origin requests to the host application.
- External library loading (CDN) is blocked — use inline JS only.

## Injected Scripts (AUTO_RESIZE_SCRIPT)

The `wrapHtmlForSandbox()` function injects a `<script>` block that handles two concerns:

### 1. Auto-Resize via postMessage

1. Appends script before `</body>` (using `lastIndexOf` for correct injection point).
2. Observes `document.body` with `ResizeObserver` and sends `{ type: 'quack-viz-resize', height }` via `postMessage`.
3. `HtmlVisualizer.tsx` verifies `event.source === iframeRef.current.contentWindow` before accepting — prevents spoofed messages.

### 2. Anchor Click Interception

`<a href="#id">` links in a sandboxed srcdoc iframe navigate away from the content (showing the Quack splash page). The injected script intercepts all anchor clicks and uses `scrollIntoView({ behavior: 'smooth' })` instead. See `gotcha-anchor-navigation-sandboxed-iframe.md`.

## useMemo for srcDoc Stability

The wrapped HTML is computed with `useMemo` keyed on the raw `html` prop. This prevents React from re-mounting the iframe on every parent re-render — without memoization, a new string reference would cause the iframe to reload, losing user interaction state (scroll position, form inputs, animation progress).

## Key Implementation Details

- **isLoaded state resets on html change**: when the `html` prop changes, `isLoaded` is reset to `false` to show a loading state while the new content renders.
- **React key collision fix**: each `HtmlVisualizer` instance uses a stable key derived from content to avoid React reconciliation issues when multiple visualizers appear in the same message.
- **Black base styles**: `wrapHtmlForSandbox()` injects minimal black-theme CSS (`#000` background, light text) so visualizations blend with Quack's UI by default. Font sizes default to 13px body text.
- **Default height 650px**: `DEFAULT_HEIGHT = 650` in `HtmlVisualizer.tsx`. The iframe starts at this height and auto-resizes up to `MAX_HEIGHT` (2000px).
- **JS is supported**: `sandbox="allow-scripts"` enables inline JS. Agents can use JS for interactivity (tabs, scroll, animations). External CDN scripts are blocked.
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

## Distinctive Tool Chip

The visualizer MCP tool has a distinctive appearance in the tool bar (System Initialized widget):

- **Color**: `#d946ef` (fuchsia) — stands out from other MCP tools
- **Icon**: eye/preview SVG — conveys "visualization" at a glance
- Defined in `ToolWidgets.tsx` (`getToolColor` + `ToolIcon`)

## Brain Breadcrumb

`// Brain: quack-visualizer-inline-html` — placed in `MarkdownText.tsx`, `StreamMessage.tsx`, `stream-daemon.js`.
