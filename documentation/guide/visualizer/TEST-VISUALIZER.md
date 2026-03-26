---
type: guide
project: quack-app
created: 2026-03-24
tags: [visualizer, testing, html, iframe]
---

# Quack Visualizer - Test & Documentation Guide

This document serves two purposes:
1. **Documentation**: Explains how the inline HTML Visualizer works
2. **Manual Test Plan**: Step-by-step verification in Quack

---

## How the Visualizer Works

The Quack Visualizer renders AI-generated HTML directly inside chat messages. When Claude (or any LLM) writes a ` ```quack-viz ` code fence, the MarkdownText parser intercepts it and renders an interactive iframe instead of a static code block. This brings Claude Desktop-like visualization capabilities to Quack — charts, diagrams, interactive widgets, all inline.

The iframe uses `sandbox="allow-scripts"` **without** `allow-same-origin`, which means the HTML can run JavaScript (for Chart.js, D3, etc.) but cannot access Quack's DOM, cookies, localStorage, or Tauri APIs. Maximum isolation.

### Architecture

```
Claude generates ```quack-viz code fence
        │
        ▼
MarkdownText.tsx (line ~140)
  ├─ detects codeBlockLang === 'quack-viz'
  └─ renders <HtmlVisualizer html={content} />
        │
        ▼
HtmlVisualizer.tsx
  ├─ wrapHtmlForSandbox(html)  ─── htmlVisualizerUtils.ts
  │   ├─ detects fragment vs full doc
  │   ├─ injects auto-resize script
  │   └─ adds dark base styles (if fragment)
  ├─ <iframe srcdoc={wrapped} sandbox="allow-scripts" />
  ├─ postMessage listener (auto-resize)
  └─ Toolbar: Code/Preview | Copy | Collapse
```

### Key Concepts

- **Code fence trigger**: ` ```quack-viz ` — the language tag on the code fence activates the visualizer
- **Sandbox isolation**: `allow-scripts` without `allow-same-origin` = JS runs but no parent access
- **Auto-resize**: The injected script uses `ResizeObserver` + `postMessage` to tell the parent iframe height
- **Source verification**: `event.source === iframeRef.current.contentWindow` prevents other iframes from spoofing resize messages
- **useMemo**: `wrappedHtml` is memoized to prevent iframe re-mount on React re-renders

### Where Things Live

| File | What it does |
|------|-------------|
| `src/components/chat/HtmlVisualizer.tsx` | Main component: iframe + toolbar + resize logic |
| `src/components/chat/HtmlVisualizer.css` | Dark theme styles, toolbar, loading spinner |
| `src/components/chat/htmlVisualizerUtils.ts` | `wrapHtmlForSandbox()`, `isCompleteHtmlDocument()` |
| `src/components/chat/CopyButton.tsx` | Reusable copy-to-clipboard (shared with MarkdownText) |
| `src/components/MarkdownText.tsx` | Modified: captures code fence language, routes `quack-viz` |

---

## Manual Testing in Quack

Open Quack and follow each section in order. You need a working Claude session.

---

### Test 1: Basic Visualization Rendering

**What to check**: A simple HTML fragment renders as an interactive iframe, not as code.

1. Open Quack and start a new session
2. Send this prompt to Claude:

```
Please write a simple visualization using a quack-viz code fence. Just a colored box with some text and a button that changes the background color when clicked. Keep it simple.
```

3. Wait for Claude to respond with a ` ```quack-viz ` block

**Pass criteria**:
- [ ] You see a widget with an orange border and "Visualizer" label in the toolbar
- [ ] The content renders as an interactive HTML page, NOT as raw code
- [ ] The toolbar shows three buttons: "Code", "Copy", "Collapse"
- [ ] If there's a button in the viz, clicking it works (JS executes)

**If it doesn't work**: Check the browser console (Cmd+Option+I → Console tab). If you see CSP errors about `frame-src`, the Tauri CSP may need `blob:` added to `frame-src`.

---

### Test 2: Code/Preview Toggle

**What to check**: The Code button toggles between rendered preview and raw HTML source.

1. Find the visualization from Test 1
2. Click the **"Code"** button in the toolbar
3. Verify you see raw HTML source code
4. Click the **"Preview"** button (same position, label changed)
5. Verify the visualization re-appears

**Pass criteria**:
- [ ] Clicking "Code" shows raw HTML in a monospaced font
- [ ] Clicking "Preview" returns to the rendered iframe
- [ ] The button label toggles between "Code" and "Preview"
- [ ] The "Code" button has an orange highlight when active

---

### Test 3: Copy to Clipboard

**What to check**: The Copy button copies the original HTML (not the wrapped version) to clipboard.

1. Click the **"Copy"** button in the visualizer toolbar
2. Open any text editor and paste (Cmd+V)

**Pass criteria**:
- [ ] The button briefly shows "Copied!" feedback
- [ ] The pasted text is the original HTML Claude wrote (without the auto-resize script wrapper)

---

### Test 4: Collapse/Expand

**What to check**: Collapsing hides the iframe without destroying it.

1. Click the **"Collapse"** button
2. Verify the iframe area disappears (only toolbar visible)
3. Click the **"Expand"** button
4. Verify the visualization returns

**Pass criteria**:
- [ ] Collapsed state shows only the toolbar bar
- [ ] Expanding restores the visualization without reloading
- [ ] The button label toggles between "Collapse" and "Expand"

---

### Test 5: Auto-Resize

**What to check**: The iframe height adjusts to fit its content automatically.

1. Send this prompt:

```
Create a quack-viz visualization with a very tall list of 20 numbered items, each on its own line with some padding.
```

2. Observe the iframe height

