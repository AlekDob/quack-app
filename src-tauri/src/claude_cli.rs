use serde::{Deserialize, Serialize};
use std::{collections::HashMap, fs, path::{Path, PathBuf}, process::Stdio, sync::Arc};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{ChildStdin, Command};
use tokio::sync::Mutex as TokioMutex;
use once_cell::sync::Lazy;
// std::sync::atomic types used via full path (e.g., std::sync::atomic::AtomicBool)

// Windows-specific helper to hide console windows
#[cfg(target_os = "windows")]
fn hide_console_window(cmd: &mut std::process::Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

// =============================================================================
// CLOUD PROVIDER ENV PROPAGATION
// Brain: fix-bedrock-env-vars-gui-launch
// When Quack is launched from Finder (GUI), critical env vars like
// CLAUDE_CODE_USE_BEDROCK, AWS_PROFILE, etc. are missing from the process env.
// This helper propagates them from the cached login-shell environment.
// =============================================================================

/// Cloud provider env vars that must be propagated to SDK child processes.
const CLOUD_PROVIDER_ENV_VARS: &[&str] = &[
    // Bedrock / Vertex toggle
    "CLAUDE_CODE_USE_BEDROCK",
    "CLAUDE_CODE_USE_VERTEX",
    // AWS credentials & config
    "AWS_PROFILE",
    "AWS_REGION",
    "AWS_DEFAULT_REGION",
    "AWS_ACCESS_KEY_ID",
    "AWS_SECRET_ACCESS_KEY",
    "AWS_SESSION_TOKEN",
    "ANTHROPIC_BEDROCK_BASE_URL",
    // GCP / Vertex credentials
    "CLOUD_ML_REGION",
    "ANTHROPIC_VERTEX_PROJECT_ID",
    "GOOGLE_APPLICATION_CREDENTIALS",
];

/// Propagate cloud provider env vars to a child Command.
/// Priority: process env (inherited) > settings.json env > login shell env.
fn propagate_cloud_env(command: &mut Command) {
    let login_env = crate::shell_env::get_login_env();
    // Read env vars from ~/.claude/settings.json (set via Quack Settings toggle)
    let settings_env = crate::hooks::get_claude_env_vars_impl().unwrap_or_default();

    for &var in CLOUD_PROVIDER_ENV_VARS {
        // If already in process env, it's inherited automatically — skip
        if std::env::var(var).is_ok() {
            continue;
        }
        // Settings.json env vars take priority (user explicitly set via UI)
        if let Some(value) = settings_env.get(var) {
            log::info!("[ENV] Propagating {} from settings.json", var);
            command.env(var, value);
            continue;
        }
        // Fallback: login shell env
        if let Some(value) = login_env.get(var) {
            log::info!("[ENV] Propagating {} from login shell", var);
            command.env(var, value);
        }
    }
}

// =============================================================================
// WINDOWS PATH SANITIZATION
// =============================================================================

/// Sanitize a Windows path for Node.js compatibility.
/// Strips the `\\?\` extended-length path prefix that Tauri/Windows APIs produce,
/// because Node.js (especially non-LTS versions like v24/v25) fails to resolve
/// these paths correctly — `Module._findPath` traverses up to bare `C:` (missing `\`)
/// and crashes with `EISDIR: illegal operation on a directory, lstat 'C:'`.
// Brain: fix-nodejs-eisdir-windows-path
#[cfg(target_os = "windows")]
fn sanitize_path_for_node(path: &Path) -> PathBuf {
    let path_str = path.to_string_lossy();
    if path_str.starts_with(r"\\?\") {
        let stripped = &path_str[4..];
        log::debug!("[Path] Stripped \\\\?\\ prefix: {} -> {}", path_str, stripped);
        PathBuf::from(stripped)
    } else {
        path.to_path_buf()
    }
}

#[cfg(not(target_os = "windows"))]
fn sanitize_path_for_node(path: &Path) -> PathBuf {
    path.to_path_buf()
}

/// Sanitize a Windows path string (for cwd passed as JSON config value).
#[cfg(target_os = "windows")]
fn sanitize_path_string_for_node(path: &str) -> String {
    if path.starts_with(r"\\?\") {
        let stripped = &path[4..];
        log::debug!("[Path] Stripped \\\\?\\ prefix from string: {} -> {}", path, stripped);
        stripped.to_string()
    } else {
        path.to_string()
    }
}

#[cfg(not(target_os = "windows"))]
fn sanitize_path_string_for_node(path: &str) -> String {
    path.to_string()
}

// =============================================================================
// CHILD PROCESS MANAGEMENT (for abort/kill support)
// =============================================================================

/// Store running child processes (stdin/stdout/stderr already taken) for abort/kill support
/// Key: event_session_key, Value: Child handle
static RUNNING_CHILD_PROCESSES: Lazy<TokioMutex<HashMap<String, tokio::process::Child>>> =
    Lazy::new(|| TokioMutex::new(HashMap::new()));

// =============================================================================
// PERSISTENT DAEMON MODE
// Brain: persistent-daemon-architecture
// Instead of spawning a new Node.js process per message (20+ sec overhead),
// keep a single long-lived daemon that handles queries via stdin/stdout IPC.
//
// Lock ordering (to prevent deadlocks):
//   1. DAEMON_PROCESS
//   2. DAEMON_QUERIES
//   3. DAEMON_QUERY_RESULTS
//   4. DAEMON_READY_TX
// Never acquire a lower-numbered lock while holding a higher-numbered one.
// =============================================================================

/// The persistent daemon process (singleton)
static DAEMON_PROCESS: Lazy<TokioMutex<Option<DaemonProcess>>> =
    Lazy::new(|| TokioMutex::new(None));

/// Active daemon queries: queryId → completion channel + metadata
static DAEMON_QUERIES: Lazy<TokioMutex<HashMap<String, DaemonQueryState>>> =
    Lazy::new(|| TokioMutex::new(HashMap::new()));

/// Last Result event per query (captured so we can return usage data on completion)
static DAEMON_QUERY_RESULTS: Lazy<TokioMutex<HashMap<String, ClaudeCliResponse>>> =
    Lazy::new(|| TokioMutex::new(HashMap::new()));


struct DaemonProcess {
    stdin: ChildStdin,
    #[allow(dead_code)]
    child_pid: u32,
    ready: bool,
}

struct DaemonQueryState {
    agent_id: String,
    session_key: String,
    /// Brain: fix-late-render-abort-stale-buffer
    /// Frontend-generated turn ID echoed back in every emitted event.
    turn_id: Option<String>,
    app: AppHandle,
    /// Used to signal the awaiting send_message_via_sdk_streaming call.
    /// Brain: bug-background-task-unsolicited-events
    /// Changed to Option so we can take() it on query_complete while keeping the
    /// entry alive in DAEMON_QUERIES for post-query background task events.
    completion_tx: Option<tokio::sync::oneshot::Sender<Result<ClaudeCliResponse, String>>>,
    /// Pauses the query timeout while the user is reviewing a plan or answering a question
    waiting_for_user: Arc<std::sync::atomic::AtomicBool>,
    /// When Some, the query has completed but we keep the entry to route background task events.
    completed_at: Option<std::time::Instant>,
}

/// Abort a running SDK stream by sending an abort command to the daemon.
#[tauri::command]
pub async fn abort_sdk_stream(session_key: String) -> Result<(), String> {
    let queries = DAEMON_QUERIES.lock().await;
    let matching_query = queries.iter()
        .find(|(_, state)| state.session_key == session_key)
        .map(|(qid, _)| qid.clone());

    if let Some(query_id) = matching_query {
        log::info!("[DAEMON:ABORT] Sending abort for daemon query={} session={}", query_id, session_key);
        let cmd = serde_json::json!({"type": "abort", "queryId": query_id});
        drop(queries);
        return send_to_daemon(&cmd.to_string()).await;
    }

    log::warn!("[SDK] ⚠️ abort_sdk_stream: no daemon query found for session: {}", session_key);
    Ok(())
}

// =============================================================================
// DAEMON LIFECYCLE MANAGEMENT
// =============================================================================

/// Ensure the daemon process is running. If not, spawn it.
async fn ensure_daemon(app: &AppHandle) -> Result<(), String> {
    let mut daemon_guard = DAEMON_PROCESS.lock().await;

    if let Some(ref d) = *daemon_guard {
        if d.ready {
            log::debug!("[DAEMON:LIFECYCLE] Daemon already running and ready (pid={})", d.child_pid);
            return Ok(());
        }
        log::warn!("[DAEMON:LIFECYCLE] Daemon exists but not ready (pid={}) — clearing stale state", d.child_pid);
    }
    // Clear any stale daemon state before spawning
    *daemon_guard = None;

    log::info!("[DAEMON:LIFECYCLE] Spawning persistent Node.js daemon...");

    let script_path = get_node_sdk_script(app, "stream-daemon.js")?;
    log::info!("[DAEMON:LIFECYCLE] Resolved daemon script: {:?}", script_path);
    let node_sdk_dir = script_path.parent()
        .ok_or("Failed to get node-sdk directory")?
        .to_path_buf();

    // Resolve Node.js executable (same logic as send_message_via_sdk_streaming)
    let is_production = !cfg!(debug_assertions);
    let node_path = if is_production {
        let sidecar_name = "node-sidecar";
        let sidecar_path = app.path().resolve(sidecar_name, tauri::path::BaseDirectory::Resource).ok()
            .or_else(|| {
                std::env::current_exe().ok().and_then(|exe| {
                    exe.parent().map(|dir| dir.join(sidecar_name))
                }).filter(|p| p.exists())
            });
        match sidecar_path {
            Some(path) if path.exists() => Some(path),
            _ => find_system_node_executable(),
        }
    } else {
        find_system_node_executable()
    };

    let node_path = node_path.ok_or_else(|| {
        format!("Node.js {} or later is required but was not found.", MIN_NODE_VERSION)
    })?;

    let mut command = Command::new(&node_path);

    // Polyfill for Node < 22
    let node_major = get_node_major_version(&node_path).unwrap_or(0);
    if node_major > 0 && node_major < 22 {
        let polyfill_path = node_sdk_dir.join("disposable-polyfill.cjs");
        if polyfill_path.exists() {
            command.arg("--require").arg(&polyfill_path);
        }
    }

    command
        .arg(&script_path)
        .current_dir(&node_sdk_dir)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Environment setup — authentication
    // Set up provider auth from environment (daemon gets env from process)
    // Individual query auth is handled per-query via env vars set before daemon spawn
    // For now, inherit process env (ANTHROPIC_API_KEY, OAuth, etc.)

    // Use the user's full login-shell PATH as base (captures NVM, Homebrew, etc.
    // even when Quack is launched from Finder with minimal env).
    // Brain: fix-shell-env-gui-launch
    let base_path = crate::shell_env::get_login_path();
    let using_sidecar = node_path.to_string_lossy().contains("node-sidecar");
    if using_sidecar {
        command.env_remove("NVM_DIR");
        command.env_remove("NVM_BIN");
        command.env_remove("NVM_INC");
        command.env_remove("VOLTA_HOME");
        command.env_remove("NODE_PATH");
        let sep = if cfg!(target_os = "windows") { ";" } else { ":" };
        let clean: Vec<&str> = base_path.split(sep)
            .filter(|p| !p.contains(".nvm/") && !p.contains(".volta/"))
            .collect();
        command.env("PATH", clean.join(sep));
    } else if let Some(node_dir) = node_path.parent() {
        let sep = if cfg!(target_os = "windows") { ";" } else { ":" };
        command.env("PATH", format!("{}{}{}", node_dir.to_string_lossy(), sep, base_path));
    }

    // Propagate cloud provider env vars (Bedrock, Vertex, AWS) from login shell
    // Brain: fix-bedrock-env-vars-gui-launch
    propagate_cloud_env(&mut command);

    // Set Anthropic credentials from environment or credential files
    let has_env_key = std::env::var("ANTHROPIC_API_KEY").is_ok();
    if has_env_key {
        if let Ok(key) = std::env::var("ANTHROPIC_API_KEY") {
            command.env("ANTHROPIC_API_KEY", key);
        }
    } else {
        use crate::claude_auth;
        if let Ok(Some(credentials)) = claude_auth::get_claude_credentials() {
            if let crate::claude_auth::AuthType::ApiKey = credentials.auth_type {
                command.env("ANTHROPIC_API_KEY", &credentials.token);
            }
        }
    }

    command.env("CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS", "1");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command.spawn()
        .map_err(|e| format!("Failed to spawn daemon: {}", e))?;

    let child_pid = child.id().unwrap_or(0);
    log::info!("[DAEMON:LIFECYCLE] Spawned daemon process (pid={}, node={:?})", child_pid, node_path);

    let stdin = child.stdin.take()
        .ok_or("Failed to capture daemon stdin")?;
    let stdout = child.stdout.take()
        .ok_or("Failed to capture daemon stdout")?;

    // Capture stderr for logging
    if let Some(stderr) = child.stderr.take() {
        tokio::spawn(async move {
            let mut reader = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let upper = line.to_uppercase();
                if upper.contains("[ERROR]") || upper.contains("FATAL") {
                    log::error!("[Daemon stderr] {}", line);
                } else if upper.contains("[WARN]") {
                    log::warn!("[Daemon stderr] {}", line);
                } else if upper.contains("[INFO]") {
                    log::info!("[Daemon stderr] {}", line);
                } else {
                    log::debug!("[Daemon stderr] {}", line);
                }
            }
        });
    }

    // Store the child so it doesn't get dropped (which would kill it)
    // We store it in RUNNING_CHILD_PROCESSES with a special key
    {
        let mut procs = RUNNING_CHILD_PROCESSES.lock().await;
        procs.insert("__daemon__".to_string(), child);
    }

    // Spawn background stdout reader task
    let app_clone = app.clone();
    tokio::spawn(async move {
        daemon_stdout_reader(stdout, app_clone).await;
    });

    // Wait for daemon_ready signal (with timeout)
    let (ready_tx, ready_rx) = tokio::sync::oneshot::channel::<()>();

    // Store the ready channel globally so the reader can signal it
    {
        let mut guard = DAEMON_READY_TX.lock().await;
        *guard = Some(ready_tx);
    }

    *daemon_guard = Some(DaemonProcess {
        stdin,
        child_pid,
        ready: false,
    });

    // Drop the daemon lock before waiting for ready signal
    drop(daemon_guard);

    // Wait for ready with timeout
    match tokio::time::timeout(std::time::Duration::from_secs(30), ready_rx).await {
        Ok(Ok(())) => {
            let mut daemon_guard = DAEMON_PROCESS.lock().await;
            if let Some(ref mut d) = *daemon_guard {
                d.ready = true;
            }
            log::info!("[DAEMON:LIFECYCLE] Daemon is ready! Startup complete.");
            Ok(())
        }
        Ok(Err(_)) => {
            log::error!("[DAEMON:LIFECYCLE] Ready channel was dropped — daemon may have crashed during startup");
            // Clear stale daemon state so next call can retry
            let mut daemon_guard = DAEMON_PROCESS.lock().await;
            *daemon_guard = None;
            Err("Daemon ready channel was dropped".to_string())
        }
        Err(_) => {
            log::error!("[DAEMON:LIFECYCLE] Timed out waiting for daemon ready signal (30s)");
            // Clear stale daemon state and kill the process
            {
                let mut daemon_guard = DAEMON_PROCESS.lock().await;
                *daemon_guard = None;
            }
            {
                let mut procs = RUNNING_CHILD_PROCESSES.lock().await;
                if let Some(mut child) = procs.remove("__daemon__") {
                    let _ = child.kill().await;
                }
            }
            Err("Daemon startup timed out after 30 seconds".to_string())
        }
    }
}

