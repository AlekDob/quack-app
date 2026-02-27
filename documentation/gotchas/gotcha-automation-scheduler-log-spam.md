---
type: gotcha
project: quack-app
created: 2026-02-27
last_verified: 2026-02-27
tags: [automation, logging, useEffect, react, performance]
---
# Automation Scheduler Log Spam on Dev Startup

## Symptom
Running `npm run dev` (or `cargo tauri dev`) floods the console with hundreds of:
```
[Automation] Scheduler already running
```

## Root Cause
The `useEffect` in `App.tsx` (~line 9208) that calls `invoke('start_automation_scheduler')` has **unstable dependencies**:

```ts
}, [tauriAvailable, createSession, sendMessageForTargetAgent]);
```

`createSession` and `sendMessageForTargetAgent` are `useCallback` functions whose identity changes on every render (their own deps change frequently). Each re-run of the effect calls the Rust command again. The Rust scheduler is idempotent — it detects it's already active and returns early — but logged at `info` level, causing the spam.

## Fix Applied
Changed `log::info!` → `log::debug!` in `automation.rs:97` so the message is suppressed in normal console output.

## Deeper Fix (Deferred)
Stabilize the effect deps by storing `createSession` and `sendMessageForTargetAgent` in `useRef`s, or move the scheduler start to a separate one-time effect with `[]` deps (since those functions are only used inside the tick listener closure, not in the effect setup itself).

## Files
- `src-tauri/src/automation.rs:97` — log level
- `src/App.tsx:9208-9331` — useEffect with unstable deps
