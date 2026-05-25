//! Remote API Endpoints
//!
//! REST API for external tools (nami, n8n, Shortcuts) and mobile dashboard.
//! All /api/* routes require Bearer token auth (checked via ApiState).

use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

use crate::remote_auth::RemoteAuthState;
use crate::remote_ws::{WsBroadcast, WsEvent};

// ─── Shared State ──────────────────────────────────────────────────

/// Per-session live state mirrored from the desktop frontend (chatLoadingMap,
/// pendingQuestionsMap, last assistant message status). Powers the mobile PWA
/// Task Hub priority computation.
///
/// Brain: pattern-remote-api-architecture
#[derive(Clone, Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionLiveEntry {
    pub is_streaming: bool,
    pub pending_question_count: u32,
    pub last_message_role: Option<String>,
    pub last_message_status: Option<String>,
    pub last_activity_ms: i64,
}

pub type SessionLiveStateMap =
    std::sync::Arc<std::sync::RwLock<std::collections::HashMap<String, SessionLiveEntry>>>;

#[derive(Clone)]
pub struct ApiState {
    pub app: AppHandle,
    pub auth: RemoteAuthState,
    pub agent_status: crate::AgentStatusMap,
    pub session_live: SessionLiveStateMap,
    pub ws_broadcast: WsBroadcast,
}

impl ApiState {
    /// Validate Bearer token from request headers. Returns Err(401) if invalid.
    async fn check_auth(&self, headers: &HeaderMap) -> Result<(), (StatusCode, Json<ApiError>)> {
        let expected = self.auth.get_token().await;
        let expected_token = match expected.as_deref() {
            Some(t) => t,
            None => {
                return Err((
                    StatusCode::SERVICE_UNAVAILABLE,
                    Json(ApiError { error: "Auth not initialized".into() }),
                ));
            }
        };

        let provided = headers
            .get("authorization")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.strip_prefix("Bearer "));

        match provided {
            Some(token) if token == expected_token => Ok(()),
            _ => Err((
                StatusCode::UNAUTHORIZED,
                Json(ApiError { error: "Invalid or missing Bearer token".into() }),
            )),
        }
    }
}

