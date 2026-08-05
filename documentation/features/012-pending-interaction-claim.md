---
type: feature-doc
project: synara
stack: TypeScript / Effect
created: 2026-08-05
startDate: 2026-08-05
endDate:
last_verified: 2026-08-05
status: active
tags: [pending-interactions, approvals, store-projection, reclaim, upstream-port]
---

## Pending interaction response claim

**Purpose:** Shared policy for claiming durable approval / user-input responses, plus client turn settlement that refuses stale session snapshots.
**Stack:** TypeScript (`packages/shared` + `apps/web`)

### Files

| Type       | Path                                            | Exports/Purpose                                                                 |
| ---------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| Util       | `packages/shared/src/pendingInteractions.ts`    | `isPendingInteractionResponseClaimable`, reclaim grace cutoff                   |
| Config     | `packages/shared/package.json`                  | Export `@synara/shared/pendingInteractions`                                     |
| Store/State| `apps/web/src/storeEventReducer.ts`             | `markInteractionResponding`; `reconcileLatestTurnFromSession` stale guard       |

### Data Flow

Response-requested event → `isPendingInteractionResponseClaimable` → mark interaction `responding` → provider continues

Session shell upsert → `reconcileLatestTurnFromSession` → settle running turn only if `session.updatedAt >= turn.startedAt` (errors always settle)

### Key Functions

- `respondingInteractionReclaimCutoff(requestedAt) → ISO` — `requestedAt − 30s` grace
- `isPendingInteractionResponseClaimable({ status, responseRequestedAt, requestedAt }) → boolean` — pending/retryable/uncertain always; responding only after grace
- `markInteractionResponding(thread, event) → pendingInteractions` — claim via shared predicate
- `reconcileLatestTurnFromSession(thread, session, error) → latestTurn` — skip stale non-error settle

### State

- `pendingInteractions[].status`: `pending \| retryable \| uncertain \| responding \| …` — claim gate (thread)
- `responseRequestedAt`: `string \| null` — when client last claimed responding (thread)
- `RESPONDING_INTERACTION_RECLAIM_GRACE_MS`: `30000` — reclaim window (shared constant)

### Behavior

- Status `uncertain` is claimable (old client check only allowed pending/retryable)
- Stuck `responding` older than grace can be reclaimed by a newer response-requested event
- Stale ready/interrupted session snapshot must not close a just-started running turn (phantom completion / invisible reply)
