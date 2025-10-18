use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Mutex;

use axum::{extract::State, http::StatusCode, routing::post, Json, Router};
use serde::{Deserialize, Serialize};
use tauri::{menu::MenuBuilder, AppHandle, Emitter, Manager};

mod agency;
mod agency_setup;
mod ai;
mod claude_auth;
mod claude_cli;
mod claude_oauth;
mod commands;
mod fs;
mod git;
mod mcp;
mod notifications;
mod native_terminal;
mod plugins;
mod preferences;
mod preview;
mod slash_commands;
mod terminal;

// Global state for tracking Claude SDK session IDs per agent
pub struct SessionState {
    sessions: Mutex<HashMap<String, String>>, // agentId -> sessionId
}

impl SessionState {
    pub fn new() -> Self {
        Self {
            sessions: Mutex::new(HashMap::new()),
        }
    }

    pub fn get_session(&self, agent_id: &str) -> Option<String> {
        self.sessions.lock().ok()?.get(agent_id).cloned()
    }

    pub fn set_session(&self, agent_id: String, session_id: String) {
        if let Ok(mut sessions) = self.sessions.lock() {
            sessions.insert(agent_id, session_id);
        }
    }
}

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
        .manage(SessionState::new()) // Register global session state
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // Setup native menu for macOS
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{CheckMenuItemBuilder, MenuItemBuilder, SubmenuBuilder};

                let app_handle = app.handle().clone();
                let toggle_perf_id = "toggle_performance_monitor";

                // Get initial state
                let initial_state = tauri::async_runtime::block_on(async {
                    preferences::get_preferences(app_handle.clone())
                        .await
                        .map(|prefs| prefs.show_performance_monitor)
                        .unwrap_or(false)
                });

                // Create Quack menu with Performance Monitor toggle and AI Settings
                let toggle_perf = CheckMenuItemBuilder::with_id(toggle_perf_id, "Show Performance Monitor")
                    .checked(initial_state)
                    .accelerator("Cmd+Shift+P")
                    .build(app)?;

                let ai_settings_id = "open_ai_settings";
                let ai_settings = tauri::menu::MenuItemBuilder::with_id(ai_settings_id, "AI Settings...")
                    .accelerator("Cmd+Shift+A")
                    .build(app)?;

                let watch_intro_id = "watch_intro";
                let watch_intro = tauri::menu::MenuItemBuilder::with_id(watch_intro_id, "Watch Intro")
                    .accelerator("Cmd+Shift+I")
                    .build(app)?;

                let backgrounds_id = "open_backgrounds";
                let backgrounds = tauri::menu::MenuItemBuilder::with_id(backgrounds_id, "Backgrounds...")
                    .accelerator("Cmd+Shift+B")
                    .build(app)?;

                let quack_menu = SubmenuBuilder::new(app, "Quack")
                    .item(&toggle_perf)
                    .separator()
                    .item(&ai_settings)
                    .item(&watch_intro)
                    .item(&backgrounds)
                    .build()?;

                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .select_all()
                    .build()?;

                // Build and set the menu
                let menu = MenuBuilder::new(app)
                    .item(&quack_menu)
                    .item(&edit_menu)
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
                    } else if event.id() == ai_settings_id {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = app_handle.emit("open-ai-settings", ()) {
                                log::error!("Failed to emit open-ai-settings event: {}", e);
                            }
                        });
                    } else if event.id() == watch_intro_id {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = app_handle.emit("watch-intro", ()) {
                                log::error!("Failed to emit watch-intro event: {}", e);
                            }
                        });
                    } else if event.id() == backgrounds_id {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = app_handle.emit("open-backgrounds", ()) {
                                log::error!("Failed to emit open-backgrounds event: {}", e);
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
            agency::list_agents,
            agency::get_agent_details,
            agency::save_agent,
            agency::check_agents_directory,
            agency::create_agents_directory,
            agency_setup::setup_quack_agency_full,
            terminal::create_terminal,
            terminal::list_terminals,
            terminal::get_active_processes,
            terminal::write_to_terminal,
            terminal::resize_terminal,
            terminal::close_terminal,
            terminal::set_terminal_color,
            terminal::update_terminal,
            native_terminal::open_native_terminal,
            native_terminal::focus_native_terminal,
            native_terminal::close_native_terminal,
            native_terminal::get_installed_terminal_apps,
            commands::load_saved_commands,
            commands::save_command,
            commands::update_command,
            commands::delete_command,
            fs::list_directory,
            fs::get_home_directory,
            fs::read_file_content,
            fs::write_file_content,
            fs::stat_file,
            fs::read_file_preview,
            fs::save_clipboard_file,
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
            ai::get_prompt_engineering_questions,
            ai::improve_prompt_with_answers,
            notifications::send_ai_completion_notification,
            notifications::send_telegram_test,
            notifications::send_ntfy_test,
            preferences::get_preferences,
            preferences::set_preference,
            preferences::toggle_performance_monitor,
            preferences::set_ai_api_key,
            preferences::get_ai_api_key,
            preferences::set_claude_api_key,
            preferences::get_claude_api_key,
            preferences::set_ai_model,
            preferences::get_ai_model,
            preferences::get_background_image,
            preferences::set_background_image,
            preferences::list_available_backgrounds,
            preferences::set_telegram_config,
            preferences::get_telegram_config,
            preferences::set_ntfy_topic,
            preferences::get_ntfy_topic,
            preferences::set_mobile_notifications_enabled,
            preferences::get_mobile_notifications_enabled,
            claude_auth::get_claude_cli_credentials,
            claude_auth::check_claude_cli_auth,
            claude_auth::get_credentials_path,
            claude_cli::check_claude_cli_available,
            claude_cli::send_message_via_cli,
            claude_cli::send_message_via_cli_streaming,
            claude_cli::send_message_via_sdk_streaming,
            claude_oauth::start_claude_oauth,
            slash_commands::list_slash_commands,
            slash_commands::create_slash_command,
            slash_commands::update_slash_command,
            slash_commands::delete_slash_command,
            mcp::list_mcp_servers,
            mcp::get_mcp_server,
            mcp::save_mcp_server,
            mcp::delete_mcp_server,
            mcp::get_mcp_templates,
            mcp::test_mcp_connection,
            plugins::list_available_plugins,
            plugins::list_installed_plugins,
            plugins::install_plugin,
            plugins::uninstall_plugin,
            plugins::search_plugins
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
