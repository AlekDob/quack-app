---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-03
last_verified: 2026-07-03
tags: [chat, user-message, markdown, actions, sticky, ux]
---

## User message bar

**Purpose:** User turns render as a **right-aligned content card** with hover
actions (copy, re-send, branch) — not the old left-gutter "You" label + tiny
header buttons. Matches Cursor/Conductor: the user's prompt is the hero block;
actions appear on hover at the bottom-right of the card.

**Files:** `src/components/UserMessageBar.tsx`, styles `.ai-user-bar*` in
`src/App.css`, wired from `AIChatPanel.tsx`.

### Layout

```
┌─────────────────────────────────────┐
│  [optional image thumbnails]        │
│  Markdown-rendered prompt text      │
│                          [⎘][↻][⎇] │  ← hover / focus-within
└─────────────────────────────────────┘
```

- Wrapper: `.ai-msg.ai-msg-user` (nav-rail anchors unchanged: `data-anchor-*`).
- Card: `.ai-user-bar` — `align-self: flex-end`, `max-width: 88%`, elevated
  surface (`--bg-elev`, border, `radius-md`).
- Body: `.ai-user-bar-main` — `MarkdownPreview` for the prompt (supports
  pasted markdown, lists, headings at compact sizes).
- Actions: `.ai-user-bar-actions` — hidden at rest (`opacity: 0`), revealed on
  `.ai-user-bar:hover` or `:focus-within` (keyboard accessible).

### Actions

| Button | Icon | Behaviour |
|---|---|---|
| Copy | `copy` | Clipboard + toast |
| Re-send | `refresh` | `regenerateFrom(idx)` — wipes below |
| Branch | `branch` | `branchFromHere(idx)` — new chat tab (only when `aiChatId` set) |

Disabled while `streaming !== null || runningTools`.

### Stacking (long threads)

Each user bar gets an incrementing `z-index` (`userTurnByIdx`) so when turns
stack visually, hover actions on older messages stay clickable above newer content.

### Images

Reuses `.ai-msg-images` / `.ai-msg-image` inside the bar; click opens the
existing zoom modal (`openZoom`).

### Related

- Navigation rail ticks: still keyed off `data-anchor-role="user"` on the wrapper.
- Assistant turns: unchanged Jack header + `InterleavedBlocks` / `ComposeCard`.