// ─── Response Types ────────────────────────────────────────────────

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StatusResponse {
    version: String,
    uptime_secs: u64,
    agent_count: usize,
    active_session_count: usize,
    remote_enabled: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct AgentSummary {
    id: String,
    name: String,
    status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    avatar: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    color: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    working_on: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    branch: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_active_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    created_at: Option<i64>,
    display_order: i64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionSummary {
    id: String,
    title: String,
    agent_id: String,
    status: String,
    created_at: i64,
    updated_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    message_count: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    claude_session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_path: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    project_color: Option<String>,
    // Live-state fields (mirrored from desktop chatStore via notify_* commands).
    // Used by the mobile PWA to compute Task Hub priorities without an extra round-trip.
    is_streaming: bool,
    pending_question_count: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_message_role: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_message_status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_activity_at: Option<i64>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ChatMessage {
    role: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct JobSummary {
    id: String,
    name: String,
    agent_name: String,
    cron_expression: String,
    enabled: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    next_run_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_run_at: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    last_run_status: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateJobRequest {
    name: String,
    cron_expression: String,
    agent_id: String,
    agent_name: String,
    project_path: String,
    project_name: String,
    prompt_template: String,
    #[serde(default)]
    model: Option<String>,
    #[serde(default = "default_true")]
    enabled: bool,
    #[serde(default)]
    timeout_minutes: Option<i64>,
    #[serde(default)]
    skip_if_running: Option<bool>,
}

fn default_true() -> bool { true }

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct UpdateJobRequest {
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    cron_expression: Option<String>,
    #[serde(default)]
    agent_id: Option<String>,
    #[serde(default)]
    agent_name: Option<String>,
    #[serde(default)]
    project_path: Option<String>,
    #[serde(default)]
    project_name: Option<String>,
    #[serde(default)]
    prompt_template: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    enabled: Option<bool>,
    #[serde(default)]
    timeout_minutes: Option<i64>,
    #[serde(default)]
    skip_if_running: Option<bool>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExecuteRequest {
    agent_id: String,
    prompt: String,
    #[serde(default)]
    project_path: Option<String>,
    #[serde(default)]
    model: Option<String>,
    #[serde(default)]
    lead_session_id: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ExecuteResponse {
    success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    error: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct RepoOrderData {
    order: Vec<String>,
    colors: std::collections::HashMap<String, String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct OrderingResponse {
    repo_order: RepoOrderData,
    agent_orders: std::collections::HashMap<String, serde_json::Value>,
}

#[derive(Serialize, Clone)]
struct ApiError {
    error: String,
}

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<ApiError>)>;

// ─── Router ────────────────────────────────────────────────────────

/// Create the /api sub-router. Mount via `nest("/api", ...)` in lib.rs.
pub fn create_api_router(
    app: AppHandle,
    auth: RemoteAuthState,
    agent_status: crate::AgentStatusMap,
    session_live: SessionLiveStateMap,
    ws_broadcast: WsBroadcast,
) -> Router {
    let state = ApiState { app, auth, agent_status, session_live, ws_broadcast };

    Router::new()
        .route("/status", get(handle_status))
        .route("/agents", get(handle_list_agents))
        .route("/agents/:id", get(handle_get_agent))
        .route("/sessions", get(handle_list_sessions))
        .route("/sessions/:id", get(handle_get_session).delete(handle_delete_session))
        .route("/jobs", get(handle_list_jobs).post(handle_create_job))
        .route("/jobs/:id", put(handle_update_job).delete(handle_delete_job))
        .route("/jobs/:id/fire", post(handle_fire_job))
        .route("/jobs/:id/toggle", post(handle_toggle_job))
        .route("/execute", post(handle_execute))
        .route("/ordering", get(handle_ordering))
        .route("/groups", get(handle_list_groups))
        .route("/project-colors", get(handle_project_colors))
        .route("/sessions/:id/messages", get(handle_session_messages))
        .route("/sessions/:id/send", post(handle_send_message))
        .route("/avatars/:filename", get(handle_avatar))
        .with_state(state)
}

// ─── Storage Helpers ───────────────────────────────────────────────

fn get_app_data_dir() -> Option<std::path::PathBuf> {
    if cfg!(target_os = "macos") {
        dirs::home_dir()
            .map(|h| h.join("Library/Application Support/com.quack.terminal"))
    } else if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .ok()
            .map(|p| std::path::PathBuf::from(p).join("com.quack.terminal"))
    } else {
        dirs::home_dir()
            .map(|h| h.join(".local/share/com.quack.terminal"))
    }
}

fn get_agents_storage_path() -> Option<std::path::PathBuf> {
    get_app_data_dir().map(|d| d.join("quack-agents.json"))
}

/// Read a Tauri Store `.dat` file (plain JSON on disk).
fn read_dat_store(filename: &str) -> serde_json::Value {
    get_app_data_dir()
        .map(|dir| dir.join(filename))
        .and_then(|path| std::fs::read_to_string(&path).ok())
        .and_then(|content| serde_json::from_str(&content).ok())
        .unwrap_or(serde_json::json!({}))
}

pub(crate) fn read_agents_storage() -> Result<serde_json::Value, String> {
    let path = get_agents_storage_path()
        .ok_or_else(|| "Cannot determine storage path".to_string())?;
    let content = std::fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read storage: {}", e))?;
    serde_json::from_str(&content)
        .map_err(|e| format!("Failed to parse storage: {}", e))
}

fn read_automation_jobs(app: &AppHandle) -> Vec<serde_json::Value> {
    let store = match app.store("quack-automations.json") {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    store
        .get("jobs")
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default()
}

// ─── Uptime ────────────────────────────────────────────────────────

static START_TIME: std::sync::OnceLock<std::time::Instant> = std::sync::OnceLock::new();

pub fn init_uptime() {
    START_TIME.get_or_init(std::time::Instant::now);
}

fn uptime_secs() -> u64 {
    START_TIME.get().map(|t| t.elapsed().as_secs()).unwrap_or(0)
}

fn err(msg: impl Into<String>) -> (StatusCode, Json<ApiError>) {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: msg.into() }))
}

// ─── Handlers ──────────────────────────────────────────────────────

async fn handle_status(
    headers: HeaderMap,
    State(state): State<ApiState>,
) -> ApiResult<StatusResponse> {
    state.check_auth(&headers).await?;

    let storage = read_agents_storage().map_err(err)?;

    let agent_count = storage
        .get("agents")
        .and_then(|a| a.as_array())
        .map(|a| a.len())
        .unwrap_or(0);

    let active_sessions = storage
        .get("sessions")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .filter(|s| {
                    s.get("status")
                        .and_then(|v| v.as_str())
                        .map(|st| st == "in_progress" || st == "running")
                        .unwrap_or(false)
                })
                .count()
        })
        .unwrap_or(0);

    let remote_enabled = state.auth.is_enabled().await;

    Ok(Json(StatusResponse {
        version: env!("CARGO_PKG_VERSION").to_string(),
        uptime_secs: uptime_secs(),
        agent_count,
        active_session_count: active_sessions,
        remote_enabled,
    }))
}

async fn handle_list_agents(
    headers: HeaderMap,
    State(state): State<ApiState>,
) -> ApiResult<Vec<AgentSummary>> {
    state.check_auth(&headers).await?;

    let storage = read_agents_storage().map_err(err)?;

    // Read real-time agent status from global AGENT_STATUS map
    // Brain: gotcha-mobile-session-dot-status
    // Updated by: (1) handle_status_update hook, (2) daemon_stdout_reader, (3) legacy streaming
    let live_status = state.agent_status.read().ok();

    let agents = storage
        .get("agents")
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .enumerate()
                .map(|(idx, a)| {
                    let agent_id = a.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let agent_name = a.get("name").and_then(|v| v.as_str())
                        .or_else(|| a.get("label").and_then(|v| v.as_str()))
                        .unwrap_or("").to_string();
                    let role = a.get("personality")
                        .and_then(|p| p.get("role"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    // Prefer live in-memory status over stale disk value.
                    // Look up by agent ID first, then by agent name (hook may use either).
                    let status = live_status.as_ref()
                        .and_then(|map| {
                            map.get(&agent_id).cloned()
                                .or_else(|| map.get(&agent_name).cloned())
                        })
                        .unwrap_or_else(|| {
                            a.get("status").and_then(|v| v.as_str()).unwrap_or("idle").to_string()
                        });
                    AgentSummary {
                        id: agent_id,
                        name: a.get("name").and_then(|v| v.as_str())
                            .or_else(|| a.get("label").and_then(|v| v.as_str()))
                            .unwrap_or("Agent").to_string(),
                        status,
                        avatar: a.get("avatar").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        color: a.get("color").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        role,
                        project_name: a.get("projectName").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        project_path: a.get("projectPath").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        working_on: a.get("workingOn").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        branch: a.get("branch").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        last_active_at: a.get("lastActiveAt").and_then(|v| v.as_i64()),
                        created_at: a.get("createdAt").and_then(|v| v.as_i64()),
                        display_order: idx as i64,
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(Json(agents))
}

async fn handle_get_agent(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(agent_id): Path<String>,
) -> ApiResult<serde_json::Value> {
    state.check_auth(&headers).await?;

    let storage = read_agents_storage().map_err(err)?;

    let agent = storage
        .get("agents")
        .and_then(|a| a.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|a| a.get("id").and_then(|v| v.as_str()) == Some(&agent_id))
        })
        .cloned();

    match agent {
        Some(a) => Ok(Json(a)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ApiError { error: format!("Agent not found: {}", agent_id) }),
        )),
    }
}

async fn handle_list_sessions(
    headers: HeaderMap,
    State(state): State<ApiState>,
) -> ApiResult<Vec<SessionSummary>> {
    state.check_auth(&headers).await?;

    let storage = read_agents_storage().map_err(err)?;
    let live = state.session_live.read().ok();
    let colors = load_repo_colors();

    let sessions = storage
        .get("sessions")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .map(|s| {
                    let id = s.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string();
                    let created_at = s.get("createdAt").and_then(|v| v.as_i64()).unwrap_or(0);
                    let updated_at = s.get("updatedAt").and_then(|v| v.as_i64()).unwrap_or(created_at);
                    let project_path = s.get("projectPath").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let project_name = s.get("projectName").and_then(|v| v.as_str()).map(|s| s.to_string());
                    let project_color = project_path
                        .as_deref()
                        .and_then(|p| resolve_project_color(p, &colors));

                    let live_entry = live.as_ref().and_then(|m| m.get(&id).cloned());

                    SessionSummary {
                        id: id.clone(),
                        title: s.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        agent_id: s.get("agentId").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        status: s.get("status").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                        created_at,
                        updated_at,
                        message_count: s.get("messageCount").and_then(|v| v.as_i64()),
                        claude_session_id: s.get("claudeSessionId").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        project_name,
                        project_path,
                        project_color,
                        is_streaming: live_entry.as_ref().map(|e| e.is_streaming).unwrap_or(false),
                        pending_question_count: live_entry.as_ref().map(|e| e.pending_question_count).unwrap_or(0),
                        last_message_role: live_entry.as_ref().and_then(|e| e.last_message_role.clone()),
                        last_message_status: live_entry.as_ref().and_then(|e| e.last_message_status.clone()),
                        last_activity_at: live_entry.as_ref().map(|e| e.last_activity_ms).filter(|t| *t > 0),
                    }
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(Json(sessions))
}

async fn handle_get_session(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(session_id): Path<String>,
) -> ApiResult<serde_json::Value> {
    state.check_auth(&headers).await?;

    let storage = read_agents_storage().map_err(err)?;

    let session = storage
        .get("sessions")
        .and_then(|s| s.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(&session_id))
        })
        .cloned();

    match session {
        Some(s) => Ok(Json(s)),
        None => Err((
            StatusCode::NOT_FOUND,
            Json(ApiError { error: format!("Session not found: {}", session_id) }),
        )),
    }
}

// ─── Session Messages ─────────────────────────────────────────────

/// Query params for message pagination.
/// If `limit` is set, returns the last N messages (with optional offset from the end).
/// If not set, returns all messages (backward compatible for polling).
#[derive(Deserialize)]
struct MessagesQuery {
    #[serde(default)]
    limit: Option<usize>,
    #[serde(default)]
    offset: Option<usize>,
}

async fn handle_session_messages(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(session_id): Path<String>,
    Query(query): Query<MessagesQuery>,
) -> Result<Response, (StatusCode, Json<ApiError>)> {
    state.check_auth(&headers).await?;

    // Find the claudeSessionId from the Quack session
    let storage = read_agents_storage().map_err(err)?;
    let session_entry = storage
        .get("sessions")
        .and_then(|s| s.as_array())
        .and_then(|arr| {
            arr.iter().find(|s| {
                s.get("id").and_then(|v| v.as_str()) == Some(&session_id)
            })
        });

    // Session not found at all
    if session_entry.is_none() {
        return Ok(Json(serde_json::json!([])).into_response());
    }

    // Session exists but claudeSessionId not set yet (agent still initializing)
    let claude_id = match session_entry
        .and_then(|s| s.get("claudeSessionId").and_then(|v| v.as_str()))
        .map(|s| s.to_string())
    {
        Some(id) if !id.is_empty() => id,
        _ => return Ok(Json(serde_json::json!([])).into_response()),
    };

    // Use the existing get_session_details function
    let details = crate::sessions::get_session_details(claude_id)
        .map_err(|e| err(format!("Failed to read messages: {}", e)))?;

    let all_messages: Vec<ChatMessage> = details
        .messages
        .into_iter()
        .map(|m| ChatMessage {
            role: m.role,
            content: m.content,
        })
        .collect();

    let total = all_messages.len();

    // If limit is set, return paginated slice (from the end)
    let messages = if let Some(limit) = query.limit {
        let offset = query.offset.unwrap_or(0);
        let start = total.saturating_sub(offset + limit);
        let end = total.saturating_sub(offset);
        all_messages[start..end].to_vec()
    } else {
        all_messages
    };

    Ok((
        StatusCode::OK,
        [("x-total-count", total.to_string())],
        Json(messages),
    ).into_response())
}

#[derive(Deserialize)]
struct SendMessageRequest {
    message: String,
}

async fn handle_send_message(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(session_id): Path<String>,
    Json(payload): Json<SendMessageRequest>,
) -> ApiResult<serde_json::Value> {
    state.check_auth(&headers).await?;

    // Brain: gotcha-mobile-session-dot-status
    // Look up agent_id from session and mark as busy immediately
    if let Ok(storage) = read_agents_storage() {
        if let Some(agent_id) = storage
            .get("sessions")
            .and_then(|s| s.as_array())
            .and_then(|arr| {
                arr.iter()
                    .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(&session_id))
                    .and_then(|s| s.get("agentId").and_then(|v| v.as_str()))
            })
        {
            if let Ok(mut map) = crate::AGENT_STATUS.write() {
                map.insert(agent_id.to_string(), "busy".to_string());
            }
        }
    }

    // Emit event for the frontend to pick up and send to the session
    let event_data = serde_json::json!({
        "sessionId": session_id,
        "message": payload.message,
        "source": "remote-dashboard",
    });

    state.app.emit("remote-send-message", &event_data).map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: format!("Failed to emit: {}", e) }))
    })?;

    Ok(Json(serde_json::json!({ "success": true })))
}

