---
type: pattern
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [remote-api, axum, rest, authentication, tauri-store]
---

# Pattern: Remote API Architecture

## Context

Quack exposes a REST API on port 6768 for external tools (n8n, Apple Shortcuts, mobile dashboard). The challenge: the HTTP server already existed for legacy terminal hooks (status updates, session creation, telegram webhooks) using `HookState`. The Remote API needs its own state type (`ApiState`) with auth capabilities.

## Architecture

### Layered on existing axum server

The Remote API does not spin up a separate server. It shares the same `TcpListener` on port 6768 via axum's `nest()`:

```rust
// Legacy routes use HookState
let legacy_router = Router::new()
    .route("/terminal/status", post(handle_status_update))
    .route("/session/create", post(handle_create_session))
    // ...
    .with_state(hook_state);    // -> Router<()>

// API routes use ApiState (includes auth)
let api_router = remote_api::create_api_router(app_handle, auth_state);
                                               // -> Router<()> (with_state called inside)

// Combine: legacy at root, API nested under /api
let router = legacy_router.nest("/api", api_router);
```

Key insight: both routers call `.with_state()` before merging, converting them to `Router<()>`. This is required because `nest()` and `merge()` need matching state types.

### Separate state types

| State | Used by | Contains |
|-------|---------|----------|
| `HookState` | `/terminal/*`, `/session/*`, `/proxy`, `/telegram/*` | `AppHandle` |
| `ApiState` | `/api/*` | `AppHandle` + `RemoteAuthState` |

`ApiState` wraps `RemoteAuthState` which holds the Bearer token and enabled flag behind `Arc<RwLock<_>>`.

### Inline auth check (no middleware)

Every `/api/*` handler calls `state.check_auth(&headers).await?` as its first line:

```rust
async fn handle_status(
    headers: HeaderMap,
    State(state): State<ApiState>,
) -> ApiResult<StatusResponse> {
    state.check_auth(&headers).await?;
    // ... handler logic
}
```

We avoided `axum::middleware::from_fn_with_state` because mixing middleware state types with router state types causes silent 404s. See `documentation/gotchas/gotcha-axum-nest-state-types.md`.

### Config persistence via Tauri Store

Remote API settings live in `quack-remote.json` (managed by `tauri-plugin-store`):

```rust
pub struct RemoteConfig {
    pub enabled: bool,           // bind to 0.0.0.0 vs 127.0.0.1
    pub token: Option<String>,   // 32-char hex Bearer token
    pub port: u16,               // default 6768
}
```

- Token is auto-generated on first use (`remote_auth::generate_token()`)
- Config is loaded at startup in `setup()` and pushed into `RemoteAuthState`
- Tauri commands (`set_remote_enabled`, `regenerate_remote_token`) update both the store and the in-memory `RemoteAuthState`

### Conditional network binding

```rust
let bind_addr: [u8; 4] = if remote_cfg.enabled {
    [0, 0, 0, 0]   // LAN-accessible
} else {
    [127, 0, 0, 1] // localhost only
};
```

When `enabled: false`, the server only listens on loopback. Legacy hooks still work locally. When `enabled: true`, the same server becomes LAN-accessible and the `/api/*` routes are protected by Bearer token.

## Files

| File | Role |
|------|------|
| `src-tauri/src/remote_api.rs` | Router, handlers, response types |
| `src-tauri/src/remote_auth.rs` | `RemoteAuthState`, token generation |
| `src-tauri/src/remote_config.rs` | `RemoteConfig`, Tauri Store persistence, Tauri commands |
| `src-tauri/src/lib.rs` | Server setup, `nest("/api", ...)`, bind address logic |

## API Endpoints

All under `/api/`, all require `Authorization: Bearer <token>`:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/status` | App version, uptime, agent/session counts |
| GET | `/api/agents` | List all agents |
| GET | `/api/agents/:id` | Single agent detail |
| GET | `/api/sessions` | List all sessions |
| GET | `/api/sessions/:id` | Single session detail |
| GET | `/api/jobs` | List automation jobs |
| POST | `/api/jobs/:id/fire` | Manually fire an automation job |
| POST | `/api/jobs/:id/toggle` | Toggle job enabled/disabled |
| POST | `/api/execute` | Start a new agent session |

Note: path params use `:id` syntax (axum 0.7). Axum 0.8+ uses `{id}`.