/// One-shot channel for daemon ready signal
/// Lock ordering: always acquire DAEMON_READY_TX before DAEMON_PROCESS when both needed
static DAEMON_READY_TX: Lazy<TokioMutex<Option<tokio::sync::oneshot::Sender<()>>>> =
    Lazy::new(|| TokioMutex::new(None));

/// Background task that reads daemon stdout and routes events to the correct query
async fn daemon_stdout_reader(stdout: tokio::process::ChildStdout, _app: AppHandle) {
    let mut reader = BufReader::new(stdout).lines();

    while let Ok(Some(line)) = reader.next_line().await {
        // Parse the daemon message
        let msg: serde_json::Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => {
                log::warn!("[DAEMON:IPC] Failed to parse stdout line: {} — raw: {}", e, &line[..std::cmp::min(200, line.len())]);
                continue;
            }
        };

        let msg_type = msg.get("type").and_then(|t| t.as_str()).unwrap_or("");
        let query_id = msg.get("queryId").and_then(|q| q.as_str()).map(String::from);

        match msg_type {
            "daemon_ready" => {
                log::info!("[DAEMON:LIFECYCLE] Received daemon_ready signal from Node.js");
                let mut guard = DAEMON_READY_TX.lock().await;
                if let Some(tx) = guard.take() {
                    let _ = tx.send(());
                }
            }

            "pong" => {
                log::debug!("[DAEMON:IPC] Received pong from daemon");
            }

            "event" => {
                // Route SDK event to the correct frontend listener
                // Lock ordering: acquire DAEMON_QUERIES briefly, clone needed data, release,
                // then acquire DAEMON_QUERY_RESULTS if needed
                if let (Some(ref qid), Some(event)) = (&query_id, msg.get("event")) {
                    let is_unsolicited = msg.get("unsolicited").and_then(|u| u.as_bool()).unwrap_or(false);
                    let emit_info = {
                        let queries = DAEMON_QUERIES.lock().await;
                        queries.get(qid.as_str()).map(|state| {
                            (state.agent_id.clone(), state.session_key.clone(), state.turn_id.clone(), state.app.clone(), state.completed_at.is_some())
                        })
                    };

                    if let Some((agent_id, session_key, turn_id, app_handle, is_completed)) = emit_info {
                        let sdk_event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("unknown");
                        // Brain: bug-background-task-unsolicited-events
                        let effective_unsolicited = is_unsolicited || is_completed;
                        if effective_unsolicited {
                            log::info!("[DAEMON:ROUTE] query={} UNSOLICITED event_type={} -> agent={}", qid, sdk_event_type, agent_id);
                        } else {
                            log::debug!("[DAEMON:ROUTE] query={} event_type={} -> agent={}", qid, sdk_event_type, agent_id);
                        }

                        let event_name = format!("claude-event:{}", agent_id);
                        // Brain: fix-late-render-abort-stale-buffer
                        // Include turnId (frontend-generated) so the frontend can reject
                        // stale events from aborted/completed queries.
                        // Brain: bug-background-task-unsolicited-events
                        // For post-query background task events, send null turnId so the
                        // frontend doesn't try to match them to the completed message.
                        let wrapped = serde_json::json!({
                            "sessionKey": session_key,
                            "turnId": if effective_unsolicited { None } else { turn_id },
                            "event": event,
                            "unsolicited": effective_unsolicited
                        });
                        let _ = app_handle.emit(&event_name, &wrapped);

                        // Update global agent status map + emit WS broadcast on CHANGE only
                        // Brain: gotcha-mobile-session-dot-status
                        if let Some(event_type) = event.get("type").and_then(|t| t.as_str()) {
                            match event_type {
                                "assistant" => {
                                    let changed = if let Ok(mut map) = crate::AGENT_STATUS.write() {
                                        map.insert(agent_id.clone(), "busy".to_string()).as_deref() != Some("busy")
                                    } else { false };
                                    if changed {
                                        let _ = app_handle.emit("external-terminal-status", serde_json::json!({
                                            "id": agent_id, "status": "busy"
                                        }));
                                    }
                                }
                                "result" => {
                                    if let Ok(mut map) = crate::AGENT_STATUS.write() {
                                        map.insert(agent_id.clone(), "idle".to_string());
                                    }
                                    let _ = app_handle.emit("external-terminal-status", serde_json::json!({
                                        "id": agent_id, "status": "idle"
                                    }));
                                    // Capture Result events for usage data
                                    log::info!("[DAEMON:QUERY] query={} received Result event — capturing usage data", qid);
                                    if let Ok(result_event) = serde_json::from_value::<ClaudeEvent>(event.clone()) {
                                        if let ClaudeEvent::Result { result, session_id, total_cost_usd, usage, .. } = result_event {
                                            let response = ClaudeCliResponse {
                                                result, session_id, total_cost_usd, usage,
                                            };
                                            let mut results = DAEMON_QUERY_RESULTS.lock().await;
                                            results.insert(qid.clone(), response);
                                        }
                                    }
                                }
                                // Brain: fix-ask-user-question-stream-event-not-emitted
                                // SDK emits ask_user_question as a stream event regardless of
                                // whether canUseTool is called. In bypassPermissions mode (Build),
                                // canUseTool is NOT called, so the top-level "ask_user_question"
                                // message (handled below at the outer match) never fires.
                                // We must also emit ask-user-question from here so the frontend
                                // can render the UI and collect user answers.
                                "ask_user_question" => {
                                    let request_id = event.get("requestId").and_then(|r| r.as_str()).unwrap_or("");
                                    let questions = event.get("questions").cloned().unwrap_or(serde_json::Value::Array(vec![]));
                                    log::info!("[DAEMON:ROUTE] ask_user_question stream event query={} requestId={} -> emitting ask-user-question to frontend", qid, request_id);

                                    // Pause timeout while user is answering
                                    {
                                        let queries_lock = DAEMON_QUERIES.lock().await;
                                        if let Some(state) = queries_lock.get(qid.as_str()) {
                                            state.waiting_for_user.store(true, std::sync::atomic::Ordering::Relaxed);
                                        }
                                    }

                                    let payload = serde_json::json!({
                                        "requestId": request_id,
                                        "questions": questions,
                                        "agentId": agent_id,
                                        "sessionKey": session_key,
                                        "queryId": qid
                                    });

                                    let ask_event = format!("ask-user-question:{}", agent_id);
                                    let _ = app_handle.emit(&ask_event, payload.clone());
                                    let _ = app_handle.emit("ask-user-question", payload);
                                }
                                // Same for plan_approval_request stream events
                                "plan_approval_request" => {
                                    let request_id = event.get("requestId").and_then(|r| r.as_str()).unwrap_or("");
                                    let plan = event.get("plan").cloned().unwrap_or(serde_json::Value::Null);
                                    log::info!("[DAEMON:ROUTE] plan_approval_request stream event query={} requestId={} -> emitting plan-approval-request to frontend", qid, request_id);

                                    {
                                        let queries_lock = DAEMON_QUERIES.lock().await;
                                        if let Some(state) = queries_lock.get(qid.as_str()) {
                                            state.waiting_for_user.store(true, std::sync::atomic::Ordering::Relaxed);
                                        }
                                    }

                                    let payload = serde_json::json!({
                                        "requestId": request_id,
                                        "plan": plan,
                                        "agentId": agent_id,
                                        "sessionKey": session_key,
                                        "queryId": qid
                                    });

                                    let plan_event = format!("plan-approval-request:{}", agent_id);
                                    let _ = app_handle.emit(&plan_event, payload.clone());
                                    let _ = app_handle.emit("plan-approval-request", payload);
                                }
                                _ => {}
                            }
                        }
                    }
                }
            }

            "ask_user_question" => {
                // Daemon forwarded an AskUserQuestion from canUseTool
                if let Some(ref qid) = query_id {
                    let queries = DAEMON_QUERIES.lock().await;
                    if let Some(state) = queries.get(qid.as_str()) {
                        let request_id = msg.get("requestId").and_then(|r| r.as_str()).unwrap_or("");
                        log::info!("[DAEMON:INTERACT] AskUserQuestion query={} requestId={} -> emitting to frontend", qid, request_id);
                        // Pause timeout while user is answering
                        state.waiting_for_user.store(true, std::sync::atomic::Ordering::Relaxed);
                        let questions = msg.get("questions").cloned().unwrap_or(serde_json::Value::Array(vec![]));

                        let payload = serde_json::json!({
                            "requestId": request_id,
                            "questions": questions,
                            "agentId": state.agent_id,
                            "sessionKey": state.session_key,
                            "queryId": qid
                        });

                        let ask_event = format!("ask-user-question:{}", state.agent_id);
                        let _ = state.app.emit(&ask_event, payload.clone());
                        let _ = state.app.emit("ask-user-question", payload);
                    }
                }
            }

            "tool_permission_request" => {
                // Ask mode: daemon requests user permission before tool execution
                if let Some(ref qid) = query_id {
                    let queries = DAEMON_QUERIES.lock().await;
                    if let Some(state) = queries.get(qid.as_str()) {
                        let request_id = msg.get("requestId").and_then(|r| r.as_str()).unwrap_or("");
                        let tool_name = msg.get("toolName").and_then(|t| t.as_str()).unwrap_or("unknown");
                        log::info!("[DAEMON:INTERACT] ToolPermissionRequest query={} requestId={} tool={} -> emitting to frontend", qid, request_id, tool_name);
                        state.waiting_for_user.store(true, std::sync::atomic::Ordering::Relaxed);

                        let payload = serde_json::json!({
                            "requestId": request_id,
                            "toolName": tool_name,
                            "input": msg.get("input").cloned().unwrap_or(serde_json::Value::Null),
                            "agentId": state.agent_id,
                            "sessionKey": state.session_key,
                            "queryId": qid
                        });
                        let _ = state.app.emit("tool-permission-request", payload);
                    }
                }
            }

            "plan_approval_request" => {
                if let Some(ref qid) = query_id {
                    let queries = DAEMON_QUERIES.lock().await;
                    if let Some(state) = queries.get(qid.as_str()) {
                        let request_id = msg.get("requestId").and_then(|r| r.as_str()).unwrap_or("");
                        log::info!("[DAEMON:INTERACT] PlanApprovalRequest query={} requestId={} -> emitting to frontend", qid, request_id);
                        // Pause timeout while user reviews the plan
                        state.waiting_for_user.store(true, std::sync::atomic::Ordering::Relaxed);
                        let plan = msg.get("plan").cloned().unwrap_or(serde_json::Value::Null);

                        let payload = serde_json::json!({
                            "requestId": request_id,
                            "plan": plan,
                            "agentId": state.agent_id,
                            "sessionKey": state.session_key,
                            "queryId": qid
                        });
                        let _ = state.app.emit("plan-approval-request", payload);
                    }
                }
            }

            "query_complete" => {
                if let Some(ref qid) = query_id {
                    let is_unsolicited = msg.get("unsolicited").and_then(|u| u.as_bool()).unwrap_or(false);

                    // Get the captured Result event data (if any)
                    let stored_result = {
                        let mut results = DAEMON_QUERY_RESULTS.lock().await;
                        results.remove(qid.as_str())
                    };

                    let response = stored_result.unwrap_or_else(|| ClaudeCliResponse {
                        result: String::new(),
                        session_id: String::new(),
                        total_cost_usd: 0.0,
                        usage: Usage {
                            input_tokens: 0, output_tokens: 0,
                            cache_read_input_tokens: 0, cache_creation_input_tokens: 0,
                            extra: None,
                        },
                    });

                    let mut queries = DAEMON_QUERIES.lock().await;
                    if is_unsolicited {
                        // Brain: bug-background-task-unsolicited-events
                        // This is a query_complete for a background task turn.
                        // Remove the entry now — the background task is done.
                        queries.remove(qid.as_str());
                        log::info!("[DAEMON:QUERY] query={} background task completed — cleaned up", qid);
                    } else if let Some(state) = queries.get_mut(qid.as_str()) {
                        // Brain: bug-background-task-unsolicited-events
                        // Take the completion channel but KEEP the entry alive so we can
                        // route post-query background task events through it.
                        if let Some(tx) = state.completion_tx.take() {
                            let _ = tx.send(Ok(response));
                        }
                        state.completed_at = Some(std::time::Instant::now());
                        log::info!("[DAEMON:QUERY] query={} completed — keeping alive for background events", qid);
                    }
                }
            }

            "query_error" => {
                if let Some(ref qid) = query_id {
                    let error_msg = msg.get("error").and_then(|e| e.as_str()).unwrap_or("Unknown daemon error");
                    log::error!("[DAEMON:QUERY] query={} error: {}", qid, error_msg);

                    // Clean up stored result
                    {
                        let mut results = DAEMON_QUERY_RESULTS.lock().await;
                        results.remove(qid.as_str());
                    }

                    let mut queries = DAEMON_QUERIES.lock().await;
                    if let Some(mut state) = queries.remove(qid.as_str()) {
                        if let Some(tx) = state.completion_tx.take() {
                            let _ = tx.send(Err(error_msg.to_string()));
                        }
                    }
                }
            }

            _ => {
                log::debug!("[DAEMON:IPC] Unknown message type from daemon: {}", msg_type);
            }
        }
    }

    // stdout closed — daemon died
    log::error!("[DAEMON:LIFECYCLE] Daemon stdout closed — process likely crashed");

    // Clear daemon state
    {
        let mut daemon_guard = DAEMON_PROCESS.lock().await;
        *daemon_guard = None;
    }

    // Clean up the daemon child process entry
    {
        let mut procs = RUNNING_CHILD_PROCESSES.lock().await;
        procs.remove("__daemon__");
    }

    // Fail all active queries (skip already-completed ones that have no completion_tx)
    let mut queries = DAEMON_QUERIES.lock().await;
    let query_ids: Vec<String> = queries.keys().cloned().collect();
    for qid in query_ids {
        if let Some(mut state) = queries.remove(&qid) {
            if let Some(tx) = state.completion_tx.take() {
                let _ = tx.send(Err("Daemon process crashed unexpectedly".to_string()));
            }
        }
    }

    log::info!("[DAEMON:LIFECYCLE] Daemon cleanup complete — will auto-restart on next query");
}

