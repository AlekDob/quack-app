---
type: diary
project: quack-app
date: 2026-03-08
---

- [14:00] (Alek) feat: pattern WebSocket per il modulo remote implementato. Nuovo file `src-tauri/src/remote_ws.rs` con `WsBroadcast` (tokio broadcast channel, capacity 64), enum `WsEvent` tagged con `snake_case` per AgentStatus, SessionCreated, SessionCompleted, JobFired, JobCompleted. Handler `handle_ws_upgrade` autentica via query param `?token=xxx`, poi upgrade a WebSocket. `handle_ws_connection` splitta il socket in send/recv task Tokio e usa `tokio::select!` per gestire disconnect da entrambi i lati. Bridge in `lib.rs`: listener Tauri (`external-terminal-status`, `sessions-updated`, `automation-fire-job`) mappati su `WsBroadcast::send()`. I client mobile ricevono eventi real-time JSON senza polling. KEY INSIGHT: il broadcast channel di Tokio gestisce N client contemporanei con zero lock — ogni connessione riceve il proprio `Receiver` via `subscribe()`.
