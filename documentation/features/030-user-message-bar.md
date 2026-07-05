---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-03
last_verified: 2026-07-05
tags: [chat, user-message, markdown, actions, sticky, scroll, ux]
---

## User message bar

**Purpose:** User turns render as a **full-width inset card** with hover
actions (copy, re-send, branch) — not the old left-gutter "You" label + tiny
header buttons. Matches Cursor: the user's prompt stays **pinned at the top of
the viewport** while you scroll through that turn's assistant response; older
turns stack underneath with incrementing `z-index`.

**Files:**

| File | Role |
|---|---|
| `src/components/UserMessageBar.tsx` | Card markup + hover actions |
| `src/components/AIChatPanel.tsx` | Turn grouping, sticky wrapper, nav anchors |
| `src/chatScroll.ts` | `groupChatTurns`, `pinUserTurnToTop`, tail-follow helpers |
| `src/App.css` | `.ai-turn`, `.ai-msg-user`, `.ai-user-bar*` |

### DOM structure (turn grouping)

Flat `display[]` messages are grouped into **turns** before render:

```
.ai-messages                    ← scroll container (overflow-y: auto)
  .ai-turn                      ← one per user prompt + its responses
    .ai-msg.ai-msg-user         ← position: sticky; top: 0; z-index: N
      .ai-user-bar              ← visual card (NOT sticky — parent is)
    .ai-msg-assistant …         ← assistant / orphan tool rows for this turn
  .ai-turn
    …
```

`groupChatTurns()` in `chatScroll.ts` walks `display` and builds
`{ userIdx, followIdxs[] }`. A turn starts at each `role: "user"` message;
every following non-user message until the next user belongs in `followIdxs`.
Threads that begin with assistant/tool rows get a turn with `userIdx: null`.

`AIChatPanel` renders via `renderAt(i)` for follow-ups and hoists the user
bar into the turn wrapper (user messages inside `renderAt` return `null`).

### Sticky behaviour (Cursor-style)

| Moment | What happens |
|---|---|
| **Send** | `pinUserTurnToTop(scrollRef)` scrolls so the latest `[data-anchor-role="user"]` sits at the top (`PIN_TOP_GAP_PX = 8`). `pinActiveRef` suppresses tail-follow until the stream ends. |
| **Scroll response** | `.ai-msg-user` sticks at `top: 0` for the whole turn — the sticky **containing block** is `.ai-turn` (prompt + response height), not the card alone. |
| **Next turn** | When the next `.ai-turn` scrolls up, its user bar (higher `z-index`) covers the previous sticky prompt. |

**Why an earlier attempt failed:** `position: sticky` on `.ai-user-bar` could
never work — its parent `.ai-msg-user` was only as tall as the bar. Sticky
only travels within the parent's box. Moving sticky to `.ai-msg-user` inside
a tall `.ai-turn` fixes it.

**CSS gotchas (do not regress):**

- Sticky lives on **`.ai-msg-user`**, not `.ai-user-bar`.
- `.ai-msg-user { animation: none }` — the `.ai-msg` entrance animation uses
  `transform`, which breaks sticky in WebKit/Chromium.
- `.ai-msg-user` uses `background: var(--chat-stream-bg)` so assistant content
  scrolling underneath does not show through the pin gap.
- `z-index` is inline on `.ai-msg-user` (`userTurnByIdx`, 1…N per thread).

### Surface tokens

User cards use **dedicated tokens** so they read clearly above the chat stream
without jumping to semantic colour or orange accent:

| Token | Dark | Light | Role |
|---|---|---|---|
| `--user-bar-bg` | `color-mix(fg 12%, chat-stream-bg)` | `color-mix(fg 5%, bg-alt)` | Card fill — one step lifted from `--chat-stream-bg` / `--bg` |
| `--user-bar-border` | `color-mix(fg 16%, transparent)` | `color-mix(fg 10%, transparent)` | Edge definition (stronger than `--border`) |

`.ai-user-bar` also uses a 1px top hairline (`box-shadow`) instead of a heavy
drop shadow — minimal, Cursor-like separation when content scrolls underneath.

**Do not** reuse `--bg-hi` here: on dark it is only ~2% lighter than the stream
(`#1a1b21` vs `#181818`), so user turns vanished into the transcript.

### Layout

```
┌──────────────────────────────────────────────┐  ← sticks here while scrolling
│  [optional image thumbnails]                 │
│  Markdown-rendered prompt text    [⎘][↻][⎇] │  ← hover / focus-within
└──────────────────────────────────────────────┘
        Jack · Project Manager
        … assistant response scrolls below …
```

- Wrapper: `.ai-msg.ai-msg-user` — nav-rail anchors unchanged (`data-anchor-*`).
- Card: `.ai-user-bar` — full width, dedicated surface tokens (`--user-bar-bg`,
  `--user-bar-border`), `radius-md`, 1px hairline shadow. See **Surface tokens**
  below.
- Body: `.ai-user-bar-main` — `MarkdownPreview` (compact heading sizes).
- Actions: `.ai-user-bar-actions` — `opacity: 0` at rest; revealed on
  `.ai-user-bar:hover` or `:focus-within`.

### Actions

| Button | Icon | Behaviour |
|---|---|---|
| Copy | `copy` | Clipboard + toast |
| Re-send | `refresh` | `regenerateFrom(idx)` — wipes below |
| Branch | `branch` | `branchFromHere(idx)` — new chat tab (only when `aiChatId` set) |

Disabled while `streaming !== null || runningTools`.

### Images

Reuses `.ai-msg-images` / `.ai-msg-image` inside the bar; click opens the
existing zoom modal (`openZoom`).

### Related

- **Navigation rail** (`021-chat-nav-rail.md`) — ticks still query
  `[data-anchor-role="user"]`; `offsetTop` unchanged because the anchor
  remains the first child of each `.ai-turn`.
- **Composer / send pin** (`022-chat-composer.md`) — `pinUserTurnToTop` on
  send; tail-follow gated by `pinActiveRef` + `stickyBottomRef`.
- Assistant turns: Jack header + `InterleavedBlocks` / `ComposeCard`.
