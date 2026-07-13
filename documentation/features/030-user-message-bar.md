---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-03
last_verified: 2026-07-13
tags: [chat, user-message, markdown, actions, sticky, scroll, collapse, ux, liquid-glass, image-deck]
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
| `src/components/UserMessageBar.tsx` | `UserTurnBar`, `UserMessageImageDeck`, `UserMessageBarInner`, actions |
| `src/hooks/useUserBarSticky.ts` | Stuck sentinel IO, tall measure, compact/expand state |
| `src/imageAttach.ts` | `userMessageDisplayText`, `rehydrateMessageImages` (reload thumbs) |
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
    .ai-msg.ai-msg-user         ← position: sticky; top: 0; z-index: N; bg transparent
      .ai-user-bar.has-images?   ← liquid-glass card; overflow: visible
        .ai-user-bar-main        ← MarkdownPreview only (fenced code → copyable pills, `049`)
        .ai-user-bar-aside       ← right column: actions only (deck is bar-absolute)
          .ai-user-msg-images    ← 32px deck, absolute on .ai-user-bar (right, bottom: 40px)
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
| At rest / unstuck | (none) | Natural (`min-height: 42px`, 13.5px text) | Hidden |
| Stuck, short (≤160px) | `.is-stuck` | Natural | Hidden |
| Stuck, tall, auto | `.is-stuck.is-compact` | `92px` max on text; ~4 lines + fade | Visible (↓) |
| Stuck, tall, manual | `.is-stuck.is-expanded` | `min(60vh, 420px)`, `overflow-y: auto` | Visible (↑) |

Manual expand **resets to compact** when the bar becomes unstuck (`useEffect` on `isStuck`).

#### `useUserBarSticky(content)`

| Constant / signal | Value | Role |
|---|---|---|
| `TALL_THRESHOLD_PX` | `160` | `ResizeObserver` on `.ai-user-bar-main`; above → eligible for collapse |
| `estimateTall` | `>500` chars or `≥7` newlines | Seeds `isTall` without waiting for layout |
| `isStuck` | sentinel `bottom` vs scroll top + `UNSTICK_GAP_PX` hysteresis | `IntersectionObserver` + scroll sync on `.ai-messages` |
| `isCompact` | `isStuck && isTall && !expanded` | Drives `.is-compact` |
| `canToggle` | `isStuck && isTall` | Shows chevron; adds `.is-stuck` for button opacity |

**Sentinel placement (critical):** `.ai-user-bar-sentinel` must be a **sibling**
of `.ai-msg-user`, not a child. If the sentinel is inside the sticky element, it
moves with the pin and `IntersectionObserver` never fires. `UserTurnBar` owns
this structure.

**Re-measure:** `ResizeObserver` + `content`. While `.is-compact`, skip live
`scrollHeight` — use `tallCacheRef` only. Stuck: sentinel `bottom` vs scroll top +
`UNSTICK_GAP_PX` hysteresis.

**Spacing pass (2026-07-13):** Default bar padding/font increased; turn gap
`18px`; user wrapper `gap: 8px`.

**Liquid glass + image deck (2026-07-13, Alek):** User bar moved from opaque
`color-mix` fill to **translucent glass** (`backdrop-filter: blur(medium)` +
gradient tokens). Light mode adds a Cursor-style hairline border + soft drop
shadow (same recipe as `.ai-composer-shell`). Attached image thumbs are no
longer a row above the bar (extra height); they render as a **32px card deck**
absolutely positioned on the bar's right edge (`bottom: 40px`), above the
action icons. Rest = stacked pile (`--fan-index` offset + slight rotate);
hover/focus-within = fan left in a row. See **Images** below.

### CSS gotchas (do not regress)

| Rule | Why |
|---|---|
| Sticky on `.ai-msg-user`, not `.ai-user-bar` | Containing block must span the turn |
| `.ai-msg-user { animation: none }` | `.ai-msg` entrance `transform` breaks sticky in WebKit |
| `.ai-msg-user { background: transparent }` | Sticky wrapper must not block glass blur / scrolling content |
| `.ai-user-bar { overflow: visible }` | Image deck fans left on hover; compact clamp stays on `.ai-user-bar-main` only |
| `z-index` inline on `.ai-msg-user` | `userTurnByIdx`, 1…N per thread |
| Compact shrinks visible bar only | Never read `scrollHeight` while `.is-compact` — clamped layout flips `isTall` false → expand/compact loop |
| Stuck uses sentinel hysteresis | `UNSTICK_GAP_PX` — avoid 0-height sentinel edge flutter at scroll top |
| `.ai-user-bar-expand` opacity when `.is-stuck` | Chevron visible while stuck; other actions stay hover-gated |
| Deck `bottom: 40px` on `.ai-user-bar` | Clears 24px action row + padding without clipping at bar top (tuned vs `calc(100%+4px)` and `30px`) |

