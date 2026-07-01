---
type: feature
project: quack-desktop
created: 2026-07-01
last_verified: 2026-07-01
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

- **Decoupled via DOM data-attributes.** Each message div carries `data-anchor-idx`, `data-anchor-role`, and (user only) `data-anchor-preview` (first 120 chars). The rail never imports the message model — it queries `[data-anchor-role="user"]`.
- **Minimap positioning.** Each tick's `top` = `el.offsetTop / scrollHeight` (0..1) → proportional to its place in the content, so the rail reads as a true minimap.
- **Freshness.** Rescans on `version` (turn count) + a rAF-throttled `MutationObserver` on the scroll container (catches streaming growth / reflow).
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
- Very large sessions (1000+ turns) render one button per turn — fine in practice but not virtualized.
- Preview is a single-line ellipsis of raw content (markdown not stripped).