async fn handle_list_jobs(
    headers: HeaderMap,
    State(state): State<ApiState>,
) -> ApiResult<Vec<JobSummary>> {
    state.check_auth(&headers).await?;

    let jobs = read_automation_jobs(&state.app);

    let summaries: Vec<JobSummary> = jobs
        .iter()
        .map(|j| JobSummary {
            id: j.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            name: j.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            agent_name: j.get("agentName").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            cron_expression: j.get("cronExpression").and_then(|v| v.as_str()).unwrap_or("").to_string(),
            enabled: j.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false),
            next_run_at: j.get("nextRunAt").and_then(|v| v.as_i64()),
            last_run_at: j.get("lastRunAt").and_then(|v| v.as_i64()),
            last_run_status: j.get("lastRunStatus").and_then(|v| v.as_str()).map(|s| s.to_string()),
        })
        .collect();

    Ok(Json(summaries))
}

async fn handle_fire_job(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(job_id): Path<String>,
) -> ApiResult<serde_json::Value> {
    state.check_auth(&headers).await?;

    let jobs = read_automation_jobs(&state.app);

    let job = match jobs.iter().find(|j| {
        j.get("id").and_then(|v| v.as_str()) == Some(&job_id)
    }) {
        Some(j) => j.clone(),
        None => {
            return Err((
                StatusCode::NOT_FOUND,
                Json(ApiError { error: format!("Job not found: {}", job_id) }),
            ));
        }
    };

    let fire_event = serde_json::json!({
        "jobId": job_id,
        "jobName": job.get("name").and_then(|v| v.as_str()).unwrap_or(""),
        "agentId": job.get("agentId").and_then(|v| v.as_str()).unwrap_or(""),
        "agentName": job.get("agentName").and_then(|v| v.as_str()).unwrap_or(""),
        "projectPath": job.get("projectPath").and_then(|v| v.as_str()).unwrap_or(""),
        "projectName": job.get("projectName").and_then(|v| v.as_str()).unwrap_or(""),
        "prompt": job.get("promptTemplate").and_then(|v| v.as_str()).unwrap_or(""),
        "model": job.get("model"),
        "timeoutMinutes": job.get("timeoutMinutes"),
        "source": "remote-api",
    });

    state.app.emit("automation-fire-job", &fire_event).map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: format!("Failed to emit: {}", e) }))
    })?;

    log::info!("🚀 [Remote API] Fired job: {}", job_id);

    Ok(Json(serde_json::json!({ "success": true, "jobId": job_id })))
}