/// Send a JSON command to the daemon via stdin
async fn send_to_daemon(message: &str) -> Result<(), String> {
    let msg_type = serde_json::from_str::<serde_json::Value>(message)
        .ok()
        .and_then(|v| v.get("type").and_then(|t| t.as_str()).map(String::from))
        .unwrap_or_else(|| "unknown".to_string());
    log::info!("[DAEMON:IPC] Sending to daemon stdin: type={} ({}B)", msg_type, message.len());

    let mut daemon_guard = DAEMON_PROCESS.lock().await;
    if let Some(ref mut daemon) = *daemon_guard {
        let line = format!("{}\n", message);
        daemon.stdin.write_all(line.as_bytes()).await
            .map_err(|e| {
                log::error!("[DAEMON:IPC] Failed to write to daemon stdin: {}", e);
                format!("Failed to write to daemon stdin: {}", e)
            })?;
        daemon.stdin.flush().await
            .map_err(|e| {
                log::error!("[DAEMON:IPC] Failed to flush daemon stdin: {}", e);
                format!("Failed to flush daemon stdin: {}", e)
            })?;
        Ok(())
    } else {
        log::error!("[DAEMON:IPC] Cannot send — daemon is not running");
        Err("Daemon is not running".to_string())
    }
}

/// Restart daemon command (for dev/debug)
#[tauri::command]
pub async fn restart_daemon(app: AppHandle) -> Result<(), String> {
    log::info!("[DAEMON:LIFECYCLE] Restart requested");

    // Drain in-flight queries first — signal them all as errors
    {
        let mut queries = DAEMON_QUERIES.lock().await;
        let query_ids: Vec<String> = queries.keys().cloned().collect();
        if !query_ids.is_empty() {
            log::warn!("[DAEMON:LIFECYCLE] Draining {} in-flight queries before restart", query_ids.len());
        }
        for qid in query_ids {
            if let Some(mut state) = queries.remove(&qid) {
                if let Some(tx) = state.completion_tx.take() {
                    let _ = tx.send(Err("Daemon restarting".to_string()));
                }
            }
        }
    }

    // Clean up stored results
    {
        let mut results = DAEMON_QUERY_RESULTS.lock().await;
        results.clear();
    }

    // Send shutdown command (best-effort)
    let _ = send_to_daemon(&serde_json::json!({"type": "shutdown"}).to_string()).await;
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    // Clear daemon state and kill process if still alive
    {
        let mut daemon_guard = DAEMON_PROCESS.lock().await;
        *daemon_guard = None;
    }
    {
        let mut procs = RUNNING_CHILD_PROCESSES.lock().await;
        if let Some(mut child) = procs.remove("__daemon__") {
            let _ = child.kill().await;
        }
    }

    // Spawn fresh daemon
    ensure_daemon(&app).await
}

