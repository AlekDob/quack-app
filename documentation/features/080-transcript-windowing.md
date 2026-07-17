---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-17
last_verified: 2026-07-17
tags: [chat, transcript, windowing, performance, render, chat-switch, vitest]
---

## Transcript windowing (long-chat render)

**Purpose:** Stop the main-thread stall when switching into a long chat. The
transcript rendered EVERY turn (`turns.map`), so a chat with hundreds of turns
painted a huge DOM and blocked layout/paint (messages apply in a
`startTransition`, but committing + painting the DOM still costs). Render only
the tail; reveal the rest on demand. This is the `076` "message virtualization"
follow-up.

**Stack:** pure helper in `chatScroll.ts` + `showAllTurns` state in `AIChatPanel`
+ a "Show earlier" pill; vitest regression.

### Files

| Type | Path | Role |
|---|---|---|
| Helper | `src/chatScroll.ts` | `windowChatTurns`, `windowToolRows`, `TURN_WINDOW`, `TOOL_ROW_CAP` |
| Render | `src/components/AIChatPanel.tsx` | uses shared constants; `.ai-show-earlier` pill; tool "Show N more" via `windowToolRows` |
| Style | `src/App.css` | `.ai-show-earlier` centered pill |
| Test | `src/chatScroll.test.ts` | vitest — grouping + turn/tool windowing (`npm test`) |

### How it works

```
display (messages)
  → groupChatTurns(display) → allTurns          (absolute display indices)
  → windowChatTurns(allTurns, 40, showAllTurns)
        expanded || len ≤ 40 → { turns: all, hiddenCount: 0 }
        else                 → { turns: last 40, hiddenCount: len-40 }
  → hiddenCount > 0 ? render "Show N earlier messages" pill (sets showAllTurns)
  → turns.map(...)                               (unchanged per-turn render)
```

- `showAllTurns` **resets on `aiChatId` change** — switching INTO a huge chat
  starts windowed (fast paint), never fully expanded.
- Windowed turns keep their **absolute `display` indices** (`slice` of the turn
  array, not of `display`), so `display[i]`, scrub dimming, and `data-anchor`
  lookups stay correct.
- The **newest turns are always in the window** — streaming and the pinned user
  turn (`pinUserTurnToTop`) live in the tail.
- Short chats (≤ `TURN_WINDOW`) render exactly as before (no pill, `hiddenCount 0`).

### Gotchas

- **Tool-dense turns:** windowing is by **turns**, not tools. A 20-turn chat with hundreds of `tool_calls` still painted every row. Legacy (no-blocks) lists now cap at `TOOL_ROW_CAP=12` with “Show N more tools” (`AIChatPanel`).
- **Nav rail (`021`)** builds ticks from rendered `data-anchor` turns, so while
  windowed it shows ticks for **visible turns only**; clicking "Show earlier"
  reveals the rest and their ticks. Jump-to-turn targets a hidden turn only
  after expand. (Auto-expand-on-jump is a possible follow-up.)
- **Streaming a huge chat**: each committed turn slides the tail window; the
  user is auto-scrolled to the bottom so the top churn isn't seen. Rare (huge =
  old/done chats).
- **Tune** `TURN_WINDOW` in `AIChatPanel.tsx` — higher = more context up-front,
  more paint; lower = faster switch, more "Show earlier" clicks.

### Verify

1. Open a chat with hundreds of turns → opens instantly, "Show N earlier
   messages" pill at the top; `[chat-switch] transcript painted` shows
   `count ≤ 40`, low `elapsedMs`.
2. Click the pill → full history renders; nav-rail ticks fill in.
3. Switch away and back → windowed again (state reset).
4. Short chat → no pill, identical to before.
5. `npm test` → `src/chatScroll.test.ts` green (7 tests).

### Related

| Doc | Link |
|---|---|
| Chat lazy hydrate + DONE unload (flagged this follow-up) | `076-chat-lazy-hydrate-done-unload.md` |
| Chat/session switch loader (masks residual latency) | `075-chat-switch-loader.md` |
| Chat nav rail (per-turn ticks) | `021-chat-nav-rail.md` |
| Scroll pin helpers (same module) | `chatScroll.ts` |
| Diary | `documentation/diary/2026-07-17.md` |
