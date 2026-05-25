---
type: bug-fix
project: quack-app
created: 2026-04-07
last_verified: 2026-05-18
tags: [rust, mutex, panic, tokio, crash, concurrency, panic-abort, dsym, sleep-wake]
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

## Hardening implemented (2026-05-18, v0.9.3)

Trigger: nuovo crash report `abort()` su `tokio-runtime-worker` ~13 min dopo il
risveglio dallo sleep (uptime 39h). Mutex poisoning già sanato (zero
`.lock().unwrap()` rimasti) → era un panic NUOVO, ma `panic = "abort"` lo
amplificava a kill dell'intero processo.

1. **`Cargo.toml [profile.release]`: `panic = "abort"` → `panic = "unwind"`.**
   Ora un panic in un task tokio uccide SOLO quel task; runtime e app
   sopravvivono (isolamento per-task nativo di tokio). Conseguenza chiave:
   **con `abort` `std::panic::catch_unwind` NON funzionava** (niente unwinding da
   intercettare) — ora il hardening #2 è finalmente efficace.
2. **Panic hook diagnostico** (`lib.rs` `install_panic_hook()`, chiamato come
   prima riga di `run()`). Logga timestamp + thread + `location()` (file:line) +
   payload + backtrace su stderr e su `~/Library/Application Support/quack/panic.log`.
   Necessario perché `tauri_plugin_log` è registrato solo in `cfg!(debug_assertions)`:
   in release NON c'è sink di log.
3. **Simbolicazione**: `strip = true` mantenuto (binario distribuito piccolo) ma
   aggiunti `debug = 1` + `split-debuginfo = "packed"` → su macOS genera
   `target/release/app.dSYM`. **Processo di release: archiviare il `.dSYM` per
   ogni versione** così i crash report degli utenti diventano simbolicabili.

## Future hardening (still open)
- Aggiungere `catch_unwind` / supervisione esplicita attorno agli spawn dei task
  long-lived (scheduler cron, WebSocket/Telegram reconnect) per restart automatico
  invece di task morto silenzioso — ora possibile grazie a #1.
- Valutare `parking_lot::Mutex` (non avvelena affatto).
- Identificare il panic-site originale del crash 0.9.3 alla prossima ricorrenza
  via `panic.log` (location file:line ora catturata).