async fn handle_toggle_job(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(job_id): Path<String>,
) -> ApiResult<serde_json::Value> {
    state.check_auth(&headers).await?;

    let store = state.app.store("quack-automations.json").map_err(|e| err(e.to_string()))?;

    let mut jobs: Vec<serde_json::Value> = store
        .get("jobs")
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default();

    let mut found = false;
    let mut new_enabled = false;
    for job in jobs.iter_mut() {
        if job.get("id").and_then(|v| v.as_str()) == Some(&job_id) {
            found = true;
            let current = job.get("enabled").and_then(|v| v.as_bool()).unwrap_or(false);
            new_enabled = !current;
            job["enabled"] = serde_json::json!(new_enabled);
            break;
        }
    }

    if !found {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiError { error: format!("Job not found: {}", job_id) }),
        ));
    }

    store.set("jobs", serde_json::json!(jobs));
    let _ = state.app.emit("automation-jobs-updated", ());

    log::info!("🔄 [Remote API] Toggled job {}: enabled={}", job_id, new_enabled);

    Ok(Json(serde_json::json!({ "success": true, "jobId": job_id, "enabled": new_enabled })))
}

// ─── Job CRUD ─────────────────────────────────────────────────────

async fn handle_create_job(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Json(payload): Json<CreateJobRequest>,
) -> ApiResult<serde_json::Value> {
    state.check_auth(&headers).await?;

    let store = state.app.store("quack-automations.json").map_err(|e| err(e.to_string()))?;

    let mut jobs: Vec<serde_json::Value> = store
        .get("jobs")
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default();

    let now = chrono::Utc::now().timestamp_millis();
    let id = format!("auto-{}-{}", now, &uuid::Uuid::new_v4().to_string()[..6]);

    let new_job = serde_json::json!({
        "id": id,
        "name": payload.name,
        "cronExpression": payload.cron_expression,
        "agentId": payload.agent_id,
        "agentName": payload.agent_name,
        "projectPath": payload.project_path,
        "projectName": payload.project_name,
        "promptTemplate": payload.prompt_template,
        "model": payload.model,
        "enabled": payload.enabled,
        "createdAt": now,
        "updatedAt": now,
        "timeoutMinutes": payload.timeout_minutes.unwrap_or(10),
        "skipIfRunning": payload.skip_if_running.unwrap_or(true),
    });

    jobs.push(new_job.clone());
    store.set("jobs", serde_json::json!(jobs));
    let _ = state.app.emit("automation-jobs-updated", ());

    log::info!("✅ [Remote API] Created job: {} ({})", id, payload.name);

    Ok(Json(new_job))
}