/// Reload MCP server configuration
#[tauri::command]
pub async fn reload_mcp_servers() -> Result<(), String> {
    let cmd = serde_json::json!({"type": "mcp_reload"});
    send_to_daemon(&cmd.to_string()).await
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClaudeCliResponse {
    pub result: String,
    pub session_id: String,
    pub total_cost_usd: f64,
    pub usage: Usage,
}

// New event-based structures for --output-format json
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ClaudeEvent {
    System {
        subtype: String,
        tools: Option<Vec<String>>,
        session_id: String,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    Assistant {
        message: AssistantMessage,
        session_id: String,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    User {
        message: serde_json::Value,
        session_id: String,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    Result {
        #[serde(default)]
        result: String,
        session_id: String,
        #[serde(default)]
        total_cost_usd: f64,
        usage: Usage,
        /// Per-model usage breakdown (SDK 0.2.x) with contextWindow, costUSD, etc.
        #[serde(default, rename = "modelUsage")]
        model_usage: Option<serde_json::Value>,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    // Agent event (subagent start/stop) - SDK 0.1.54+
    Agent {
        action: Option<String>,
        agent_name: Option<String>,
        agent_type: Option<String>,
        session_id: Option<String>,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    // Complete event (stream finished)
    Complete {
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    // AskUserQuestion event - requires user input (SDK v0.1.71+)
    #[serde(rename = "ask_user_question")]
    AskUserQuestion {
        #[serde(rename = "requestId")]
        request_id: String,
        questions: Vec<AskUserQuestionQuestion>,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    // ToolPermissionRequest event - Ask mode requires user approval for each tool
    #[serde(rename = "tool_permission_request")]
    ToolPermissionRequest {
        #[serde(rename = "requestId")]
        request_id: String,
        #[serde(rename = "toolName")]
        tool_name: String,
        input: serde_json::Value,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
    // PlanApprovalRequest event - ExitPlanMode requires user approval
    #[serde(rename = "plan_approval_request")]
    PlanApprovalRequest {
        #[serde(rename = "requestId")]
        request_id: String,
        plan: serde_json::Value,
        #[serde(flatten)]
        extra: serde_json::Value,
    },
}

/// Question structure for AskUserQuestion tool
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AskUserQuestionQuestion {
    pub question: String,
    pub header: String,
    pub options: Vec<AskUserQuestionOption>,
    #[serde(rename = "multiSelect")]
    pub multi_select: bool,
}

/// Option structure for AskUserQuestion
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AskUserQuestionOption {
    pub label: String,
    pub description: String,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssistantMessage {
    pub id: String,
    pub content: Vec<ContentBlock>,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum ContentBlock {
    Text {
        text: String,
    },
    #[serde(rename = "tool_use")]
    ToolUse {
        #[serde(default)]
        id: Option<String>, // Made optional for robustness
        name: String,
        input: serde_json::Value,
    },
    // Thinking block (SDK 0.1.54+ extended thinking)
    Thinking {
        thinking: String,
    },
    #[serde(untagged)]
    Other(serde_json::Value),
}

/// Deserialize null or missing values as 0 for token counts.
/// The Claude Agent SDK sends `null` for cache token fields when no caching occurred,
/// but `#[serde(default)]` only handles missing fields, not explicit `null`.
fn deserialize_null_as_zero<'de, D>(deserializer: D) -> Result<u32, D::Error>
where
    D: serde::Deserializer<'de>,
{
    Option::<u32>::deserialize(deserializer).map(|opt| opt.unwrap_or(0))
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Usage {
    #[serde(default, deserialize_with = "deserialize_null_as_zero")]
    pub input_tokens: u32,
    #[serde(default, deserialize_with = "deserialize_null_as_zero")]
    pub output_tokens: u32,
    #[serde(default, deserialize_with = "deserialize_null_as_zero")]
    pub cache_read_input_tokens: u32,
    #[serde(default, deserialize_with = "deserialize_null_as_zero")]
    pub cache_creation_input_tokens: u32,
    /// Capture any extra fields the SDK sends (e.g., cache_creation, service_tier)
    #[serde(flatten)]
    pub extra: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentConfig {
    pub name: String,
    pub description: String,
    pub model: String,
    pub file_path: String,
}

/// Team context for Agent Teams mode
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamContext {
    pub team_name: String,
    pub members: Vec<TeamContextMember>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeamContextMember {
    pub name: String,
    pub role: String,
    pub communication_style: String,
    pub is_lead: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClaudeCliRequest {
    pub prompt: String,
    pub model: Option<String>,
    pub thinking_mode: Option<String>,
    pub permission_mode: Option<String>,
    pub attachments: Option<Vec<String>>,
    pub agents: Option<Vec<AgentConfig>>,
    pub cwd: Option<String>,
    // ✅ Session ID for conversation continuity (resume support)
    pub session_id: Option<String>,
    // ✅ Structured outputs support (beta)
    pub output_format: Option<serde_json::Value>,
    // ✅ Effort parameter: 'low' | 'medium' | 'high' (SDK 0.1.54+)
    pub effort: Option<String>,
    // ✅ Setting sources control (to prevent "Prompt is too long" errors)
    pub setting_sources: Option<Vec<String>>,
    // 🗣️ Allowed tools list (SDK v0.1.57+) - enables specific tools like AskUserQuestion
    pub allowed_tools: Option<Vec<String>>,
    // 🦆 SESSION-FIRST: Frontend session key for routing events to correct chat session
    // This allows parallel conversations - each stream knows where to write its events
    pub session_key: Option<String>,
    // 🦆 Agent Teams context (team name + members for prompt augmentation)
    pub team_context: Option<TeamContext>,
    // 🦆 LLM Provider support (Ollama, custom OpenAI-compatible endpoints)
    pub provider: Option<String>,           // 'anthropic' | 'ollama' | 'custom'
    pub provider_base_url: Option<String>,  // Base URL for non-Anthropic providers
    pub provider_api_key: Option<String>,   // API key for custom providers
    // 🖥️ IDE context (open file, selection, diagnostics, git status)
    // Injected into system prompt by Node.js — kept separate from user message
    pub ide_context: Option<String>,
    // Brain: fix-late-render-abort-stale-buffer
    // Frontend-generated turn ID echoed back in every emitted event so the frontend
    // can reject stale events from aborted/completed queries.
    pub turn_id: Option<String>,
}

const DEFAULT_MODEL: &str = "sonnet";
const MAX_ATTACHMENTS: usize = 6;
const MAX_ATTACHMENT_SIZE: u64 = 15 * 1024 * 1024;

/// Minimum supported Node.js version (major)
// Brain: sdk-requires-node22-disposable
// Claude Agent SDK v0.2.47+ uses Symbol.dispose (Explicit Resource Management)
// which requires Node.js 22+. We polyfill via --require for Node 20-21.
// Node 20+ required for ESM compatibility with the SDK.
const MIN_NODE_VERSION: u32 = 20;

/// Get home directory robustly (works even when $HOME is not set)
/// This is important for apps launched from Finder which don't inherit shell environment
fn get_home_dir() -> Option<PathBuf> {
    // Try $HOME first (fastest)
    if let Ok(home) = std::env::var("HOME") {
        if !home.is_empty() {
            return Some(PathBuf::from(home));
        }
    }

    // Fallback: Use platform-specific method
    #[cfg(target_os = "macos")]
    {
        // On macOS, use NSHomeDirectory equivalent via getpwuid
        use std::ffi::CStr;
        unsafe {
            let uid = libc::getuid();
            let pwd = libc::getpwuid(uid);
            if !pwd.is_null() {
                let home = CStr::from_ptr((*pwd).pw_dir);
                if let Ok(home_str) = home.to_str() {
                    return Some(PathBuf::from(home_str));
                }
            }
        }
    }

    None
}

/// Parse Node.js version from `node --version` output (e.g., "v22.8.0" -> 22)
fn parse_node_major_version(version_str: &str) -> Option<u32> {
    let trimmed = version_str.trim().trim_start_matches('v');
    trimmed.split('.').next()?.parse().ok()
}

/// Get Node.js major version from executable path (e.g., 22 for v22.8.0)
fn get_node_major_version(node_path: &Path) -> Option<u32> {
    let mut cmd = std::process::Command::new(node_path);
    cmd.arg("--version");

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    if let Ok(output) = cmd.output() {
        if output.status.success() {
            if let Ok(version_str) = String::from_utf8(output.stdout) {
                return parse_node_major_version(&version_str);
            }
        }
    }
    None
}

/// Find system Node.js executable (fallback when sidecar is not available)
/// This searches common Node.js installation paths with robust home directory detection.
/// Brain: fix-node-resolution-prefer-newest
/// Collects ALL compatible candidates and returns the one with the highest major version.
/// This ensures nvm v22 is preferred over /usr/local/bin/node v18.
fn find_system_node_executable() -> Option<PathBuf> {
    log::info!("[Node.js] Searching for system Node.js installation...");

    // Collect all compatible candidates as (path, major_version)
    let mut candidates: Vec<(PathBuf, u32)> = Vec::new();

    /// Helper: add a candidate if it exists and is compatible
    fn try_add_candidate(candidates: &mut Vec<(PathBuf, u32)>, path: PathBuf) {
        if path.exists() {
            if let Some(major) = get_node_major_version(&path) {
                if major >= MIN_NODE_VERSION {
                    log::info!("[Node.js] 📋 Candidate: {:?} (v{})", path, major);
                    candidates.push((path, major));
                }
            }
        }
    }

    // Get home directory robustly (works even when launched from Finder)
    let home_dir = get_home_dir();
    log::info!("[Node.js] Home directory: {:?}", home_dir);

    // 🔍 SOURCE 1: Try Volta's which command (if Volta is available)
    let mut cmd = std::process::Command::new("volta");
    cmd.args(["which", "node"]);
    #[cfg(target_os = "windows")]
    hide_console_window(&mut cmd);

    if let Ok(output) = cmd.output() {
        if output.status.success() {
            if let Ok(path_str) = String::from_utf8(output.stdout) {
                try_add_candidate(&mut candidates, PathBuf::from(path_str.trim()));
            }
        }
    }

    // 🔍 SOURCE 2: Check Volta directory directly (for Finder/Explorer launch)
    if let Some(ref home) = home_dir {
        #[cfg(target_os = "windows")]
        let volta_node = home.join(".volta").join("bin").join("node.exe");
        #[cfg(not(target_os = "windows"))]
        let volta_node = home.join(".volta/bin/node");

        try_add_candidate(&mut candidates, volta_node);
    }

    // 🔍 SOURCE 3: Try standard PATH
    #[cfg(target_os = "windows")]
    {
        let mut cmd = std::process::Command::new("where");
        cmd.arg("node");
        hide_console_window(&mut cmd);

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                if let Ok(path_str) = String::from_utf8(output.stdout) {
                    for line in path_str.lines() {
                        try_add_candidate(&mut candidates, PathBuf::from(line.trim()));
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        if let Ok(output) = std::process::Command::new("which").arg("node").output() {
            if output.status.success() {
                if let Ok(path_str) = String::from_utf8(output.stdout) {
                    try_add_candidate(&mut candidates, PathBuf::from(path_str.trim()));
                }
            }
        }
    }

    // 🔍 SOURCE 4: Common installation paths
    #[cfg(target_os = "windows")]
    let common_paths: Vec<PathBuf> = vec![
        PathBuf::from(r"C:\Program Files\nodejs\node.exe"),
        PathBuf::from(r"C:\Program Files (x86)\nodejs\node.exe"),
        PathBuf::from(r"C:\nodejs\node.exe"),
    ];

    #[cfg(not(target_os = "windows"))]
    let common_paths: Vec<PathBuf> = vec![
        PathBuf::from("/opt/homebrew/bin/node"),
        PathBuf::from("/usr/local/bin/node"),
        PathBuf::from("/usr/bin/node"),
        PathBuf::from("/opt/local/bin/node"),
    ];

    for path in &common_paths {
        try_add_candidate(&mut candidates, path.clone());
    }

    // 🔍 SOURCE 5: Check NVM installations
    if let Some(ref home) = home_dir {
        #[cfg(target_os = "windows")]
        {
            if let Ok(appdata) = std::env::var("APPDATA") {
                let nvm_dir = PathBuf::from(&appdata).join("nvm");
                if nvm_dir.exists() {
                    log::info!("[Node.js] Found nvm-windows directory, scanning versions...");
                    if let Ok(entries) = fs::read_dir(&nvm_dir) {
                        for entry in entries.filter_map(|e| e.ok()) {
                            if entry.path().is_dir() && entry.file_name().to_string_lossy().starts_with('v') {
                                try_add_candidate(&mut candidates, entry.path().join("node.exe"));
                            }
                        }
                    }
                }
            }
        }

        #[cfg(not(target_os = "windows"))]
        {
            // NVM at ~/.nvm/versions/node
            let nvm_dir = home.join(".nvm/versions/node");
            if nvm_dir.exists() {
                log::info!("[Node.js] Found NVM directory, scanning versions...");
                if let Ok(entries) = fs::read_dir(&nvm_dir) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        if entry.path().is_dir() {
                            try_add_candidate(&mut candidates, entry.path().join("bin/node"));
                        }
                    }
                }
            }

            // 🔍 SOURCE 6: Check fnm installations (Unix only)
            let fnm_dirs = vec![
                home.join(".local/share/fnm/node-versions"),
                home.join(".fnm/node-versions"),
            ];

            for fnm_dir in &fnm_dirs {
                if fnm_dir.exists() {
                    log::info!("[Node.js] Found fnm directory at: {:?}, scanning versions...", fnm_dir);
                    if let Ok(entries) = fs::read_dir(fnm_dir) {
                        for entry in entries.filter_map(|e| e.ok()) {
                            if entry.path().is_dir() {
                                try_add_candidate(&mut candidates, entry.path().join("installation/bin/node"));
                            }
                        }
                    }
                }
            }

            // User-specific paths (Unix only)
            let user_paths = vec![
                home.join(".local/bin/node"),
                home.join("bin/node"),
            ];
            for path in user_paths {
                try_add_candidate(&mut candidates, path);
            }
        }
    }

    // 🏆 Select the candidate with the highest major version
    if candidates.is_empty() {
        log::warn!("[Node.js] ❌ No compatible Node.js found (minimum: v{})", MIN_NODE_VERSION);
        log::warn!("[Node.js] Searched: Volta, PATH, common paths, NVM, fnm, user directories");
        return None;
    }

    // Deduplicate by canonical path
    candidates.dedup_by(|a, b| a.0 == b.0);

    // Sort by major version descending
    candidates.sort_by(|a, b| b.1.cmp(&a.1));

    let (ref best_path, best_version) = candidates[0];
    log::info!("[Node.js] ✅ Selected: {:?} (v{})", best_path, best_version);

    // Warn about odd-numbered (non-LTS) Node.js versions
    if best_version % 2 != 0 {
        log::warn!("[Node.js] ⚠️ Non-LTS version v{} selected. \
            Odd-numbered Node.js releases may have compatibility issues. \
            Recommended: use LTS (v22.x).", best_version);
    }

    // Log skipped lower versions
    if candidates.len() > 1 {
        log::info!("[Node.js] Skipped lower versions: {:?}",
            candidates[1..].iter().map(|(p, v)| format!("{:?} (v{})", p, v)).collect::<Vec<_>>());
    }

    Some(best_path.clone())
}

// Event payloads for tool tracking
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize)]
pub struct ToolStartEvent {
    pub tool_id: String,
    pub tool_name: String,
    pub message_id: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize)]
pub struct ToolResultEvent {
    pub tool_id: String,
    pub tool_name: String,
    pub message_id: String,
    pub result: String,
    pub status: String, // "completed" | "error"
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize)]
pub struct ToolDiffLine {
    #[serde(rename = "type")]
    pub line_type: String, // "added" | "removed" | "unchanged"
    pub content: String,
    #[serde(rename = "lineNumber")]
    pub line_number: Option<u32>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, Serialize)]
pub struct ToolDiffEvent {
    pub tool_id: String,
    pub message_id: String,
    #[serde(rename = "fileName")]
    pub file_name: Option<String>,
    pub lines: Vec<ToolDiffLine>,
}

/// Find the Claude CLI executable path with robust search including NVM, Volta, and user directories
pub fn find_claude_cli_path() -> Option<String> {
    // Strategy: Search in order of preference
    // 1. Try Volta's 'which claude' first (respects Volta toolchain)
    // 2. Try 'where claude' on Windows or 'which claude' on Unix (system PATH)
    // 3. Common system paths (Homebrew, MacPorts, system-wide)
    // 4. User-specific paths (~/.local/bin, ~/bin)
    // 5. NVM paths (~/.nvm/versions/node/*/bin/claude)
    // 6. Volta paths (~/.volta/bin/claude)
    // 7. Windows npm global paths (%APPDATA%\npm, %ProgramFiles%\nodejs)

    log::info!("[Claude CLI] Starting search for Claude executable...");

    // 🎯 PRIORITY 1: Try Volta's which command (if Volta is available)
    // This respects Volta's toolchain and version management
    let mut cmd = std::process::Command::new("volta");
    cmd.args(["which", "claude"]);
    #[cfg(target_os = "windows")]
    hide_console_window(&mut cmd);

    if let Ok(output) = cmd.output() {
        if output.status.success() {
            if let Ok(path_str) = String::from_utf8(output.stdout) {
                let path = path_str.trim();
                if !path.is_empty() && Path::new(path).exists() {
                    log::info!("[Claude CLI] ✅ Found via Volta: {}", path);
                    return Some(path.to_string());
                }
            }
        }
    }

    // 🎯 PRIORITY 2: Try system PATH via 'where' (Windows) or 'which' (Unix)
    #[cfg(target_os = "windows")]
    {
        log::info!("[Claude CLI] Trying 'where claude' (Windows)...");
        let mut cmd = std::process::Command::new("where");
        cmd.arg("claude");
        hide_console_window(&mut cmd);

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                if let Ok(path_str) = String::from_utf8(output.stdout) {
                    // 'where' can return multiple lines, take the first one
                    if let Some(first_line) = path_str.lines().next() {
                        let path = first_line.trim();
                        if !path.is_empty() && Path::new(path).exists() {
                            log::info!("[Claude CLI] ✅ Found via 'where' at: {}", path);
                            return Some(path.to_string());
                        }
                    }
                }
            }
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        log::info!("[Claude CLI] Trying 'which claude' (Unix)...");
        let mut cmd = std::process::Command::new("which");
        cmd.arg("claude");

        if let Ok(output) = cmd.output() {
            if output.status.success() {
                if let Ok(path) = String::from_utf8(output.stdout) {
                    let path = path.trim();
                    if !path.is_empty() && Path::new(path).exists() {
                        log::info!("[Claude CLI] ✅ Found via 'which' at: {}", path);
                        return Some(path.to_string());
                    }
                }
            }
        }
    }

    // 🎯 PRIORITY 3: Build search paths based on platform
    let mut search_paths: Vec<String> = vec![];

    #[cfg(not(target_os = "windows"))]
    {
        // Unix/macOS paths
        search_paths.extend(vec![
            "/opt/homebrew/bin/claude".to_string(),         // Homebrew on Apple Silicon
            "/usr/local/bin/claude".to_string(),            // Homebrew on Intel Mac
            "/opt/local/bin/claude".to_string(),            // MacPorts
            "/usr/bin/claude".to_string(),                  // System-wide install
        ]);
    }

    #[cfg(target_os = "windows")]
    {
        // Windows npm global paths
        if let Ok(appdata) = std::env::var("APPDATA") {
            search_paths.push(format!("{}\\npm\\claude.cmd", appdata));
            search_paths.push(format!("{}\\npm\\claude", appdata));
        }

        if let Ok(programfiles) = std::env::var("ProgramFiles") {
            search_paths.push(format!("{}\\nodejs\\claude.cmd", programfiles));
            search_paths.push(format!("{}\\nodejs\\claude", programfiles));
        }

        // Add common Windows paths
        search_paths.extend(vec![
            r"C:\Program Files\nodejs\claude.cmd".to_string(),
            r"C:\Program Files (x86)\nodejs\claude.cmd".to_string(),
        ]);
    }

    // Add user-specific paths (cross-platform)
    if let Ok(home) = std::env::var("HOME") {
        #[cfg(not(target_os = "windows"))]
        {
            // Volta-managed global binaries (high priority)
            search_paths.push(format!("{}/.volta/bin/claude", home));

            search_paths.push(format!("{}/.local/bin/claude", home));
            search_paths.push(format!("{}/bin/claude", home));

            // Search in NVM directories
            let nvm_base = format!("{}/.nvm/versions/node", home);
            if let Ok(entries) = fs::read_dir(&nvm_base) {
                for entry in entries.filter_map(Result::ok) {
                    let node_version_path = entry.path();
                    if node_version_path.is_dir() {
                        let claude_path = node_version_path.join("bin/claude");
                        if let Some(path_str) = claude_path.to_str() {
                            search_paths.push(path_str.to_string());
                        }
                    }
                }
            }

            // Search in Volta toolchain directories
            let volta_base = format!("{}/.volta/tools/image/claude", home);
            if let Ok(entries) = fs::read_dir(&volta_base) {
                for entry in entries.filter_map(Result::ok) {
                    let version_path = entry.path();
                    if version_path.is_dir() {
                        let claude_path = version_path.join("bin/claude");
                        if let Some(path_str) = claude_path.to_str() {
                            search_paths.push(path_str.to_string());
                        }
                    }
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Windows-specific: Add USERPROFILE paths
        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            search_paths.push(format!("{}\\AppData\\Roaming\\npm\\claude.cmd", userprofile));
            search_paths.push(format!("{}\\AppData\\Roaming\\npm\\claude", userprofile));
        }

        // Windows NVM paths
        if let Ok(appdata) = std::env::var("APPDATA") {
            let nvm_dir = PathBuf::from(&appdata).join("nvm");
            if nvm_dir.exists() {
                if let Ok(entries) = fs::read_dir(&nvm_dir) {
                    for entry in entries.filter_map(Result::ok) {
                        let version_path = entry.path();
                        if version_path.is_dir() {
                            let claude_cmd = version_path.join("claude.cmd");
                            if let Some(path_str) = claude_cmd.to_str() {
                                search_paths.push(path_str.to_string());
                            }
                        }
                    }
                }
            }
        }
    }

    // Try each search path
    log::info!("[Claude CLI] Checking {} search paths...", search_paths.len());
    for path in &search_paths {
        if Path::new(path).exists() {
            // Verify it's executable by running --version
            log::debug!("[Claude CLI] Testing path: {}", path);
            let mut cmd = std::process::Command::new(path);
            cmd.arg("--version");
            #[cfg(target_os = "windows")]
            hide_console_window(&mut cmd);

            let output = cmd.output();

            if let Ok(output) = output {
                if output.status.success() {
                    if let Ok(version) = String::from_utf8(output.stdout) {
                        log::info!("[Claude CLI] ✅ Found at: {} (version: {})", path, version.trim());
                    } else {
                        log::info!("[Claude CLI] ✅ Found at: {}", path);
                    }
                    return Some(path.to_string());
                }
            }
        }
    }

    log::warn!("[Claude CLI] ❌ Not found in any known location");
    log::warn!("[Claude CLI] Searched {} paths + Volta + system PATH", search_paths.len());
    log::warn!("[Claude CLI] Tip: Install via 'npm install -g @anthropic-ai/claude-code' or use ANTHROPIC_API_KEY");
    None
}

/// Check if Claude CLI is available and authenticated
#[tauri::command]
pub fn check_claude_cli_available() -> Result<bool, String> {
    Ok(find_claude_cli_path().is_some())
}

/// Send a message to Claude via CLI
#[tauri::command]
pub async fn send_message_via_cli(request: ClaudeCliRequest) -> Result<ClaudeCliResponse, String> {
    // Check if CLI is available
    if !check_claude_cli_available().map_err(|e| e.to_string())? {
        return Err("Claude CLI is not available. Make sure Claude Code CLI is installed and you are logged in.".to_string());
    }

    let ClaudeCliRequest {
        prompt,
        model,
        thinking_mode,
        permission_mode,
        attachments,
        ..
    } = request;

    let mut prompt_with_attachments = prompt.clone();

    if let Some(list) = attachments {
        if list.len() > MAX_ATTACHMENTS {
            return Err(format!("Too many attachments. Maximum allowed is {}.", MAX_ATTACHMENTS));
        }

        let mut has_header = prompt_with_attachments.contains("Attachments:");

        for path in list {
            let trimmed = path.trim();
            if trimmed.is_empty() {
                continue;
            }

            let metadata = fs::metadata(trimmed)
                .map_err(|e| format!("Unable to read attachment '{}': {}", trimmed, e))?;

            if !metadata.is_file() {
                return Err(format!("Attachment is not a file: {}", trimmed));
            }

            if metadata.len() > MAX_ATTACHMENT_SIZE {
                let name = Path::new(trimmed)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or(trimmed);
                return Err(format!("Attachment '{}' exceeds 15MB limit.", name));
            }

            if prompt_with_attachments.contains(trimmed) {
                continue;
            }

            if !has_header {
                if !prompt_with_attachments.ends_with('\n') {
                    prompt_with_attachments.push('\n');
                }
                prompt_with_attachments.push_str("\nAttachments:\n");
                has_header = true;
            }

            prompt_with_attachments.push_str(trimmed);
            prompt_with_attachments.push('\n');
        }
    }

    // Find Claude CLI path
    let claude_path = find_claude_cli_path()
        .ok_or_else(|| "Claude CLI not found. Please ensure it's installed and in your PATH.".to_string())?;

    // Prepare the command
    let mut command = Command::new(claude_path);
    command
        .arg("--print")
        .arg("--output-format")
        .arg("json");

    let selected_model = model.unwrap_or_else(|| DEFAULT_MODEL.to_string());
    command.arg("--model").arg(&selected_model);

    if let Some(mode) = thinking_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
            None
        } else {
            Some(trimmed.to_owned())
        }
    }) {
        command.arg("--think").arg(mode);
    }

    // Map frontend permission modes to CLI permission modes
    // Note: "act" mode (auto-approve) is the CLI default, so we omit --permission-mode flag
    if let Some(mode) = permission_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_lowercase())
        }
    }) {
        match mode.as_str() {
            "bypass" => {
                command.arg("--permission-mode").arg("bypassPermissions");
            }
            "plan" => {
                command.arg("--permission-mode").arg("plan");
            }
            "act" => {
                // Do nothing - CLI default is auto-approve
            }
            _ => {
                // Unknown mode - fallback to auto-approve (do nothing)
            }
        }
    }

    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Windows: Hide console window
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn claude command: {}", e))?;

    // Write prompt to stdin
    {
        let stdin = child.stdin.as_mut()
            .ok_or("Failed to open stdin".to_string())?;
        stdin.write_all(prompt_with_attachments.as_bytes()).await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    // Wait for command to complete and get output
    let output = child.wait_with_output().await
        .map_err(|e| format!("Failed to wait for claude command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI failed: {}", stderr));
    }

    // Parse JSON output
    let stdout = String::from_utf8_lossy(&output.stdout);
    let response: ClaudeCliResponse = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse Claude CLI JSON response: {}", e))?;

    Ok(response)
}

/// Parse tool usage from Claude CLI output line
#[allow(dead_code)]
fn parse_tool_from_line(line: &str) -> Option<(String, String)> {
    // Look for tool patterns in Claude Code output
    // Examples:
    // "Using tool: Read"
    // "Tool: Edit - file.ts"
    // "Running: Bash(npm install)"

    let line_lower = line.to_lowercase();

    // Pattern 1: "Using tool: ToolName"
    if let Some(idx) = line_lower.find("using tool:") {
        let rest = &line[idx + 11..].trim();
        if let Some(tool_name) = rest.split_whitespace().next() {
            return Some((tool_name.to_string(), line.to_string()));
        }
    }

    // Pattern 2: "Tool: ToolName"
    if let Some(idx) = line_lower.find("tool:") {
        let rest = &line[idx + 5..].trim();
        if let Some(tool_name) = rest.split_whitespace().next() {
            return Some((tool_name.to_string(), line.to_string()));
        }
    }

    // Pattern 3: Detect tool names directly (Read, Edit, Bash, Grep, Glob, etc.)
    let tools = ["read", "edit", "write", "bash", "grep", "glob", "webfetch", "websearch"];
    for tool in tools {
        if line_lower.contains(tool) && (line_lower.contains("using") || line_lower.contains("running")) {
            return Some((tool.to_string(), line.to_string()));
        }
    }

    None
}

/// Send a message to Claude via CLI with streaming tool tracking
#[tauri::command]
pub async fn send_message_via_cli_streaming(
    app: AppHandle,
    agent_id: String,
    request: ClaudeCliRequest,
) -> Result<ClaudeCliResponse, String> {
    // Check if CLI is available
    if !check_claude_cli_available().map_err(|e| e.to_string())? {
        return Err("Claude CLI is not available. Make sure Claude Code CLI is installed and you are logged in.".to_string());
    }

    let ClaudeCliRequest {
        prompt,
        model,
        thinking_mode,
        permission_mode,
        attachments,
        ..
    } = request;

    let mut prompt_with_attachments = prompt.clone();

    if let Some(list) = attachments {
        if list.len() > MAX_ATTACHMENTS {
            return Err(format!("Too many attachments. Maximum allowed is {}.", MAX_ATTACHMENTS));
        }

        let mut has_header = prompt_with_attachments.contains("Attachments:");

        for path in list {
            let trimmed = path.trim();
            if trimmed.is_empty() {
                continue;
            }

            let metadata = fs::metadata(trimmed)
                .map_err(|e| format!("Unable to read attachment '{}': {}", trimmed, e))?;

            if !metadata.is_file() {
                return Err(format!("Attachment is not a file: {}", trimmed));
            }

            if metadata.len() > MAX_ATTACHMENT_SIZE {
                let name = Path::new(trimmed)
                    .file_name()
                    .and_then(|s| s.to_str())
                    .unwrap_or(trimmed);
                return Err(format!("Attachment '{}' exceeds 15MB limit.", name));
            }

            if prompt_with_attachments.contains(trimmed) {
                continue;
            }

            if !has_header {
                if !prompt_with_attachments.ends_with('\n') {
                    prompt_with_attachments.push('\n');
                }
                prompt_with_attachments.push_str("\nAttachments:\n");
                has_header = true;
            }

            prompt_with_attachments.push_str(trimmed);
            prompt_with_attachments.push('\n');
        }
    }

    // Find Claude CLI path
    let claude_path = find_claude_cli_path()
        .ok_or_else(|| "Claude CLI not found. Please ensure it's installed and in your PATH.".to_string())?;

    // Prepare the command with verbose mode for tool tracking
    let mut command = Command::new(claude_path);
    command
        .arg("--verbose")
        .arg("--output-format")
        .arg("json");

    let selected_model = model.unwrap_or_else(|| DEFAULT_MODEL.to_string());
    command.arg("--model").arg(&selected_model);

    if let Some(mode) = thinking_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("auto") {
            None
        } else {
            Some(trimmed.to_owned())
        }
    }) {
        command.arg("--think").arg(mode);
    }

    // Map frontend permission modes to CLI permission modes
    // Note: "act" mode (auto-approve) is the CLI default, so we omit --permission-mode flag
    if let Some(mode) = permission_mode.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_lowercase())
        }
    }) {
        match mode.as_str() {
            "bypass" => {
                command.arg("--permission-mode").arg("bypassPermissions");
            }
            "plan" => {
                command.arg("--permission-mode").arg("plan");
            }
            "act" => {
                // Do nothing - CLI default is auto-approve
            }
            _ => {
                // Unknown mode - fallback to auto-approve (do nothing)
            }
        }
    }

    command
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Windows: Hide console window
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        command.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("Failed to spawn claude command: {}", e))?;

    // Write prompt to stdin
    {
        let stdin = child.stdin.as_mut()
            .ok_or("Failed to open stdin".to_string())?;
        stdin.write_all(prompt_with_attachments.as_bytes()).await
            .map_err(|e| format!("Failed to write to stdin: {}", e))?;
    }

    // Read stderr only for logging (tool tracking now done via JSON parsing)
    if let Some(stderr) = child.stderr.take() {
        let mut stderr_reader = BufReader::new(stderr).lines();
        // Spawn task to log stderr (but don't emit tool events - handled by JSON)
        tokio::spawn(async move {
            while let Ok(Some(line)) = stderr_reader.next_line().await {
                // Log stderr for debugging
                log::info!("[Claude stderr] {}", line);
            }
        });
    }

    // Wait for command to complete and get output
    let output = child.wait_with_output().await
        .map_err(|e| format!("Failed to wait for claude command: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Claude CLI failed: {}", stderr));
    }

    // Parse JSON output from stdout
    let stdout = String::from_utf8_lossy(&output.stdout);

    // Log the raw output for debugging
    log::info!("[Claude stdout] {}", stdout);

    // Parse as event array
    let events: Vec<ClaudeEvent> = serde_json::from_str(&stdout)
        .map_err(|e| format!("Failed to parse Claude CLI events: {}. Output: {}", e, stdout))?;

    // Emit each event to the frontend for real-time visualization
    for event in &events {
        let event_name = format!("claude-event:{}", agent_id);
        let _ = app.emit(&event_name, event);
    }

    // Extract final response from Result event
    let result_event = events.iter()
        .find_map(|e| match e {
            ClaudeEvent::Result { result, session_id, total_cost_usd, usage, .. } => {
                // Pass usage as-is. Frontend calculates context fill as:
                // contextWindowFill = input_tokens + cache_read + cache_creation
                Some(ClaudeCliResponse {
                    result: result.clone(),
                    session_id: session_id.clone(),
                    total_cost_usd: *total_cost_usd,
                    usage: usage.clone(),
                })
            }
            _ => None,
        })
        .ok_or_else(|| format!("No result event found in Claude CLI output. Events: {:?}", events))?;

    Ok(result_event)
}

