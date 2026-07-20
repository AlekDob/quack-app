---
type: bug-doc
project: quack-desktop
created: 2026-07-20
fixed: 2026-07-20
status: fixed
tags: [sessions, claude-code, provider-session, transcript, recovery]
related:
  - documentation/features/044-provider-session-bridge.md
  - documentation/features/001-ai-session-library.md
  - documentation/features/023-session-usage-panel.md
---

# Bug — Quack session mix + Editor context in history

## Symptoms

1. Hub / tab title shows chat A (e.g. renamed "Storico conversazioni"), but the
   transcript and/or Claude Code `--resume` context belong to chat B.
2. User bubbles in history show internal Quack wire text:
   `[Editor context]`, `QUACK EDITOR`, `[Agent identity]`, attachment paths —
   not the user's typed message.
3. Observed at least under `npm run tauri dev`; same code paths run in
   production builds.

Plan mode / ExitPlanMode is **unrelated**.

## Root causes

| # | Cause | Effect |
|---|---|---|
| 1 | `guessClaudeSessionId(root, assistantTurns)` in the 12s disk-hydrate poll linked the **first** CC JSONL with matching `turn_count` | Wrong `providerSessionIds["claude-code"]` persisted → wrong resume + recovery |
| 2 | Recovery / ⟲ Sessions re-imported CLI user messages that still carried Quack's `ccPrefix` | Wire prompt rendered as user bubbles; could overwrite Quack's clean row |

## Fix (2026-07-20)

| Change | Where |
|---|---|
| Removed turn-count auto-guess entirely | `sessionDiskHydrate.ts`, `AIChatPanel` disk-hydrate poll |
| Sid only from stream-json or ⟲ Sessions | `044` identity rules |
| `stripEditorContextPrefix` + `sanitizeUserMessageContent` | `chatTextUtils.ts` → `cleanStaleToolMessages` |
| Recovery + `onResume` sanitize before paint/persist | `chatProviderRecovery.ts`, `AIChatPanel` |
| Vitest | `chatTextUtils.test.ts` |

## Residual

- Wrong links **already on disk** are not auto-cleared — re-link via ⟲ Sessions.
- Polluted bubbles heal on next open (strip on load).
- Without a saved sid, usage ring JSONL hydrate stays empty until a real link exists (`023`).

## See also

- Living behavior: `044-provider-session-bridge.md` → **Session identity safety**
- Diary: `documentation/diary/2026-07-20.md`
