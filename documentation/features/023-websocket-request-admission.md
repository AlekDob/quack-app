---
type: feature-doc
project: synara
stack: React / TypeScript / Node / WebSocket
created: 2026-08-12
last_verified: 2026-08-12
status: active
tags: [websocket, admission, concurrency, file-preview, companion]
---

## WebSocket request admission

**Purpose:** Limit concurrent WebSocket RPC work per client so a burst of reads does not saturate the server or starve control traffic.
**Stack:** TypeScript / Effect on the server, WebSocket RPC transport in the web app.

### Files

| Type              | Path                                                                                                   | Purpose                                                                                            |
| ----------------- | ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Admission         | `apps/server/src/wsRequestAdmission.ts`                                                                | Classifies requests, applies per-client limits, and releases leases on completion or interruption. |
| Middleware        | `apps/server/src/wsRpc.ts`                                                                             | Wraps non-stream RPC handlers with the admission guard.                                            |
| Test              | `apps/server/src/wsRequestAdmission.test.ts`                                                           | Covers class limits, independent control capacity, failed work, and interruption cleanup.          |
| Client call sites | `apps/web/src/lib/projectReactQuery.ts`, `apps/web/src/components/settings/CompanionSettingsPanel.tsx` | File reads and Companion model discovery that use the expensive-read lane.                         |

### Request classes and limits

| Class            | Limit | Examples                                                                             |
| ---------------- | ----: | ------------------------------------------------------------------------------------ |
| `control`        |    16 | Terminal writes and acknowledgements, command dispatch, cancellation.                |
| `standard`       |    12 | Lightweight reads and ordinary RPCs.                                                 |
| `expensive-read` |    10 | File previews, workspace searches, Git diffs, provider model discovery, diagnostics. |

The limit is per WebSocket client. A client can use all ten expensive-read leases without consuming control capacity. A request over the class limit fails with `RPC_EXPENSIVE_READ_CAPACITY_EXCEEDED`, marked retryable with a 250 ms retry hint.

### Why the expensive-read limit is 10

The old limit was 2. That was too small for the current UI. Opening a file can overlap with React Query prefetches, workspace searches, and the Companion connection test. The third read was rejected before the file system or Companion server ran.

The limit remains bounded at 10. This keeps protection against unbounded fan-out while allowing normal foreground actions to coexist with background reads. Control traffic has a separate budget, so terminal acknowledgements and cancellation remain available during a read burst.

### Lifecycle

1. The RPC middleware identifies the request class from the method name.
2. `acquire` creates a lease if the client is below that class limit.
3. The handler runs inside `Effect.acquireUseRelease`.
4. The lease is released after success, failure, or fiber interruption.

The ledger is in-memory and scoped to the server process. Restarting the server clears active leases.

### Verification

```text
bun run test -- wsRequestAdmission.test.ts
```

The focused suite passes with 4 tests. The admission test fills all 10 expensive-read slots, confirms the 11th is rejected, confirms control traffic still succeeds, and checks that all leases are released.

### Follow-up

The current policy rejects over-limit requests instead of queueing them. If background prefetch grows, the next improvement should be request priority or a small bounded queue for foreground reads. Do not remove the per-client cap without replacing that protection.
