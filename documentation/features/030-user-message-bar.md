---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-03
last_verified: 2026-07-17
tags: [chat, user-message, markdown, actions, sticky, scroll, collapse, ux, liquid-glass, image-deck]
---

## User message bar

**Purpose:** User turns render as a **full-width inset card** with hover
actions (copy, re-send, branch). The prompt stays **pinned at the top of the
viewport** while you scroll that turn's assistant response (CSS sticky).
**Tall prompts always clamp to ~3 lines** (Cursor-style); click the card to
expand. Collapse is **not** tied to sticky/scroll — that coupling caused
height ↔ IntersectionObserver flicker.

**Files:**

| File | Role |
|---|---|
| `src/components/UserMessageBar.tsx` | `UserTurnBar`, `UserMessageImageDeck`, `UserMessageBarInner`, actions |
| `src/hooks/useUserBarSticky.ts` | Overflow measure + compact/expand (sticky pin is CSS-only) |
| `src/hooks/useUserBarSticky.test.ts` | `estimateUserBarOverflow` regression |
| `src/imageAttach.ts` | `userMessageDisplayText`, `rehydrateMessageImages` (reload thumbs) |
| `src/components/AIChatPanel.tsx` | Turn grouping; renders `<UserTurnBar>` per user message |
| `src/chatScroll.ts` | `groupChatTurns`, `pinUserTurnToTop`, tail-follow helpers |
| `src/App.css` | `.ai-turn`, `.ai-msg-user`, `.ai-user-bar*`, collapse tokens |

### Public API

| Export | When to use |
|---|---|
| `UserTurnBar` | **Chat turns** — sticky `.ai-msg-user` wrapper + nav `data-anchor-*`. Used by `AIChatPanel`. |
| `UserMessageBar` | Standalone card only (no turn wrapper). |

`UserTurnBar` props: all `UserMessageBar` bar props plus `zIndex`, `anchorIdx`, optional `dimmed`.

### DOM structure (turn grouping)

```
.ai-messages                    ← scroll container (overflow-y: auto)
  .ai-turn                      ← sticky containing block (prompt + response height)
    .ai-msg.ai-msg-user         ← position: sticky; top: 0; z-index: N; bg transparent
      .ai-user-bar.is-compact?   ← liquid-glass card; overflow: visible
        .ai-user-bar-main        ← MarkdownPreview (clamped to 3 lines when collapsed)
        .ai-user-bar-aside       ← deck + actions (stopPropagation — no toggle steal)
    .ai-msg-assistant …
```

`groupChatTurns()` in `chatScroll.ts` → `{ userIdx, followIdxs[] }`.
`AIChatPanel` hoists user bars into `.ai-turn`; user rows inside `renderAt` return `null`.

### Sticky behaviour (pin)

| Moment | What happens |
|---|---|
| **Send** | `pinUserTurnToTop(scrollRef)` — latest `[data-anchor-role="user"]` at top (`PIN_TOP_GAP_PX = 8`). |
| **Scroll response** | `.ai-msg-user` sticks at `top: 0` for the whole turn. |
| **Next turn** | Next turn's user bar (higher `z-index`) covers the previous sticky prompt. |

**Why sticky is on `.ai-msg-user`, not `.ai-user-bar`:** sticky only travels within the parent's box. `.ai-msg-user` spans the turn height because it sits inside tall `.ai-turn`.

### Tall-prompt collapse (Cursor-style, always)

**Problem (old):** Compact only while **stuck** + sentinel `IntersectionObserver`.
Shrinking the bar moved the sentinel relative to scroll → stuck flipped →
compact toggled → flicker loop.

**Solution:** Clamp **by default** to 3 lines whenever the prompt overflows.
Click the card (or chevron) to expand. Sticky pin stays pure CSS — no IO.

#### State machine

```
         ┌─────────────┐
         │   compact   │  max-height: 3 lines + fade (if expandable)
         │  (default)  │
         └──────┬──────┘
                │ click card / chevron
                ▼
         ┌─────────────┐
         │  expanded   │  min(60vh, 420px) internal scroll
         └──────┬──────┘
                │ click again / chevron
                └──────────► compact
```

| State | CSS classes | Height | Click / chevron |
|---|---|---|---|
| Short (fits ≤3 lines) | `.is-compact` | Natural (clamp no-op) | None |
| Tall, collapsed | `.is-compact.is-expandable` | `calc(1.55em * 3)` + fade | Expand |
| Tall, expanded | `.is-expanded.is-expandable` | `min(60vh, 420px)`, scroll | Collapse |

Content change resets to collapsed.

#### `useUserBarSticky(content)`

| Signal | Role |
|---|---|
| `estimateUserBarOverflow` | Seeds `canExpand` (>180 chars or ≥3 newlines) before layout |
| `canExpand` | `scrollHeight > clientHeight` while clamped; hysteresis clears only when content clearly fits |
| `isCompact` | `!expanded && canExpand` — clamp only tall prompts |
| `canToggle` | `canExpand` — card is clickable + chevron visible |

**No sentinel / IntersectionObserver.** Sticky detection was removed from JS.

### CSS gotchas (do not regress)

| Rule | Why |
|---|---|
| Sticky on `.ai-msg-user`, not `.ai-user-bar` | Containing block must span the turn |
| `.ai-msg-user { animation: none }` | `.ai-msg` entrance `transform` breaks sticky in WebKit |
| `.ai-msg-user { background: transparent }` | Sticky wrapper must not block glass blur |
| `.ai-user-bar { overflow: visible }` | Image deck fans left; clamp stays on `.ai-user-bar-main` |
| Clamp only on `.ai-user-bar-main` | Single max-height — do not double-clamp `.md-preview` |
| Fade only with `.is-expandable` | Short prompts must not show a fake truncate gradient |
| Aside `stopPropagation` | Copy / images / chevron must not toggle expand |
| Do not re-bind collapse to sticky | Height change + scroll IO = flicker |

### Surface tokens (liquid glass)

| Token | Role |
|---|---|
| `--user-bar-glass-from` / `--to` | Gradient + compact fade stop |
| `--user-bar-border` / `--user-bar-shadow` | Hairline + depth |

Do **not** use `--bg-hi` for the card — too close to `--chat-stream-bg` on dark.

### Actions

| Button | Behaviour |
|---|---|
| Card click / Expand chevron | Toggle compact ↔ expanded (only if `canExpand`) |
| Copy | Clipboard + toast |
| Re-send | `regenerateFrom(idx)` |
| Branch | `branchFromHere(idx)` |

### Images (card deck)

Unchanged: 32px deck absolute on the bar (`bottom: 40px`); hover fans left.
Clicks stay on the aside (no expand toggle).

### Test plan

1. Short prompt → full height, no fade, no chevron, click does nothing.
2. Long prompt (paste / 4+ lines) → 3-line clamp + fade; click expands; click again collapses.
3. Scroll assistant reply → bar stays sticky at top, still 3 lines (no flicker).
4. Multi-turn → older sticky covered by next turn's higher `z-index`.
5. Image deck click → zoom only, does not toggle expand.
6. `npm test` → `useUserBarSticky.test.ts` passes.

### Related

| Doc | Link |
|---|---|
| Navigation rail | `021-chat-nav-rail.md` |
| Composer pin | `022-chat-composer.md` |
| Diary | `documentation/diary/2026-07-17.md` |
