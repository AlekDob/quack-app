---
type: bug-fix
project: quack-app
created: 2026-04-07
last_verified: 2026-04-07
tags: [rust, mutex, panic, tokio, crash, concurrency]
---

# Fix: Mutex Poisoning Cascade Abort

## Symptom
App crashes after ~9 minutes with ~30 active child processes. Crash report shows `abort()` triggered by a Rust `panic!` on a tokio-runtime-worker thread.

## Root Cause
24 instances of `.lock().unwrap()` on `std::sync::Mutex` across 5 files. When any tokio task panics while holding a Mutex, the Mutex becomes "poisoned". Every subsequent `.lock().unwrap()` on the same Mutex panics, cascading into `abort()`.

## Affected Files & Mutexes

| File | Count | Mutexes |
|------|-------|---------|
| `src-tauri/src/ai.rs` | 7 | SUGGESTION_CACHE, TOKEN_STATS, RATE_LIMITER |
| `src-tauri/src/license.rs` | 10 | LicenseState fields (gumroad_product_id, supabase_url, supabase_key) |
| `src-tauri/src/lib.rs` | 3 | LicenseState initialization |
| `src-tauri/src/preview.rs` | 2 | WEBVIEW_STATE |
| `src-tauri/src/claude_oauth.rs` | 2 | OAUTH_STATE |

## Fix
Replaced all `.lock().unwrap()` with `.lock().unwrap_or_else(|e| e.into_inner())`.

This recovers the inner data from a poisoned Mutex instead of panicking. The data may be in an inconsistent state, but for these use cases (caches, configs, rate limiters, OAuth state) the risk of stale data is negligible vs. crashing the app.

## Why NOT panic on poisoned Mutex here
- SUGGESTION_CACHE: worst case = stale suggestion cache, auto-expires in 1h
- TOKEN_STATS: worst case = slightly wrong token count
- RATE_LIMITER: worst case = one extra API call allowed
- LicenseState: read-only after init, values don't change at runtime
- WEBVIEW_STATE: worst case = stale webview label, gets overwritten on next create
- OAUTH_STATE: worst case = OAuth validation fails, user retries

## Safe patterns already in codebase
- `AGENT_STATUS` (RwLock): uses `if let Ok(...)` -- already safe
- `SESSION_CACHE` (RwLock): uses `.map_err()` -- already safe

## Future hardening (not yet implemented)
1. Build debug builds to get symbolicated crash reports that reveal the ORIGINAL panic
2. Add `catch_unwind` around tokio task spawns to prevent one task's panic from poisoning shared state
3. Consider replacing `std::sync::Mutex` with `parking_lot::Mutex` which doesn't poison at all
