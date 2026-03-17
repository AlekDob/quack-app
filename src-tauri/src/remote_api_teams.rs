//! Remote API — Team Endpoints
//!
//! Orchestrates agent teams via the Remote API. Each teammate = separate
//! Quack session, launched via the existing `remote-execute` event pattern.
//! Zero modifications to daemon or App.tsx.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;

use crate::remote_api::{err, read_agents_storage, ApiError, ApiResult, ApiState};

// ─── Constants ────────────────────────────────────────────────────

const TEAMS_STORE: &str = "quack-remote-teams.json";
const TEAMS_KEY: &str = "teams";

// ─── Types ────────────────────────────────────────────────────────

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTeam {
    pub id: String,
    pub name: String,
    pub lead_agent_id: String,
    pub members: Vec<RemoteTeamMember>,
    pub created_at: i64,
    pub status: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteTeamMember {
    pub agent_id: String,
    pub agent_name: String,
    pub role: Option<String>,
    pub task: String,
    pub session_id: Option<String>,
    pub status: String,
}

// ─── Request / Response ───────────────────────────────────────────

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTeamMember {
    agent_id: String,
    #[serde(default)]
    role: Option<String>,
    task: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateTeamRequest {
    name: String,
    lead_agent_id: String,
    members: Vec<CreateTeamMember>,
}

// ─── Router ───────────────────────────────────────────────────────

pub fn create_team_routes() -> Router<ApiState> {
    Router::new()
        .route("/teams", get(handle_list_teams).post(handle_create_team))
        .route("/teams/:id", get(handle_get_team).delete(handle_disband_team))
}

// ─── Storage Helpers ──────────────────────────────────────────────

fn read_teams(app: &AppHandle) -> Vec<RemoteTeam> {
    let store = match app.store(TEAMS_STORE) {
        Ok(s) => s,
        Err(_) => return vec![],
    };
    store
        .get(TEAMS_KEY)
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_default()
}

fn write_teams(app: &AppHandle, teams: &[RemoteTeam]) -> Result<(), String> {
    let store = app.store(TEAMS_STORE).map_err(|e| e.to_string())?;
    let val = serde_json::to_value(teams).map_err(|e| e.to_string())?;
    store.set(TEAMS_KEY, val);
    Ok(())
}

// ─── Handlers ─────────────────────────────────────────────────────

async fn handle_create_team(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Json(payload): Json<CreateTeamRequest>,
) -> ApiResult<RemoteTeam> {
    state.check_auth(&headers).await?;

    validate_create_request(&payload)?;

    let storage = read_agents_storage().map_err(err)?;
    let agents = storage
        .get("agents")
        .and_then(|a| a.as_array())
        .ok_or_else(|| err("No agents found"))?;

    let members = build_members(&payload.members, agents)?;
    let team = build_team(payload.name, payload.lead_agent_id, members);

    let mut teams = read_teams(&state.app);
    teams.push(team.clone());
    write_teams(&state.app, &teams).map_err(err)?;

    spawn_staggered_launch(state.app.clone(), team.members.clone());

    // Emit event for frontend to show team widget in lead's chat
    let team_event = serde_json::to_value(&team).unwrap_or_default();
    let _ = state.app.emit("team-created", &team_event);

    log::info!("🦆 [Remote Teams] Created team: {} ({})", team.name, team.id);
    Ok(Json(team))
}

async fn handle_list_teams(
    headers: HeaderMap,
    State(state): State<ApiState>,
) -> ApiResult<Vec<RemoteTeam>> {
    state.check_auth(&headers).await?;
    Ok(Json(read_teams(&state.app)))
}

async fn handle_get_team(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(team_id): Path<String>,
) -> ApiResult<serde_json::Value> {
    state.check_auth(&headers).await?;

    let mut teams = read_teams(&state.app);
    let team = teams
        .iter_mut()
        .find(|t| t.id == team_id)
        .ok_or_else(|| {
            (StatusCode::NOT_FOUND, Json(ApiError { error: format!("Team not found: {}", team_id) }))
        })?;

    // Auto-sync member statuses from live session data
    let sessions = read_agents_storage()
        .ok()
        .and_then(|s| s.get("sessions").and_then(|v| v.as_array().cloned()));

    let mut any_changed = false;
    for member in &mut team.members {
        let new_status = resolve_member_status(member, sessions.as_deref());
        if new_status != member.status {
            member.status = new_status;
            any_changed = true;
        }
    }

    // Auto-complete team when all members are done
    if team.status == "active" && team.members.iter().all(|m| m.status == "completed") {
        team.status = "completed".to_string();
        any_changed = true;
    }

    let response = serde_json::to_value(&*team).map_err(|e| err(e.to_string()))?;

    if any_changed {
        let _ = write_teams(&state.app, &teams);
    }

    Ok(Json(response))
}

async fn handle_disband_team(
    headers: HeaderMap,
    State(state): State<ApiState>,
    Path(team_id): Path<String>,
) -> ApiResult<serde_json::Value> {
    state.check_auth(&headers).await?;

    let mut teams = read_teams(&state.app);
    let team = teams
        .iter_mut()
        .find(|t| t.id == team_id)
        .ok_or_else(|| {
            (StatusCode::NOT_FOUND, Json(ApiError { error: format!("Team not found: {}", team_id) }))
        })?;

    if team.status == "disbanded" {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiError { error: "Team already disbanded".into() }),
        ));
    }

    team.status = "disbanded".to_string();
    write_teams(&state.app, &teams).map_err(err)?;

    log::info!("🦆 [Remote Teams] Disbanded team: {}", team_id);
    Ok(Json(serde_json::json!({ "success": true, "teamId": team_id })))
}

