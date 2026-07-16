---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-16
tags: [agent-hub, agent-status, sessions, notifications, cross-project, workspace-colors, watcher, mount-asymmetry, collapsed-rail, hover-drawer, archived, delete, lifecycle]
---

## Agent Hub (cross-project status rail)

**Purpose:** The right-side rail is now a single CROSS-PROJECT hub: it lists the open AI chats of every open workspace, grouped by live status, with a project name+color badge instead of the old "CC" provider chip, and fires an OS notification + sound when a chat becomes ready or needs input. This is the headline "read the room at a glance" feature (CLAUDE.md + `decisions/001`).
**Stack:** React 19, TypeScript strict, Zustand, module-level pub/sub, Tauri v2 (notification plugin + custom commands/events).

### Status taxonomy (groups, attention order)

UI labels are English (app language). Dot colors are vivid + glowing — the dot IS the meaning, so it carries real color in the otherwise-neutral chrome.

| Group | status | derived from | dot color |
|---|---|---|---|
| Error | `error` | (reserved) live error record | `#ef4444` red + glow |
| Needs input | `needs-input` | `claude:permission-request` (permission or AskUserQuestion) | `#a855f7` purple + glow, pulsing |
| Working | `working` | sessionId present in `claude_code_active_sessions` | `#eab308` yellow + glow, pulsing |
| Ready | `ready` | resting state — anything not running/blocked/done | `#22c55e` green + glow |
| Done | `done` | manual (right-click **Mark done**) | neutral dim |
| Archived | `archived` | legacy (`archivedAt` on descriptor) | neutral dim (muted title) |

`archived` chats are **hidden from the live status groups** (Error → Done) but surfaced in a separate **Archived** section when the hub is expanded — see below. **"Ready" is the resting baseline** — there is no separate "idle" group; a chat that isn't actively running, blocked, or marked done is Ready (waiting for the user). Priority on collision: archived → error → needs-input → working → done → ready (`resolveDisplayStatus`).

### Architecture — single producer, no panel coupling

A single headless `AgentHubWatcher` (mounted once in `App.tsx`) derives status for EVERY open chat and is the only writer of `agentStatusStore`. **Why not let panels publish:** mount-asymmetry — not every chat's `AIChatPanel` is mounted (esp. Agent Mode). The watcher instead reads app-wide signals that don't need a mounted panel:
- **working/ready**: polls `claude_code_active_sessions` (Rust) every 1.5s. Returns chat-tab `sessionId`s whose subprocess child is alive. working→(not active) edge = ready (+ notify if unfocused).
- **needs-input**: listens to the GLOBAL `claude:permission-request` event (carries `cwd` + `session_id`). A 600ms grace timer means auto-allowed tools (Read, always-allow, AskUserQuestion redirect) never flash needs-input — only genuinely-waiting prompts do. Cleared on the new `claude:permission-resolved` / existing `claude:permission-cancelled` events (permission) or on focus (question).
- **seen**: the watcher auto-marks the focused chat seen each tick, clearing a needs-input(question) once you look (ready, being the resting state, just stays ready).

### Key files

| Concern | File |
|---|---|
| Status store (pub/sub, `resolveDisplayStatus`, seen) | `src/agentStatusStore.ts` |
| Global watcher (poll + permission events + notifications) | `src/components/AgentHubWatcher.tsx` |
| The hub UI (groups, rows, dots, badge, context menu, rename) | `src/components/AIChatsRail.tsx` |
| Customizations footer + modal (expanded hub) | `src/components/AgentCustomizations.tsx`, `CustomizationsModal` → feature 036 |
| Session diff subtitles (expanded rows) | `src/chatDiffStore.ts`, `src/sessionDiffStats.ts` → feature 029 |
| OS notification + toast + quack sound (60s dedup, focus gate) | `src/notifications.ts` |
| View prefs (expanded, collapsed sections) — global | `src/hubPrefs.ts` — first-run collapses `done` + `archived` |
| Shared provider badge (DRY extract) | `src/modelBadge.ts` |
| Backend: live-session list | `src-tauri/src/claude_code.rs` → `claude_code_active_sessions` |
| Backend: permission-resolved event | `src-tauri/src/claude_perm.rs` → `claude_perm_decide` emits `claude:permission-resolved` |
| Lifecycle + rename persistence | `src/store.ts` → `AIChatDescriptor.{doneAt,archivedAt,titleLocked}`, `renameAIChat`, `setAIChatLifecycle`, `focusAIChat`, `activeAiChatId` |
| Agent stop on lifecycle | `src/stopChatAgent.ts`, `src/aiStopBus.ts` → `046-process-cleanup.md` |
| Mount point | `src/App.tsx` (`<AIChatsRail/>` in `.shell-stack`, `<AgentHubWatcher/>`) |
| Collapsed rail + hover drawer + switch perf | `064-agent-hub-drawer-and-chat-tab-switch.md` |
| Sound asset | `public/sounds/quack.mp3` (from quack-app) |

### Right-click lifecycle (2026-07-16)

Context menu on a row (`ContextMenu`, shared viewport-clamped component):

| Item | When | Effect |
|---|---|---|
| **Rename** | always | Inline input; sets `titleLocked` so `AIChatPanel` auto-title stops overwriting |
| **Mark done** / **Reopen** | not archived | Toggles `doneAt` — finished but still in hub |
| **Unarchive** | `archivedAt` set (legacy) | `setAIChatLifecycle(…, "active")` |
| **Delete** | always (separator above) | Confirm dialog → `deleteSession` (disk transcript) + `closeAIChat` (tab + descriptor) |

**Archive removed from the menu (2026-07-16):** Done + Archive overlapped ("finished" vs "hide"). New workflow: **Mark done** to park a session, **Delete** to remove it permanently. The **Archived** section and `archivedAt` field remain for chats archived before this change; no new archives are created from the hub UI.

