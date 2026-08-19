---
type: feature-doc
project: synara
stack: React / Vite / TypeScript
created: 2026-08-19
startDate: 2026-08-19
endDate: 2026-08-19
last_verified: 2026-08-19
status: active
tags: [chat, composer, interrupt, stop]
---

## Composer stop responsiveness

**Purpose:** Make the composer's stop button acknowledge a click immediately, instead of looking dead until the provider settles the turn.
**Stack:** React / TypeScript (`apps/web`)
**Linear:** ALE-40 — "Lo stop non funziona sempre bene"

### Problem

`thread.turn.interrupt` is fire-and-forget from the UI's point of view: `storeEventReducer.ts` deliberately keeps the turn in `state: "running"` after the request is dispatched (comment at line ~1245: "best-effort, keep the latest-turn clock/state live until the provider confirms a terminal event"). Server-side, `interruptProviderTurn` in `ProviderCommandReactor.ts` can take up to `PROVIDER_COMMAND_INTERRUPT_TIMEOUT` before it settles, escalating to a full session stop on timeout/uncertain outcomes.

Because the button's only state source was `phase === "running"`, clicking it produced zero visible change for however long that settlement took. It read as broken even though the interrupt command was dispatched correctly.

### Files

| Type      | Path                                    | Exports/Purpose                                                        |
| --------- | ---------------------------------------- | ------------------------------------------------------------------------ |
| Component | `apps/web/src/components/ChatView.tsx`   | `isStopPending` local state; `onInterruptFromStopControl`; stop button  |

### Data flow

Click → `onInterruptFromStopControl` sets `stopRequestedKey` to `stopControlKey` (`` `${threadId}:${turnId}` ``) synchronously, before awaiting the dispatch → button re-renders with `isStopPending = true` (pulsing icon, `aria-busy`, "Stopping..." title) → `onInterrupt()` dispatches `thread.turn.interrupt` as before (server/reducer behavior unchanged) → resolution:
- **Dispatch throws** → `stopRequestedKey` cleared immediately, existing error toast fires, button returns to normal (retryable).
- **Provider settles the turn** → `phase` leaves `"running"`, a `useEffect` clears `stopRequestedKey`.
- **New turn starts on the same thread, or thread switches** → `activeLatestTurnId`/`activeThreadId` changes `stopControlKey`, so the stale pending flag no longer matches and `isStopPending` is `false` for the new turn without any extra cleanup code.

Ctrl+C (`isMacPlatform` shortcut) routes through the same `onInterruptFromStopControl`, so it gets the same feedback.

### Behavior

- Purely a local UI signal — does not change what's dispatched to the server, the reducer, or the interrupt/timeout/session-stop escalation logic server-side.
- Keyed on thread+turn rather than a plain boolean, so it self-clears on turn/thread change without a dedicated reset call.
- Second click while pending still dispatches another interrupt (not disabled) — harmless no-op if the first is still in flight, and useful if the first request was silently dropped.

### Verification

- `bun typecheck` — clean, no new errors.
- `bun fmt` — clean.
- `bun lint` — clean (pre-existing warning count unchanged).
- Not manually run through the UI this session (no dev server session) — worth a manual click-through to confirm the pulse/aria-busy feel before considering this fully verified.

### Related documentation

- `013-immediate-send-feedback.md` — same class of fix (local optimistic UI state ahead of a slow server round-trip), same file (`ChatView.tsx`).
