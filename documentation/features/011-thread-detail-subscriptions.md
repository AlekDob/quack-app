---
type: feature-doc
project: synara
stack: React / Vite / TypeScript
created: 2026-08-05
startDate: 2026-08-05
endDate:
last_verified: 2026-08-05
status: active
tags: [subscriptions, event-router, thread-detail, shell, streaming]
---

## Thread detail subscriptions

**Purpose:** Keep the EventRouter detail lease stable across streaming shell updates so newly created threads receive one coherent snapshot subscribe instead of churning reconcile no-ops.
**Stack:** React / TypeScript (`apps/web`)

### Files

| Type      | Path                                      | Exports/Purpose                                                      |
| --------- | ----------------------------------------- | -------------------------------------------------------------------- |
| Route/Page| `apps/web/src/routes/__root.tsx`          | `EventRouter` lease list + identity-stable `subscribedThreadIds`     |
| Util      | `apps/web/src/storeNormalization.ts`      | `arraysShallowEqual` for lease identity                              |
| Store     | `apps/web/src/store.ts` / shell selectors | `serverThreads` (re-emits on streaming updates)                      |

### Data Flow

`routeThreadId` / split view → `hostThreadIds` → `resolveThreadDetailSubscriptionLeaseIds` → shallow-equal retain previous array identity → subscription reconcile effect only when content changes → thread snapshot / live events

### Key Functions

- `resolveThreadDetailSubscriptionLeaseIds({ visible, retained, server }) → ThreadId[]` — lease membership
- `arraysShallowEqual(a, b) → boolean` — keep previous lease reference when membership unchanged

### State

- `subscribedThreadIdsRef`: `ThreadId[]` — last emitted lease identity (component)
- `subscribedThreadIds`: `ThreadId[]` — identity-stable lease passed to effects (component)
- `visibleThreadIdsRef`: mirror for async reconcile callbacks (component)

### Behavior

- `serverThreads` identity changes every stream tick must not enqueue a no-op reconcile on the serialized subscribe chain
- Missing lease identity stability: new threads can miss the first snapshot until app restart rehydrates from SQLite
