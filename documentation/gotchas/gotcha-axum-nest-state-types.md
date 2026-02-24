---
type: gotcha
project: quack-app
created: 2026-02-24
last_verified: 2026-02-24
tags: [axum, routing, state, middleware, 404]
---

# Gotcha: axum nest() with different State types causes silent 404

## Symptom

All `/api/*` routes return 404 (Not Found) with no error logs. The routes are correctly defined and the server starts without errors. Requests to legacy routes (e.g. `/terminal/status`) work fine.

## Root Cause

When using `axum::Router::nest()` to combine routers that have **different State types**, both routers must call `.with_state()` first to erase their state into `Router<()>`. If either router still carries a concrete state type, the merge silently fails and routes don't match.

### The dangerous pattern: middleware with wrong state type

Using `from_fn_with_state` with `ApiState` on a router that gets nested into a `Router<HookState>` causes the same 404:

```rust
// DON'T DO THIS -- middleware state conflicts with parent router state
let api_router = Router::new()
    .route("/status", get(handle_status))
    .layer(axum::middleware::from_fn_with_state(
        api_state.clone(),    // ApiState
        require_auth,
    ))
    .with_state(api_state);   // -> Router<()>

// This nest() may compile but routes silently fail
let router = legacy_router.nest("/api", api_router);
```

The `from_fn_with_state` layer captures a different state type than what the parent expects. Axum's type system sometimes lets this compile but the route matching breaks at runtime.

## Fix: Inline auth checks

Instead of middleware, call auth directly in each handler:

```rust
async fn handle_status(
    headers: HeaderMap,
    State(state): State<ApiState>,
) -> ApiResult<StatusResponse> {
    state.check_auth(&headers).await?;  // inline auth
    // ... rest of handler
}
```

And ensure both routers call `.with_state()` before combining:

```rust
let legacy_router = Router::new()
    .route("/terminal/status", post(handle_status_update))
    .with_state(hook_state);        // -> Router<()>

let api_router = create_api_router(app, auth);  // calls .with_state() internally -> Router<()>

let router = legacy_router.nest("/api", api_router);  // Router<()> + Router<()> = OK
```

## Bonus gotcha: axum path param syntax

Axum **0.7** (which Quack uses) requires colon syntax for path parameters:

```rust
.route("/agents/:id", get(handle_get_agent))   // axum 0.7 ✅
.route("/agents/{id}", get(handle_get_agent))   // axum 0.8+ only ❌
```

Using `{id}` in axum 0.7 compiles but the route never matches -- another silent 404.

## Trigger

You'll hit this when:
- Adding authenticated routes alongside unauthenticated ones
- Nesting routers with different state types
- Upgrading axum versions and forgetting to update path param syntax

## References

- `src-tauri/src/remote_api.rs` — `create_api_router()` uses `.with_state()` and inline auth
- `src-tauri/src/lib.rs` — `nest("/api", api_router)` combining both routers
- `documentation/patterns/pattern-remote-api-architecture.md` — full architecture overview
