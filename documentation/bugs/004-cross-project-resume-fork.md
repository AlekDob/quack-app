---
type: bug-doc
project: quack-desktop
created: 2026-07-20
fixed: 2026-07-20
status: fixed
tags: [sessions, claude-code, resume, project-switch, images, transcript, truncation]
related:
  - documentation/features/044-provider-session-bridge.md
  - documentation/features/043-chat-transcript-persistence.md
  - documentation/features/016-image-attachments.md
  - documentation/features/058-workspace-switch-performance.md
---

# Bug — Cross-project switch loses CLI `--resume` (forked / truncated chat)

## Symptoms

While working a chat in **another project** (e.g. astronaut) and switching workspaces mid/post turn:

1. Follow-up starts a **new** Claude Code JSONL instead of `--resume`.
2. Quack transcript looks **thin / truncated** vs the CLI history.
3. Agent claims missing images even though the user attached them (paths never reached the new spawn’s flatten).
4. `provider-links.json` can list **two** CLI ids for the **same** Quack `sessionId`.

### Concrete case (2026-07-20)

| Layer | Id / state |
|---|---|
| Quack | `a_h3ushs41` @ `ws_l4hnlk_1m` (astronaut) — **5** disk messages |
| CC turn 1 | `1b9e6e56-…` — images + “Let me look at the images…” |
| CC fork | `f136f591-…` — flatten without image paths → “Non vedo immagini…”, then resend |

## Root causes

| # | Cause | Effect |
|---|---|---|
| 1 | `chatStream` read `providerSessionIds` from React **state** (stale / empty after remount) | Follow-up omitted `--resume` → new JSONL |
| 2 | Session id only persisted via messages effect — project switch could flush **before** id landed on disk | Remount hydrated without CLI link |
| 3 | `preferRicherSession` on refuse-shrink did `{ ...next, messages: prev }` | Kept rich messages but **wiped** `providerSessionIds` from thin `next` |
| 4 | First-turn `flattenMessages` serialized only `content` | Historical `message.images` paths dropped on emergency flatten |
| 5 | Recovery only loads the **current** linked id | Orphan richer JSONL (`1b9e6e56`) not auto-merged (by design) |

## Fix (2026-07-20)

| Change | Where |
|---|---|
| `mergeProviderSessionIds` + keep links in `preferRicherSession` | `providerSession.ts`, `chatStoreCache.ts` (+ vitest) |
| `providerSessionIdsRef` on send; immediate `patchSession` on `session` / CC init | `AIChatPanel.tsx` |
| `wireUserContent` reinjects image paths in flatten / last-user | `cliPrompt.ts` (CC uses shared helper; + vitest) |

## Recovery for already-forked chats

Not automatic. User: ⟲ Sessions → pick the richer orphan CLI id (or continue on the current fork knowingly).

## See also

- Living behavior: `044` → **Session identity safety**
- Diary: `documentation/diary/2026-07-20.md`
