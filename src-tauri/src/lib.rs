use std::net::SocketAddr;

use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use tauri::{menu::MenuBuilder, AppHandle, Emitter, Manager};

mod ai;
mod commands;
mod fs;
mod git;
mod preferences;
mod preview;
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
            // Setup native menu for macOS
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{CheckMenuItemBuilder, SubmenuBuilder};

                let app_handle = app.handle().clone();
                let toggle_perf_id = "toggle_performance_monitor";

                // Get initial state
                let initial_state = tauri::async_runtime::block_on(async {
                    preferences::get_preferences(app_handle.clone())
                        .await
                        .map(|prefs| prefs.show_performance_monitor)
                        .unwrap_or(false)
                });

                // Create View menu with Performance Monitor toggle
                let toggle_perf = CheckMenuItemBuilder::with_id(toggle_perf_id, "Show Performance Monitor")
                    .checked(initial_state)
                    .accelerator("Cmd+Shift+P")
                    .build(app)?;

                let view_menu = SubmenuBuilder::new(app, "View")
                    .item(&toggle_perf)
                    .build()?;

                // Build and set the menu
                let menu = MenuBuilder::new(app)
                    .item(&view_menu)
                    .build()?;

                app.set_menu(menu)?;

                // Handle menu events
                app.on_menu_event(move |app, event| {
                    if event.id() == toggle_perf_id {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Ok(new_state) = preferences::toggle_performance_monitor(app_handle).await {
                                log::info!("Performance monitor toggled: {}", new_state);
                            }
                        });
                    }
                });
            }
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;

                // Cambia il titolo della finestra e aggiungi badge nell'icona del Dock in dev mode
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.set_title("🦆 Quack [DEV MODE]");

                    #[cfg(target_os = "macos")]
                    {
                        use cocoa::appkit::NSApp;
                        use cocoa::base::{id, nil};
                        use cocoa::foundation::{NSAutoreleasePool, NSString};
                        use objc::{msg_send, sel, sel_impl};

                        // Proteggiamo il codice unsafe con std::panic::catch_unwind
                        let _ = std::panic::catch_unwind(|| unsafe {
                            let _pool = NSAutoreleasePool::new(nil);
                            let app: id = NSApp();
                            if app != nil {
                                let badge_text = NSString::alloc(nil).init_str("DEV");
                                let dock_tile: id = msg_send![app, dockTile];
                                if dock_tile != nil && badge_text as id != nil {
                                    let _: () = msg_send![dock_tile, setBadgeLabel: badge_text];
                                }
                            }
                        });
                    }
                }
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
                        if let Err(error) = axum::serve(listener, router.into_make_service()).await
                        {
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
            terminal::get_active_processes,
            terminal::write_to_terminal,
            terminal::resize_terminal,
            terminal::close_terminal,
            terminal::set_terminal_color,
            terminal::update_terminal,
            commands::load_saved_commands,
            commands::save_command,
            commands::update_command,
            commands::delete_command,
            fs::list_directory,
            fs::get_home_directory,
            fs::read_file_content,
            fs::write_file_content,
            git::git_status_summary,
            git::git_diff,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_commit_history,
            git::git_repository_root,
            preview::create_preview_webview,
            preview::update_preview_webview_position,
            preview::destroy_preview_webview,
            preview::show_preview_webview,
            preview::hide_preview_webview,
            preview::inject_preview_script,
            ai::get_ai_suggestion,
            ai::analyze_error,
            ai::save_api_key,
            ai::test_api_connection,
            ai::get_token_usage_stats,
            preferences::get_preferences,
            preferences::set_preference,
            preferences::toggle_performance_monitor
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
