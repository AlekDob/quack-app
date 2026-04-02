---
type: bug
project: quack-app
created: 2026-04-01
last_verified: 2026-04-01
tags: [streaming, race-condition, daemon, stop, persistent-session, rendering]
---

# Assistant response renders one turn late — current state

## Summary

The original frontend stale-buffer race was real and has been fixed, but it was **not** the whole story.

As of April 1, 2026, there are two important conclusions:

1. The original React/Tauri race did exist and was correctly fixed.
2. At least one **remaining** failure mode happens **before rendering**: after a prior `Stop`, the answer to user message `n-1` can be returned immediately as the completion result for message `n`.

That second behavior means the backend/session-process layer can still misattribute an already-generated answer from the previous turn to the new turn.

## Shipped fixes so far

### 1. Frontend atomic buffer consume

Commit: `1162070d57e667edc317cffa3b0673f7ab81b0c4`

- Moved event-buffer consumption into the `setChatSessions` updater.
- Fixed the original stale-buffer window where late events from turn `n` could be attached to turn `n+1`.

### 2. Per-turn isolation in frontend chat paths

Commit: `0a1017ad0c7a4e84fb1c5f52f2f629585a2df5a1`

- Added frontend-generated `turnId` wiring.
- Stored `turnId` on assistant placeholders.
- Rejected stale events from old turns.
- Applied the same pattern to Kanban and popout paths.

### 3. Persistent-session stop via SDK interrupt

Commit: `ea542efe7b575e8de9364d0918c8043d2af9f1f3`

- Switched persistent-session stop to the SDK interrupt path.
- Suppressed post-stop assistant/tool/result events.
- Added aborted-turn rejection in the frontend.

### 4. New hardening on top of the above

Current worktree at time of writing: `aef03de` plus uncommitted daemon changes in `src-tauri/node-sdk/stream-daemon.js`.

- After `Stop` on a persistent session, the subprocess is now marked **tainted**.
- The next turn for that session forces a **fresh subprocess** instead of reusing the stopped one.
- Added daemon diagnostics:
  - `TAINTED_SESSION_RESTART`
  - `OVERLAP_DETECTED`
  - `RESULT_AFTER_INTERRUPT`

## What has been confirmed

## Confirmed cause #1: original frontend stale-buffer race

This was the first confirmed mechanism:

- Rust emitted stream events asynchronously and resolved invoke completion immediately after.
- React marked the assistant message `complete`.
- A trailing event could then be buffered instead of applied.
- On the next send, that stale event could be flushed into the new assistant placeholder.

This explains the classic visual “answer appears under the next user message” symptom.

## Confirmed cause #2: previous answer can be returned as the new completion result

This is the newer and more important finding.

In a real failing session, the wrong answer was already present in:

- `[COMPLETION] ... response.result = ...`

That means the bug was not merely “the UI rendered the wrong bubble.”  
The daemon/frontend invoke pipeline had already handed the previous turn’s answer to the new turn.

This is strongly associated with a prior `Stop`.

## Why this changes the diagnosis

If the wrong answer is already inside `response.result` for the new send, then:

- the main problem is **not** React ordering
- the main problem is **not** event-buffer rendering alone
- the misalignment is happening in the persistent-session execution path before the UI renders anything

## Most likely remaining root cause

The most likely remaining mechanism is shared persistent-subprocess reuse after `Stop`.

### Relevant code

- [`src-tauri/node-sdk/stream-daemon.js`](/Users/fredric/Dev/quack-app/src-tauri/node-sdk/stream-daemon.js)
- [`src-tauri/src/claude_cli.rs`](/Users/fredric/Dev/quack-app/src-tauri/src/claude_cli.rs)

### Why this is plausible

`SessionProcess` has:

- a single mutable `currentQueryId`
- a single shared event queue
- one `events()` generator per query consuming from that same queue

After `Stop`:

- the query is marked aborted
- interrupt is sent
- the old query may still be draining internally

If the next query starts on the same `SessionProcess` before the old one is fully drained, the new query can consume the old query’s already-generated `assistant`/`result` events and emit them under the new query.