### Surface tokens (liquid glass)

| Token | Dark | Light | Role |
|---|---|---|---|
| `--user-bar-glass-from` | `color-mix(fg 10%, transparent)` | `color-mix(bg-elev 94%, transparent)` | Gradient start + compact fade stop |
| `--user-bar-glass-to` | `color-mix(fg 3%, transparent)` | `color-mix(bg-elev 76%, transparent)` | Gradient end |
| `--user-bar-border` | `color-mix(fg 20%, transparent)` | `color-mix(fg 14%, transparent)` | Hairline edge (stronger than generic `--border`) |
| `--user-bar-shadow` | hairline top + `0 4px 14px rgba(0,0,0,0.22)` | `0 1px 2px rgba(0,0,0,0.07)` | Depth — light mirrors composer resting shadow |
| `--user-bar-bg` | `= --user-bar-glass-from` | same | Legacy alias for fade gradient |

Implementation: `.ai-user-bar` uses `linear-gradient(135deg, from, to)` +
`backdrop-filter: blur(var(--blur-medium)) saturate(160%)` + `::after` top-edge
highlight. `@supports not (backdrop-filter)` falls back to solid
`color-mix(fg 10%, chat-stream-bg)` (light: `--bg-elev`).

Do **not** use `--bg-hi` for the card — too close to `--chat-stream-bg` on dark.
Do **not** reuse `.liquid-glass` class on the bar — scroll-adjacent blur uses
`--blur-medium` (not `--blur-heavy`) per design-system GPU guidance.

### Layout (compact while stuck)

```
┌──────────────────────────────────────────────┐  ← sticks at top: 0
│ First lines of prompt…              [🃏][↓][⎘] │  ← deck floats right @ bottom:40px
└──────────────────────────────────────────────┘
        … assistant response visible below …
```

Expanded (`.is-expanded`) restores full text scroll up to `min(60vh, 420px)`.
The image deck does not affect bar min-height — it overlays the right gutter
above action icons.

### Actions

| Button | Icon | Behaviour |
|---|---|---|
| Expand / Collapse | `chevron-down` / `chevron-up` | Only when stuck + tall; toggles compact ↔ expanded |
| Copy | `copy` | Clipboard + toast |
| Re-send | `refresh` | `regenerateFrom(idx)` — wipes below |
| Branch | `branch` | `branchFromHere(idx)` — new chat tab |

Copy / re-send / branch disabled while `streaming !== null || runningTools`.

### Images (card deck)

`UserMessageImageDeck` (`.ai-user-msg-images` / `.ai-user-msg-image`) lives
**inside** `.ai-user-bar-aside` but positions against `.ai-user-bar`
(`position: absolute; right: 12px; bottom: 40px`). Each thumb is **32×32px**
(smaller than the 56px composer staging strip in `016`).

| State | Behaviour |
|---|---|
| Rest | Cards stacked with `--fan-index`: `translate(-3px×i, -1px×i)` + slight rotate — pile-of-cards look |
| Hover / focus-within | Fan horizontally left: `translate(-36px×i, 0)`; elevated `z-index` + `--shadow-md` |
| Click | Zoom modal (`openZoom`) |

`data-count` on the deck container for future badge styling. On session load,
`rehydrateMessageImages` rebuilds missing thumbs from disk paths
(`applyLoadedMessages` in `AIChatPanel`).

Images-only user turns hide the synthetic prompt `"See the attached images."`
via `userMessageDisplayText` — the deck is sufficient context.

See also **`016-image-attachments.md`** (attach + queue) and **`039-composer-queue.md`**
(queued image preview cards).

### Test plan

1. Short prompt (< ~4 lines) → send → scroll response → bar stays full height, no chevron.
2. Long prompt (30+ lines or paste logs) → scroll response → bar compacts (~160px max), fade visible, assistant text readable underneath.
3. Chevron ↓ → expands with internal scroll; ↑ → back to compact.
4. Scroll until prompt returns to natural position → full height, chevron hidden.
5. Multi-turn thread → older sticky bar covered by next turn's higher `z-index`.
6. Nav rail (`021`) → ticks still on `[data-anchor-role="user"]`; jump scroll unchanged.
7. Light + dark theme → glass border/shadow readable; compact fade uses `--user-bar-glass-from`.
8. Message with 2+ images → deck stacks on right; hover fans left without covering copy/re-send; click opens zoom.

### Related

| Doc | Link |
|---|---|
| Navigation rail | `021-chat-nav-rail.md` — anchors on `.ai-msg-user`; `offsetTop` honest under `.ai-messages` |
| Composer pin | `022-chat-composer.md` — `pinUserTurnToTop`, `pinActiveRef`, `stickyBottomRef` |
| Diary | `documentation/diary/2026-07-10-sticky-collapse.md` |
