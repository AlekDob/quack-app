---
type: decision
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [remote-api, mobile, axum, dashboard, nami, external-tools]
---

# Quack Remote API + Mobile Dashboard

## Context

Quack already runs an **axum HTTP server** on `127.0.0.1:6768` inside the Tauri process (`lib.rs:822-852`). It currently serves:
- `POST /terminal/status` — external hook status updates
- `POST /session/create` — create session from external source (WhatsApp)
- `POST /session/message` — add message to session
- `POST /session/start-chat` — auto-start a chat session
- `GET /proxy` — CORS proxy
- Telegram webhook routes

**Goal**: Extend this server into a full Remote API that:
1. External tools (nami, n8n, Shortcuts, etc.) can call to control Quack agents
2. A responsive mobile web dashboard can use to monitor and control agents from iPhone/Android
3. Supports real-time updates via WebSocket

## Architecture

```
iPhone/Android Browser ──── WiFi/LAN ────┐
                                          │
nami / n8n / Shortcuts ── HTTP POST ──────┤
                                          ▼
                                  ┌──────────────┐
                                  │  axum server  │
                                  │  :6768        │
                                  │  (inside      │
                                  │   Tauri)      │
                                  └──────┬───────┘
                                         │ emit()
                                         ▼
                                  ┌──────────────┐
                                  │  React UI    │
                                  │  (main       │
                                  │   window)    │
                                  └──────────────┘
```

## Key Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Server | Extend existing axum on :6768 | Already running, no new dependencies |
| Binding | `0.0.0.0:6768` (LAN) instead of `127.0.0.1` | Mobile needs LAN access |
| Auth | Bearer token (generated on first launch, shown in Settings) | Simple, sufficient for LAN |
| Mobile UI | Served by axum itself (static HTML/JS/CSS) | No separate build step, works offline |
| Real-time | WebSocket on `/ws` | Already have `tokio-tungstenite` in Cargo.toml |
| Mobile framework | Vanilla HTML + minimal JS (or Preact ~3KB) | Keep it lightweight, no build tooling |
| QR Code | Generate in Settings page → scan from phone | Encodes `http://{local-ip}:6768?token=xxx` |

## Security

- **Auth token**: 32-char random hex, generated once, stored in Tauri Store (`quack-remote.json`)
- **All API routes** require `Authorization: Bearer {token}` header
- **WebSocket** auth: token as query param on connect (`/ws?token=xxx`)
- **LAN only**: No internet exposure, no HTTPS needed (local network)
- **Settings toggle**: "Enable Remote API" (default: OFF) — only binds to 0.0.0.0 when enabled
- When disabled, keeps `127.0.0.1` binding (local-only, for nami/n8n)

---

## Phase 1: REST API Extension (~4h)

### Goal
Complete REST API for agents, sessions, jobs, and remote execution.

### New Endpoints

```
GET  /api/status                  → { version, uptime, agentCount, activeSessionCount }
GET  /api/agents                  → list all agents with status
GET  /api/agents/:id              → agent details + recent sessions
GET  /api/agents/:id/sessions     → sessions for agent
POST /api/sessions                → create session (extends existing /session/create)
GET  /api/sessions                → list all sessions
GET  /api/sessions/:id            → session details + messages
POST /api/sessions/:id/message    → send message to session (extends /session/message)
POST /api/sessions/:id/start      → start/resume session (extends /session/start-chat)
GET  /api/jobs                    → list automation jobs
POST /api/jobs/:id/fire           → fire automation job immediately
POST /api/jobs/:id/toggle         → enable/disable job
POST /api/execute                 → fire-and-forget: pick agent + prompt → session created
```

### Files to Create