// ─── Validation ───────────────────────────────────────────────────

fn validate_create_request(
    req: &CreateTeamRequest,
) -> Result<(), (StatusCode, Json<ApiError>)> {
    if req.members.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(ApiError { error: "Team must have at least one member".into() }),
        ));
    }
    let mut seen = std::collections::HashSet::new();
    for m in &req.members {
        if !seen.insert(&m.agent_id) {
            return Err((
                StatusCode::BAD_REQUEST,
                Json(ApiError { error: format!("Duplicate agent: {}", m.agent_id) }),
            ));
        }
    }
    Ok(())
}

// ─── Builder Helpers ──────────────────────────────────────────────

fn build_members(
    req_members: &[CreateTeamMember],
    agents: &[serde_json::Value],
) -> Result<Vec<RemoteTeamMember>, (StatusCode, Json<ApiError>)> {
    req_members
        .iter()
        .map(|rm| {
            let agent = agents
                .iter()
                .find(|a| a.get("id").and_then(|v| v.as_str()) == Some(&rm.agent_id))
                .ok_or_else(|| {
                    (StatusCode::BAD_REQUEST, Json(ApiError {
                        error: format!("Agent not found: {}", rm.agent_id),
                    }))
                })?;

            let name = agent
                .get("label")
                .or_else(|| agent.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("Agent")
                .to_string();

            Ok(RemoteTeamMember {
                agent_id: rm.agent_id.clone(),
                agent_name: name,
                role: rm.role.clone(),
                task: rm.task.clone(),
                session_id: Some(format!("session-{}", uuid::Uuid::new_v4())),
                status: "pending".to_string(),
            })
        })
        .collect()
}

fn build_team(
    name: String,
    lead_agent_id: String,
    members: Vec<RemoteTeamMember>,
) -> RemoteTeam {
    RemoteTeam {
        id: format!("team-{}", &uuid::Uuid::new_v4().to_string()[..8]),
        name,
        lead_agent_id,
        members,
        created_at: chrono::Utc::now().timestamp_millis(),
        status: "active".to_string(),
    }
}

// ─── Session Launch ───────────────────────────────────────────────

/// Spawn staggered remote-execute events for each team member.
/// 500ms delay between each to avoid pendingAutoStartRef race in React.
fn spawn_staggered_launch(app: AppHandle, members: Vec<RemoteTeamMember>) {
    tokio::spawn(async move {
        for (i, member) in members.iter().enumerate() {
            if i > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(500)).await;
            }
            emit_member_session(&app, member);
        }
    });
}

fn emit_member_session(app: &AppHandle, member: &RemoteTeamMember) {
    let storage = match read_agents_storage() {
        Ok(s) => s,
        Err(e) => {
            log::error!("🦆 [Remote Teams] Failed to read agents: {}", e);
            return;
        }
    };

    let agent = match storage
        .get("agents")
        .and_then(|a| a.as_array())
        .and_then(|arr| {
            arr.iter()
                .find(|a| a.get("id").and_then(|v| v.as_str()) == Some(&member.agent_id))
        }) {
        Some(a) => a,
        None => return,
    };

    let project_path = agent
        .get("cwd")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();

    let project_name = std::path::Path::new(&project_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    let event = serde_json::json!({
        "sessionId": member.session_id,
        "agentId": member.agent_id,
        "agentName": member.agent_name,
        "projectPath": project_path,
        "projectName": project_name,
        "prompt": member.task,
        "source": "remote-team",
        "autoSend": true,
    });

    // Brain: gotcha-mobile-session-dot-status
    if let Ok(mut map) = crate::AGENT_STATUS.write() {
        map.insert(member.agent_id.clone(), "busy".to_string());
    }

    let _ = app.emit("remote-execute", &event);
    log::info!(
        "🦆 [Remote Teams] Launched: {} ({})",
        member.agent_name,
        member.session_id.as_deref().unwrap_or("?")
    );
}

// ─── Status Sync ──────────────────────────────────────────────────

fn resolve_member_status(
    member: &RemoteTeamMember,
    sessions: Option<&[serde_json::Value]>,
) -> String {
    let sid = match &member.session_id {
        Some(id) => id,
        None => return member.status.clone(),
    };

    let session = sessions.and_then(|arr| {
        arr.iter()
            .find(|s| s.get("id").and_then(|v| v.as_str()) == Some(sid))
    });

    match session {
        Some(s) => {
            let st = s.get("status").and_then(|v| v.as_str()).unwrap_or("unknown");
            match st {
                "in_progress" | "running" => "running".to_string(),
                "completed" | "idle" => "completed".to_string(),
                "failed" | "error" => "failed".to_string(),
                _ => member.status.clone(),
            }
        }
        None => member.status.clone(),
    }
}
