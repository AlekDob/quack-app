//! Remote API Endpoints
//!
//! REST API for external tools (nami, n8n, Shortcuts) and mobile dashboard.
//! All /api/* routes require Bearer token auth (checked via ApiState).

use axum::{
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_store::StoreExt;

use crate::remote_auth::RemoteAuthState;

// ─── Shared State ──────────────────────────────────────────────────

#[derive(Clone)]
pub struct ApiState {
    pub app: AppHandle,
    pub auth: RemoteAuthState,
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
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionSummary {
    id: String,
    title: String,
    agent_id: String,
    status: String,
    created_at: i64,
    #[serde(skip_serializing_if = "Option::is_none")]
    message_count: Option<i64>,
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
struct ExecuteRequest {
    agent_id: String,
    prompt: String,
    #[serde(default)]
    project_path: Option<String>,
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

#[derive(Serialize, Clone)]
struct ApiError {
    error: String,
}

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<ApiError>)>;

// ─── Router ────────────────────────────────────────────────────────

/// Create the /api sub-router. Mount via `nest("/api", ...)` in lib.rs.
pub fn create_api_router(app: AppHandle, auth: RemoteAuthState) -> Router {
    let state = ApiState { app, auth };

    Router::new()
        .route("/status", get(handle_status))
        .route("/agents", get(handle_list_agents))
        .route("/agents/:id", get(handle_get_agent))
        .route("/sessions", get(handle_list_sessions))
        .route("/sessions/:id", get(handle_get_session))
        .route("/jobs", get(handle_list_jobs))
        .route("/jobs/:id/fire", post(handle_fire_job))
        .route("/jobs/:id/toggle", post(handle_toggle_job))
        .route("/execute", post(handle_execute))
        .route("/avatars/:filename", get(handle_avatar))
        .with_state(state)
}

// ─── Storage Helpers ───────────────────────────────────────────────

fn get_agents_storage_path() -> Option<std::path::PathBuf> {
    if cfg!(target_os = "macos") {
        dirs::home_dir()
            .map(|h| h.join("Library/Application Support/com.quack.terminal/quack-agents.json"))
    } else if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .ok()
            .map(|p| std::path::PathBuf::from(p).join("com.quack.terminal/quack-agents.json"))
    } else {
        dirs::home_dir()
            .map(|h| h.join(".local/share/com.quack.terminal/quack-agents.json"))
    }
}

fn read_agents_storage() -> Result<serde_json::Value, String> {
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

    let agents = storage
        .get("agents")
        .and_then(|a| a.as_array())
        .map(|arr| {
            arr.iter()
                .map(|a| {
                    let role = a.get("personality")
                        .and_then(|p| p.get("role"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());
                    AgentSummary {
                        id: a.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        name: a.get("name").and_then(|v| v.as_str())
                            .or_else(|| a.get("label").and_then(|v| v.as_str()))
                            .unwrap_or("Agent").to_string(),
                        status: a.get("status").and_then(|v| v.as_str()).unwrap_or("idle").to_string(),
                        avatar: a.get("avatar").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        color: a.get("color").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        role,
                        project_name: a.get("projectName").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        project_path: a.get("projectPath").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        working_on: a.get("workingOn").and_then(|v| v.as_str()).map(|s| s.to_string()),
                        branch: a.get("branch").and_then(|v| v.as_str()).map(|s| s.to_string()),
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

    let sessions = storage
        .get("sessions")
        .and_then(|s| s.as_array())
        .map(|arr| {
            arr.iter()
                .map(|s| SessionSummary {
                    id: s.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    title: s.get("title").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    agent_id: s.get("agentId").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                    status: s.get("status").and_then(|v| v.as_str()).unwrap_or("unknown").to_string(),
                    created_at: s.get("createdAt").and_then(|v| v.as_i64()).unwrap_or(0),
                    message_count: s.get("messageCount").and_then(|v| v.as_i64()),
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
        "source": "remote-api",
        "autoSend": true,
    });

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
