---
type: bug
project: synara
created: 2026-08-06
last_verified: 2026-08-06
status: fixed
tags: [regression, upstream, pending-interactions, composer-queue, approvals, storeEventReducer]
---

## Conversation wedges: second message never dispatches until a full snapshot arrives

### Symptom

- Sending a follow-up message to a running agent appears to do nothing: the message sits in the composer queue, the send button keeps spinning, no turn starts.
- **Self-healing but slow**: after several minutes (next full server snapshot) the queue drains on its own and the thread resumes.
- No approval card is visible on screen, so nothing hints that an approval is blocking the queue.

### Root cause

Client/server asymmetry introduced by `54bd78d92` (cherry-pick of upstream `6c4153c59`, "settle stale approvals, resolve out-of-root file refs, sync edit target").

That commit added `settleUnanswerablePendingInteractions` in `apps/server/src/orchestration/Layers/ProviderRuntimeIngestion.ts`: on every `session.started`, durable pending approval/user-input rows left over from the dead runtime are settled by appending a `provider.approval.respond.failed` / `provider.user-input.respond.failed` activity whose payload carries `detail` + `requestId` but **no `responseCommandId`** (no response command ever claimed the row).

Both projections were supposed to handle that shape:

| Layer                                   | Handles missing `responseCommandId`?            |
| --------------------------------------- | ----------------------------------------------- |
| Server `ProjectionPipeline.ts`          | Yes — settles the row as `uncertain`            |
| Web `apps/web/src/storeEventReducer.ts` | **No** — bailed out early, row stayed `pending` |

So in the browser the interaction stayed `pending` forever. `derivePendingApprovals` (`apps/web/src/pendingInteractionDerivation.ts`) only retains `pending`/`retryable` settlements, so it kept the approval "open" → `activePendingApproval !== null` in `ChatView.tsx` → the queued-composer auto-dispatch effect returns early → every queued message is swallowed.

Only a fresh full snapshot (which carries the server's `uncertain` status) cleared it, which is why the block eventually released by itself.

### Chain

```
session.started
  → server settles stale row, appends *.respond.failed WITHOUT responseCommandId
  → web reducer ignores the activity (early return)
  → pendingInteractions keeps status "pending"
  → derivePendingApprovals keeps the approval actionable
  → ChatView queued-dispatch effect blocked on activePendingApproval
  → follow-up messages stuck in the composer queue
```

### Fix

`apps/web/src/storeEventReducer.ts` now mirrors the server projection: when a `*.respond.failed` activity has no `responseCommandId` and its `detail` matches `isStalePendingRequestFailureDetail` (`@synara/shared/threadSummary`), the matching row is moved to `uncertain` (unless already `confirmed`/`uncertain`, to stay idempotent across repeated session starts).

Regression test: `apps/web/src/storeEventReducer.test.ts` → "settles a still-pending approval when reconciliation reports it stale without a response command".

### Gotcha to remember

Any settlement rule added to `apps/server/src/orchestration/Layers/ProjectionPipeline.ts` must be mirrored in `apps/web/src/storeEventReducer.ts`. The two are independent projections of the same activity stream; a divergence does not crash — it produces a UI that stays wrong until the next full snapshot, which reads as a random, self-healing freeze and is very hard to trace back to the commit that caused it.

### Not done

- No safety timeout on the composer queue. If a future cause blocks `activePendingApproval` the symptom returns; add a bounded fallback then, not speculatively.
