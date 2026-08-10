---
type: bug
project: synara
created: 2026-08-09
last_verified: 2026-08-09
status: fixed
tags: [pending-interactions, user-input, restart, startup-reconciliation, ProviderCommandReactor]
---

## A question prompt survives an app restart and can never be answered

### Symptom

A thread asks a question (`AskUserQuestion`). You close the app before answering. You reopen it.
The question panel is still there, with the options and the "Submit answers" button. The composer
is blocked behind it. Clicking Submit does nothing visible. Clicking again does nothing. The thread
is wedged forever.

Observed in the wild: thread `668c255f` ("Richiesta MCP Mobbin"), question raised 2026-08-07,
still unanswerable on 2026-08-09 after several restarts, with three failed submit attempts logged
within seven seconds.

### Root cause

Two independent defects, both required to produce the wedge.

**1. A dead runtime was classified as a retryable failure.**

The prompt is answered through a callback held in memory by the provider runtime
(`ClaudeAdapter`'s `pendingUserInputs` map). That runtime dies with the process, so after a restart
no response can ever land. `ProviderService.respondToInteraction` rejects with a
`ProviderValidationError`: *"Cannot respond to request '…' because the provider runtime is not
active."*

`ProviderCommandReactor.interactionFailureSettlementStatus` only treated adapter-level errors as
terminal, so this rejection settled as `retryable`. Both the durable row and the client's derivation
(`pendingInteractionDerivation.retainActionableSettlements`) keep `retryable` interactions open — so
every click failed the same way and the panel never cleared.

**2. The boot sweep never selected the thread.**

`startupTurnReconciliation` exists exactly for this and already emits stale-request failures at
startup. Its candidate filter read `thread.hasPendingApprovals` / `thread.hasPendingUserInput` off
the *command* read model. But `ProjectionSnapshotQuery.getCommandReadModel` builds each thread with
`activities: <checkpoint-revert rows only>` and `pendingInteractions: []`, and `toProjectedThread`
derives those flags from that activity list. With no `user-input.requested` activity in it, both
flags are structurally **always false**. The sweep therefore only ever cleaned threads with an
orphaned turn; a thread whose turn had already settled — the exact restart case — was skipped.

### Fix

- `ProviderCommandReactor`: `isUnknownPending*RequestError` → `isUnanswerable*RequestError`, now also
  matching `provider runtime is not active`. That routes the failure to
  `buildStalePendingRequestFailureDetail` + `settlementStatus: "uncertain"`, which settles the row and
  clears the panel on the first click.
- `startupTurnReconciliation`: candidates are now selected by `selectThreadsNeedingRestartCleanup`,
  which takes the pending-request thread ids from `getShellSnapshot()` (SQL-computed counts, the real
  ones) instead of the command read model's always-false flags.

### Gotcha to remember

Do not read `hasPendingApprovals` / `hasPendingUserInput` off `engine.getReadModel()`. That model has
no activities, so those flags are always false. Use the shell snapshot or the pending-interaction
rows.
