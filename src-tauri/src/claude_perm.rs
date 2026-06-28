//! Localhost HTTP endpoint that the Claude Code CLI's `PreToolUse`
//! hook calls to request permission for each tool invocation. The hook
//! POSTs the tool call as JSON; we forward it to the frontend as a
//! Tauri event, wait synchronously for the user's decision (allow /
//! deny), then return the matching exit-code semantics so Claude Code
//! continues or blocks the call.
//!
//! Why HTTP and not Tauri IPC?
//!   - The hook command in `.claude/settings.local.json` is a shell
//!     command, not a JS callback. It needs to talk to *something*
//!     reachable from a child process spawned by claude.
//!   - HTTP is the only mechanism that works identically on Windows /
//!     macOS / Linux without shipping a sidecar binary.
//!   - We use `tiny_http` (sync, no async runtime) so the request
//!     thread can simply `block_on` a channel response.
//!
//! Why a fixed port?
//!   - The settings.local.json hook URL bakes in the port. Random
//!     ports would force us to rewrite the file every app launch.
//!   - We pick 14272 as a unlikely-to-collide default. If it's taken,
//!     we fall back to a random port and rewrite settings on each
//!     workspace open.

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};
use tiny_http::{Method, Response, Server};
use uuid::Uuid;

const DEFAULT_PORT: u16 = 14272;

/// How long the HTTP handler waits for the user's decision before
/// giving up and defaulting to Deny. Kept under Claude Code's own
/// hook timeout (60s default) so we always respond before the CLI
/// kills the hook process — otherwise a slow user click would
/// produce an orphaned card the user clicks Allow on but no agent
/// is listening anymore.
const DECISION_TIMEOUT: Duration = Duration::from_secs(50);

/// User decision on a permission request. The HTTP server translates
/// these to the exit-code semantics Claude Code expects from a hook:
///   - Allow → exit 0 (let the tool run)
///   - Deny  → exit 2 (block the tool, agent treats as a failure)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum PermDecision {
    Allow,
    Deny,
}

/// In-flight permission requests: request_id -> reply channel sender.
/// Each pending HTTP handler thread parks on its receiver waiting for
/// the frontend to POST back via `claude_perm_decide`. The optional
/// string is a deny reason surfaced to the MODEL via the hook's
/// permissionDecisionReason — e.g. "ask the user in plain text" for
/// AskUserQuestion redirects.
type PendingMap =
    Arc<Mutex<HashMap<String, mpsc::Sender<(PermDecision, Option<String>)>>>>;

#[derive(Default)]
pub struct PermState {
    pub port: Mutex<Option<u16>>,
    pub pending: PendingMap,
    /// Per-startup random secret. The hook URL we install in
    /// settings.local.json includes this as a query param; requests
    /// without a matching token are rejected. Closes the drive-by
    /// hole — without it, any local process (or a malicious webpage
    /// abusing simple-content-type CORS) could spam fake permission
    /// cards just by knowing the port.
    pub auth_token: Mutex<Option<String>>,
}

/// Payload emitted to the frontend when a hook requests permission.
/// The frontend renders a card and eventually calls back via
/// `claude_perm_decide(request_id, decision)`.
#[derive(Serialize, Clone)]
pub struct PermissionRequest {
    pub request_id: String,
    /// Tool name as Claude Code knows it (Edit, Bash, Read, etc.).
    pub tool_name: String,
    /// Tool input as raw JSON — frontend renders tool-specific UX.
    pub tool_input: serde_json::Value,
    /// Workspace cwd Claude Code is operating in. Lets the frontend
    /// route the card to the right open AI chat panel when multiple
    /// workspaces are open simultaneously.
    pub cwd: Option<String>,
    /// Session id from the stream — pairs the request with whichever
    /// chat panel is currently driving that session.
    pub session_id: Option<String>,
}

