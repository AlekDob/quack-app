---
type: feature-doc
project: quack-app
stack: Vanilla JS PWA (mobile) + Rust (Axum) + React 18 (desktop hook)
created: 2026-05-25
last_verified: 2026-05-25
tags: [pwa, mobile, task-hub, quack-remote, priority-grouping, websocket, fab, project-color, live-state]
---

## PWA Task Hub (Mobile)
**Purpose:** Mobile-first PWA served at `/dashboard/` from the Quack binary (port `6768`) that mirrors the desktop **Task Hub View** (feature `054`) — 4-priority grouping of active sessions (Needs attention / Working / Agent done / Other) with live WS updates and a FAB to create new conversations from anywhere.
**Stack:** Vanilla JS (zero-build) + Rust Axum backend (WS broadcast + REST) + React 18 desktop hook that mirrors `chatStore` into the backend so the PWA can compute identical priorities.

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Asset | `src-tauri/static/app.js` | Vanilla SPA: `state.tab='taskhub'` default, `computePriority(s)`, `computeTaskHubBadge()`, `renderTaskHub()`/`renderTaskHubSection`/`renderTaskHubItem`, `renderFab()`, `renderNewChatSheet()`/`renderNewChatStep`, `startNewChat`, `patchSession` (in-place WS patcher), `startFallbackPolling`/`stopFallbackPolling`, new WS handlers (`session_streaming`, `pending_question`, `message_added`, `session_updated`), `getProjectColor`. |
| Asset | `src-tauri/static/style.css` | `.taskhub`, `.taskhub-section-header`, `.taskhub-item`, `.project-chip` (uses `--proj` CSS var + `color-mix`), `.fab-new` (top-right safe-area aware), `.new-chat-sheet`, `.nc-*` (3-step picker), `.tab-badge`. |
| Asset | `src-tauri/static/index.html` | Unchanged shell (`<div id="app">` + token injection). All UI rendered by `app.js`. |
| Hook | `src/hooks/useRemoteLiveStateSync.ts` | Watches `useChatStore.chatLoadingMap`, `pendingQuestionsMap`, `chatSessions` + invokes `notify_session_streaming/_pending_question/_message` Tauri commands (debounced 150ms per session). Mounted in `App.tsx`. |
| Service | `src-tauri/src/remote_ws.rs` | 4 new `WsEvent` variants: `SessionStreaming`, `PendingQuestion`, `MessageAdded`, `SessionUpdated`. |
| Service | `src-tauri/src/remote_api.rs` | `SessionLiveEntry`/`SessionLiveStateMap`, enriched `SessionSummary`, 3 notify commands, `handle_project_colors`, `load_repo_colors`/`fallback_color`/`resolve_project_color` helpers, `DEFAULT_PROJECT_COLORS` palette. |
| Config | `src-tauri/src/lib.rs` | Instantiates `SessionLiveStateMap`, `app.manage`-s it, passes to `create_api_router`, registers `notify_*` in `generate_handler!`. |

### Data Flow
```
Desktop chatStore (chatLoadingMap, pendingQuestionsMap, chatSessions)
  → useRemoteLiveStateSync (diff + debounce 150ms)
  → invoke('notify_session_*')
  → Rust SessionLiveStateMap update
  → WsBroadcast.send(WsEvent::SessionStreaming|PendingQuestion|MessageAdded|SessionUpdated)
  → /ws subscribers (PWA)
  → handleWsEvent → patchSession(id, {...}) → render()

PWA load: GET /api/sessions (now includes isStreaming, pendingQuestionCount,
  lastMessageRole/Status, updatedAt, projectColor) + GET /api/project-colors
  → state.sessions / state.projectColors
  → renderTaskHub() groups by computePriority → 4 sections

WS down >10s → startFallbackPolling (5s loadData) → WS reconnect → stop + loadData

FAB '+' → state.newChat = {step:1} → project picker → agent picker
  → prompt+model → POST /api/execute (no leadSessionId)
  → optimistic chat view + startChatPolling + background loadData
```

### Priority Computation (`computePriority`, mirrors `TaskHubView.tsx:151-168`)
| Priority | Label | Condition |
|----------|-------|-----------|
| 1 | Needs attention | `s.pendingQuestionCount > 0` |
| 2 | Working | `s.isStreaming` OR `s.lastMessageStatus === 'streaming'` OR (`s.status === 'in_progress'/'running'` AND not P3) |
| 3 | Agent done | `s.lastMessageRole === 'assistant'` AND (`s.lastMessageStatus === 'complete'` OR `s.lastMessageStatus == null`) |
| 4 | Other | None of the above |

**Badge (`computeTaskHubBadge`)**: `count(P1) + count(P3)`, identical to desktop. Rendered on `Task Hub` tab as `.tab-badge`.

**Sort within priority**: `(updatedAt || createdAt) DESC`. P4 opacity fades from `0.75 → 0.4`.

### Priority Accent Colors
| Priority | Color | CSS var |
|----------|-------|---------|
| 1 | `#a855f7` | purple |
| 2 | `#22c55e` | green |
| 3 | `#f59e0b` | orange |
| 4 | `null` | transparent (border-left) |

