---
type: feature-doc
project: quack-desktop
stack: Tauri + React
created: 2026-07-20
startDate: 2026-07-20
endDate:
last_verified: 2026-07-20
status: active
tags: [perf, audit, diagnostics, sysmon, companion-window, chat-switch]
related:
  - 010-project-dock.md
  - 046-process-cleanup.md
  - 024-resume-white-screen-recovery.md
  - 058-workspace-switch-performance.md
  - 075-chat-switch-loader.md
  - 085-agent-ide-mode-toggle.md
  - 087-new-chat-perf.md
---

## Perf Audit Window

**Purpose:** Opt-in companion window that shows Quack/WebKit process CPU·RAM plus a timeline of switch / new-chat / resume timings so intermittent cold/warm lag is diagnosable without DevTools.

**Stack:** Tauri 2 `WebviewWindow` (label `audit`) + React; main window produces snapshots over Tauri events (Dock pattern).

### Tasks

- [x] `perfAuditBus` ring + throttled `audit:snapshot` / `audit:request`
- [x] Wire `switchPerf`, `chatSwitchDebug`, `resumeDebug`, StatusBar `process_stats`
- [x] `auditWindow.ts` + `PerfAuditWindow` (`?audit=1`)
- [x] StatusBar Audit chip, Settings → Diagnostics, `view.toggle_audit` (Ctrl+Alt+P)
- [x] Capabilities + quit teardown
- [x] Feature doc + CLAUDE.md + diary

### Files

| Type | Path | Role |
|---|---|---|
| Bus | `src/perfAuditBus.ts` | Event ring, process snapshot, emit/request |
| Window | `src/auditWindow.ts` | open/close/toggle, pref `lcp.audit.enabled` |
| UI | `src/components/PerfAuditWindow.tsx` | Processes + timeline |
| Route | `src/App.tsx` | `IS_AUDIT`, context provider, request listener |
| Entry | `src/components/StatusBar.tsx`, `SettingsModal.tsx`, `actions.ts` | Chip / Diagnostics / command |
| Caps | `src-tauri/capabilities/default.json` | window label `audit` |

### Architecture

```
StatusBar (5s process_stats) ──publishProcessStats──► perfAuditBus
switchPerf / chatSwitch / resume ──recordPerfEvent──► ring (cap 100)
Main ──throttle 500ms── emit audit:snapshot ──► Audit window
Audit window ──audit:request──► force snapshot
```

- **No second sysmon poll** — StatusBar owns `process_stats`; Task Manager keeps its own 2s poll only while open.
- **Default off** — ring still records cheaply; Tauri emit only when pref is on.
- **Kill stays in Task Manager** (Ctrl+Alt+U) — audit is read-only.

### Entry points

| Surface | Action |
|---|---|
| StatusBar | **Audit** chip → `toggleAudit()` |
| Settings → Diagnostics | Toggle Perf Audit window |
| Command palette / accel | `view.toggle_audit` — **Ctrl+Alt+P** |
| Audit header | **Copy JSON** — clipboard snapshot (`type: "quack-perf-audit"`) for pasting into chat |

### Copy JSON

Exports a compact report (`type: "quack-perf-audit"`, `v: 1`): context (warm/cold),
process totals + trimmed rows, timeline events with ISO `at` timestamps.

| Field | Meaning |
|---|---|
| `elapsedMs` (export) | Prefers `detail.elapsedMs` / `detail.loadMs` over top-level — agent-mode top-level is “since mode toggle” and misleads (e.g. 162s) |
| `sinceModeMs` | Present only when agent-mode wall clock differs from phase-local ms |
| `processes[].cmd` | Truncated to 120 chars |

Paste the JSON into an agent chat to diagnose intermittent lag. New-chat
regressions: see **`087`** expected marks (`session loaded` / `hydrate done` /
`panel painted`).

### Gotchas

- Feature number **086** (085 is Agent↔IDE toggle; 087 is new-chat perf).
- Ctrl+Shift+A is already Agent Mode — do not reuse for audit.
- Closing via OS × calls `markAuditClosed()` so pref stays in sync.
- Requires `tauri dev` restart for the new window capability label.
- Measuring with a heavy subscriber during chat-switch freeze would bias results — timeline updates are throttled and the audit UI lives in a separate webview.
- Resume flicker (hidden under 2s) is filtered out of heal + timeline so New chat after alt-tab isn’t buried under `visibility` spam (`024`).

### Related

- Task Manager (`046`) — kill + modal process tree
- Project Dock (`010`) — companion window pattern
- Resume (`024`) — wake events appear as `resume` timeline rows
- New chat hydrate/paint (`087`) — primary consumer of Copy JSON samples
