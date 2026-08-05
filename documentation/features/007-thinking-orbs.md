---
type: feature-doc
project: synara
stack: React / Vite / TypeScript
created: 2026-08-05
startDate: 2026-08-05
endDate:
last_verified: 2026-08-05
status: active
tags: [thinking-orbs, chat, streaming, loading, animation]
---

## Thinking Orbs in Chat

**Purpose:** Animated, monochrome thinking indicators for live assistant activity and streaming replies.
**Stack:** React / TypeScript (apps/web) + [`thinking-orbs`](https://orbs.jakubantalik.com/)

### Files

| Type      | Path                                                    | Exports/Purpose                                     |
| --------- | ------------------------------------------------------- | --------------------------------------------------- |
| Util      | `apps/web/src/lib/thinkingOrbState.ts`                  | `thinkingOrbStateForWorkEntry` mapping              |
| Component | `apps/web/src/components/chat/TimelineWorkEntryRow.tsx` | Renders orb on thinking work-log rows               |
| Component | `apps/web/src/components/chat/MessagesTimeline.tsx`     | Renders orb + "Composing…" during message streaming |

### Why this library

- Plain 2D canvas, no WebGL, no filters.
- Auto-pauses when off-screen (`IntersectionObserver`) or tab-hidden.
- Respects `prefers-reduced-motion`.
- Monochrome palette follows the app theme automatically.

### Work-log state mapping

Only rows with `tone === "thinking"` and no special left-glyph (e.g. GitHub, MCP, browser) show an orb. The chosen animation reflects the entry’s intent:

| Synara activity kind                               | Orb state    | Rationale                                  |
| -------------------------------------------------- | ------------ | ------------------------------------------ |
| `requestKind === "file-read"` / `web_search`       | `searching`  | Looking something up                       |
| `requestKind === "file-change"`                    | `shaping`    | Editing / forming files                    |
| `itemType === "command_execution"` / has `command` | `working`    | Running terminal work                      |
| `itemType === "mcp_tool_call"`                     | `weaving`    | Interlacing multiple external capabilities |
| `itemType === "collab_agent_tool_call"`            | `connecting` | Talking to a subagent                      |
| Everything else with `tone === "thinking"`         | `solving`    | Generic reasoning                          |

### Streaming indicator

When an assistant message is streaming (`row.message.streaming`), a small inline header appears above the markdown:

- `<ThinkingOrb state="composing" size={20} />`
- Label: **Composing…**

This header disappears as soon as the stream ends.

### Performance notes

- The library caps DPR at 2 and stops animations outside the viewport.
- We use the `20` px preset (inline-text scale) inside rows; the chat-avatar `64` px preset is not used anywhere yet.
- Each instance carries its own `aria-label`, so screen readers still get a text description even though the visual is canvas-based.

### Decision log

- **Inline `20 px` preset only.** We deliberately avoided the `64 px` avatar-scale orb for now. At 20 px the animation reads as a status glyph next to text; at 64 px it becomes a presence avatar and needs its own layout rules.
- **Conservative mapping.** Not every tool row gets a different orb. Only categories with a strong, unambiguous verb get a dedicated state; the rest fall back to `solving`. This keeps the timeline readable and avoids "animation fatigue."
- **No orb for special left-glyphs.** If a row already has a product icon (GitHub, browser, MCP cube, Synara mark) we keep that icon. The orb replaces only the generic `BotIcon` thinking glyph.
- **Streaming indicator as a header, not a footer.** The footer is reserved for terminal metadata (timestamp, copy, pin). Showing "Composing…" above the live text keeps the footer free and matches the top-to-bottom reading order.

### Dependencies

```bash
bun add thinking-orbs@0.2.0
```

- Peer deps: `react >=18`, `react-dom >=18` (Synara uses React 19).
- Tree-shakeable, no runtime side effects.

### Testing notes

- Unit tests for `thinkingOrbStateForWorkEntry` should cover each `requestKind` / `itemType` branch plus the fallback.
- Visual regression is the main risk: the canvas renders differently from SVG/Lucide icons. Browser tests should verify that thinking rows still render without errors in both light and dark themes.
- The library itself handles `prefers-reduced-motion`; no additional test coverage needed for that.

### Related documentation

- [`thinking-orbs` demo & docs](https://orbs.jakubantalik.com/)
- Synara feature docs:
  - `005-subagent-avatars.md` — related avatar/presence work in chat
- Code:
  - `apps/web/src/lib/liveActivityPresentation.ts` — live activity labels and timing
  - `apps/web/src/session-logic.ts` — `WorkLogEntry` shape

### Future tweaks

- Map `liveActivity.state` (starting / running_tool / waiting / streaming) if we want orbs outside the work-log rows.
- Add a `64` px orb to the composer or to a global "agent active" surface.
- Add a small unit-test file for `thinkingOrbStateForWorkEntry` once the mapping stabilizes.