**Pass criteria**:
- [ ] The iframe does NOT have a tiny height showing only part of the content
- [ ] The iframe height is capped at 600px maximum (you'll need to scroll inside for very tall content)
- [ ] The "Rendering..." spinner shows briefly before content appears

---

### Test 6: Chart.js from CDN

**What to check**: The iframe can load external libraries from CDN (Chart.js, D3, etc.).

1. Send this prompt:

```
Create a quack-viz visualization that loads Chart.js from CDN (https://cdn.jsdelivr.net/npm/chart.js) and renders a bar chart showing these values: React=85, Vue=72, Angular=45, Svelte=68. Use a dark background.
```

2. Wait for the chart to render (may take 1-2 seconds for CDN load)

**Pass criteria**:
- [ ] A bar chart appears with 4 bars
- [ ] Hovering over bars shows tooltips (Chart.js interactivity)
- [ ] No console errors about blocked requests or CSP violations
- [ ] The chart background matches Quack's dark theme

**If it doesn't work**: CDN loading requires network access from the iframe. Since `sandbox="allow-scripts"` doesn't block `fetch`, this should work. If blocked, check if a corporate proxy/firewall is interfering.

---

### Test 7: Multiple Visualizations in One Message

**What to check**: Multiple ` ```quack-viz ` blocks in the same message each get their own iframe.

1. Send this prompt:

```
Create two separate quack-viz visualizations in your response:
1. First: a red circle with SVG
2. Second: a blue square with SVG
Put some text between them.
```

**Pass criteria**:
- [ ] Two separate visualizer widgets appear, each with their own toolbar
- [ ] Each has independent Code/Preview/Collapse controls
- [ ] Collapsing one does NOT affect the other
- [ ] Text between the two visualizations renders normally as markdown

---

### Test 8: Normal Code Blocks Still Work

**What to check**: Regular code blocks (` ```typescript `, ` ```python `, etc.) are NOT affected.

1. Send this prompt:

```
Show me a TypeScript code example of a fibonacci function. Use a normal typescript code fence, not quack-viz.
```

**Pass criteria**:
- [ ] The code block renders as a normal syntax-highlighted code block
- [ ] The Copy button on the code block still works
- [ ] No "Visualizer" toolbar appears — it's just a regular code block

---

### Test 9: Malformed HTML Graceful Degradation

**What to check**: Broken HTML doesn't crash the chat — it renders whatever it can.

1. Send this prompt:

```
Create a quack-viz block with intentionally broken HTML: missing closing tags, a script that throws an error, and some visible text that says "I still render".
```

**Pass criteria**:
- [ ] The visualizer widget appears (doesn't crash)
- [ ] The text "I still render" is visible
- [ ] Clicking "Code" shows the raw broken HTML
- [ ] No errors in the main Quack console (iframe errors stay inside the iframe)

---

### Test 10: Security — Iframe Isolation

**What to check**: The sandboxed iframe cannot access Quack's DOM or APIs.

1. Send this prompt:

```
Create a quack-viz block that tries to:
1. Access parent.document.title and display it
2. Access localStorage and display a value
3. Show the text "If you see 'ACCESS DENIED' for both, the sandbox works"

Use try/catch around each access attempt and display "ACCESS DENIED" if it fails.
```

**Pass criteria**:
- [ ] Both access attempts show "ACCESS DENIED"
- [ ] The iframe CANNOT read Quack's document title
- [ ] The iframe CANNOT read localStorage
- [ ] The text about sandbox working is visible

---

## Troubleshooting

### Visualization shows as raw code instead of iframe

- **Cause**: The code fence language tag is wrong. It must be exactly ` ```quack-viz ` (lowercase, no spaces)
- **Fix**: Ask Claude to use the exact marker: "wrap it in a ```quack-viz code fence"

### Blank iframe with no content

- **Cause**: CSP blocking `srcdoc` iframes
- **Fix**: Check `src-tauri/tauri.conf.json` → `frame-src`. May need `blob:` added
- **Console check**: Look for `Refused to frame '' because it violates the following Content Security Policy`

### Chart.js / CDN libraries not loading

- **Cause**: Network access blocked inside sandbox
- **Fix**: `sandbox="allow-scripts"` should allow fetch/script loading. Check firewall/proxy
- **Console check**: Look for `net::ERR_BLOCKED_BY_CLIENT` or CSP `connect-src` errors

### Iframe height stuck at 400px

- **Cause**: Auto-resize postMessage not getting through
- **Fix**: Check that `event.source` verification works. Open console, look for `quack-viz-resize` messages
- **Console check**: Add `window.addEventListener('message', e => console.log(e.data))` temporarily

---

## Architecture Summary

### Before

```
MarkdownText.tsx
  └─ All ```code fences``` → <pre><code> block (no language capture)
  └─ CopyButton defined inline (not reusable)
```

### After (current)

```
MarkdownText.tsx
  ├─ ```quack-viz → <HtmlVisualizer> (sandboxed iframe)
  ├─ ```other-lang → <pre><code> block (unchanged)
  └─ CopyButton imported from chat/CopyButton.tsx (shared)

HtmlVisualizer.tsx
  ├─ wrapHtmlForSandbox() → injects resize script + dark styles
  ├─ <iframe srcdoc sandbox="allow-scripts"> → isolated execution
  ├─ postMessage listener → auto-resize with source verification
  └─ Toolbar: Code/Preview, Copy, Collapse/Expand
```

### Key Design Decisions

1. **Code fence, not tool_use**: Works with any LLM provider, zero backend changes, natural fallback to raw code
2. **sandbox without allow-same-origin**: Maximum security — AI-generated JS cannot access Quack
3. **CopyButton extraction**: Keeps MarkdownText under 300 lines, enables reuse across components
4. **useMemo for srcDoc**: Prevents iframe flickering on React re-renders
