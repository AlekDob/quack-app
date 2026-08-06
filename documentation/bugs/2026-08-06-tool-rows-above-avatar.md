---
type: bug
project: synara
created: 2026-08-06
last_verified: 2026-08-06
tags: [transcript, avatar, papero, timeline, ui]
---

# Tool rows rendering above the turn avatar

**Symptom:** in some turns the papero/subagent avatar + name line showed up _below_ the tool-call rows instead of above them — inconsistent with turns where the avatar sat on top as expected.

**Root cause:** the avatar is not a fixed part of a turn's layout. `deriveMessagesTimelineRows` (`apps/web/src/components/chat/MessagesTimeline.logic.ts`) stamps `showPaperoAvatar` on whichever row happens to declare it first, and only `message` (assistant) and `working` (live "Thinking") rows could carry that flag. A standalone `kind: "work"` row — pushed when tool calls run before any assistant text exists in the turn — had no avatar field at all.

So when a turn started with tool work (no assistant text yet), the tool rows rendered first with no avatar, and the identity line landed on the next row that _could_ carry it: the live "Thinking" row underneath. Once assistant text existed, later tool entries attached as `inlineWorkEntries` on that message and rendered _below_ its avatar — same run, two different visual positions depending on ordering.

**Fix:** `work` rows can now own `showPaperoAvatar`/`avatarPaperoId`/`avatarModelSelection` too. When a standalone work group is flushed and no row has claimed the turn's avatar yet, it takes it — but only if the turn actually has a user message (a bare "Context compacted" row with no turn context stays avatar-less). `collapseSettledTurns` hoists the flag off a folded work row the same way it already did for folded assistant narration, and `isRowUnchanged` compares the new fields so the row-stability diff doesn't freeze a stale avatar state. `MessagesTimeline.tsx`'s `work` render branch shows `ChatStreamAvatarSlot` + `ChatStreamMetaRow` when the flag is set.

**Files changed:**

- `apps/web/src/components/chat/MessagesTimeline.logic.ts`
- `apps/web/src/components/chat/MessagesTimeline.tsx`
- `apps/web/src/components/chat/MessagesTimeline.logic.test.ts` (regression test)

**Related:** [[003-paperi]] — the avatar/identity system this row belongs to.
