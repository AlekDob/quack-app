---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-03
last_verified: 2026-07-10
tags: [chat, user-message, markdown, actions, sticky, scroll, collapse, ux]
---

## User message bar

**Purpose:** User turns render as a **full-width inset card** with hover
actions (copy, re-send, branch). The prompt stays **pinned at the top of the
viewport** while you scroll that turn's assistant response (Cursor-style).
**Tall prompts auto-collapse while stuck** so long pastes (logs, code blocks)
do not hide the reply — a problem Cursor still exhibits on very tall user
messages.

**Files:**

| File | Role |
|---|---|
| `src/components/UserMessageBar.tsx` | `UserTurnBar` (turn shell), `UserMessageBarInner` (card), actions |
| `src/hooks/useUserBarSticky.ts` | Stuck sentinel IO, tall measure, compact/expand state |
| `src/components/AIChatPanel.tsx` | Turn grouping; renders `<UserTurnBar>` per user message |
| `src/chatScroll.ts` | `groupChatTurns`, `pinUserTurnToTop`, tail-follow helpers |
| `src/App.css` | `.ai-turn`, `.ai-msg-user`, `.ai-user-bar*`, collapse tokens |

### Public API

| Export | When to use |
|---|---|
| `UserTurnBar` | **Chat turns** — includes sentinel sibling + `.ai-msg-user` sticky wrapper + nav `data-anchor-*`. Used by `AIChatPanel`. |
| `UserMessageBar` | Standalone card only (no sentinel). Hook runs but stuck detection is ineffective without the sentinel sibling — prefer `UserTurnBar` in scroll containers. |

`UserTurnBar` props: all `UserMessageBar` bar props plus `zIndex`, `anchorIdx`, optional `dimmed`.

### DOM structure (turn grouping)

Flat `display[]` messages are grouped into **turns** before render:

```
.ai-messages                    ← scroll container (overflow-y: auto); IO root
  .ai-turn                      ← sticky containing block (prompt + response height)
    .ai-user-bar-sentinel       ← 0-height sibling BEFORE sticky (IO target)
    .ai-msg.ai-msg-user         ← position: sticky; top: 0; z-index: N
      .ai-user-bar              ← visual card; state classes below
        .ai-user-bar-main       ← MarkdownPreview + optional images
        .ai-user-bar-actions    ← expand + copy / re-send / branch
    .ai-msg-assistant …
```

`groupChatTurns()` in `chatScroll.ts` → `{ userIdx, followIdxs[] }`.
`AIChatPanel` hoists user bars into `.ai-turn`; user rows inside `renderAt` return `null`.

### Sticky behaviour (pin)

| Moment | What happens |
|---|---|
| **Send** | `pinUserTurnToTop(scrollRef)` — latest `[data-anchor-role="user"]` at top (`PIN_TOP_GAP_PX = 8`). `pinActiveRef` blocks tail-follow until stream ends. |
| **Scroll response** | `.ai-msg-user` sticks at `top: 0` for the whole turn. |
| **Next turn** | Next turn's user bar (higher `z-index`) covers the previous sticky prompt. |

**Why sticky is on `.ai-msg-user`, not `.ai-user-bar`:** sticky only travels within the parent's box. `.ai-msg-user` spans the turn height because it sits inside tall `.ai-turn`.

### Tall-prompt collapse (stuck + compact)

**Problem:** A sticky prompt taller than the viewport covers assistant content
(same class of bug reported for Cursor/VS Code `.stickyHeader`).

**Solution:** When the bar is **stuck** and **naturally tall**, clamp height and
offer manual expand.

#### State machine

```
                    ┌─────────────┐
         not stuck  │  expanded   │  full natural height
        ┌──────────►│  (default)  │◄──────────┐
        │           └─────────────┘           │
        │                  │ send / at rest   │ scroll back (unstuck)
        │                  │ scroll down      │
        │                  ▼                  │
        │           ┌─────────────┐           │
        │           │   compact   │  max-height + fade
        │           │ (auto stuck)│───────────┘
        │           └──────┬──────┘
        │                  │ chevron expand
        │                  ▼
        │           ┌─────────────┐
        └───────────│  expanded   │  capped internal scroll
           chevron  │ (manual)    │
           collapse└─────────────┘
```

| State | CSS classes | Height | Expand chevron |
|---|---|---|---|
| At rest / unstuck | (none) | Natural | Hidden |
| Stuck, short (≤100px) | `.is-stuck` | Natural | Hidden |
| Stuck, tall, auto | `.is-stuck.is-compact` | `min(35vh, 160px)` + fade | Visible (↓) |
| Stuck, tall, manual | `.is-stuck.is-expanded` | `min(60vh, 420px)`, `overflow-y: auto` | Visible (↑) |