async fn handle_update_job(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(job_id): Path<String>,
    Json(payload): Json<UpdateJobRequest>,
) -> ApiResult<serde_json::Value> {
    state.check_auth(&headers).await?;

    let store = state.app.store("quack-automations.json").map_err(|e| err(e.to_string()))?;

    let mut jobs: Vec<serde_json::Value> = store
        .get("jobs")
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default();

    let mut found = false;
    let mut updated_job = serde_json::Value::Null;
    let now = chrono::Utc::now().timestamp_millis();

    for job in jobs.iter_mut() {
        if job.get("id").and_then(|v| v.as_str()) == Some(&job_id) {
            found = true;
            if let Some(name) = &payload.name { job["name"] = serde_json::json!(name); }
            if let Some(cron) = &payload.cron_expression { job["cronExpression"] = serde_json::json!(cron); }
            if let Some(agent_id) = &payload.agent_id { job["agentId"] = serde_json::json!(agent_id); }
            if let Some(agent_name) = &payload.agent_name { job["agentName"] = serde_json::json!(agent_name); }
            if let Some(project_path) = &payload.project_path { job["projectPath"] = serde_json::json!(project_path); }
            if let Some(project_name) = &payload.project_name { job["projectName"] = serde_json::json!(project_name); }
            if let Some(prompt) = &payload.prompt_template { job["promptTemplate"] = serde_json::json!(prompt); }
            if let Some(model) = &payload.model { job["model"] = serde_json::json!(model); }
            if let Some(enabled) = payload.enabled { job["enabled"] = serde_json::json!(enabled); }
            if let Some(timeout) = payload.timeout_minutes { job["timeoutMinutes"] = serde_json::json!(timeout); }
            if let Some(skip) = payload.skip_if_running { job["skipIfRunning"] = serde_json::json!(skip); }
            job["updatedAt"] = serde_json::json!(now);
            updated_job = job.clone();
            break;
        }
    }

    if !found {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiError { error: format!("Job not found: {}", job_id) }),
        ));
    }

    store.set("jobs", serde_json::json!(jobs));
    let _ = state.app.emit("automation-jobs-updated", ());

    log::info!("📝 [Remote API] Updated job: {}", job_id);

    Ok(Json(updated_job))
}

async fn handle_delete_job(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(job_id): Path<String>,
) -> ApiResult<serde_json::Value> {
    state.check_auth(&headers).await?;

    let store = state.app.store("quack-automations.json").map_err(|e| err(e.to_string()))?;

    let jobs: Vec<serde_json::Value> = store
        .get("jobs")
        .and_then(|v| v.as_array().cloned())
        .unwrap_or_default();

    let original_len = jobs.len();
    let filtered: Vec<serde_json::Value> = jobs
        .into_iter()
        .filter(|j| j.get("id").and_then(|v| v.as_str()) != Some(&job_id))
        .collect();

    if filtered.len() == original_len {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiError { error: format!("Job not found: {}", job_id) }),
        ));
    }

    store.set("jobs", serde_json::json!(filtered));
    let _ = state.app.emit("automation-jobs-updated", ());

    log::info!("🗑️ [Remote API] Deleted job: {}", job_id);

    Ok(Json(serde_json::json!({ "success": true, "jobId": job_id })))
}

