---
type: gotcha
project: synara
created: 2026-08-13
last_verified: 2026-08-13
status: fixed
tags: [wsTransport, orchestration-shell, reconnect, sidebar, notifications, websocket]
---

## An explicit shell resubscribe no-ops while the stream is already running, freezing the whole sidebar

### Symptom

Linear ALE-18: an agent finishes a turn, but the sidebar keeps showing "in lavorazione" (working)
and no completion notification/quack sound fires. Clicking the thread to open it "fixes" it
instantly — the status updates and the notification fires right then, late.

Not scoped to one thread: the entire sidebar (every thread's shell status) stops receiving live
updates until something forces a fresh shell subscribe.

### Cause

`ensureScopedSubscriptions()` (`apps/web/src/routes/__root.tsx`) resets the shell replay cursor
(`shellSnapshotSequence = -1`) and calls `api.orchestration.subscribeShell()`, expecting a fresh
snapshot to follow immediately.

But `WsTransport.startStream()` (`apps/web/src/wsTransport.ts`) early-returns if a stream with that
key already has a registered cleanup — it assumes "already running" means "already correct". If a
prior reconnect had already restarted the shell stream, the explicit `subscribeShell` request became
a no-op: no new snapshot was requested, so `shellSnapshotSequence` stayed at `-1`.

With the cursor stuck at `-1`, every subsequent shell event (`thread.session-set`,
`thread.turn-diff-completed`, etc. — see `apps/server/src/orchestration/threadShellEvents.ts`) got
buffered into `pendingShellEvents` instead of being applied (`apps/web/src/routes/__root.tsx`,
`onShellEvent` handler: `if (shellSnapshotSequence < 0) { appendBounded(...); return; }`). The
fallback `loadShellSnapshotOnce()` didn't help either: `shouldApplyBootstrapShellSnapshot` bails out
once `threadsHydrated` is true and the store already has spaces/projects/threads.

Opening a thread creates a **thread-detail** subscription (a separate stream), which is unaffected
by the shell cursor bug and delivers the settled state directly — that's why clicking the thread
"fixes" it and fires the deferred notification right there.

Confirmed server-side data was never the problem: `thread.session-set` / `thread.turn-diff-completed`
are already published on the shell stream (`OTHER_THREAD_SHELL_EVENT_TYPES`), hot projectors commit
before `publishCommittedEvent`, and `operational_diagnostics` showed no admission rejections or
stream drops. Purely a client-side resubscribe-is-a-no-op bug.

### Fix

`apps/web/src/wsTransport.ts`: the `subscribeShell` branch of `request()` now calls
`await this.stopStream("orchestration.shell")` before `startShellStream()`, mirroring the thread
subscribe path's `forceRestart`. An explicit subscribe now always tears down any existing shell
stream first, so it always gets a real restart and a fresh snapshot.

See `documentation/features/011-thread-detail-subscriptions.md` for the related detail-subscription
lease design (that path was already correct; this bug was shell-only).
