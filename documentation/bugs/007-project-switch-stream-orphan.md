---
type: bug-doc
project: quack-desktop
created: 2026-07-21
fixed: 2026-07-21
status: fixed
tags: [sessions, project-switch, streaming, truncate, claude-code, agent-mode]
related:
  - documentation/features/043-chat-transcript-persistence.md
  - documentation/features/058-workspace-switch-performance.md
  - documentation/features/001-ai-session-library.md
  - documentation/features/076-chat-lazy-hydrate-done-unload.md
---

# Bug — Project switch orphans stream → truncated transcript / “agent stopped”

## Symptoms

While an agent is `WORKING` in project A:

1. Switch to project B (Agent Mode hub or IDE ActivityBar).
2. Return to A: assistant text frozen mid-sentence; hub may look idle.
3. Resending the prompt produces duplicate Milo bubbles that again cut off
   (“Show N more chars” on older incomplete turns is display collapse only).

## Root causes

| # | Cause | Effect |
|---|---|---|
| 1 | Agent Mode `mountChats` only listed chats for `activeId`; IDE gated hosts on `isActive` | Stream consumer (`AIChatPanel` listener) unmounted mid-turn |
| 2 | Streaming checkpoint wrote a partial `assistant` row; attach skipped when `ended` + last role was assistant | Richer Rust buffer never replayed → permanent truncate |
| 3 | `preferRicherSession` compared only `messages.length` | Same-count thinner checkpoint could overwrite a richer flush |

## Fix (2026-07-21)

| Change | Where |
|---|---|
| Sticky mount `working` / `needs-input` hosts across all open workspaces | `AgentModeShell.tsx` |
| Mount sticky IDE hosts without `isActive` gate; offscreen portal root + keep heavy while live | `WorkspaceShell.tsx` |
| Attach compares buffer text vs checkpoint; strip thin assistant then replay | `chatAttachReplay.ts`, `AIChatPanel.tsx` |
| Equal-count prefer longer last-assistant content | `chatStoreCache.ts` (+ vitest) |

## See also

- Living behavior: `043` project-switch section, `058` gotchas, `001` sticky-host gotcha
- Diary: `documentation/diary/2026-07-21.md`
