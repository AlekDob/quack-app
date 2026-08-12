---
type: feature-doc
project: synara
stack: TypeScript / Effect
created: 2026-08-05
startDate: 2026-08-05
endDate:
last_verified: 2026-08-09
status: active
tags:
  [
    pending-interactions,
    approvals,
    store-projection,
    reclaim,
    upstream-port,
    startup-reconciliation,
    dead-runtime,
  ]
---

## Pending interaction response claim

**Purpose:** Shared policy for claiming durable approval / user-input responses, plus client turn settlement that refuses stale session snapshots. Also covers server-side terminal-settlement classification (dead runtime → `uncertain`) and the boot sweep that clears requests orphaned by a restart.
**Stack:** TypeScript (`packages/shared` + `apps/web` + `apps/server`)

### Files

| Type        | Path                                                             | Exports/Purpose                                                                                                                                       |
| ----------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Util        | `packages/shared/src/pendingInteractions.ts`                     | `isPendingInteractionResponseClaimable`, reclaim grace cutoff                                                                                         |
| Config      | `packages/shared/package.json`                                   | Export `@synara/shared/pendingInteractions`                                                                                                           |
| Store/State | `apps/web/src/storeEventReducer.ts`                              | `markInteractionResponding`; `reconcileLatestTurnFromSession` stale guard                                                                             |
| Reactor     | `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts` | `isUnanswerableApprovalRequestError` / `isUnanswerableUserInputRequestError` — treat "provider runtime is not active" as terminal, settle `uncertain` |
| Startup     | `apps/server/src/orchestration/startupTurnReconciliation.ts`     | `selectThreadsNeedingRestartCleanup` — boot sweep candidates from the shell snapshot's SQL-computed pending counts, not the command read model        |

### Data Flow

Response-requested event → `isPendingInteractionResponseClaimable` → mark interaction `responding` → provider continues

Session shell upsert → `reconcileLatestTurnFromSession` → settle running turn only if `session.updatedAt >= turn.startedAt` (errors always settle)

Restart → `startupTurnReconciliation` runs once before accepting commands → `selectThreadsNeedingRestartCleanup` picks threads with an orphaned turn, an interrupted checkpoint revert, or a pending request per `getShellSnapshot()` → dispatches synthetic activities to settle them

Respond to a request whose runtime died → `ProviderService` fails with "provider runtime is not active" → `isUnanswerableApprovalRequestError` / `isUnanswerableUserInputRequestError` matches it → settles `uncertain` instead of `retryable`

### Key Functions

- `respondingInteractionReclaimCutoff(requestedAt) → ISO` — `requestedAt − 30s` grace
- `isPendingInteractionResponseClaimable({ status, responseRequestedAt, requestedAt }) → boolean` — pending/retryable/uncertain always; responding only after grace
- `markInteractionResponding(thread, event) → pendingInteractions` — claim via shared predicate
- `reconcileLatestTurnFromSession(thread, session, error) → latestTurn` — skip stale non-error settle
- `selectThreadsNeedingRestartCleanup({ threads, threadIdsWithPendingRequests }) → threads` — pure boot sweep candidate filter; pending-request ids come from the shell snapshot, not `engine.getReadModel()` (its `hasPendingApprovals`/`hasPendingUserInput` are always false — no activities in that model)

### State

- `pendingInteractions[].status`: `pending \| retryable \| uncertain \| responding \| …` — claim gate (thread)
- `responseRequestedAt`: `string \| null` — when client last claimed responding (thread)
- `RESPONDING_INTERACTION_RECLAIM_GRACE_MS`: `30000` — reclaim window (shared constant)

### Behavior

- Status `uncertain` is claimable (old client check only allowed pending/retryable)
- Stuck `responding` older than grace can be reclaimed by a newer response-requested event
- Stale ready/interrupted session snapshot must not close a just-started running turn (phantom completion / invisible reply)
- A question prompt whose owning provider runtime died (app/server restart) settles `uncertain` on first response attempt or on the next boot sweep — it can never be `retryable` forever