/// Send a message to Claude via Node.js SDK with real-time streaming.
/// Uses the persistent daemon process for all queries.
#[tauri::command]
pub async fn send_message_via_sdk_streaming(
    app: AppHandle,
    agent_id: String,
    request: ClaudeCliRequest,
    _session_state: tauri::State<'_, crate::SessionState>,
) -> Result<ClaudeCliResponse, String> {
    let debug_timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    log::info!("[DAEMON:QUERY] send_message_via_sdk_streaming at {}", debug_timestamp);

    // Brain: gotcha-mobile-session-dot-status
    // Mark agent as busy immediately — before daemon even starts.
    // This ensures the REST API returns "busy" right away, covering the gap
    // between message sent and first "assistant" SDK event.
    if let Ok(mut map) = crate::AGENT_STATUS.write() {
        map.insert(agent_id.clone(), "busy".to_string());
    }
    // Emit WS broadcast for instant mobile update
    let _ = app.emit("external-terminal-status", serde_json::json!({
        "id": agent_id, "status": "busy"
    }));

    // Send via daemon. On daemon lifecycle errors, restart once and retry.
    match send_message_via_daemon(&app, &agent_id, &request).await {
        Ok(response) => Ok(response),
        Err(e) if e.contains("daemon") || e.contains("Daemon") || e.contains("stdin") || e.contains("crashed") || e.contains("dropped") => {
            log::warn!("[DAEMON:RETRY] Daemon error, restarting daemon and retrying: {}", e);
            // Clear stale daemon state so ensure_daemon() spawns fresh
            {
                let mut daemon = DAEMON_PROCESS.lock().await;
                *daemon = None;
            }
            send_message_via_daemon(&app, &agent_id, &request).await
        }
        Err(e) => Err(e),
    }
}