/// Spawn the permission-callback HTTP server. Idempotent — if the
/// server is already running (port set in state), this is a no-op.
/// Tries the fixed default port first; if that's taken, takes a random
/// free one and we rewrite settings.local.json per workspace.
pub fn start_server(app: AppHandle) -> Result<u16, String> {
    if let Some(state) = app.try_state::<PermState>() {
        if let Some(port) = *state.port.lock() {
            return Ok(port);
        }
        let server = match Server::http(format!("127.0.0.1:{}", DEFAULT_PORT)) {
            Ok(s) => s,
            Err(_) => Server::http("127.0.0.1:0")
                .map_err(|e| format!("failed to bind permission server: {}", e))?,
        };
        let actual_port = server
            .server_addr()
            .to_ip()
            .map(|s| s.port())
            .ok_or_else(|| "no port from bound server".to_string())?;
        *state.port.lock() = Some(actual_port);

        // Mint a per-startup token so only our auto-installed hook
        // (which knows the token because we build the URL ourselves)
        // can submit permission requests. UUID is fine for this —
        // we just need 128 bits of unguessability, not crypto.
        let token = Uuid::new_v4().to_string();
        *state.auth_token.lock() = Some(token.clone());

        let pending = Arc::clone(&state.pending);
        let app_handle = app.clone();
        // Spawn one thread per request so a slow user decision (up
        // to DECISION_TIMEOUT) doesn't block other parallel tool
        // calls. handle_request mostly just blocks on a channel,
        // so threads are cheap.
        thread::spawn(move || {
            for request in server.incoming_requests() {
                let app_h = app_handle.clone();
                let pending_h = Arc::clone(&pending);
                let token_h = token.clone();
                thread::spawn(move || {
                    handle_request(request, &app_h, &pending_h, &token_h);
                });
            }
        });
        Ok(actual_port)
    } else {
        Err("permission state not registered with app".to_string())
    }
}

fn handle_request(
    mut request: tiny_http::Request,
    app: &AppHandle,
    pending: &PendingMap,
    expected_token: &str,
) {
    if request.method() != &Method::Post {
        let _ = request.respond(Response::from_string("expected POST").with_status_code(405));
        return;
    }
    // Reject anything that doesn't carry our per-startup token.
    // Token is in the URL query (matches the hook URL we generate
    // in claude_code.rs::build_hook_command).
    let url = request.url().to_string();
    if !url_has_token(&url, expected_token) {
        let _ = request.respond(
            Response::from_string("forbidden").with_status_code(403),
        );
        return;
    }

    // The hook command POSTs the tool call as JSON on stdin →
    // curl forwards it as the request body. Shape per Claude Code's
    // PreToolUse hook contract:
    //   {
    //     "session_id": "...",
    //     "transcript_path": "...",
    //     "cwd": "...",
    //     "hook_event_name": "PreToolUse",
    //     "tool_name": "Edit",
    //     "tool_input": { ... }
    //   }
    let mut body = String::new();
    if request.as_reader().read_to_string(&mut body).is_err() {
        let _ = request.respond(Response::from_string("bad body").with_status_code(400));
        return;
    }
    let payload: serde_json::Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(_) => {
            // Default-allow on malformed payloads — better to let the
            // agent run than to block all tools because of a parse
            // failure on our end.
            let _ = request.respond(Response::from_string("ok").with_status_code(200));
            return;
        }
    };

    let request_id = Uuid::new_v4().to_string();
    let tool_name = payload
        .get("tool_name")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let tool_input = payload
        .get("tool_input")
        .cloned()
        .unwrap_or(serde_json::Value::Null);
    let cwd = payload
        .get("cwd")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let session_id = payload
        .get("session_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Set up the reply channel BEFORE emitting the event so we can't
    // miss a fast frontend response.
    let (tx, rx) = mpsc::channel::<(PermDecision, Option<String>)>();
    pending.lock().insert(request_id.clone(), tx);

    let req_for_frontend = PermissionRequest {
        request_id: request_id.clone(),
        tool_name,
        tool_input,
        cwd,
        session_id,
    };
    let _ = app.emit("claude:permission-request", &req_for_frontend);

    // Block waiting for the user's decision. Capped at
    // DECISION_TIMEOUT (50s) so we always respond before Claude
    // Code's 60s hook timeout kills the curl process; otherwise a
    // late user click would land on a card whose request is gone.
    let recv_result = rx.recv_timeout(DECISION_TIMEOUT);
    let (decision, reason) = match recv_result {
        Ok(d) => d,
        Err(_) => {
            // Timed out — the hook process is about to die (or has).
            // Tell the frontend to drop this card so the user doesn't
            // see a ghost waiting for their click.
            let _ = app.emit("claude:permission-cancelled", &request_id);
            (PermDecision::Deny, None)
        }
    };

    // Clean up the pending entry.
    pending.lock().remove(&request_id);

    // Body protocol the hook script parses: "0" = allow, "2" = deny,
    // "2:<reason>" = deny with a permissionDecisionReason the model
    // reads. Reasons are flattened to one line — the script splits on
    // the first ':' only.
    let body = match decision {
        PermDecision::Allow => "0".to_string(),
        PermDecision::Deny => match reason {
            Some(r) => format!("2:{}", r.replace('\n', " ")),
            None => "2".to_string(),
        },
    };
    let _ = request.respond(
        Response::from_string(body)
            .with_status_code(200)
            .with_header(
                tiny_http::Header::from_bytes(
                    &b"content-type"[..],
                    &b"text/plain; charset=utf-8"[..],
                )
                .unwrap(),
            ),
    );
}

