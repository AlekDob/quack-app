---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-06-28
tags: [agent-hub, agent-status, sessions, notifications, cross-project, workspace-colors, watcher, mount-asymmetry]
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
| Done | `done` | manual (right-click) | neutral dim |

`archived` chats (manual) are filtered out of the hub entirely. **"Ready" is the resting baseline** — there is no separate "idle" group; a chat that isn't actively running, blocked, or marked done is Ready (waiting for the user). Priority on collision: archived → error → needs-input → working → done → ready (`resolveDisplayStatus`).

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
| OS notification + toast + quack sound (60s dedup, focus gate) | `src/notifications.ts` |
| View prefs (expanded, collapsed sections) — global | `src/hubPrefs.ts` |
| Shared provider badge (DRY extract) | `src/modelBadge.ts` |
| Backend: live-session list | `src-tauri/src/claude_code.rs` → `claude_code_active_sessions` |
| Backend: permission-resolved event | `src-tauri/src/claude_perm.rs` → `claude_perm_decide` emits `claude:permission-resolved` |
| Lifecycle + rename persistence | `src/store.ts` → `AIChatDescriptor.{doneAt,archivedAt,titleLocked}`, `renameAIChat`, `setAIChatLifecycle`, `focusAIChat`, `activeAiChatId` |
| Mount point | `src/App.tsx` (`<AIChatsRail/>` in `.shell-stack`, `<AgentHubWatcher/>`) |
| Sound asset | `public/sounds/quack.mp3` (from quack-app) |

### Right-click lifecycle

Context menu on a row (`HubContextMenu`, clones `WorkspaceColorPopover`): **Rinomina** (inline input, sets `titleLocked` so the auto-title effect in `AIChatPanel` stops overwriting it), **Segna come fatto / Riapri** (toggles `doneAt`), **Archivia** (sets `archivedAt`, hides). Persisted on the descriptor in per-workspace `state.json`.

### Notifications

`@tauri-apps/plugin-notification` v2 (added to `package.json`, `Cargo.toml`, registered in `lib.rs`, permissions in `capabilities/default.json` incl. `core:window:allow-is-focused`). `notifyAgentEvent` fires OS notification + in-app toast (`src/notify.ts`) + `quack.mp3`. Gated: skipped when the user is already on that chat; deduped to max once per chat per 60s.

### Gotchas

- **Backend stream key = chat-tab `sessionId`** (= `AIChatDescriptor.sessionId`), NOT the Claude session UUID. `claude_code_active_sessions` returns these, matched directly against descriptors. The permission event's `session_id` IS the Claude UUID — resolved to a chat via `loadSessions(wsId).claudeSessionId` (+ cwd→workspace fallback) in the watcher's `resolveChat`.
- **Editor mode mounts all open workspaces' shells** (hidden via `display:none`), so their panels stream in the background; Agent Mode mounts only the active session. The watcher is mount-independent either way — it reads the backend, not the panels.
- **`aiRailExpanded` (per-workspace) + `reorderAIChat` are now dead** — the hub is global (`hubPrefs`) and grouped by status (drag-reorder dropped in v1). Left in the store, harmless.
