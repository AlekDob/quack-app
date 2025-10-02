use std::net::SocketAddr;

use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

mod fs;
mod git;
mod terminal;

#[derive(Clone)]
struct HookState {
  app: AppHandle,
}

#[derive(Deserialize, Clone)]
struct HookPayload {
  #[serde(default)]
  id: Option<String>,
  #[serde(default)]
  label: Option<String>,
  status: String,
  #[serde(default = "default_true")]
  notify: bool,
}

#[derive(Serialize, Clone)]
struct HookEventPayload {
  id: Option<String>,
  label: Option<String>,
  status: String,
  notify: bool,
}

fn default_true() -> bool {
  true
}

async fn handle_status_update(
  State(state): State<HookState>,
  Json(payload): Json<HookPayload>,
) -> StatusCode {
  let status = match payload.status.as_str() {
    "busy" | "Busy" | "BUSY" => "busy",
    "idle" | "Idle" | "IDLE" => "idle",
    _ => return StatusCode::BAD_REQUEST,
  };

  let sanitized_id = payload
    .id
    .as_ref()
    .map(|value| value.trim())
    .filter(|value| !value.is_empty())
    .map(|value| value.to_string());

  let sanitized_label = payload
    .label
    .as_ref()
    .map(|value| value.trim())
    .filter(|value| !value.is_empty())
    .map(|value| value.to_string());

  if sanitized_id.is_none() && sanitized_label.is_none() {
    return StatusCode::BAD_REQUEST;
  }

  let event_payload = HookEventPayload {
    id: sanitized_id,
    label: sanitized_label,
    status: status.to_string(),
    notify: payload.notify,
  };

  if state
    .app
    .emit("external-terminal-status", event_payload)
    .is_err()
  {
    return StatusCode::INTERNAL_SERVER_ERROR;
  }

  StatusCode::OK
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_notification::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      let app_handle = app.handle().clone();
      tauri::async_runtime::spawn(async move {
        let state = HookState { app: app_handle };
        let router = Router::new()
          .route("/terminal/status", post(handle_status_update))
          .with_state(state);

        let addr: SocketAddr = ([127, 0, 0, 1], 6768).into();

        match tokio::net::TcpListener::bind(addr).await {
          Ok(listener) => {
            if let Err(error) = axum::serve(listener, router.into_make_service()).await {
              log::error!("HTTP hook server error: {error}");
            }
          }
          Err(error) => {
            log::error!("Impossibile aprire la porta del server hook: {error}");
          }
        }
      });

      Ok(())
    })
    .invoke_handler(tauri::generate_handler![
      terminal::create_terminal,
      terminal::list_terminals,
      terminal::write_to_terminal,
      terminal::resize_terminal,
      terminal::close_terminal,
      terminal::set_terminal_color,
      terminal::update_terminal,
      fs::list_directory,
      fs::get_home_directory,
      fs::read_file_content,
      fs::write_file_content,
      git::git_status_summary,
      git::git_diff,
      git::git_stage,
      git::git_unstage,
      git::git_commit,
      git::git_commit_history
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
