---
type: feature-doc
project: synara
stack: TypeScript / React / Effect
created: 2026-08-14
startDate: 2026-08-14
endDate:
last_verified: 2026-08-14
status: active
tags: [composer-queue, dispatch-mode, thread-unmount, durable-queue, provider-command-reactor]
---

## Queued turn server handoff

**Purpose:** When `ChatView` unmounts from a thread (thread closed, or pane switches to another thread), hand any locally-queued composer follow-ups over to the server's durable queue so they still dispatch instead of freezing until the thread is reopened.
**Stack:** TypeScript (`apps/web` React component + `apps/server` Effect orchestration)

### Files

| Type      | Path                                                             | Exports/Purpose                                                                                                                                                                                        |
| --------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Component | `apps/web/src/components/ChatView.tsx`                           | Queue auto-dispatch effect (~9000), queue handoff-on-unmount effect (~9060), `dispatchQueuedComposerTurn` (~8860), per-thread `sendHandlersByThreadRef` map (~7049), handlers captured into it (~9992) |
| Test      | `apps/web/src/components/ChatView.browser.tsx`                   | "hands queued follow-ups to the server queue when you switch threads" (~4585)                                                                                                                          |
| Reactor   | `apps/server/src/orchestration/Layers/ProviderCommandReactor.ts` | `drainQueuedTurnsForThread` (~2393), `drainQueuedTurnsForSession` (~2494) — promote the next queued turn once the live provider turn settles                                                           |
| Repo      | `apps/server/src/persistence/Layers/QueuedTurnPromotions.ts`     | SQL-backed claim/promote lifecycle for `queued_turn_promotions` (`enqueue`, `claimNext`, `markPromoted`)                                                                                               |

### Data Flow

`ChatView` unmounts (thread closed / pane switched) → handoff effect reads `queuedComposerTurnsRef.current` + that thread's captured `LateComposerSendHandlers` from `sendHandlersByThreadRef` → sequentially calls `dispatchQueuedComposerTurn(turn, "queue", handlers)` for each remaining turn → each dispatch removed from the local draft store only after it succeeds

`thread.turn.start` / `thread.turn.dispatch-queued` with `dispatchMode: "queue"` → orchestration event log → `ProviderCommandReactor.drainQueuedTurnsForThread` claims the next queued promotion once no live provider turn is active → dispatches it server-side with no UI attached

### Key Functions

- `dispatchQueuedComposerTurn(queuedTurn, dispatchMode, handlers?) → Promise<boolean>` — sends a chat or plan-follow-up queued turn through the given (or currently-mounted) `LateComposerSendHandlers`
- unmount cleanup (queue handoff effect, `ChatView.tsx` ~9060) — drains `queuedComposerTurnsRef.current` for `threadId` via that thread's captured handlers, skipping the head entry if the auto-dispatch effect already claimed it (`autoDispatchingQueuedTurnRef.current`)
- `drainQueuedTurnsForThread(threadId)` (server) — claims and promotes the next `queued_turn_promotions` row for a thread once its live provider turn has settled

### State

- `queuedComposerTurnsRef.current`: `QueuedComposerTurn[]` — mirror of the composer draft store's queue, read by both the auto-dispatch effect and the unmount handoff (component)
- `sendHandlersByThreadRef.current`: `Map<ThreadId, LateComposerSendHandlers>` — per-thread send handlers; refreshed every commit in a layout effect so a ChatView instance reused across a thread switch in the same pane doesn't hand off through the stale thread's handlers (component)
- `autoDispatchingQueuedTurnRef.current`: `boolean` — true while the mounted-thread drain effect has a send in flight, so the unmount handoff skips re-sending that same head turn (component)
- `queued_turn_promotions.state`: `queued \| promoted \| cancelled` — server-side durable queue row lifecycle (persistence)

### Known Limitations

- `sendInFlightRef` / `sendPreflightInFlightRef` are shared (not per-thread) in-flight send guards. If another thread's send is in flight at the exact moment of the thread switch, `dispatchQueuedComposerTurn` can return `false` and the handoff aborts for the remaining turns — they simply stay queued in the local draft until the thread is opened and closed again.