// ─── Session Delete ───────────────────────────────────────────────

async fn handle_delete_session(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(session_id): Path<String>,
) -> ApiResult<serde_json::Value> {
    state.check_auth(&headers).await?;

    // 1. Remove from agents storage (quack-agents.json)
    let path = get_agents_storage_path()
        .ok_or_else(|| err("Cannot determine storage path"))?;
    let content = std::fs::read_to_string(&path)
        .map_err(|e| err(format!("Failed to read storage: {}", e)))?;
    let mut storage: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| err(format!("Failed to parse storage: {}", e)))?;

    let removed = if let Some(sessions) = storage.get_mut("sessions").and_then(|s| s.as_array_mut()) {
        let before = sessions.len();
        sessions.retain(|s| s.get("id").and_then(|v| v.as_str()) != Some(&session_id));
        before != sessions.len()
    } else {
        false
    };

    if !removed {
        return Err((
            StatusCode::NOT_FOUND,
            Json(ApiError { error: format!("Session not found: {}", session_id) }),
        ));
    }

    // Write back
    let updated = serde_json::to_string_pretty(&storage)
        .map_err(|e| err(format!("Failed to serialize: {}", e)))?;
    std::fs::write(&path, updated)
        .map_err(|e| err(format!("Failed to write storage: {}", e)))?;

    // 2. Try to delete Claude SDK session file (best-effort)
    let _ = crate::sessions::delete_session(session_id.clone());

    // 3. Notify frontend to reload sessions
    let _ = state.app.emit("sessions-updated", ());

    log::info!("🗑️ [Remote API] Deleted session: {}", session_id);

    Ok(Json(serde_json::json!({ "success": true, "sessionId": session_id })))
}

// ─── Execute ──────────────────────────────────────────────────────

async fn handle_execute(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Json(payload): Json<ExecuteRequest>,
) -> ApiResult<ExecuteResponse> {
    state.check_auth(&headers).await?;

    let storage = read_agents_storage().map_err(err)?;

    let agent = storage
        .get("agents")
        .and_then(|a| a.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|a| a.get("id").and_then(|v| v.as_str()) == Some(&payload.agent_id))
        })
        .cloned();

    let agent = match agent {
        Some(a) => a,
        None => {
            return Ok(Json(ExecuteResponse {
                success: false,
                session_id: None,
                error: Some(format!("Agent not found: {}", payload.agent_id)),
            }));
        }
    };

    let project_path = payload.project_path.unwrap_or_else(|| {
        agent.get("cwd").and_then(|v| v.as_str()).unwrap_or("").to_string()
    });

    let project_name = std::path::Path::new(&project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let session_id = format!("session-{}", uuid::Uuid::new_v4());

    let execute_event = serde_json::json!({
        "sessionId": session_id,
        "agentId": payload.agent_id,
        "agentName": agent.get("label").and_then(|v| v.as_str()).unwrap_or(""),
        "projectPath": project_path,
        "projectName": project_name,
        "prompt": payload.prompt,
        "model": payload.model.as_deref().filter(|m| !m.is_empty()),
        "leadSessionId": payload.lead_session_id,
        "source": "remote-api",
        "autoSend": true,
    });

    // Brain: gotcha-mobile-session-dot-status
    // Mark agent as busy IMMEDIATELY so the REST API returns "busy"
    // before the daemon even starts streaming (covers the "waiting" gap)
    if let Ok(mut map) = crate::AGENT_STATUS.write() {
        map.insert(payload.agent_id.clone(), "busy".to_string());
    }

    state.app.emit("remote-execute", &execute_event).map_err(|e| {
        (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: format!("Failed to emit: {}", e) }))
    })?;

    log::info!(
        "🚀 [Remote API] Execute: agent={}, prompt={}...",
        payload.agent_id,
        &payload.prompt[..payload.prompt.len().min(50)]
    );

    Ok(Json(ExecuteResponse {
        success: true,
        session_id: Some(session_id),
        error: None,
    }))
}

// ─── Ordering Endpoint ────────────────────────────────────────────

async fn handle_ordering(
    headers: HeaderMap,
    State(state): State<ApiState>,
) -> ApiResult<OrderingResponse> {
    state.check_auth(&headers).await?;

    // Read .quack-repo-order.dat (Tauri Store = plain JSON)
    let repo_store = read_dat_store(".quack-repo-order.dat");
    let repo_order = if let Some(raw) = repo_store.get("repository-order") {
        if let Some(obj) = raw.as_object() {
            // New format: { order: [...], colors: {...} }
            let order = obj.get("order")
                .and_then(|v| v.as_array())
                .map(|a| a.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
                .unwrap_or_default();
            let colors = obj.get("colors")
                .and_then(|v| v.as_object())
                .map(|m| m.iter().map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string())).collect())
                .unwrap_or_default();
            RepoOrderData { order, colors }
        } else if let Some(arr) = raw.as_array() {
            // Legacy format: plain array
            let order = arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect();
            RepoOrderData { order, colors: Default::default() }
        } else {
            RepoOrderData { order: vec![], colors: Default::default() }
        }
    } else {
        RepoOrderData { order: vec![], colors: Default::default() }
    };

    // Read .quack-agent-order.dat — keys are agent-order-${repoPath}
    let agent_store = read_dat_store(".quack-agent-order.dat");
    let agent_orders = if let Some(obj) = agent_store.as_object() {
        obj.iter()
            .filter(|(k, _)| k.starts_with("agent-order-"))
            .map(|(k, v)| {
                let repo_path = k.strip_prefix("agent-order-").unwrap_or(k).to_string();
                (repo_path, v.clone())
            })
            .collect()
    } else {
        Default::default()
    };

    Ok(Json(OrderingResponse { repo_order, agent_orders }))
}

