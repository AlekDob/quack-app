---
type: feature-doc
project: synara
stack: React / Vite / TypeScript
created: 2026-08-05
startDate: 2026-08-05
endDate:
last_verified: 2026-08-05
status: active
tags: [chat, sidebar, loading, papero, composer, send]
---

## Immediate send feedback

**Purpose:** Show a busy state the instant the user hits send — composer, sidebar row, and papero avatar — instead of waiting for the provider preflight (status refresh, worktree creation, `thread.create`) to resolve.
**Stack:** React / TypeScript (`apps/web`)

### Problem

`isSendBusy` used to flip on only after `localDispatch` was set, which happened after the send preflight (provider availability check, browser prompt attachment, worktree creation, `thread.create`) had already run. On a slow preflight the composer and the sidebar row stayed idle-looking for a noticeable beat after the user pressed send. Separately, the papero avatar only appeared on the first assistant/work row, so it was invisible during that same gap.

### Files

| Type      | Path                                                     | Exports/Purpose                                                                       |
| --------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Store     | `apps/web/src/pendingSendStore.ts`                       | `usePendingSendStore` — `pendingSendThreadIds`, `markPendingSend`, `clearPendingSend` |
| Component | `apps/web/src/components/ChatView.tsx`                   | Sets/clears the pending flag around the send preflight; feeds `isSendBusy`            |
| Component | `apps/web/src/components/Sidebar.tsx`                    | Reads the flag to light up the row before the server acknowledges                     |
| Logic     | `apps/web/src/components/Sidebar.logic.ts`               | `isThreadActivelyWorking` short-circuits on `hasPendingLocalSend`                     |
| Logic     | `apps/web/src/components/chat/MessagesTimeline.logic.ts` | `working` row carries `showPaperoAvatar` / `avatarPaperoId`                           |
| Component | `apps/web/src/components/chat/PaperoPill.tsx`            | `PaperoStreamAvatarSlot` — shared avatar slot (DRY with the message row)              |
| Component | `apps/web/src/components/chat/MessagesTimeline.tsx`      | Renders the papero on the live "Thinking" row when unclaimed                          |

### Data flow

`onSend` → before the preflight, `markPendingSend(threadId)` sets the flag synchronously → composer (`isSendBusy`) and sidebar row (`isThreadActivelyWorking`) read it and show their loader immediately → preflight runs (provider refresh, worktree, `thread.create`) → `localDispatch` takes over as the real busy signal → `onSend` returns and clears the flag in a `finally`, covering every bail-out/throw path, not just the happy one.

In parallel, `deriveMessagesTimelineRows` tracks whether any row in the current turn has already claimed the papero avatar (`paperoAvatarShownForTurn`). The live `working` ("Thinking…") row wears the avatar itself until an assistant row takes over, so the papero shows up on the very first frame instead of waiting for the first work-log entry.

`currentTurnPaperoId` is read from the last **user** message's `paperoId` field. Until the server acknowledges a turn, the transcript shows the local optimistic user message (`setOptimisticUserMessages`), not the server-projected one — so that optimistic message must carry `paperoId` too, or the avatar falls back to the default (Milo) regardless of which papero was actually selected for the send. Fixed by adding `paperoId: paperoIdForSendRef.current` to the optimistic message in the main send path and in `onSubmitPlanFollowUp` (both the optimistic message and its `thread.turn.start` dispatch).

### Behavior

- The pending flag is per-thread (`Record<ThreadId, true | undefined>`), so it never leaks busy state onto other conversations.
- It is a pure UI signal — it does not affect what gets dispatched to the server, only how soon the loading state renders.
- Cleared via `finally`, so a preflight error (e.g. provider unavailable) still releases the loader instead of leaving the row stuck.
- The papero avatar slot is shared between the message row and the working row (`PaperoStreamAvatarSlot`) — no duplicated avatar markup.

### Verification

- `cd apps/web && bunx vitest run src/components/Sidebar.logic.test.ts` — 108 tests passed.
- `cd apps/web && bunx vitest run src/components/chat/MessagesTimeline.logic.test.ts` — 67 tests passed.
- `bun fmt` clean.
- `bun typecheck` — no new errors (2 pre-existing, unrelated failures remain in `InlineMentionChip.tsx` and `UsageNotchSurface.tsx`).

### Related documentation

- `008-sidebar-thread-creation-skeleton.md` — the sidebar placeholder this same session also fixed (empty-skeleton bug), shares `pendingSendStore` as one of its "creation in flight" signals.
- `007-thinking-orbs.md` — the "Thinking…" row this feature now also anchors an avatar on.
