---
type: feature-doc
project: synara
stack: React / Vite / TypeScript
created: 2026-08-05
startDate: 2026-08-05
endDate: 2026-08-05
last_verified: 2026-08-11
status: active
tags: [composer, activity-strip, subagents, browser-automation, background-work]
---

## Composer Activity Strip

**Purpose:** One panel above the composer showing everything running right now for the open thread — subagents and non-subagent background work (browser automation, agent-launched terminal commands) — instead of two separate strips.
**Stack:** React / TypeScript (apps/web)

### Files

| Type      | Path                                                               | Exports/Purpose                                                                                                  |
| --------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| Logic     | `apps/web/src/components/chat/ComposerActivityStrip.logic.ts`      | `deriveComposerActivityStripRows`, `deriveComposerBackgroundActivityRows`, `activityStripHeaderLabel`, row types |
| Component | `apps/web/src/components/chat/ComposerActivityStrip.tsx`           | Renders the unified strip; `BackgroundActivityRow` for command rows                                              |
| Component | `apps/web/src/components/chat/ComposerBrowserActivityPill.tsx`     | Dedicated Browser status marker above the composer                                                               |
| Util      | `apps/web/src/lib/subagentPresentation.ts`                         | `SubagentStatusKind` (adds `"attention"`), dot/tone/label helpers shared by subagent and background rows         |
| Store     | `apps/web/src/browserStateStore.ts`                                | `selectThreadBrowserState` — source for the browser automation row                                               |
| Consumer  | `apps/web/src/components/ChatView.tsx`                             | Wires `threadBrowserState`, `onOpenBrowserPanel` into the strip                                                  |
| Test      | `apps/web/src/components/chat/ComposerActivityStrip.logic.test.ts` | Subagent scoping (pre-existing) + background rows, attention ordering, header label                              |

Renamed from `ComposerSubagentStrip.tsx` / `.logic.ts` (git mv, no new files for the subagent path). See [005-subagent-avatars.md](005-subagent-avatars.md) for the duck-avatar half of this component.

### Data Flow

- **Subagents:** unchanged — `WorkLogEntry.subagents` → `collectSubagentRows` → `kind: "subagent"` rows.
- **Browser automation:** `ThreadBrowserState.automation` (from `useBrowserStateStore(selectThreadBrowserState(threadId))`, delivered over Electron IPC `desktop:browser-state`) → `deriveComposerBrowserActivityPresentation()` → a dedicated Browser pill while `automation.phase !== "idle"`. The pill opens the existing right dock and is separate from the collapsible activity strip.
- **Agent commands:** `WorkLogEntry` with `itemType === "command_execution"` and `toolStatus === "running"` → `runningCommandRows()`, deduped by `` `command:${toolCallId ?? id}` `` → one `kind: "activity"` row per running command; retires itself once `toolStatus` moves to `completed`/`failed`/`cancelled`.
- Both row kinds merge in `deriveComposerActivityStripRows`, attention rows first, then subagents, then the rest of the background rows.
- On a top-level thread, `stripRawWorkLogEntries` reuses the already-derived `rawWorkLogEntries` (`ChatView.logic.resolveComposerStripWorkLogEntries`) instead of re-deriving from `stripSourceActivities` on every live activity tick — the re-derive path only runs for subagent threads, which have a distinct parent source.

### Key Functions

- `deriveComposerActivityStripRows(input) → ComposerActivityStripRow[]` — single entry point ChatView calls; returns `[]` when there is nothing to show.
- `deriveComposerBackgroundActivityRows({ workEntries }) → ComposerActivityStripBackgroundItem[]` — the command-only non-subagent half, also unit-tested standalone.
- `resolveComposerStripWorkLogEntries({ hasDistinctParentSource, activeWorkLogEntries, deriveParentWorkLogEntries }) → WorkLogEntry[]` — picks the cheap path (reuse) vs. the parent-derive path; avoids scanning and normalizing the full activity history twice per live update on long threads.
- `activityStripHeaderLabel(rows) → string` — one header string for all three cases: subagents-only ("N of M subagents running"), background-only ("N background activities"), mixed ("N of M running").

### State

None new — same pattern as before (pure derivation from work-log entries + one Zustand selector), no extra store or timer. `activityStripCompact` (existing collapse state) now gates both row kinds together.

### Behavior

- Single panel: a thread with both a running subagent and a running command shows one strip, one header, one collapse toggle — not two panels.
- Background rows use `GlobeIcon` / `TerminalIcon` instead of the subagent duck avatar (no identity to carry — there is one browser, commands are one-shot).
- Attention-required browser state (OAuth sign-in, download approval, popup blocked, error) sorts first and uses the new `"attention"` status kind (amber dot/text), since it is the only row the user must act on.
- Clicking the browser row opens the thread's Browser panel (`ChatView.onOpenBrowserPanel`); it only opens, never closes, an already-open panel.
- Stop-all and Ctrl+B background-a-subagent controls still target subagent rows only (`runningSubagentCount`, `collectForegroundRunningSubagentStripItems`).
- `ponytail:` a short-lived foreground command can flash in the strip for a second or two; not gated on `liveActivity.startedAt` age — add if it proves noisy.

### Out of scope (deliberately not built)

- Cross-thread global indicator (sidebar/notch badge for "N activities across all projects").
- App terminals (`terminalStateStore`) and dev servers (`projectRunStore`) in the strip.
- Animated orb instead of the icon — `leading`-style swap would be a small follow-up, not done here.