// ─── Groups Endpoint ──────────────────────────────────────────────

async fn handle_list_groups(
    headers: HeaderMap,
    State(state): State<ApiState>,
) -> ApiResult<Vec<crate::groups::ProjectGroup>> {
    state.check_auth(&headers).await?;
    let groups = crate::groups::list_groups().map_err(err)?;
    Ok(Json(groups))
}

// ─── Avatar Endpoint ──────────────────────────────────────────────

async fn handle_avatar(
    Path(filename): Path<String>,
    State(state): State<ApiState>,
) -> Response {
    // Sanitize: only allow alphanumeric + dash + dot, must end in .jpeg/.png
    if !filename.chars().all(|c| c.is_alphanumeric() || c == '-' || c == '.' || c == '_')
        || !(filename.ends_with(".jpeg") || filename.ends_with(".jpg") || filename.ends_with(".png"))
    {
        return StatusCode::BAD_REQUEST.into_response();
    }

    // Try resource path (production bundle), then fallback to public/ (dev)
    let paths_to_try = vec![
        state.app.path().resource_dir()
            .ok()
            .map(|r| r.join("images/ducks/new-avatars").join(&filename)),
        Some(std::path::PathBuf::from(
            concat!(env!("CARGO_MANIFEST_DIR"), "/../public/images/ducks/new-avatars")
        ).join(&filename)),
    ];

    for maybe_path in paths_to_try.into_iter().flatten() {
        if let Ok(bytes) = std::fs::read(&maybe_path) {
            let content_type = if filename.ends_with(".png") {
                "image/png"
            } else {
                "image/jpeg"
            };
            return (
                StatusCode::OK,
                [
                    (header::CONTENT_TYPE, content_type),
                    (header::CACHE_CONTROL, "public, max-age=86400"),
                ],
                bytes,
            ).into_response();
        }
    }

    StatusCode::NOT_FOUND.into_response()
}

// ─── Tauri Command: Delegate Plan ────────────────────────────────────
// Brain: 047-plan-delegate-remote
// Called from PlanWidget.tsx to delegate a plan to another agent.
// Same logic as handle_execute but invoked directly via Tauri (no HTTP/CORS).

#[tauri::command]
pub async fn delegate_plan_to_agent(
    app: AppHandle,
    agent_id: String,
    prompt: String,
    lead_session_id: Option<String>,
    project_path: Option<String>,
) -> Result<String, String> {
    let storage = read_agents_storage().map_err(|e| format!("{:?}", e))?;

    let agent = storage
        .get("agents")
        .and_then(|a| a.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|a| a.get("id").and_then(|v| v.as_str()) == Some(&agent_id))
        })
        .cloned()
        .ok_or_else(|| format!("Agent not found: {}", agent_id))?;

    let path = project_path.unwrap_or_else(|| {
        agent.get("cwd").and_then(|v| v.as_str()).unwrap_or("").to_string()
    });

    let name = std::path::Path::new(&path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let session_id = format!("session-{}", uuid::Uuid::new_v4());

    let event = serde_json::json!({
        "sessionId": session_id,
        "agentId": agent_id,
        "agentName": agent.get("label").and_then(|v| v.as_str()).unwrap_or(""),
        "projectPath": path,
        "projectName": name,
        "prompt": prompt,
        "model": serde_json::Value::Null,
        "leadSessionId": lead_session_id,
        "source": "plan-delegate",
        "autoSend": true,
    });

    if let Ok(mut map) = crate::AGENT_STATUS.write() {
        map.insert(agent_id.clone(), "busy".to_string());
    }

    app.emit("remote-execute", &event)
        .map_err(|e| format!("Failed to emit: {}", e))?;

    log::info!("📋 [Delegate Plan] agent={}, session={}", agent_id, session_id);

    Ok(session_id)
}

// ─── Project Colors (for Task Hub chip) ──────────────────────────────
// Brain: pattern-remote-api-architecture
// Mirrors `useProjectColor` + `DEFAULT_PROJECT_COLORS` (src/utils/projectColors.ts).

const DEFAULT_PROJECT_COLORS: &[&str] = &[
    "#FF6B35", "#22D3EE", "#A855F7", "#F59E0B",
    "#10B981", "#EC4899", "#3B82F6", "#84CC16",
];

