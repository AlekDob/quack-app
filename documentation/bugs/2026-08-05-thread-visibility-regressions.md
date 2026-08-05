---
type: bug
project: synara
created: 2026-08-05
last_verified: 2026-08-05
status: fixed
tags: [regression, upstream, transcript, subscriptions, pending-interactions]
---

## Thread responds but reply invisible / new thread missing until restart

### Symptom

- Provider finishes a turn; UI shows no assistant reply until refresh/restart
- New conversation missing from sidebar/detail until app restart (SQLite had it)

### Upstream gap

Missing vs `Emanuele-web04/synara` (`upstream/main`):

| Commit                                                            | Relevance                                           |
| ----------------------------------------------------------------- | --------------------------------------------------- |
| `6c4153c59` Improve session orchestration and transcript handling | claimable interactions + stale session settle guard |
| `425a2d5cc` Optimize thread detail subscriptions                  | lease identity stability in `EventRouter`           |

### Root causes

| #   | Cause                                                                                          | File                   |
| --- | ---------------------------------------------------------------------------------------------- | ---------------------- |
| 1   | Response claim only allowed `pending`/`retryable` (not `uncertain` / reclaimable `responding`) | `storeEventReducer.ts` |
| 2   | Stale session snapshot settled a just-started running turn                                     | `storeEventReducer.ts` |
| 3   | Streaming `serverThreads` churn rebuilt lease arrays → subscribe reconcile races               | `__root.tsx`           |

### Fix (ported locally)

- New `@synara/shared/pendingInteractions`
- `isPendingInteractionResponseClaimable` in `markInteractionResponding`
- `session.updatedAt >= turn.startedAt` guard in `reconcileLatestTurnFromSession`
- `arraysShallowEqual` identity-stable `subscribedThreadIds`

### Docs

- Features: `011-thread-detail-subscriptions.md`, `012-pending-interaction-claim.md`
- Recap: `documentation/recaps/thread-visibility-regressions.md`
- Diary: `documentation/diary/2026-08-05.md`

### Residual

- Full `upstream/main` still ahead (v0.6.6/v0.6.7 notification/sidechat/terminal fixes not fully merged)
- Sidechat dock lease expansion from `425a2d5cc` not ported if right-dock sidechats still miss detail sync