Manual expand **resets to compact** when the bar becomes unstuck (`useEffect` on `isStuck`).

#### `useUserBarSticky(content)`

| Constant / signal | Value | Role |
|---|---|---|
| `TALL_THRESHOLD_PX` | `100` | `ResizeObserver` on `.ai-user-bar-main`; above → eligible for collapse |
| `isStuck` | `!sentinel.isIntersecting` | `IntersectionObserver`, `root: .ai-messages`, `threshold: 0` |
| `isCompact` | `isStuck && isTall && !expanded` | Drives `.is-compact` |
| `canToggle` | `isStuck && isTall` | Shows chevron; adds `.is-stuck` for button opacity |

**Sentinel placement (critical):** `.ai-user-bar-sentinel` must be a **sibling**
of `.ai-msg-user`, not a child. If the sentinel is inside the sticky element, it
moves with the pin and `IntersectionObserver` never fires. `UserTurnBar` owns
this structure.

**Re-measure:** `ResizeObserver` + `content` dependency — edits to the prompt
or image row resize the bar.

### CSS gotchas (do not regress)

| Rule | Why |
|---|---|
| Sticky on `.ai-msg-user`, not `.ai-user-bar` | Containing block must span the turn |
| `.ai-msg-user { animation: none }` | `.ai-msg` entrance `transform` breaks sticky in WebKit |
| `.ai-msg-user { background: var(--chat-stream-bg) }` | Opaque pin — no bleed-through |
| `z-index` inline on `.ai-msg-user` | `userTurnByIdx`, 1…N per thread |
| Fade uses `var(--user-bar-bg)` | Matches card fill in light/dark |
| `.ai-user-bar-expand` opacity when `.is-stuck` | Chevron visible while stuck; other actions stay hover-gated |

### Surface tokens

| Token | Dark | Light | Role |
|---|---|---|---|
| `--user-bar-bg` | `color-mix(fg 12%, chat-stream-bg)` | `color-mix(fg 5%, bg-alt)` | Card fill |
| `--user-bar-border` | `color-mix(fg 16%, transparent)` | `color-mix(fg 10%, transparent)` | Edge |

Do **not** use `--bg-hi` — too close to `--chat-stream-bg` on dark.

### Layout (compact while stuck)

```
┌──────────────────────────────────────────────┐  ← sticks at top: 0
│  [thumbnails, clipped if tall]               │
│  First lines of prompt…          [↓][⎘][↻]  │  ← fade at bottom when compact
└──────────────────────────────────────────────┘
        … assistant response visible below …
```

### Actions

| Button | Icon | Behaviour |
|---|---|---|
| Expand / Collapse | `chevron-down` / `chevron-up` | Only when stuck + tall; toggles compact ↔ expanded |
| Copy | `copy` | Clipboard + toast |
| Re-send | `refresh` | `regenerateFrom(idx)` — wipes below |
| Branch | `branch` | `branchFromHere(idx)` — new chat tab |

Copy / re-send / branch disabled while `streaming !== null || runningTools`.

### Images

`.ai-msg-images` / `.ai-msg-image` inside `.ai-user-bar-main`; click → zoom modal (`openZoom`). Included in `scrollHeight` for tall detection; clipped with text when compact.

### Test plan

1. Short prompt (< ~4 lines) → send → scroll response → bar stays full height, no chevron.
2. Long prompt (30+ lines or paste logs) → scroll response → bar compacts (~160px max), fade visible, assistant text readable underneath.
3. Chevron ↓ → expands with internal scroll; ↑ → back to compact.
4. Scroll until prompt returns to natural position → full height, chevron hidden.
5. Multi-turn thread → older sticky bar covered by next turn's higher `z-index`.
6. Nav rail (`021`) → ticks still on `[data-anchor-role="user"]`; jump scroll unchanged.
7. Light + dark theme → fade matches card surface.

### Related

| Doc | Link |
|---|---|
| Navigation rail | `021-chat-nav-rail.md` — anchors on `.ai-msg-user`; `offsetTop` honest under `.ai-messages` |
| Composer pin | `022-chat-composer.md` — `pinUserTurnToTop`, `pinActiveRef`, `stickyBottomRef` |
| Diary | `documentation/diary/2026-07-10-sticky-collapse.md` |