/// Send message via the persistent daemon process
async fn send_message_via_daemon(
    app: &AppHandle,
    agent_id: &str,
    request: &ClaudeCliRequest,
) -> Result<ClaudeCliResponse, String> {
    // Ensure daemon is running
    ensure_daemon(app).await?;

    let event_session_key = request.session_key.as_deref().unwrap_or(agent_id).to_string();
    let query_id = format!("q_{}_{}", event_session_key, uuid::Uuid::new_v4());

    // Create completion channel
    let (tx, rx) = tokio::sync::oneshot::channel();

    // Shared flag: set to true when query is waiting for user (plan approval / ask-user-question)
    let waiting_for_user = Arc::new(std::sync::atomic::AtomicBool::new(false));

    // Register query
    {
        let mut queries = DAEMON_QUERIES.lock().await;
        // Brain: bug-background-task-unsolicited-events
        // Remove any previously completed query for the same agent (cleanup stale entries)
        let agent_id_str = agent_id.to_string();
        queries.retain(|_, state| {
            !(state.agent_id == agent_id_str && state.completed_at.is_some())
        });
        queries.insert(query_id.clone(), DaemonQueryState {
            agent_id: agent_id_str,
            session_key: event_session_key.clone(),
            turn_id: request.turn_id.clone(),
            app: app.clone(),
            completion_tx: Some(tx),
            waiting_for_user: waiting_for_user.clone(),
            completed_at: None,
        });
    }

    // Build permission mode value
    let permission_value = request.permission_mode.as_ref().and_then(|mode| match mode.as_str() {
        "bypass" => Some("bypassPermissions".to_string()),
        "plan" => Some("plan".to_string()),
        "ask" => Some("default".to_string()),
        "debug" => Some("bypassPermissions".to_string()),
        "chat" => Some("default".to_string()),
        "act" => None,
        _ => None,
    });

    // Build query command
    let mut query_cmd = serde_json::json!({
        "type": "query",
        "queryId": query_id,
        "prompt": request.prompt,
        "model": request.model.as_deref().unwrap_or(DEFAULT_MODEL),
        "thinkingMode": request.thinking_mode,
        "cwd": request.cwd.as_ref().map(|p| sanitize_path_string_for_node(p)),
        "sessionId": request.session_id,
    });

    if let Some(perm) = permission_value {
        query_cmd["permissionMode"] = serde_json::Value::String(perm);
    }
    if request.permission_mode.as_deref() == Some("ask") {
        query_cmd["askMode"] = serde_json::Value::Bool(true);
    }
    if request.permission_mode.as_deref() == Some("debug") {
        query_cmd["debugMode"] = serde_json::Value::Bool(true);
    }
    if request.permission_mode.as_deref() == Some("chat") {
        query_cmd["chatMode"] = serde_json::Value::Bool(true);
    }
    if let Some(ref agents) = request.agents {
        query_cmd["agents"] = serde_json::json!(agents);
    }
    if let Some(ref tc) = request.team_context {
        query_cmd["teamContext"] = serde_json::json!(tc);
    }
    if let Some(ref attachments) = request.attachments {
        query_cmd["attachments"] = serde_json::json!(attachments);
    }
    if let Some(ref fmt) = request.output_format {
        query_cmd["outputFormat"] = fmt.clone();
    }
    if let Some(ref effort) = request.effort {
        query_cmd["effort"] = serde_json::Value::String(effort.clone());
    }
    if let Some(ref tools) = request.allowed_tools {
        query_cmd["allowedTools"] = serde_json::json!(tools);
    }
    if let Some(ref ide_ctx) = request.ide_context {
        query_cmd["ideContext"] = serde_json::Value::String(ide_ctx.clone());
    }
    // 🦆 LLM Provider support for daemon path (custom/ollama providers)
    if let Some(ref prov) = request.provider {
        query_cmd["provider"] = serde_json::Value::String(prov.clone());
    }
    if let Some(ref url) = request.provider_base_url {
        query_cmd["providerBaseUrl"] = serde_json::Value::String(url.clone());
    }
    if let Some(ref key) = request.provider_api_key {
        query_cmd["providerApiKey"] = serde_json::Value::String(key.clone());
    }

    // Send query to daemon
    let cmd_str = query_cmd.to_string();
    log::info!("[DAEMON:QUERY] Sending query={} session={} model={} resume={} prompt={}...",
        query_id, event_session_key,
        request.model.as_deref().unwrap_or(DEFAULT_MODEL),
        request.session_id.as_deref().unwrap_or("(new)"),
        &request.prompt[..std::cmp::min(80, request.prompt.len())]);

    send_to_daemon(&cmd_str).await.map_err(|e| {
        // Remove query from tracking on send failure
        let query_id_clone = query_id.clone();
        tokio::spawn(async move {
            let mut queries = DAEMON_QUERIES.lock().await;
            queries.remove(&query_id_clone);
        });
        e
    })?;

    // Wait for completion with a smart timeout:
    // - Hard limit of 10 minutes for AI processing
    // - Timeout pauses automatically while waiting for user input (plan approval / ask-user-question)
    const PROCESSING_TIMEOUT_SECS: u64 = 3600;
    const CHECK_INTERVAL_SECS: u64 = 15;

    tokio::pin!(rx);
    let mut deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(PROCESSING_TIMEOUT_SECS);

    loop {
        let time_remaining = deadline.saturating_duration_since(tokio::time::Instant::now());
        // Poll every CHECK_INTERVAL_SECS so we can re-evaluate waiting_for_user
        let wait_dur = std::cmp::min(
            std::time::Duration::from_secs(CHECK_INTERVAL_SECS),
            time_remaining + std::time::Duration::from_millis(1),
        );

        match tokio::time::timeout(wait_dur, &mut rx).await {
            Ok(Ok(result)) => {
                log::info!("[DAEMON:QUERY] query={} finished successfully", query_id);
                break result;
            }
            Ok(Err(_)) => {
                log::error!("[DAEMON:QUERY] query={} completion channel dropped", query_id);
                let mut queries = DAEMON_QUERIES.lock().await;
                queries.remove(&query_id);
                break Err("Query completion channel was dropped unexpectedly".to_string());
            }
            Err(_) => {
                // Interval elapsed — check whether we're waiting for the user
                if waiting_for_user.load(std::sync::atomic::Ordering::Relaxed) {
                    // User is reviewing a plan or answering a question: extend deadline
                    deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(PROCESSING_TIMEOUT_SECS);
                    log::debug!("[DAEMON:QUERY] query={} waiting for user input — timeout extended", query_id);
                } else if tokio::time::Instant::now() >= deadline {
                    log::error!("[DAEMON:QUERY] query={} timed out after {}s", query_id, PROCESSING_TIMEOUT_SECS);
                    let abort_cmd = serde_json::json!({"type": "abort", "queryId": query_id});
                    let _ = send_to_daemon(&abort_cmd.to_string()).await;
                    let mut queries = DAEMON_QUERIES.lock().await;
                    queries.remove(&query_id);
                    break Err("Query timed out after 60 minutes".to_string());
                }
            }
        }
    }
}

