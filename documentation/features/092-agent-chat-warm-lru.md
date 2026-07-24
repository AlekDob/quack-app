---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-24
last_verified: 2026-07-24
tags: [chat-switch, performance, warm-lru, agent-mode, ide, mount, veil, quack-v1]
---

## Agent chat warm LRU

**Purpose:** Keep the last few viewed live chats mounted so Agent Mode / hub
rail hops are CSS toggles (Cursor-feel) instead of remount + hydrate + veil.
**Stack:** React 19, TypeScript, module-level MRU

### Problem (Audit 2026-07-24)

| Surface | Before | Evidence |
|---|---|---|
| Agent Mode | No `tabOpen` — idle hosts unmounted every select | `alreadyMounted: 0/15` |
| IDE hub rail | Single AI tab slot (`pruneAiTabsInTree`) drops prior tab | Same cold remount |
| Perceived | Veil floor 160–220ms even when load was fast | Last hop: hydrate 211ms + veil 307ms (130 msgs) |
| Cross-ws | Veil ended before `setActiveWorkspace` → host dropped → **second** cold hydrate | Double `session loaded` after veil-down |

IDE open-tab `tabOpen` already kept pane tabs warm (`076`); Agent Mode had no
equivalent, and IDE hub focus deliberately prunes other `ai:` tabs.

### Policy

| Keep mounted when hidden | Source |
|---|---|
| Visible / pulse target | Existing |
| `working` / `needs-input` | Sticky live (`076` / bug `007`) |
| Per-ws last selection | `getAgentSelectedChat(wsId)` as `tabOpen` |
| Last **5** touched chat ids (MRU) | `agentChatWarm.ts` → `tabOpen` |
| DONE / archived + hidden | Still unload (`076`) |

Warm hop → `pulseChatSwitch({ veil: false })` (no “Loading chat…”).

### Files

| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/agentChatWarm.ts` | `touchAgentChatWarm`, `isAgentChatWarm`, `agentChatWarmIds`, `clearAgentChatWarm` |
| Test | `src/agentChatWarm.test.ts` | MRU order + cap 5 |
| Util | `src/chatHostMount.ts` | `shouldKeepChatHostMounted` — `tabOpen` gate (unchanged API) |
| Component | `src/components/AgentModeShell.tsx` | Warm set in `mountChats`; `memo(AgentChatHost)`; veil skip |
| Component | `src/components/WorkspaceShell.tsx` | `tabOpen: isAgentChatWarm \|\| (isActive && !!pane)` |
| Component | `src/components/AIChatsRail.tsx` | IDE hub: touch + `veil: !alreadyWarm` |

### Data Flow

```
selectSession / rail focusChat
  → touchAgentChatWarm(chatId)
  → alreadyMounted / alreadyWarm?
       yes → pulseChatSwitch({ veil: false }) → CSS data-visible flip
       no  → pulseChatSwitch({ veil: true }) → mount + hydrate + endChatSwitch
  → shouldKeepChatHostMounted({ tabOpen: warm || wsSelected || pane })
```

### Key Functions

- `touchAgentChatWarm(chatId: string) → void` — MRU front; cap 5
- `isAgentChatWarm(chatId: string) → boolean` — in warm set?
- `shouldKeepChatHostMounted({ tabOpen }) → boolean` — DONE still wins when hidden

### State

- `order: string[]` — MRU chat ids, max 5 (module, session-lifetime)

### Gotchas

- **Touch before mount pass** — so the target survives veil-down before cross-ws
  `setActiveWorkspace` resolves (was the double-hydrate bug).
- **Per-ws selection ≠ LRU** — one last pick per open project + shared LRU of 5.
- **IDE single-slot unchanged** — prune still swaps the visible `ai:` tab; warm
  hosts stay on `stickyHostRoot` when `pane` is null.
- **`memo(AgentChatHost)`** — Agent Mode shell re-renders on every select +
  agent-status tick; without memo every warm host re-painted `AIChatPanel`.
- Diagnose with `[chat-switch]` / Perf Audit `086` (`alreadyMounted`, `veil` skipped).

### Related

| Feature | Relation |
|---|---|
| `076-chat-lazy-hydrate-done-unload.md` | Base mount / DONE unload policy |
| `075-chat-switch-loader.md` | Veil; warm hops use `veil: false` |
| `001-ai-session-library.md` | Hub rail + Agent Mode lists |
| `ideAiTabSlot.ts` / `001` | IDE single AI tab slot |
| `080-transcript-windowing.md` | Cold paint cost of long transcripts |
| `087-new-chat-perf.md` | New chat still pulses veil (empty, fast floor) |

### Verify

- Agent Mode: visit A→B→A — second A instant, no veil; `[chat-switch]` shows `alreadyMounted: true`.
- IDE hub: same A↔B hop without remount spinner.
- DONE chat leave → host unloads; reopen cold (veil ok).
- `npm test -- src/agentChatWarm.test.ts`
