//! WebSocket Real-Time Push
//!
//! Broadcasts live events (agent status, session updates, job firings)
//! to connected mobile/external clients via `/ws?token=xxx`.

use std::sync::Arc;

use axum::{
    extract::{Query, State, WebSocketUpgrade},
    extract::ws::{Message, WebSocket},
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

use crate::remote_auth::RemoteAuthState;

// ─── Broadcast Hub ──────────────────────────────────────────────

/// Shared broadcast channel for pushing events to all connected WS clients.
/// Cloned into the axum state; senders live in lib.rs event listeners.
#[derive(Clone)]
pub struct WsBroadcast {
    tx: broadcast::Sender<WsEvent>,
}

impl WsBroadcast {
    pub fn new(capacity: usize) -> Self {
        let (tx, _) = broadcast::channel(capacity);
        Self { tx }
    }

    /// Send an event to all connected clients.
    /// Silently drops if no receivers are listening.
    pub fn send(&self, event: WsEvent) {
        let _ = self.tx.send(event);
    }

    /// Get a new receiver for consuming events.
    pub fn subscribe(&self) -> broadcast::Receiver<WsEvent> {
        self.tx.subscribe()
    }
}

// ─── Event Types ────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum WsEvent {
    AgentStatus {
        #[serde(rename = "agentId")]
        agent_id: String,
        status: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        label: Option<String>,
    },
    SessionCreated {
        #[serde(rename = "sessionId")]
        session_id: String,
        #[serde(rename = "agentId")]
        agent_id: String,
        title: String,
    },
    SessionCompleted {
        #[serde(rename = "sessionId")]
        session_id: String,
        status: String,
    },
    JobFired {
        #[serde(rename = "jobId")]
        job_id: String,
        #[serde(rename = "jobName")]
        job_name: String,
    },
    JobCompleted {
        #[serde(rename = "jobId")]
        job_id: String,
        status: String,
    },
}

// ─── WebSocket State ────────────────────────────────────────────

#[derive(Clone)]
pub struct WsState {
    pub auth: RemoteAuthState,
    pub broadcast: WsBroadcast,
}

#[derive(Deserialize)]
pub struct WsQuery {
    token: Option<String>,
}

// ─── Handler ────────────────────────────────────────────────────

/// WebSocket upgrade handler at `GET /ws?token=xxx`.
/// Validates Bearer token from query param before upgrading.
pub async fn handle_ws_upgrade(
    State(state): State<WsState>,
    Query(query): Query<WsQuery>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    // Auth: validate token from query string
    let expected = state.auth.get_token().await;
    let valid = match (query.token.as_deref(), expected.as_deref()) {
        (Some(provided), Some(expected_token)) => provided == expected_token,
        _ => false,
    };

    if !valid {
        return axum::http::Response::builder()
            .status(401)
            .body(axum::body::Body::from("Unauthorized"))
            .unwrap()
            .into_response();
    }

    ws.on_upgrade(move |socket| handle_ws_connection(socket, state))
}

/// Handle a single WebSocket connection.
/// Subscribes to broadcast channel and forwards events as JSON.
/// Responds to client pings. Disconnects on error or client close.
async fn handle_ws_connection(socket: WebSocket, state: WsState) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.broadcast.subscribe();

    log::info!("🌐 [WS] Client connected");

    // Spawn task to forward broadcast events to this client
    let send_task = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let json = match serde_json::to_string(&event) {
                Ok(j) => j,
                Err(_) => continue,
            };
            if sender.send(Message::Text(json)).await.is_err() {
                break; // Client disconnected
            }
        }
    });

    // Read loop: handle client messages (ping/pong, close)
    let recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Close(_) => break,
                Message::Ping(_) => { /* axum auto-responds with pong */ }
                _ => { /* Ignore other messages from client */ }
            }
        }
    });

    // Wait for either task to finish (client disconnect or error)
    tokio::select! {
        _ = send_task => {},
        _ = recv_task => {},
    }

    log::info!("🌐 [WS] Client disconnected");
}