/// Send answers to an AskUserQuestion request via daemon stdin.
#[tauri::command]
pub async fn answer_user_question(
    agent_id: String,  // Actually the processKey (sessionKey or agentId)
    request_id: String,
    answers: serde_json::Value,
) -> Result<(), String> {
    log::info!("[DAEMON:INTERACT] answer_user_question process={} requestId={}", agent_id, request_id);

    // Verify daemon has a matching active query for this agent/session
    let has_matching_query = {
        let queries = DAEMON_QUERIES.lock().await;
        queries.values().any(|state| {
            state.session_key == agent_id || state.agent_id == agent_id
        })
    };

    if !has_matching_query {
        return Err(format!(
            "No active daemon query found for process={}. The query may have already completed.",
            agent_id
        ));
    }

    log::info!("[DAEMON:INTERACT] Routing answer via daemon for requestId={} (matching query found)", request_id);

    // Resume the query timeout now that user has responded
    {
        let queries = DAEMON_QUERIES.lock().await;
        for state in queries.values() {
            if state.session_key == agent_id || state.agent_id == agent_id {
                state.waiting_for_user.store(false, std::sync::atomic::Ordering::Relaxed);
                break;
            }
        }
    }

    let cmd = serde_json::json!({
        "type": "response",
        "requestId": request_id,
        "answers": answers,
    });
    send_to_daemon(&cmd.to_string()).await
}

