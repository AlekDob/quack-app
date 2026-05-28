//! Remote API — Terminal Management Endpoints
//!
//! REST endpoints for creating, managing, and reading terminal sessions
//! via the Remote API. Allows external agents (quack-remote skill) to
//! spawn visible terminals in Quack's UI and execute commands without blocking.

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use tauri::Emitter;

use crate::remote_api::{ApiError, ApiState};
use crate::remote_ws::WsEvent;
use crate::terminal;

// ─── Request / Response Types ──────────────────────────────────

#[derive(Deserialize)]
pub struct CreateTerminalRequest {
    cwd: String,
    label: Option<String>,
    color: Option<String>,
    #[serde(rename = "workingOn")]
    working_on: Option<String>,
}

#[derive(Deserialize)]
pub struct WriteTerminalRequest {
    data: String,
}

#[derive(Deserialize)]
pub struct OutputQuery {
    lines: Option<usize>,
    strip_ansi: Option<bool>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OutputResponse {
    terminal_id: String,
    lines: Vec<String>,
    total_lines: usize,
    alive: bool,
}

#[derive(Serialize)]
pub struct SuccessResponse {
    success: bool,
}

// ─── Event payload for frontend notification ───────────────────

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalListChangedPayload {
    pub terminal_id: String,
    pub action: String,
    pub cwd: Option<String>,
    pub label: Option<String>,
}

// ─── Helpers ───────────────────────────────────────────────────

type ApiResult<T> = Result<Json<T>, (StatusCode, Json<ApiError>)>;

fn err(msg: &str) -> (StatusCode, Json<ApiError>) {
    (StatusCode::INTERNAL_SERVER_ERROR, Json(ApiError { error: msg.to_string() }))
}

fn bad_request(msg: &str) -> (StatusCode, Json<ApiError>) {
    (StatusCode::BAD_REQUEST, Json(ApiError { error: msg.to_string() }))
}

fn not_found(msg: &str) -> (StatusCode, Json<ApiError>) {
    (StatusCode::NOT_FOUND, Json(ApiError { error: msg.to_string() }))
}

// ─── Handlers ──────────────────────────────────────────────────

pub async fn handle_create_terminal(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Json(body): Json<CreateTerminalRequest>,
) -> ApiResult<terminal::TerminalInfo> {
    state.check_auth(&headers).await?;

    let info = terminal::create_terminal_impl(
        &state.app,
        None,
        body.label.clone(),
        body.color.clone(),
        Some(body.cwd.clone()),
        body.working_on.clone(),
        None,
        None,
    ).map_err(|e| {
        let msg = e.to_string();
        if msg.contains("non valido") || msg.contains("non è una cartella") {
            bad_request(&msg)
        } else {
            err(&msg)
        }
    })?;

    let _ = state.app.emit("terminal-list-changed", TerminalListChangedPayload {
        terminal_id: info.id.clone(),
        action: "created".to_string(),
        cwd: Some(info.cwd.clone()),
        label: Some(info.label.clone()),
    });

    state.ws_broadcast.send(WsEvent::TerminalCreated {
        terminal_id: info.id.clone(),
        label: info.label.clone(),
        cwd: info.cwd.clone(),
        color: info.color.clone(),
    });

    Ok(Json(info))
}

pub async fn handle_list_terminals(
    headers: HeaderMap,
    State(state): State<ApiState>,
) -> ApiResult<Vec<terminal::TerminalInfo>> {
    state.check_auth(&headers).await?;
    let list = terminal::list_terminals_impl().map_err(|e| err(&e.to_string()))?;
    Ok(Json(list))
}

pub async fn handle_get_terminal(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> ApiResult<terminal::TerminalInfo> {
    state.check_auth(&headers).await?;
    let info = terminal::get_terminal_info(&id).map_err(|_| not_found("Terminal not found"))?;
    Ok(Json(info))
}

pub async fn handle_write_terminal(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(id): Path<String>,
    Json(body): Json<WriteTerminalRequest>,
) -> ApiResult<SuccessResponse> {
    state.check_auth(&headers).await?;
    terminal::write_to_terminal_impl(&id, &body.data)
        .map_err(|e| err(&e.to_string()))?;
    Ok(Json(SuccessResponse { success: true }))
}

pub async fn handle_terminal_output(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(id): Path<String>,
    Query(query): Query<OutputQuery>,
) -> ApiResult<OutputResponse> {
    state.check_auth(&headers).await?;
    let lines_count = query.lines.unwrap_or(100).min(5000);
    let strip = query.strip_ansi.unwrap_or(false);
    let (lines, total, alive) = terminal::read_terminal_output(&id, lines_count, strip)
        .map_err(|_| not_found("Terminal not found"))?;
    Ok(Json(OutputResponse { terminal_id: id, lines, total_lines: total, alive }))
}

pub async fn handle_close_terminal(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(id): Path<String>,
) -> ApiResult<SuccessResponse> {
    state.check_auth(&headers).await?;
    terminal::close_terminal_impl(&id).map_err(|e| err(&e.to_string()))?;

    let _ = state.app.emit("terminal-list-changed", TerminalListChangedPayload {
        terminal_id: id.clone(),
        action: "closed".to_string(),
        cwd: None,
        label: None,
    });

    state.ws_broadcast.send(WsEvent::TerminalClosed { terminal_id: id });

    Ok(Json(SuccessResponse { success: true }))
}
