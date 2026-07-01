---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-30
last_verified: 2026-06-30
tags: [usage, cost, claude-code, sessions, monitor, transcript, perf, tab, quack-v1]
---

## Usage Monitor (live Claude Code cost + session monitor)

**Purpose:** A tab that lists every Claude Code session on this machine
(scanned from `~/.claude/projects/*/*.jsonl`) with estimated USD cost, turns,
cache-hit ratio, model and active/zombie/idle state. Clicking a row opens that
session's transcript as a read-only, chunked tab.

> **Now a two-view tab.** As of `features/020`, `UsagePanel` is a thin shell
> with a `Sessions | Context` segmented control. This doc covers the **Sessions**
> view (the session monitor). The **Context** view (skill/plugin context-cost
> analyzer) lives in `features/020-context-optimizer.md`. The old session body is
> now the `SessionsView` component; each view mounts its own effects, so the 12s
> session poll doesn't run while Context is open. The chosen view is persisted per
> workspace (`viewByWs` map) so it survives the portal unmount/remount.

**Stack:** Rust command `claude_usage_sessions` (+ `claude_session_load_turns`,
`claude_session_export_markdown`) in `src-tauri/src/claude_sessions.rs`; React
`UsagePanel` + `SessionTranscriptPane` on the frontend. Polls every 12s; the
backend caches results for 5s.

### Where it lives

| Concern | File |
|---|---|
| Backend scan + cost model + chunked turn loader | `src-tauri/src/claude_sessions.rs` |
| Usage panel (list, polling, sort, open-session) | `src/components/UsagePanel.tsx` |
| Session transcript viewer (lazy, chunked) | `src/components/SessionTranscriptPane.tsx` |
| Tab key + open action (`usage:<wsId>`, `usageOpen`) | `src/store.ts` |
| Tab label + icon (`chart-bar`) | `src/components/PaneNode.tsx` |
| Portal mount (active-tab-only) | `src/components/WorkspaceShell.tsx` |
| Activity-bar entry point | `src/components/ActivityBar.tsx` |

### Why this shape (decisions)

1. **Editor tab, not a sidebar panel.** Mirrors the Whiteboard
   (`features/018`): `usageKey(wsId)` = `usage:<wsId>`, one tab per workspace,
   self-contained (re-polls on mount, so it survives restart with no
   descriptor). The activity-bar icon calls `usageOpen`, and is highlighted
   when the focused pane's active tab is a `usage:` key. The panel is only
   mounted (via portal) while its tab is the active+visible one, so the 12s
   poll never runs for a background tab.
2. **Clicking a row opens a transcript tab,** not a markdown export dumped into
   Monaco — `SessionTranscriptPane` lazy-loads N turns at a time
   (`claude_session_load_turns`) and renders each turn collapsed, so a
   multi-MB / 1500-turn session opens in one frame.
3. **Infinite scroll on the session list.** The backend returns the whole
   (age-filtered) list, but the panel only renders `INITIAL_RENDER` (24) rows
   and reveals another `RENDER_PAGE` (24) each time a bottom sentinel enters
   the panel viewport (`IntersectionObserver`, root = the scrolling panel).
   "Show all" can return hundreds of sessions; this keeps the DOM small. The
   window resets on sort / show-all change but **not** on the 12s poll (so the
   list doesn't snap to top while reading).

### UI shape

Designed for the wide tab (not the old narrow sidebar): content centred + capped
at 960px. Summary = four metric cards; each session = a **card** with a model
pill, stat chips (turns / cache-read / think / sub), the cost as the right-side
anchor, a thin neutral cache-hit micro-bar, and a left-edge semantic trace for
active/zombie/fresh. Pure CSS-variable tokens, no emoji, colour only on semantic
state (per the brand's neutral chrome). Components: `SummaryStat`, `SessionRow`,
`rowStateOf` (keeps each render ≤20 lines).

### Performance gotchas (the freeze fix)

The first cut **froze the UI** with hundreds of sessions. Root causes, all in
`claude_usage_sessions`:

- **Cache never written on the success path.** The comment promised a 5s cache
  but only the empty/no-home branches wrote `REPORT_CACHE` — every 12s poll
  re-walked + re-read the whole tree. Fixed: the success path now stores the
  report before returning.
- **Every JSONL read + JSON-parsed in full, then filtered.** The `min_age`
  filter ran *after* `fs::read_to_string`, so 300+ multi-MB files were read on
  every poll just to be discarded. Fixed with a **cheap mtime gate** before the
  read: a file whose mtime is older than the window can't be in-window, so it's
  skipped without opening it.
- **Synchronous command stalled IPC/window events.** The scan now runs on
  `tauri::async_runtime::spawn_blocking` (same pattern as `git.rs`/`search.rs`),
  so the heavy walk never blocks the core thread.

> Brain breadcrumb in code: `// Brain: claude-usage-spike`.
