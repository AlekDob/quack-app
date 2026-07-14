---
type: feature
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-14
tags: [chat, navigation, minimap, ux, long-threads]
---

# 021 — Chat navigation rail (minimap)

**Purpose:** Codex-style navigation rail for long chat threads. A thin gutter
on the **right** of the message stream (where the user's own turns live) with
one tick per USER turn; hover a tick to preview that turn, click to jump. The
active tick tracks the turn in view. Makes very long sessions navigable without
endless scrolling. Preview opens leftward so it never covers the messages.

## Components

| File | Role |
|---|---|
| `src/components/ChatNavRail.tsx` | The rail: reads anchors from the DOM, renders ticks + hover preview, jumps on click |
| `src/components/AIChatPanel.tsx` | Renders `<ChatNavRail>` in `.ai-messages-wrap`; stamps `data-anchor-*` on each message div |
| `src/App.css` | `.ai-nav-rail` / `.ai-nav-tick` / `.ai-nav-preview` styles |

## How it works

- **Decoupled via DOM data-attributes.** Each user turn's anchor div carries `data-anchor-idx`, `data-anchor-role="user"`, and `data-anchor-preview` (first 120 chars). Anchors live on `.ai-msg-user` inside `.ai-turn` wrappers; a zero-height `.ai-user-bar-sentinel` precedes each anchor (see `030-user-message-bar.md` — collapse IO only, nav ignores it). The rail never imports the message model — it queries `[data-anchor-role="user"]`.
- **Minimap positioning (compact overview).** Each tick's `top` = `el.offsetTop / scrollHeight` (0..1) → proportional to its place in the WHOLE thread, so all turns stay visible as a compact overview you can click to jump anywhere. `offsetTop` is honest because `.ai-messages` is `position: relative` (else offsetParent bubbles to `.ai-messages-wrap` and values drift on scroll). Chosen over live per-message tracking, which spread the ticks out and lost the overview.
- **Freshness.** Rescans on `version` (turn count) + rAF-throttled observers on the scroll container:
  - `MutationObserver` — `childList` + `subtree` only (new turns / structural changes).
  - `ResizeObserver` — scroll-area height growth during streaming.
  - **Do not** observe `characterData` — each typewriter glyph fired a rescan and
    competed with `069` smooth streaming (2026-07-14 fix).
- **Active tick.** A `scroll` listener marks the last user anchor above the viewport's upper third (`scrollTop + clientHeight * 0.35`).
- **Jump.** Click → `element.scrollIntoView({ behavior: "smooth", block: "start" })`.

## Behaviour / rules

- Hidden for short threads (`anchors.length < 3`) — earns its space only when scrolling hurts.
- Rail lives in the right gutter (`.ai-nav-rail { right: 2px }`); ticks anchored right, preview opens leftward (`right: 20px`).
- Rail is `pointer-events: none` except the ticks + preview, so it never intercepts clicks meant for messages.
- Faint at rest (`opacity .45`), full on `.ai-messages-wrap:hover`.
- Neutral chrome: ticks use `--fg-muted` → `--fg` on hover/active. No accent colour.

## Known limits / TODO

- One tick per user turn (assistant-only turns aren't anchored).
- Compact minimap: ticks are proportional to the whole thread, so they don't sit exactly beside on-screen messages (that's by design — it's an overview, jumpable). A live per-message variant was tried and reverted (too spread out).
- Preview is a single-line ellipsis of raw content (markdown not stripped).
