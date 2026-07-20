---
type: bug-doc
project: quack-desktop
created: 2026-07-20
fixed: 2026-07-20
status: fixed
tags: [agent-mode, ide-mode, sessions, title, transcript, remount]
related:
  - documentation/features/085-agent-ide-mode-toggle.md
  - documentation/features/043-chat-transcript-persistence.md
  - documentation/features/001-ai-session-library.md
---

# Bug — Agent↔IDE loses session title + truncates transcript

## Symptoms

After **Agent Mode → IDE → Agent Mode**:

1. Hub row title becomes **Untitled** (was a real name).
2. Chat transcript looks truncated / thinner than before the round-trip.

## Root causes

| # | Cause | Effect |
|---|---|---|
| 1 | `setAgentMode` flipped layout **without** flush+await (unlike project switch) | Remount could hydrate a stale/thin disk row while async save still in flight |
| 2 | Agent center selection lived in `useState` on `AgentModeShell` | Full shell remount reset pick → wrong chat / fallback |
| 3 | `deriveTitle` → `"Untitled"` + `setAIChatTitle` on thin/partial messages | Overwrote a good hub title; `preferRicherSession` also let Untitled through on field merge |

## Fix (2026-07-20)

| Change | Where |
|---|---|
| `flushAllChatPersist` + `awaitChatDiskFlushes` before flip | `agentMode.ts` → `setAgentMode` |
| Module-level selected chat + IDE `activeAiChatId` seed; `focusAIChat` on select | `agentModeSelection.ts`, `AgentModeShell.tsx` |
| Skip auto-title when derived is empty/`Untitled` | `AIChatPanel.tsx` |
| `preferSessionTitle` inside `preferRicherSession` | `chatStoreCache.ts` (+ vitest) |

## See also

- Living behavior: `085-agent-ide-mode-toggle.md` → **Durability + title**
- Diary: `documentation/diary/2026-07-20.md`
