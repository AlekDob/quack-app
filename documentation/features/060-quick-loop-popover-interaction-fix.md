---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React)
created: 2026-04-16
last_verified: 2026-04-16
tags: [quick-loop, popover, ui-interaction, unified-action-bar, bug-fix]
---

## Quick Loop Popover Interaction Fix
**Purpose:** Restore input/select/button interactivity inside `QuickLoopPopover` by opting into the `.uab-popover` contract enforced by the parent `UnifiedActionBar`.
**Stack:** React 18 + TypeScript strict (Tauri frontend)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | src/components/loop/QuickLoopPopover.tsx | `QuickLoopPopover` — popover UI for configuring/monitoring the Quick Loop (prompt, interval, max runs, stop) |
| Component | src/components/chat/UnifiedActionBar.tsx | Parent bar; `onMouseDown` calls `preventDefault()` unless target is inside `.uab-popover` or `.chat-settings-menu` |
| Component | src/components/chat/ComposePopover.tsx | Reference popover correctly using `className="uab-popover"` |
| Component | src/components/chat/SessionPopover.tsx | Reference popover correctly using `className="uab-popover"` |
| Config | src/components/chat/UnifiedActionBar.css | `.uab-popover` style class definition |
| Service | src/hooks/useQuickLoop.ts | `useQuickLoop` — status/start/stop/currentRun state consumed by the popover |

### Data Flow
User click inside popover → `mousedown` bubbles to `UnifiedActionBar` → handler checks `target.closest('.uab-popover')` → match → skip `preventDefault()` → native focus/click reaches input/select/button → React handlers fire (`onChange`, `onClick`)

### Key Functions
- `QuickLoopPopover(props) → JSX | null` — renders dialog root with `className="uab-popover"` and defensive `onMouseDown` stopPropagation
- `IdleForm({ onStart }) → JSX` — form for prompt, interval, max runs; submits via button or Enter key
- `RunningStatus({ prompt, currentRun, onStop }) → JSX` — shows active run with Stop button
- `handleStart(prompt, intervalMs, maxRuns?) → void` — forwards config to `onStartLoop`
- `handleStop() → void` — calls `onStopLoop` then `onClose`

### State
- `prompt`: string — idle-form prompt input (component)
- `intervalMs`: number — selected interval in ms, default 60000 (component)
- `maxRunsInput`: string — optional max runs as string input (component)
- `containerRef`: RefObject<HTMLDivElement> — popover root ref (component)
- `isRunning`: boolean — derived from `status === 'running' | 'paused'` (component)

### External Dependencies
- `useQuickLoop` hook — provides `status`, `activePrompt`, `currentRun`, `startLoop`, `stopLoop`
- Parent `UnifiedActionBar` — enforces `.uab-popover` className contract to preserve textarea focus while allowing popover interaction

### Config
- `INTERVAL_OPTIONS`: preset intervals (30s, 1m, 2m, 5m, 10m, 30m)
- CSS var `--accent-color` — drives CTA and running indicator color

### Root Cause
`UnifiedActionBar` root `onMouseDown` calls `e.preventDefault()` on any target NOT matching `.uab-popover`/`.chat-settings-menu` to preserve textarea focus. `QuickLoopPopover` rendered with inline styles + `role="dialog"` only, missing the class, so its interactive children received `preventDefault()` and never focused/clicked.

### Fix Applied
`src/components/loop/QuickLoopPopover.tsx:216-223` — added `className="uab-popover"` to the root `<div>` and `onMouseDown={(e) => e.stopPropagation()}` as defense-in-depth.

### Invariant
Any popover mounted inside `UnifiedActionBar` MUST carry `className="uab-popover"` on its root element, otherwise inputs/selects/buttons will be non-interactive.