**Done section bulk menu:** **Reopen all** only — **Archive all** removed with the menu simplification.

**Archived row click (2026-07-16):** clicking an archived row now **focuses** the chat (`focusChat`) without auto-unarchiving. Sending a message unarchives (`AIChatPanel.sendUserText` → `setAIChatLifecycle(…, "active")` when `desc.archivedAt` is set). Use **Unarchive** in the context menu to restore explicitly.

Persisted lifecycle fields on `AIChatDescriptor` in per-workspace `state.json`: `doneAt`, `archivedAt` (legacy), `titleLocked`.

**Process cleanup:** Mark done, unarchive, delete, and close chat tab all call `stopChatAgent` where a live agent subprocess exists — kills the chat's CLI subprocess (`claude_code_kill_session` / `cursor_code_kill_session`) and aborts HTTP streams via `aiStopBus`. **Does not kill workspace PTY terminals** (e.g. a dev server in Terminal 1). See `046-process-cleanup.md`.

**Delete vs close tab:** the row **×** / `closeAIChat` closes the editor tab but keeps the descriptor + transcript on disk (chat can reappear if reopened from history). **Delete** is destructive — removes `ChatSession` from disk (`chatHistory.deleteSession` → `chat_store.rs`) and drops the tab descriptor.

### Archived section (expanded hub, 2026-07-13)

When the hub is **expanded** and at least one chat has `archivedAt`, a sixth collapsible group **Archived** appears below Done. Speed-first: archived rows skip live status polling and session-diff hydration.

| Concern | Behavior |
|---|---|
| Default visibility | Latest **10** chats by `createdAt` desc |
| Search | Inline filter on chat title + workspace name; max **30** matches |
| Hint | *Latest 10 of N — search for more* when `N > 10` and search empty |
| Open row | `focusChat` — focuses without unarchive; **Unarchive** in menu or send a message to restore |
| Collapsed by default | `hubPrefs` first-run default includes `"archived"` (with `"done"`) |
| Collapsed rail | Section hidden when hub is not expanded (44px chip mode) |

| Constant | Value | File |
|---|---|---|
| `ARCHIVED_PREVIEW` | 10 | `AIChatsRail.tsx` |
| `ARCHIVED_SEARCH_CAP` | 30 | `AIChatsRail.tsx` |

CSS: `.agent-hub-section.status-archived`, `.agent-hub-archived-search`, `.agent-hub-archived-hint`, `.agent-hub-dot.archived`.

### Session diff subtitles (expanded hub)

When the hub is **expanded**, rows with edits in the latest agent turn show a
second line (feature **029**):

| Files touched | Subtitle example |
|---|---|
| 1 | `Edited App.css −3 +41` |
| 2+ | `−12 +34 · 3 files` |

- Data: `chatDiffStore` (live from mounted `AIChatPanel`, hydrated from
  `chatHistory` for background chats).
- CSS: `.agent-hub-row-body`, `.agent-hub-row-diff`, `.agent-hub-diff-add` /
  `.agent-hub-diff-del` (semantic green/red).
- Row class `.has-diff` when a summary exists.

### Customizations footer (expanded hub)

When the hub is **expanded**, the shared **Agent Customizations** menu
(`.agent-custom`) is pinned to the bottom of `.agent-hub-list`, below the scrollable
status groups — same placement as Agent Mode's agents column (feature **036**).

| Piece | Role |
|---|---|
| `.agent-hub-list-body` | Scrollable chat groups (`flex: 1`, `overflow-y: auto`) |
| `.agent-custom` | Fixed footer (`flex-shrink: 0`, `margin-top: auto`) |
| `CustomizationsModal` | Opens at the clicked tab; scoped to **active workspace** `root` |

Hidden when the hub is collapsed (44px rail). See **Collapsed rail + hover drawer**
in `064-agent-hub-drawer-and-chat-tab-switch.md`.

### Collapsed rail + hover drawer (2026-07-12)

When **not** pinned expanded (`hubPrefs`), the stack rail is a **44px** strip of
status chips (chat-title initial on project-color square + corner status dot).
**Hover** opens a **240px overlay drawer** (`z-index:80`) over the editor — no
layout reflow. **Chevron** pins the hub at 240px in-flow. Implementation:
`AIChatsRail.tsx` (`useHubPeek`, `.agent-hub-shell`), `App.css`. Full detail:
`064-agent-hub-drawer-and-chat-tab-switch.md`.

### Notifications

`@tauri-apps/plugin-notification` v2 (added to `package.json`, `Cargo.toml`, registered in `lib.rs`, permissions in `capabilities/default.json` incl. `core:window:allow-is-focused`). `notifyAgentEvent` fires OS notification + in-app toast (`src/notify.ts`) + `quack.mp3`. Gated: skipped when the user is already on that chat; deduped to max once per chat per 60s.

### Gotchas

- **Backend stream key = chat-tab `sessionId`** (= `AIChatDescriptor.sessionId`), NOT the Claude session UUID. `claude_code_active_sessions` returns these, matched directly against descriptors. The permission event's `session_id` IS the Claude UUID — resolved to a chat via `loadSessions(wsId).claudeSessionId` (+ cwd→workspace fallback) in the watcher's `resolveChat`.
- **Editor mode mounts all open workspaces' shells** (hidden via `display:none`), so their panels stream in the background; Agent Mode mounts only the active session. The watcher is mount-independent either way — it reads the backend, not the panels.
- **`aiRailExpanded` (per-workspace) + `reorderAIChat` are now dead** — the hub is global (`hubPrefs`) and grouped by status (drag-reorder dropped in v1). Left in the store, harmless.