/// Frontend → backend: report the user's decision for a pending
/// request. Wakes the HTTP handler thread that's blocked on the
/// matching reply channel.
#[tauri::command]
pub fn claude_perm_decide(
    app: AppHandle,
    state: tauri::State<'_, PermState>,
    request_id: String,
    decision: PermDecision,
    reason: Option<String>,
) -> Result<(), String> {
    if let Some(tx) = state.pending.lock().remove(&request_id) {
        let _ = tx.send((decision, reason));
        // Tell the Agent Hub watcher this request is settled so a chat
        // doesn't linger in "needs-input" — and so auto-allowed tools
        // (resolved within milliseconds) never flash that state at all.
        let _ = app.emit("claude:permission-resolved", &request_id);
        Ok(())
    } else {
        // Already timed out or never existed. Not an error per se —
        // the frontend may race a timeout.
        Ok(())
    }
}

/// Returns the URL the hook command should POST to (including the
/// per-startup auth token in the query string). None if the server
/// hasn't started yet (shouldn't happen in normal use — we start the
/// server during app launch).
#[tauri::command]
pub fn claude_perm_endpoint(state: tauri::State<'_, PermState>) -> Option<String> {
    let port = *state.port.lock();
    let token = state.auth_token.lock().clone();
    match (port, token) {
        (Some(p), Some(t)) => {
            Some(format!("http://127.0.0.1:{}/permission?token={}", p, t))
        }
        _ => None,
    }
}

/// Constant-time-ish check for the per-startup auth token in the
/// URL query. Tiny_http gives us the raw URL string; we just look
/// for "token=<expected>" so we don't pull in a URL parser dep.
fn url_has_token(url: &str, expected: &str) -> bool {
    let q = match url.find('?') {
        Some(i) => &url[i + 1..],
        None => return false,
    };
    for pair in q.split('&') {
        if let Some(rest) = pair.strip_prefix("token=") {
            // length-equality check first to avoid early-exit timing
            // skew. Not strictly constant-time; tiny_http's tolerance
            // makes a precise CT comparison overkill here.
            if rest.len() == expected.len()
                && rest.bytes().zip(expected.bytes()).all(|(a, b)| a == b)
            {
                return true;
            }
        }
    }
    false
}
