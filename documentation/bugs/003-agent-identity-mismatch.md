---
type: bug-doc
project: quack-desktop
created: 2026-07-20
fixed: 2026-07-20
status: fixed
tags: [presets, agents, avatar, identity, pass-the-ball, chat-switch]
related:
  - documentation/features/062-presets.md
  - documentation/features/088-plan-milo-handoff.md
  - documentation/features/005-jack-duck-identity.md
  - documentation/features/040-per-session-composer-state.md
---

# Bug — Agent identity mismatch (Jack header / Milo voice)

## Symptoms

1. **Pass the ball:** Assistant bubble shows **Jack** (avatar + "Project Manager")
   while the model text says **"Sono Milo…"** (or implements as Builder).
2. **Chat-session switch:** Hopping between a Jack session and a Milo session
   leaves the wrong face on the transcript / composer for a frame (or sticky).
3. **Mid-turn SubagentPill switch:** In-progress bubble reattributes to the newly
   picked agent even though the turn started as someone else.
4. User fear: the **wrong agent is actually driving** the turn (not only UI) —
   can confuse the model and burn extra tokens on re-orientation / duplicate work.

## Root causes

| # | Cause | Effect |
|---|---|---|
| 1 | `applyPreset("builder")` then immediate `sendUserText` (Pass the ball) ran **before React re-rendered** — `agentAtSend` / `[Agent identity]` still read Jack from closure | Stamp Jack + speak Milo (or split identity vs stamp) |
| 2 | Streaming bubble used **live** `presetId` | Mid-turn composer switch flipped the in-flight face |
| 3 | Assistant rows **missing** `agentId` always resolved as Jack | Milo sessions painted Jack after switch / remount |
| 4 | Remount / hydrate set state but not **send-path refs** until next paint | Fast send after switch could still see previous chat's agent |

## Fix (2026-07-20)

| Change | Where |
|---|---|
| Pure helpers: freeze / resolve / backfill / display | `src/chatTurnAgent.ts` |
| `applyPreset` validates def, then syncs `presetIdRef` + model/effort/mode/thinking refs **before** `setState` | `AIChatPanel.tsx` |
| `sendUserText` reads refs for identity, `agentId` stamp, and `chatStream` knobs | `AIChatPanel.tsx` |
| `turnAgentId` frozen at send (+ replay pin); streaming bubble via `streamingBubbleAgentId` | `AIChatPanel.tsx` |
| `backfillAssistantAgentIds` + `sessionAgentFromStored` on hydrate / open / recover | `AIChatPanel.tsx` |
| RAM cache seed for preset + messages on remount | `cachedSessionSeed` in `AIChatPanel.tsx` |
| Vitest regression suite | `src/chatTurnAgent.test.ts` (25 cases) |

## Mental model (after fix)

```
applyPreset(id)  →  refs.current = id  →  setState(id)
                         ↓
sendUserText()   →  agentAtSend = presetIdRef.current
                 →  [Agent identity] + commit agentId + bubble freeze
composer switch mid-turn → next message only (toast already said so)
chat switch        →  each host's session preset + backfill
```

## Residual

- Transcripts **already saved** with a wrong `agentId` (Jack stamp on Milo text)
  are not rewritten on disk — only new turns are correct.
- Wrong Claude Code `--resume` links are a separate bug (`001-session-mix`).

## See also

- Living behavior: `062-presets.md` → **Chat message identity**
- Pass the ball: `088-plan-milo-handoff.md` → **Handoff gotcha**
- Diary: `documentation/diary/2026-07-20.md`