That exactly matches the observed symptom:

- user stops a turn
- sends another message
- the answer to the previous message comes back immediately as the new completion result

## Important evidence

### Evidence that supports the backend misattribution theory

- User reports consistently tie the remaining issue to a prior `Stop`.
- In the failing screenshot, the assistant bubble under the new user message contains the semantic answer to the previous message.
- In the failing logs, `[COMPLETION]` already contains the wrong answer.
- Therefore the corruption happens before the final assistant message is rendered.

### Evidence that weakens other theories

- Session switching alone is unlikely to be the root cause.
  - `ChatView` is keyed by active session/task and remounts correctly.
- Wake recovery is unlikely to be the root cause.
  - `useSystemWakeHandler` forces repaint/rerender/reload but does not rewrite chat state.
- Message ordering by timestamp is unlikely to be the root cause.
  - `MessageList` renders messages in array order, not by timestamp sort.

## Secondary issues found during investigation

These are real, but are not the primary confirmed cause of the current bug report.

### 1. Some SDK streaming callers still bypass `turnId`

At investigation time, these paths were identified as not passing `turnId`:

- current-agent compaction in [`src/App.tsx`](/Users/fredric/Dev/quack-app/src/App.tsx)
- target-agent compaction in [`src/App.tsx`](/Users/fredric/Dev/quack-app/src/App.tsx)
- BTW sidechain in [`src/hooks/useBTW.ts`](/Users/fredric/Dev/quack-app/src/hooks/useBTW.ts)

If an event arrives without `turnId`, the stale-turn rejection logic cannot reject it as stale/aborted.

This remains a defense-in-depth gap.

### 2. False-positive late-render warning on abort

`[BUG:LATE_RENDER] Previous assistant message still "error" at send time!`

This warning currently fires after intentional aborts because the previous assistant message is left in `error` state. It is useful for debugging incomplete turns, but it now produces false positives on legitimate `Stop` flows.

### 3. Stale completion-side `messageCount` write

Completion still persists `messageCount` from a stale `chatSessions.get(messageKey)` snapshot outside the updater.  
This causes log mismatches such as:

- `useSessionMessageSync: 14 -> 16`
- `SESSION-FIX: messageCount=14`

This is a bookkeeping issue, not the main bug.

## Current state

### What appears fixed

- The original frontend stale-buffer race is fixed.
- The persistent-session stop path is much better than before.
- In local repros, stopping a long tool-heavy turn no longer reliably causes the next turn to shift by one.

### What is still open

- Users can still hit a session where the answer to message `n-1` is returned immediately as the answer to message `n`.
- That remaining bug is most likely in persistent-subprocess reuse after stop, not in the frontend renderer.

## Recommended next actions

### Short-term pragmatic fix

Keep the new daemon behavior:

- after `Stop`, mark the persistent subprocess as tainted
- do not reuse it for the next turn
- spawn a fresh subprocess on the next send for that session

This is the safest immediate fix even though it may reduce prompt-cache efficiency on the stop path.

### Diagnostics to watch

Check `~/.quack/daemon-diag.log` for:

- `TAINTED_SESSION_RESTART`
- `OVERLAP_DETECTED`
- `RESULT_AFTER_INTERRUPT`

These should confirm whether a stopped query was still draining when the next turn began.

### Medium-term cleanup

1. Make `SessionProcess` strictly single-query so only one consumer can own the subprocess event stream at a time.
2. Wire `turnId` through every remaining `send_message_via_sdk_streaming` caller.
3. Silence or downgrade `[BUG:LATE_RENDER]` for intentionally aborted turns.
4. Fix stale `messageCount` persistence in completion handling.

## Working conclusion

The bug started as a frontend event-buffer race, but the remaining production issue is now best understood as a **backend persistent-session reuse bug after stop**.

The clearest current model is:

1. user stops a turn
2. old persistent query is not fully drained yet
3. next turn starts on the same subprocess too soon
4. old answer/result is consumed under the new query
5. frontend renders the wrong answer immediately

That theory fits the screenshot, the completion logs, the stop correlation, and the partial success of the fixes already shipped.