### FAB New-Chat Sheet (3 steps)
| Step | UI | Action |
|------|----|--------|
| 1 | List of unique projects (deduped by `projectPath` from agents) with color dot + agent count | Tap → set `projectPath/projectName`, step=2 |
| 2 | List of agents in selected project (avatar + role) | Tap → set `agentId/agentName`, step=3 |
| 3 | Project + agent pills, model select, prompt textarea | Submit → `POST /api/execute` (no `leadSessionId`) → optimistic chat view |

Back button on steps 2-3, overlay/Cancel close. Cmd+Enter on textarea triggers send.

### WS Event Patching
`patchSession(sessionId, patch)` updates `state.sessions[idx]` in place when a matching session is found. If the session isn't loaded yet, falls back to `loadData()` for a full refresh. New event types:

| Event | Patch fields |
|-------|--------------|
| `session_streaming` | `isStreaming` |
| `pending_question` | `pendingQuestionCount` |
| `message_added` | `lastMessageRole`, `lastMessageStatus`, `lastActivityAt`, `updatedAt` (+ polls chat if open) |
| `session_updated` | `updatedAt`, optionally `lastMessageRole/Status` |

### Polling Fallback
- WS `onclose` schedules `startFallbackPolling()` after 10s if still disconnected.
- Fallback timer calls `loadData()` every 5s (skipped if chat view open — it has its own poller).
- WS `onopen` clears the fallback timer and runs a full `loadData()` to catch up.

### Project Color (chip)
- Backend: `GET /api/project-colors` returns `{ projectPath: '#hex' }`. Source: `.quack-repo-order.dat` (`repository-order.colors`) + deterministic 32-bit hash fallback over `DEFAULT_PROJECT_COLORS` (8-color palette, mirrored from `src/utils/projectColors.ts`).
- Frontend: `SessionSummary.projectColor` is the per-session shortcut; `state.projectColors` is the global map.
- PWA chip uses `color-mix(in srgb, var(--proj) 14%, transparent)` background + 35% border + solid text. Lowercase project name, ellipsis, `maxWidth: 100px`.

### Backend → SessionSummary Enrichment
```rust
struct SessionSummary {
  // existing
  id, title, agent_id, status, created_at, message_count?, claude_session_id?,
  // NEW
  updated_at,                        // i64; falls back to created_at if missing
  project_name?, project_path?,      // from quack-agents.json
  project_color?,                    // resolved via /api/project-colors logic
  is_streaming,                      // from SessionLiveStateMap
  pending_question_count,            // ditto
  last_message_role?, last_message_status?,
  last_activity_at?,                 // millis, only when > 0
}
```

### Notify Commands (Rust → frontend desktop)
```rust
notify_session_streaming(session_id, is_streaming, agent_id?)
notify_session_pending_question(session_id, count, agent_id?)
notify_session_message(session_id, role, status?, agent_id?)
```
Each updates `SessionLiveStateMap` (creates entry if missing, refreshes `last_activity_ms`) and broadcasts the corresponding `WsEvent`. `notify_session_message` also broadcasts a `SessionUpdated` so clients refresh their meta.

### Desktop Hook (`useRemoteLiveStateSync`)
- `chatStore.subscribe(computeAndSchedule)` on mount.
- Per session: `Snapshot { isStreaming, pendingCount, lastRole, lastStatus }` cached. Only changed fields fire notify.
- Debounce 150ms per session to coalesce bursty updates.
- Reads `RemoteApiConfig.enabled` every 30s; skip all work when off.
- `agentIdRef` cache keeps `session_id → agent_id` map fresh from `useSessionStore.subscribe`.

### iOS PWA Considerations
- `.fab-new` uses `top: calc(env(safe-area-inset-top) + 14px)` so it sits below the notch.
- Sticky `.taskhub-search-wrap` for sticky search header.
- WS reconnect 3s + fallback polling 5s ensures the badge stays live even on flaky cellular.
- `tab-badge` uses `inline-flex` so it never breaks layout on narrow screens.

### Tests / Verification
1. Enable remote API in Settings → open `/dashboard?token=…` on iPhone (same LAN).
2. Desktop: trigger `AskUserQuestion` in session A → PWA Task Hub shows A under **Needs attention** (purple) within ~200ms.
3. Desktop: long-streaming prompt in session B → PWA shows B under **Working** (green) live.
4. Kill desktop app → PWA dot turns **Offline**, polling starts after 10s. Restart desktop → reconnects within 3s, dot turns **Live**, fresh data via `loadData()`.
5. Tap FAB `+` → select project → select agent → enter prompt → tap Start. Session appears in **Working** within 2s.
6. Search "frontend" → filters sessions by title / projectName / agentLabel.

### Cross-References
- Feature `054-task-hub-view` — desktop counterpart whose priority logic this PWA mirrors 1:1.
- Feature `062-quack-remote` — REST + WS host of this PWA.
- Pattern `pattern-pwa-task-hub-mirror.md` — broader design pattern (backend → live-state → WS → PWA).
- Pattern `pattern-remote-api-architecture.md`
- Gotcha `gotcha-mobile-session-dot-status.md` — agent status source of truth.
- Gotcha `gotcha-remote-dashboard-ip-changes.md`
- Gotcha `gotcha-axum-nest-state-types.md`
- Gotcha `gotcha-tauri-store-dat-files-plain-json.md`
