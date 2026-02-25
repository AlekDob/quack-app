---
type: bug
project: quack-app
created: 2026-02-25
last_verified: 2026-02-25
tags: [automation, scheduler, cron, nextRunAt, architecture]
---
# Bug: Automation Jobs Don't Fire / Fire Repeatedly

## Symptom 1: Job never fires
A scheduled job shows "Next: Tomorrow at HH:MM" even though the time hasn't passed yet, or the job simply never executes.

## Root Cause 1: Tick listener in tab-scoped component
The `automation-scheduler-tick` listener lived inside `AutomationView.tsx`, which only mounts when the Automation tab is active. Switching tabs unmounts the component, and ticks go unprocessed. When returning to the tab, `initialize()` recalculates `nextRunAt` — if the fire time has passed, it jumps to tomorrow.

## Fix 1: Global tick listener in App.tsx
Moved the tick listener + fire logic to a `useEffect` in `App.tsx` (always mounted). Uses `terminalsRef.current` for always-current agent list. `AutomationView` now only handles UI (CRUD, form, history).

## Symptom 2: Job fires repeatedly every 30s
A job fires once, then keeps re-firing every 30 seconds indefinitely.

## Root Cause 2: nextRunAt never advanced
`fireJob()` never recalculated `nextRunAt` after execution. Each 30s tick re-checked `now >= nextRunAt` which remained true.

## Fix 2: Advance nextRunAt immediately after fire
After `markJobRunning()`, immediately call `getNextFireTime(job.cronExpression)` (non-inclusive) and persist via `updateJob()`.

## Additional fixes
- `initialize()`: Only recalculates `nextRunAt` if undefined or in the past (preserves future timestamps)
- `getNextFireTime()`: Added `inclusive` param — `true` for job creation (include current minute), `false` after fire
- `CronPresetInput`: "Every 6 hours" no longer highlights with "Every day" (applyTime skips special patterns)

## Key Code
- `src/App.tsx` — global scheduler tick useEffect
- `src/components/automation/AutomationView.tsx` — UI only (no tick/fire)
- `src/services/cronUtils.ts` — `getNextFireTime()` with inclusive param
- `src/stores/automationStore.ts` — `initialize()` preserves future nextRunAt
- `src/components/automation/CronPresetInput.tsx` — `hasSpecialTimeFields` guard
