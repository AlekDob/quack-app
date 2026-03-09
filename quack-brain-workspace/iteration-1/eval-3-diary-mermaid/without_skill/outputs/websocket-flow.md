---
type: pattern
project: quack-app
created: 2026-03-08
last_verified: 2026-03-08
tags: [websocket, remote, rust, react, mobile]
---

# WebSocket Data Flow — Remote Module

Diagramma del flusso dati: WebSocket client mobile → Rust handler → React state.

```mermaid
flowchart TD
    subgraph MobileClient["Mobile Client (PWA)"]
        WS_CONNECT["new WebSocket(ws://IP:port/ws?token=xxx)"]
        WS_MSG["onmessage: parse JSON event"]
        REACT_STATE["React State Update\n(agents, sessions, jobs)"]
        UI["UI Re-render"]

        WS_CONNECT -->|"HTTP Upgrade"| WS_MSG
        WS_MSG --> REACT_STATE
        REACT_STATE --> UI
    end

    subgraph RustLayer["Rust / Tauri Backend"]
        subgraph AxumRouter["Axum HTTP Router"]
            ROUTE_WS["GET /ws\nhandle_ws_upgrade()"]
            AUTH_CHECK["Validate token\nquery param"]
            UPGRADE["ws.on_upgrade()"]

            ROUTE_WS --> AUTH_CHECK
            AUTH_CHECK -->|"valid"| UPGRADE
            AUTH_CHECK -->|"invalid"| HTTP_401["HTTP 401 Unauthorized"]
        end

        subgraph WsConnection["WS Connection Handler\nhandle_ws_connection()"]
            SPLIT["socket.split()\n→ sender + receiver"]
            SEND_TASK["tokio::spawn\nsend_task\nrx.recv() → sender.send()"]
            RECV_TASK["tokio::spawn\nrecv_task\nhandle Ping / Close"]
            SELECT["tokio::select!\nwait for either task"]

            SPLIT --> SEND_TASK
            SPLIT --> RECV_TASK
            SEND_TASK --> SELECT
            RECV_TASK --> SELECT
        end

        subgraph BroadcastHub["WsBroadcast Hub\n(tokio::broadcast::channel, cap 64)"]
            TX["Sender<WsEvent>"]
            RX["Receiver<WsEvent>\n(per connection)"]

            TX -->|"broadcast"| RX
        end

        subgraph TauriBridge["Tauri Event Bridge (lib.rs)"]
            LISTENER_STATUS["listen('external-terminal-status')"]
            LISTENER_SESSION["listen('sessions-updated')"]
            LISTENER_JOB["listen('automation-fire-job')"]

            LISTENER_STATUS -->|"WsEvent::AgentStatus"| TX
            LISTENER_SESSION -->|"WsEvent::SessionCreated\nWsEvent::SessionCompleted"| TX
            LISTENER_JOB -->|"WsEvent::JobFired"| TX
        end

        subgraph InternalEmitters["Internal Tauri Emitters"]
            HOOK["handle_status_update()\n(hooks.rs)"]
            DAEMON["daemon_stdout_reader()\n(claude_cli.rs)"]
            REMOTE_API["handle_execute()\nhandle_send_message()\n(remote_api.rs)"]

            HOOK -->|"emit('external-terminal-status')"| LISTENER_STATUS
            DAEMON -->|"emit('external-terminal-status')"| LISTENER_STATUS
            REMOTE_API -->|"emit('sessions-updated')"| LISTENER_SESSION
        end

        UPGRADE --> SPLIT
        RX --> SEND_TASK
    end

    subgraph WsEventTypes["WsEvent Enum (serde tag = type)"]
        EV1["agent_status\n{ agentId, status, label? }"]
        EV2["session_created\n{ sessionId, agentId, title }"]
        EV3["session_completed\n{ sessionId, status }"]
        EV4["job_fired\n{ jobId, jobName }"]
        EV5["job_completed\n{ jobId, status }"]
    end

    TX -.->|"serialized as"| WsEventTypes
    SEND_TASK -->|"Message::Text(json)"| WS_MSG
```

## Note architetturali

- `WsBroadcast` wrappa un `tokio::broadcast::Sender<WsEvent>` — ogni chiamata `.subscribe()` crea un nuovo `Receiver` indipendente. N client possono connettersi senza lock.
- Il bridge in `lib.rs` usa `app.listen()` (Tauri) per trasformare eventi interni in messaggi WebSocket. Questo disaccoppia completamente la logica business dal layer di trasporto.
- L'autenticazione avviene prima dell'upgrade HTTP, tramite query param `?token=`. Dopo l'upgrade non c'è modo di rifiutare la connessione senza chiuderla.
- I task `send_task` e `recv_task` girano in parallelo; `tokio::select!` garantisce cleanup immediato su disconnect.
- Gli eventi sono serializzati con `serde_json` usando `#[serde(tag = "type", rename_all = "snake_case")]` — il campo `type` discrimina il tipo di evento sul client.