/// Helper to resolve a node-sdk script path (resource dir → dev fallback)
fn get_node_sdk_script(app: &AppHandle, script_name: &str) -> Result<PathBuf, String> {
    // 1. Production: bundled resource directory
    if let Ok(resource_path) = app.path().resource_dir() {
        let script_path = resource_path.join("node-sdk").join(script_name);
        if script_path.exists() {
            return Ok(sanitize_path_for_node(&script_path));
        }
    }

    // 2. Development: CARGO_MANIFEST_DIR (src-tauri/)
    let dev_path = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("node-sdk")
        .join(script_name);

    if dev_path.exists() {
        return Ok(sanitize_path_for_node(&dev_path));
    }

    Err(format!("Could not find {} in resource dir or dev path", script_name))
}

/// Helper to get the rewind-files script path
fn get_rewind_script_path(app: &AppHandle) -> Result<PathBuf, String> {
    get_node_sdk_script(app, "rewind-files.js")
}

/// Helper to get the Node.js executable path (bundled sidecar or system Node.js)
fn get_bundled_node_path(app: &AppHandle) -> Result<PathBuf, String> {
    let is_production = !cfg!(debug_assertions);

    log::info!("[Node.js] Looking for Node.js executable (production: {})", is_production);

    let node_path = if is_production {
        // Production mode: Try bundled sidecar first
        let sidecar_name = "node-sidecar";

        let sidecar_path = app.path().resolve(
            sidecar_name,
            tauri::path::BaseDirectory::Resource
        ).ok().or_else(|| {
            // Strategy 2: Manual path construction
            if let Ok(exe_path) = std::env::current_exe() {
                if let Some(macos_dir) = exe_path.parent() {
                    let manual_path = macos_dir.join(sidecar_name);
                    if manual_path.exists() {
                        return Some(manual_path);
                    }
                }
            }
            None
        });

        match sidecar_path {
            Some(path) if path.exists() => {
                log::info!("[Node.js] ✅ Found bundled Node.js sidecar at: {:?}", path);
                Some(path)
            }
            _ => {
                log::warn!("[Node.js] ⚠️ Falling back to system Node.js...");
                find_system_node_executable()
            }
        }
    } else {
        // Development mode: Use system Node.js directly
        log::info!("[Node.js] Development mode - using system Node.js");
        find_system_node_executable()
    };

    node_path
        .map(|p| sanitize_path_for_node(&p))
        .ok_or_else(|| {
            "Node.js executable not found. Please install Node.js or ensure it's in your PATH.".to_string()
        })
}

/// Rewind files to a previous state using SDK file checkpointing
/// This calls the rewind-files.js script to restore files to their state
/// at a specific user message in the conversation
#[tauri::command]
pub async fn rewind_files(
    app: AppHandle,
    session_id: String,
    user_message_id: String,
    dry_run: Option<bool>,
) -> Result<serde_json::Value, String> {
    log::info!("[SDK REWIND] Starting rewind operation");
    log::info!("[SDK REWIND] Session: {}", session_id);
    log::info!("[SDK REWIND] Target message: {}", user_message_id);
    log::info!("[SDK REWIND] Dry run: {:?}", dry_run);

    // Get the rewind script path
    let script_path = get_rewind_script_path(&app)?;
    log::info!("[SDK REWIND] Script path: {:?}", script_path);

    // Build config JSON
    let config = serde_json::json!({
        "sessionId": session_id,
        "userMessageId": user_message_id,
        "dryRun": dry_run.unwrap_or(false),
    });

    let config_str = serde_json::to_string(&config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    // Get node path
    let node_path = get_bundled_node_path(&app)?;
    log::info!("[SDK REWIND] Node path: {:?}", node_path);

    // Spawn the rewind process with sanitized current_dir to prevent EISDIR on Windows
    let rewind_cwd = sanitize_path_for_node(
        &std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    );
    let mut cmd = Command::new(&node_path);
    cmd.arg(&script_path)
        .arg(&config_str)
        .current_dir(&rewind_cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Windows: Hide console window
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = cmd.spawn()
        .map_err(|e| format!("Failed to spawn rewind process: {}", e))?;

    let stdout = child.stdout.take()
        .ok_or_else(|| "Failed to capture stdout".to_string())?;
    let stderr = child.stderr.take()
        .ok_or_else(|| "Failed to capture stderr".to_string())?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut result: Option<serde_json::Value> = None;
    let mut error_output = Vec::new();

    // Read stdout (JSON events)
    while let Ok(Some(line)) = stdout_reader.next_line().await {
        log::debug!("[SDK REWIND] stdout: {}", line);
        if let Ok(event) = serde_json::from_str::<serde_json::Value>(&line) {
            let event_type = event.get("type").and_then(|t| t.as_str()).unwrap_or("");
            match event_type {
                "rewind_completed" => {
                    log::info!("[SDK REWIND] Rewind completed successfully");
                    result = Some(serde_json::json!({
                        "success": true,
                        "type": "completed",
                        "sessionId": session_id,
                        "userMessageId": user_message_id,
                    }));
                }
                "rewind_preview" => {
                    log::info!("[SDK REWIND] Preview result: {:?}", event);
                    result = Some(event);
                }
                "error" => {
                    let error_msg = event.get("error").and_then(|e| e.as_str()).unwrap_or("Unknown error");
                    return Err(format!("Rewind failed: {}", error_msg));
                }
                _ => {}
            }
        }
    }

    // Read any stderr (debug logs)
    while let Ok(Some(line)) = stderr_reader.next_line().await {
        log::debug!("[SDK REWIND] stderr: {}", line);
        error_output.push(line);
    }

    // Wait for process to complete
    let status = child.wait().await
        .map_err(|e| format!("Failed to wait for rewind process: {}", e))?;

    if !status.success() {
        let error_msg = error_output.join("\n");
        return Err(format!("Rewind process failed with exit code {:?}: {}", status.code(), error_msg));
    }

    result.ok_or_else(|| "No result from rewind operation".to_string())
}


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cli_availability() {
        // This test will only pass if Claude CLI is installed
        let available = check_claude_cli_available().unwrap_or(false);
        println!("Claude CLI available: {}", available);
    }
}
