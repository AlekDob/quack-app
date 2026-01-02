use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Mutex;

use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};
use tauri::{menu::MenuBuilder, tray::TrayIconBuilder, AppHandle, Emitter, Manager, image::Image};

mod agency;
mod agency_setup;
mod ai;
mod browser;
mod claude_auth;
mod claude_cli;
mod claude_oauth;
mod claude_usage;
mod commands;
mod context;
mod deep_link;
mod deep_link_commands;
mod fs;
mod git;
mod hooks; // 🪝 Claude Agent SDK hooks management
mod keychain; // 🔐 Secure keychain management for API keys
mod license; // 💰 License management for Pro features
mod mcp;
mod notifications;
mod native_terminal;
mod personality;
mod plugins;
mod preferences;
mod preview;
mod proxy;
mod reveal;
mod rules; // 📜 Claude Code rules management (.claude/rules/)
mod sessions;
mod skills;
mod slash_commands;
mod snippets; // Prompt snippets for quick text expansion
mod telegram_bot;
mod telegram_central;
mod telegram_obfuscation; // 🔐 Telegram token obfuscation (temporary security)
mod terminal;
mod background_tasks; // 🚀 Background tasks for async agent execution
mod claude_assets; // 📦 Claude Assets Manager for .claude/ folder management
mod ide_integration; // 🖥️ Universal IDE integration (VS Code, Cursor, JetBrains, etc.)

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

    /// Remove session mapping for an agent (used when resetting agent)
    pub fn remove_session(&self, agent_id: &str) {
        if let Ok(mut sessions) = self.sessions.lock() {
            sessions.remove(agent_id);
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
        .manage(license::LicenseState::default()) // Register license state
        .manage(mcp::MCPProcessManager::new()) // Register MCP process manager
        .manage(background_tasks::BackgroundTaskManager::new()) // Register background task manager
        .manage(background_tasks::KanbanShellManager::new()) // Register Kanban shell manager
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_mic_recorder::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .setup(|app| {
            // 💰 Load Gumroad and Supabase credentials (baked in at build time)
            // These are loaded from .env during compilation via build.rs
            let license_state: tauri::State<license::LicenseState> = app.state();

            // Load Gumroad Product ID (compile-time environment variable)
            if let Some(product_id) = option_env!("GUMROAD_PRODUCT_ID") {
                *license_state.gumroad_product_id.lock().unwrap() = Some(product_id.to_string());
                log::info!("🦆 Gumroad Product ID loaded from build-time environment");
            } else {
                log::warn!("⚠️ Gumroad Product ID not configured at build time");
            }

            // Load Supabase credentials (compile-time environment variables)
            if let (Some(supabase_url), Some(supabase_key)) = (
                option_env!("SUPABASE_URL"),
                option_env!("SUPABASE_ANON_KEY")
            ) {
                *license_state.supabase_url.lock().unwrap() = Some(supabase_url.to_string());
                *license_state.supabase_key.lock().unwrap() = Some(supabase_key.to_string());
                log::info!("🦆 Supabase credentials loaded from build-time environment");
            } else {
                log::warn!("⚠️ Supabase credentials not configured at build time");
            }

            // Initialize Telegram Central Polling State
            let telegram_state = telegram_central::TelegramPollingState::new(app.handle().clone());
            app.manage(telegram_state);

            // 🔐 Migrate API keys from preferences to keychain on first run
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = keychain::migrate_keys_to_keychain(&app_handle).await {
                    log::warn!("⚠️ Failed to migrate API keys to keychain: {}", e);
                }
            });

            // 📜 Install bundled rules for all Quack users on first run
            // This ensures essential global rules (like MCP Memory Second Brain) are available
            if let Err(e) = rules::install_bundled_rules() {
                log::warn!("⚠️ Failed to install bundled rules: {}", e);
            }

            // 🦆 Install bundled slash commands for all Quack users on first run
            // This ensures essential global commands (like /background) are available in any project
            if let Err(e) = slash_commands::install_bundled_commands() {
                log::warn!("⚠️ Failed to install bundled commands: {}", e);
            }
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

                // DevTools option (for debugging production builds)
                let open_devtools_id = "open_devtools";
                let open_devtools = tauri::menu::MenuItemBuilder::with_id(open_devtools_id, "Open DevTools")
                    .accelerator("Cmd+Option+D")
                    .build(app)?;

                let quack_menu = SubmenuBuilder::new(app, "Quack")
                    .item(&toggle_perf)
                    .separator()
                    .item(&ai_settings)
                    .item(&watch_intro)
                    .separator()
                    .item(&open_devtools)
                    .separator()
                    .quit()
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
                    } else if event.id() == open_devtools_id {
                        // Open DevTools for debugging
                        if let Some(window) = app.get_webview_window("main") {
                            window.open_devtools();
                            log::info!("DevTools opened");
                        }
                    }
                });
            }

            // Setup System Tray (Menu Bar) icon for macOS
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{MenuBuilder as TrayMenuBuilder, MenuItemBuilder};

                // Load tray icon (duck icon for menu bar)
                let tray_icon = include_bytes!("../icons/tray-icon.png");
                // Decode PNG image to RGBA bytes
                let img = image::load_from_memory(tray_icon)
                    .expect("Failed to load tray icon")
                    .to_rgba8();
                let (width, height) = img.dimensions();
                let tray_image = Image::new_owned(img.into_raw(), width, height);

                // Create tray menu with active agents list
                let show_app_item = MenuItemBuilder::with_id("show_app", "Open Quack")
                    .build(app)?;

                let show_pip_item = MenuItemBuilder::with_id("show_pip", "Show Active Agents")
                    .build(app)?;

                let quit_item = MenuItemBuilder::with_id("quit_tray", "Quit Quack")
                    .build(app)?;

                let tray_menu = TrayMenuBuilder::new(app)
                    .item(&show_app_item)
                    .item(&show_pip_item)
                    .separator()
                    .item(&quit_item)
                    .build()?;

                // Build tray icon
                let _tray = TrayIconBuilder::new()
                    .icon(tray_image)
                    .menu(&tray_menu)
                    .tooltip("Quack - Active Agents")
                    .on_menu_event(move |app, event| {
                        match event.id().as_ref() {
                            "show_app" => {
                                if let Some(window) = app.get_webview_window("main") {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                }
                            }
                            "show_pip" => {
                                // Emit event to open PiP window
                                let _ = app.emit("open-pip-window", ());
                            }
                            "quit_tray" => {
                                app.exit(0);
                            }
                            _ => {}
                        }
                    })
                    .build(app)?;
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
                let state = HookState { app: app_handle.clone() };

                // Create combined router with terminal hooks, Telegram webhook, and proxy
                let telegram_router = telegram_bot::create_telegram_router(app_handle.clone());
                let router = Router::new()
                    .route("/terminal/status", post(handle_status_update))
                    .route("/proxy", get(proxy::proxy_handler))
                    .with_state(state)
                    .merge(telegram_router);

                let addr: SocketAddr = ([127, 0, 0, 1], 6768).into();

                match tokio::net::TcpListener::bind(addr).await {
                    Ok(listener) => {
                        log::info!("🦆 HTTP server started on http://127.0.0.1:6768");
                        log::info!("🦆 Telegram webhook available at: http://127.0.0.1:6768/telegram/webhook");
                        log::info!("🦆 Proxy server available at: http://127.0.0.1:6768/proxy?url=...");
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
            agency::save_agent_content,
            agency::delete_agent,
            agency::create_agent,
            agency::check_agents_directory,
            agency::create_agents_directory,
            agency_setup::setup_quack_agency_full,
            skills::list_skills,
            skills::get_skill_details,
            skills::check_skills_directory,
            browser::open_browser_window,
            browser::close_browser_window,
            browser::emit_to_main,
            browser::handle_inspector_message,
            browser::open_oauth_window,
            browser::handle_oauth_callback,
            terminal::create_terminal,
            terminal::execute_command,
            terminal::list_terminals,
            terminal::get_active_processes,
            terminal::write_to_terminal,
            terminal::resize_terminal,
            terminal::close_terminal,
            terminal::terminal_exists,
            terminal::set_terminal_color,
            terminal::update_terminal,
            terminal::update_terminal_working_on,
            native_terminal::open_native_terminal,
            native_terminal::focus_native_terminal,
            native_terminal::close_native_terminal,
            native_terminal::get_installed_terminal_apps,
            commands::load_saved_commands,
            commands::save_command,
            commands::update_command,
            commands::delete_command,
            context::list_claude_md_files,
            context::list_context_md_files,
            context::get_claude_md_details,
            context::save_claude_md_content,
            context::get_claude_md_stats,
            fs::list_directory,
            fs::get_home_directory,
            fs::get_current_username,
            fs::read_file_content,
            fs::write_file_content,
            fs::create_directory,
            fs::stat_file,
            fs::read_file_preview,
            fs::save_clipboard_file,
            fs::search_files_recursive,
            fs::open_file_in_editor,
            fs::open_file_externally,
            fs::list_avatar_images,
            fs::save_custom_avatar,
            fs::list_custom_avatars,
            fs::delete_custom_avatar,
            fs::get_custom_avatar_path,
            fs::read_custom_avatar_bytes,
            fs::list_directory_files,
            fs::find_mcp_memory_path,
            fs::read_mcp_memory_file,
            fs::write_mcp_memory_entity,
            fs::delete_mcp_memory_entity,
            fs::add_mcp_memory_observations,
            fs::update_mcp_memory_observations,
            fs::update_mcp_memory_entity_type,
            fs::write_mcp_memory_relation,
            fs::delete_mcp_memory_relation,
            fs::detect_project_root,
            // IDE Integration commands
            ide_integration::detect_installed_ides,
            ide_integration::set_preferred_ide,
            ide_integration::execute_ide_command,
            ide_integration::focus_ide,
            ide_integration::arrange_windows_side_by_side,
            ide_integration::sync_focus_both_apps,
            ide_integration::open_file_in_ide,
            ide_integration::open_multiple_files_in_ide,
            git::git_status_summary,
            git::git_diff,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_commit_history,
            git::git_repository_root,
            git::git_current_branch,
            git::git_list_branches,
            git::git_create_branch,
            git::git_switch_branch,
            git::git_merge_branch,
            git::git_delete_branch,
            git::git_abort_merge,
            git::git_resolve_conflict,
            git::git_get_conflicts,
            git::git_push,
            git::git_pull,
            git::git_list_worktrees,
            git::git_add_worktree,
            git::git_remove_worktree,
            git::git_has_uncommitted_changes,
            git::git_get_remote_url,
            git::git_uncommitted_files_count,
            git::is_git_repository,
            git::git_init,
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
            // 🔐 Secure keychain commands for API keys
            keychain::set_claude_api_key_secure,
            keychain::get_claude_api_key_secure,
            keychain::delete_claude_api_key_secure,
            keychain::set_openai_api_key_secure,
            keychain::get_openai_api_key_secure,
            keychain::delete_openai_api_key_secure,
            keychain::check_api_keys_in_keychain,
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
            claude_auth::get_auth_debug_info,
            claude_cli::check_claude_cli_available,
            claude_cli::send_message_via_cli,
            claude_cli::send_message_via_cli_streaming,
            claude_cli::send_message_via_sdk_streaming,
            claude_cli::send_tool_result_to_sdk, // 🗣️ AskUserQuestion support (legacy)
            claude_cli::answer_user_question,    // 🗣️ AskUserQuestion via stdin (new)
            claude_oauth::start_claude_oauth,
            slash_commands::list_slash_commands,
            slash_commands::create_slash_command,
            slash_commands::update_slash_command,
            slash_commands::delete_slash_command,
            slash_commands::expand_slash_command,
            // 📜 Rules management commands
            rules::list_rules,
            rules::create_rule,
            rules::update_rule,
            rules::delete_rule,
            mcp::list_mcp_servers,
            mcp::get_mcp_server,
            mcp::save_mcp_server,
            mcp::delete_mcp_server,
            mcp::get_mcp_templates,
            mcp::test_mcp_connection,
            mcp::stop_mcp_server,
            mcp::restart_mcp_server,
            mcp::get_mcp_server_status,
            // 🪝 Hooks management commands
            hooks::list_hooks,
            hooks::save_hook,
            hooks::delete_hook,
            hooks::toggle_hook,
            plugins::list_available_plugins,
            plugins::list_installed_plugins,
            plugins::install_plugin,
            plugins::uninstall_plugin,
            plugins::search_plugins,
            reveal::reveal_in_finder,
            claude_usage::get_claude_plan_usage,
            claude_usage::open_claude_usage_in_terminal,
            deep_link_commands::test_deep_link,
            deep_link_commands::register_deep_link_handler,
            telegram_bot::send_telegram_message,
            telegram_bot::send_telegram_notification_command,
            telegram_bot::send_telegram_photo,
            telegram_central::generate_unique_id,
            telegram_central::generate_telegram_deep_link,
            telegram_central::start_telegram_polling,
            telegram_central::stop_telegram_polling,
            preferences::save_telegram_link,
            preferences::get_telegram_link,
            preferences::initialize_central_bot_token,
            personality::save_agent_personality,
            personality::load_agent_personality,
            personality::inject_personality_to_claude_md,
            sessions::list_sessions,
            sessions::get_session_info,
            sessions::get_all_sessions_info,
            sessions::get_session_details,
            sessions::delete_session,
            sessions::reset_agent_session,
            sessions::resume_session,
            // 💰 License management commands (Gumroad + Supabase)
            license::validate_license,
            license::revalidate_license,
            license::deactivate_license,
            license::get_license_devices,
            // Prompt snippets commands
            snippets::list_snippets,
            snippets::get_snippet,
            snippets::get_snippet_by_tag,
            snippets::create_snippet,
            snippets::update_snippet,
            snippets::delete_snippet,
            snippets::search_snippets,
            snippets::import_snippets,
            snippets::export_snippets,
            // Background tasks commands
            background_tasks::execute_background_agent,
            background_tasks::execute_background_command,
            background_tasks::start_background_watcher,
            background_tasks::pause_background_task,
            background_tasks::resume_background_task,
            background_tasks::cancel_background_task,
            // Kanban shell task commands
            background_tasks::start_kanban_shell_task,
            background_tasks::kill_kanban_shell_task,
            // 📦 Claude Assets Manager commands
            claude_assets::list_claude_assets,
            claude_assets::copy_claude_asset,
            claude_assets::delete_claude_asset,
            claude_assets::move_claude_asset,
            claude_assets::read_claude_asset
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