| File | ~Lines | Purpose |
|------|--------|---------|
| `src-tauri/src/remote_api.rs` | ~300 | All /api/* route handlers |
| `src-tauri/src/remote_auth.rs` | ~80 | Token generation, validation, middleware |
| `src-tauri/src/remote_config.rs` | ~60 | Load/save remote config (enabled, token, binding) |

### Files to Modify

| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | `mod remote_api; mod remote_auth; mod remote_config;` + merge routes + conditional `0.0.0.0` binding + register Tauri commands |
| `src-tauri/Cargo.toml` | Add `tower-http = { version = "0.5", features = ["cors"] }` for CORS middleware |
| `src/types.ts` | Add `RemoteApiConfig` type |

### Implementation Notes

- Route handlers read from `quack-agents.json` and `quack-automations.json` directly (same as existing `handle_create_session`)
- `POST /api/execute` is the "nami endpoint": takes `{ agent_id, prompt, project_path? }`, creates session, emits event to frontend → frontend calls `sendMessageForTargetAgent`
- Auth middleware: `tower` layer that checks `Authorization: Bearer {token}` on all `/api/*` routes
- Existing routes (`/terminal/status`, `/session/*`, `/telegram/*`) remain unchanged (no auth, backward compat)

---

## Phase 2: WebSocket Real-Time (~3h)

### Goal
Push live updates to mobile dashboard: agent status changes, session progress, new messages.

### Endpoint

```
GET /ws?token=xxx → WebSocket upgrade
```

### Event Types (server → client)

```json
{ "type": "agent_status", "agentId": "...", "status": "busy|idle" }
{ "type": "session_created", "sessionId": "...", "agentId": "...", "title": "..." }
{ "type": "session_message", "sessionId": "...", "role": "assistant|user", "text": "..." }
{ "type": "session_completed", "sessionId": "...", "status": "success|failed" }
{ "type": "job_fired", "jobId": "...", "jobName": "..." }
{ "type": "job_completed", "jobId": "...", "status": "success|failed" }
```

### Files to Create

| File | ~Lines | Purpose |
|------|--------|---------|
| `src-tauri/src/remote_ws.rs` | ~150 | WebSocket handler, broadcast to all connected clients |

### Files to Modify

| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | Add WS route, manage WebSocket broadcast state |
| `src-tauri/src/remote_api.rs` | Emit to WS clients when sessions/jobs change |

### Implementation Notes

- Use `tokio::sync::broadcast` channel for fan-out to all connected mobile clients
- Hook into existing Tauri events (`external-terminal-status`, `sessions-updated`, `automation-scheduler-tick`) to bridge them to WS
- Frontend (React) doesn't need changes — WS is for mobile clients only
- Max 5 concurrent WS connections (LAN, not a public server)

---

## Phase 3: Mobile Dashboard (~6h)

### Goal
Responsive web dashboard served by axum, accessible from phone browser.

### Pages

| Route | Content |
|-------|---------|
| `/` | Dashboard: agent cards with status badges, quick-fire buttons |
| `/agents/:id` | Agent detail: sessions list, start new session |
| `/sessions/:id` | Session detail: message history (read-only), status |
| `/jobs` | Automation jobs: list, toggle, fire, next run time |
| `/execute` | Quick execute: pick agent → write prompt → fire |

### Tech Stack

- **HTML/CSS/JS**: Single-page app served as static files by axum
- **No build step**: Raw JS with ES modules, or Preact via CDN
- **CSS**: Minimal, mobile-first, dark theme matching Quack palette
- **Real-time**: WebSocket connection for live status updates
- **PWA**: Add manifest.json for "Add to Home Screen" on iOS/Android

### Files to Create

| File | ~Lines | Purpose |
|------|--------|---------|
| `src-tauri/static/index.html` | ~100 | SPA shell with nav |
| `src-tauri/static/app.js` | ~400 | Router + components + API client + WS |
| `src-tauri/static/style.css` | ~300 | Mobile-first dark theme |
| `src-tauri/static/manifest.json` | ~20 | PWA manifest |
| `src-tauri/static/icons/` | — | PWA icons (duck logo) |

### Files to Modify

| File | Change |
|------|--------|
| `src-tauri/src/lib.rs` | Serve static files from `static/` dir via axum |
| `src-tauri/tauri.conf.json` | Include `static/` in bundle resources |

### Mobile UI Mockup

```
┌─────────────────────────┐
│  🦆 Quack Remote        │
│  ─────────────────────  │
│                         │
│  ● Agent Leo      BUSY  │
│    quack-app             │
│    [Send Prompt]         │
│                         │
│  ○ Agent Max      IDLE  │
│    flow-app              │
│    [Send Prompt]         │
│                         │
│  ─── Automation ───      │
│  ✓ Reddit Digest  09:00 │
│    [Fire Now]            │
│                         │
│  ─── Quick Execute ───   │
│  [Pick Agent ▼]          │
│  [Enter prompt...]       │
│  [🚀 Execute]            │
│                         │
└─────────────────────────┘
```

---

## Phase 4: Settings Integration (~2h)

### Goal
Settings UI in Quack desktop to enable/disable Remote API, show token, generate QR code.

### New Settings Section: "Remote API"

- Toggle: "Enable Remote API" (binds to 0.0.0.0 vs 127.0.0.1)
- Display: Auth token (copyable, regenerable)
- QR Code: Encodes `http://{local-ip}:6768/dashboard?token=xxx`
- Connected clients: list of currently connected mobile devices
- Port: configurable (default 6768)

### Files to Create

| File | ~Lines | Purpose |
|------|--------|---------|
| `src/components/settings/categories/RemoteApiSettings.tsx` | ~150 | Settings UI |
| `src/services/remoteApiService.ts` | ~40 | API calls to manage remote config |

### Files to Modify

| File | Change |
|------|--------|
| `src/components/settings/SettingsDrawer.tsx` | Add "Remote API" category |
| `src/types.ts` | Add RemoteApiConfig to settings types |

### Dependencies

- QR code: `qrcode` npm package (or generate server-side in Rust with `qrcode` crate)

---

## Phase 5: External Tool Integration (~2h)

### Goal
Document and provide examples for external tools to use the API.

### nami Integration Example

```bash
# From nami (or any tool)
curl -X POST http://192.168.1.100:6768/api/execute \
  -H "Authorization: Bearer abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "agent_id": "agent-leo-123",
    "prompt": "Review the latest PR and suggest improvements",
    "project_path": "/Users/alekdob/Desktop/Dev/Personal/meow"
  }'
```

### n8n / Apple Shortcuts Integration

- n8n: HTTP Request node → POST to /api/execute
- Apple Shortcuts: "Get Contents of URL" action → same endpoint
- iOS Shortcut widget: one-tap agent execution from home screen

### Files to Create

| File | ~Lines | Purpose |
|------|--------|---------|
| `documentation/guide/remote-api/overview.md` | ~100 | API docs for humans |
| `documentation/guide/remote-api/examples.md` | ~80 | curl, n8n, Shortcuts examples |

---

## Execution Order

```
Phase 1 (REST API)      ████████████  4h   ← START HERE
Phase 2 (WebSocket)     ██████████    3h
Phase 3 (Mobile UI)     ████████████████  6h
Phase 4 (Settings)      ██████        2h
Phase 5 (Docs + Tools)  ██████        2h
                                     ─────
                              Total: ~17h
```

### Phase 1 is self-contained
After Phase 1, nami and any HTTP client can already create sessions and fire jobs. Mobile dashboard comes later but the API is usable immediately.

### Critical Path
Phase 1 → Phase 2 → Phase 3 (sequential)
Phase 4 can be done in parallel with Phase 3.
Phase 5 is independent.

---

## Delegation Recommendation

**Team approach** (3 agents):
1. **Backend agent**: Phase 1 + Phase 2 (Rust, axum, WebSocket)
2. **Frontend agent**: Phase 3 (mobile dashboard HTML/CSS/JS) + Phase 4 (Settings UI)
3. **Docs agent**: Phase 5 (API docs, examples)

Or **sequential single-agent** if preferred — each phase is a clean commit.

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Security: token leaked on LAN | Token rotatable from Settings, disable toggle |
| Port conflict with other apps | Configurable port, fallback scan |
| Mobile Safari quirks | Test on iOS Safari early in Phase 3 |
| Large session message history | Paginate /api/sessions/:id (limit=50) |
| Tauri bundle size increase | Static files are small (~50KB total) |
| axum binding change breaks existing hooks | Keep fallback: if remote disabled, bind 127.0.0.1 as before |