fn load_repo_colors() -> std::collections::HashMap<String, String> {
    let store = read_dat_store(".quack-repo-order.dat");
    store
        .get("repository-order")
        .and_then(|v| v.as_object())
        .and_then(|obj| obj.get("colors").and_then(|c| c.as_object()))
        .map(|m| {
            m.iter()
                .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                .filter(|(_, v)| !v.is_empty())
                .collect()
        })
        .unwrap_or_default()
}

fn project_repo_key(project_path: &str) -> String {
    // Mirrors `repo-${last segment of path}` from useProjectColor.
    let last = std::path::Path::new(project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or(project_path);
    format!("repo-{}", last)
}

fn fallback_color(project_path: &str) -> String {
    // Deterministic 32-bit string hash modulo palette length.
    let mut hash: u32 = 0;
    for c in project_path.chars() {
        hash = hash.wrapping_mul(31).wrapping_add(c as u32);
    }
    let idx = (hash as usize) % DEFAULT_PROJECT_COLORS.len();
    DEFAULT_PROJECT_COLORS[idx].to_string()
}

fn resolve_project_color(
    project_path: &str,
    colors: &std::collections::HashMap<String, String>,
) -> Option<String> {
    if project_path.is_empty() {
        return None;
    }
    let key = project_repo_key(project_path);
    Some(
        colors
            .get(&key)
            .cloned()
            .unwrap_or_else(|| fallback_color(project_path)),
    )
}

async fn handle_project_colors(
    headers: HeaderMap,
    State(state): State<ApiState>,
) -> ApiResult<std::collections::HashMap<String, String>> {
    state.check_auth(&headers).await?;
    let stored = load_repo_colors();

    // Augment: include any project_path referenced by current agents/sessions
    // with their deterministic fallback color, so the PWA can render chips
    // for repos that don't have a custom color yet.
    let mut out: std::collections::HashMap<String, String> = std::collections::HashMap::new();
    if let Ok(storage) = read_agents_storage() {
        let mut paths: std::collections::HashSet<String> = std::collections::HashSet::new();
        for key in ["agents", "sessions"] {
            if let Some(arr) = storage.get(key).and_then(|v| v.as_array()) {
                for entry in arr {
                    if let Some(p) = entry.get("projectPath").and_then(|v| v.as_str()) {
                        if !p.is_empty() {
                            paths.insert(p.to_string());
                        }
                    }
                }
            }
        }
        for path in paths {
            if let Some(color) = resolve_project_color(&path, &stored) {
                out.insert(path, color);
            }
        }
    }

    Ok(Json(out))
}

// ─── Notify Commands (frontend desktop → mobile PWA via WS) ──────────
// Brain: pattern-remote-api-architecture
//
// These three Tauri commands are invoked by the desktop React frontend
// (via `useRemoteLiveStateSync` hook) whenever in-memory state changes
// that the mobile PWA needs to mirror for its Task Hub view.
//
// They update `SessionLiveStateMap` and broadcast a `WsEvent` so connected
// PWA clients refresh badges/sections without polling.

fn update_session_live<F>(map: &SessionLiveStateMap, session_id: &str, mutator: F)
where
    F: FnOnce(&mut SessionLiveEntry),
{
    if let Ok(mut guard) = map.write() {
        let entry = guard.entry(session_id.to_string()).or_default();
        mutator(entry);
        entry.last_activity_ms = chrono::Utc::now().timestamp_millis();
    }
}

#[tauri::command]
pub fn notify_session_streaming(
    state: tauri::State<'_, SessionLiveStateMap>,
    broadcast: tauri::State<'_, WsBroadcast>,
    session_id: String,
    is_streaming: bool,
    agent_id: Option<String>,
) -> Result<(), String> {
    update_session_live(&state, &session_id, |entry| {
        entry.is_streaming = is_streaming;
    });
    broadcast.send(WsEvent::SessionStreaming {
        session_id,
        agent_id,
        is_streaming,
    });
    Ok(())
}

#[tauri::command]
pub fn notify_session_pending_question(
    state: tauri::State<'_, SessionLiveStateMap>,
    broadcast: tauri::State<'_, WsBroadcast>,
    session_id: String,
    count: u32,
    agent_id: Option<String>,
) -> Result<(), String> {
    update_session_live(&state, &session_id, |entry| {
        entry.pending_question_count = count;
    });
    broadcast.send(WsEvent::PendingQuestion {
        session_id,
        agent_id,
        count,
    });
    Ok(())
}

#[tauri::command]
pub fn notify_session_message(
    state: tauri::State<'_, SessionLiveStateMap>,
    broadcast: tauri::State<'_, WsBroadcast>,
    session_id: String,
    role: String,
    status: Option<String>,
    agent_id: Option<String>,
) -> Result<(), String> {
    let now = chrono::Utc::now().timestamp_millis();
    update_session_live(&state, &session_id, |entry| {
        entry.last_message_role = Some(role.clone());
        entry.last_message_status = status.clone();
    });
    broadcast.send(WsEvent::MessageAdded {
        session_id: session_id.clone(),
        agent_id: agent_id.clone(),
        role,
        status: status.clone(),
        timestamp: now,
    });
    broadcast.send(WsEvent::SessionUpdated {
        session_id,
        updated_at: now,
        last_message_role: None,
        last_message_status: status,
    });
    Ok(())
}
