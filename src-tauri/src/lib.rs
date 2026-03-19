// Allow unexpected_cfgs from the old objc crate's msg_send! macro
#![allow(unexpected_cfgs)]

use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex, RwLock};

/// In-memory agent status map: agent_id → "busy"/"idle".
/// Updated by handle_status_update AND claude_cli daemon/legacy streaming.
/// Read by remote API (`/api/agents`).
// Brain: gotcha-mobile-session-dot-status
pub type AgentStatusMap = Arc<RwLock<HashMap<String, String>>>;

/// Global singleton — shared between hook handler, SDK streaming, and REST API.
pub static AGENT_STATUS: once_cell::sync::Lazy<AgentStatusMap> =
    once_cell::sync::Lazy::new(|| Arc::new(RwLock::new(HashMap::new())));

use axum::{extract::State, http::StatusCode, routing::{get, post}, Json, Router};
use serde::{Deserialize, Serialize};
use tauri::{menu::MenuBuilder, tray::TrayIconBuilder, AppHandle, Emitter, Listener, Manager, image::Image};

mod agency;
mod agency_setup;
mod ai;
mod brain_window;
mod browser;
mod btw; // BTW side-chain: one-shot Anthropic Messages API queries
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
mod prerequisites; // ✅ Prerequisites checker (Git, Node.js, Claude CLI)
mod teams; // 🦆 Agent Teams management (roster injection, team CRUD)
mod groups; // 📂 Project Grouping (multi-project awareness, cross-project CLAUDE.md)
mod preferences;
mod preview;
mod proxy;
mod reveal;
mod rules; // 📜 Claude Code rules management (.claude/rules/)
mod sessions;
pub mod shell_env; // 🐚 Login-shell environment capture for GUI-launched app
mod skills;
mod slash_commands;
mod snippets; // Prompt snippets for quick text expansion
mod telegram_bot;
mod telegram_central;
mod telegram_obfuscation; // 🔐 Telegram token obfuscation (temporary security)
mod terminal;
mod automation; // 🤖 Cron-based automation scheduler for agent sessions
mod background_tasks; // 🚀 Background tasks for async agent execution
mod claude_assets; // 📦 Claude Assets Manager for .claude/ folder management
mod ide_integration; // 🖥️ Universal IDE integration (VS Code, Cursor, JetBrains, etc.)
mod semantic_search; // 🔍 Semantic code search file watcher
mod git_watcher; // 🔀 Git branch change watcher
mod teammate_watcher; // 👥 Teammate session stream watcher
mod remote_api; // 🌐 Remote REST API for external tools and mobile dashboard
mod remote_auth; // 🔐 Remote API Bearer token authentication
mod remote_config; // ⚙️ Remote API configuration (enable/disable, token, port)
mod remote_ws; // 📡 WebSocket real-time push for mobile clients
mod remote_dashboard; // 📱 Mobile PWA dashboard served at /dashboard

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
    agent_status: AgentStatusMap,
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

// ============================================================
// WhatsApp Session Creation Endpoint
// ============================================================

#[derive(Deserialize, Clone, Debug)]
struct CreateSessionPayload {
    agent_id: String,
    project_path: String,
    project_name: String,
    title: String,
    #[serde(default)]
    description: Option<String>,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    whatsapp_sender: Option<serde_json::Value>,
}

#[derive(Serialize, Clone, Debug)]
struct CreateSessionResponse {
    success: bool,
    session_id: Option<String>,
    error: Option<String>,
}

/// Create a new session from external sources (like WhatsApp watcher)
/// This endpoint properly handles file locking and emits events to update the UI
async fn handle_create_session(
    State(state): State<HookState>,
    Json(payload): Json<CreateSessionPayload>,
) -> (StatusCode, Json<CreateSessionResponse>) {
    use std::fs;
    use std::path::PathBuf;
    use uuid::Uuid;

    log::info!("📱 Creating session from external source: {:?}", payload.source);

    // Get the storage path
    let storage_path = if cfg!(target_os = "macos") {
        dirs::home_dir()
            .map(|h| h.join("Library/Application Support/com.quack.terminal/quack-agents.json"))
    } else if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("com.quack.terminal/quack-agents.json"))
    } else {
        dirs::home_dir()
            .map(|h| h.join(".local/share/com.quack.terminal/quack-agents.json"))
    };

    let storage_path = match storage_path {
        Some(p) => p,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CreateSessionResponse {
                    success: false,
                    session_id: None,
                    error: Some("Failed to determine storage path".to_string()),
                }),
            );
        }
    };

    // Read current storage
    let storage_content = match fs::read_to_string(&storage_path) {
        Ok(c) => c,
        Err(e) => {
            log::error!("Failed to read storage file: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CreateSessionResponse {
                    success: false,
                    session_id: None,
                    error: Some(format!("Failed to read storage: {}", e)),
                }),
            );
        }
    };

    // Parse JSON
    let mut storage: serde_json::Value = match serde_json::from_str(&storage_content) {
        Ok(v) => v,
        Err(e) => {
            log::error!("Failed to parse storage JSON: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CreateSessionResponse {
                    success: false,
                    session_id: None,
                    error: Some(format!("Failed to parse storage: {}", e)),
                }),
            );
        }
    };

    // Generate session ID
    let session_id = format!("session-{}", Uuid::new_v4());
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    // Clone source for later use in event
    let source_str = payload.source.clone().unwrap_or_else(|| "external".to_string());

    // Create new session object
    let new_session = serde_json::json!({
        "id": session_id,
        "title": payload.title,
        "agentId": payload.agent_id,
        "projectPath": payload.project_path,
        "projectName": payload.project_name,
        "status": "in_progress",
        "createdAt": now,
        "updatedAt": now,
        "messageCount": 0,
        "initialPrompt": payload.description,
        "source": source_str,
        "whatsappSender": payload.whatsapp_sender,
    });

    // Add to sessions array
    if let Some(sessions) = storage.get_mut("sessions") {
        if let Some(arr) = sessions.as_array_mut() {
            arr.push(new_session);
        }
    } else {
        // Create sessions array if it doesn't exist
        storage["sessions"] = serde_json::json!([new_session]);
    }

    // Update agent lastActiveAt
    if let Some(agents) = storage.get_mut("agents") {
        if let Some(arr) = agents.as_array_mut() {
            for agent in arr.iter_mut() {
                if agent.get("id").and_then(|v| v.as_str()) == Some(&payload.agent_id) {
                    agent["lastActiveAt"] = serde_json::json!(now);
                    break;
                }
            }
        }
    }

    // Write back to file
    match fs::write(&storage_path, serde_json::to_string_pretty(&storage).unwrap_or_default()) {
        Ok(_) => {
            log::info!("✅ Session created: {}", session_id);

            // Emit event to frontend to reload sessions
            let _ = state.app.emit("sessions-updated", serde_json::json!({
                "action": "created",
                "sessionId": session_id,
                "source": source_str,
            }));

            (
                StatusCode::OK,
                Json(CreateSessionResponse {
                    success: true,
                    session_id: Some(session_id),
                    error: None,
                }),
            )
        }
        Err(e) => {
            log::error!("Failed to write storage file: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(CreateSessionResponse {
                    success: false,
                    session_id: None,
                    error: Some(format!("Failed to save session: {}", e)),
                }),
            )
        }
    }
}

// ============================================================
// WhatsApp Follow-up Message Endpoint
// ============================================================

#[derive(Deserialize, Clone, Debug)]
struct AddMessagePayload {
    session_id: String,
    content: String,
    #[serde(default)]
    source: Option<String>,
    #[serde(default)]
    sender_info: Option<serde_json::Value>,
}

#[derive(Serialize, Clone, Debug)]
struct AddMessageResponse {
    success: bool,
    error: Option<String>,
}

/// Add a follow-up message to an existing session
/// This is used for continuous WhatsApp conversations
async fn handle_add_message(
    State(state): State<HookState>,
    Json(payload): Json<AddMessagePayload>,
) -> (StatusCode, Json<AddMessageResponse>) {
    use std::fs;
    use std::path::PathBuf;

    log::info!("📱 Adding message to session: {}", payload.session_id);

    // Get the storage path
    let storage_path = if cfg!(target_os = "macos") {
        dirs::home_dir()
            .map(|h| h.join("Library/Application Support/com.quack.terminal/quack-agents.json"))
    } else if cfg!(target_os = "windows") {
        std::env::var("APPDATA")
            .ok()
            .map(|p| PathBuf::from(p).join("com.quack.terminal/quack-agents.json"))
    } else {
        dirs::home_dir()
            .map(|h| h.join(".local/share/com.quack.terminal/quack-agents.json"))
    };

    let storage_path = match storage_path {
        Some(p) => p,
        None => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AddMessageResponse {
                    success: false,
                    error: Some("Failed to determine storage path".to_string()),
                }),
            );
        }
    };

    // Read current storage
    let storage_content = match fs::read_to_string(&storage_path) {
        Ok(c) => c,
        Err(e) => {
            log::error!("Failed to read storage file: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AddMessageResponse {
                    success: false,
                    error: Some(format!("Failed to read storage: {}", e)),
                }),
            );
        }
    };

    // Parse JSON
    let mut storage: serde_json::Value = match serde_json::from_str(&storage_content) {
        Ok(v) => v,
        Err(e) => {
            log::error!("Failed to parse storage JSON: {}", e);
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AddMessageResponse {
                    success: false,
                    error: Some(format!("Failed to parse storage: {}", e)),
                }),
            );
        }
    };

    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64;

    // Find the session and update it
    let mut session_found = false;
    if let Some(sessions) = storage.get_mut("sessions") {
        if let Some(arr) = sessions.as_array_mut() {
            for session in arr.iter_mut() {
                if session.get("id").and_then(|v| v.as_str()) == Some(&payload.session_id) {
                    session_found = true;

                    // Update session timestamp
                    session["updatedAt"] = serde_json::json!(now);

                    // Increment message count
                    let current_count = session
                        .get("messageCount")
                        .and_then(|v| v.as_i64())
                        .unwrap_or(0);
                    session["messageCount"] = serde_json::json!(current_count + 1);

                    // Append to pending messages (the frontend will process these)
                    let pending_key = "pendingWhatsAppMessages";
                    if session.get(pending_key).is_none() {
                        session[pending_key] = serde_json::json!([]);
                    }
                    if let Some(pending) = session.get_mut(pending_key) {
                        if let Some(arr) = pending.as_array_mut() {
                            arr.push(serde_json::json!({
                                "content": payload.content,
                                "timestamp": now,
                                "senderInfo": payload.sender_info,
                            }));
                        }
                    }

                    break;
                }
            }
        }
    }

    if !session_found {
        return (
            StatusCode::NOT_FOUND,
            Json(AddMessageResponse {
                success: false,
                error: Some(format!("Session not found: {}", payload.session_id)),
            }),
        );
    }

    // Write back to file
    match fs::write(&storage_path, serde_json::to_string_pretty(&storage).unwrap_or_default()) {
        Ok(_) => {
            log::info!("✅ Message added to session: {}", payload.session_id);

            // Emit event to frontend to reload sessions
            let _ = state.app.emit("sessions-updated", serde_json::json!({
                "action": "message_added",
                "sessionId": payload.session_id,
                "source": payload.source.unwrap_or_else(|| "whatsapp".to_string()),
            }));

            (
                StatusCode::OK,
                Json(AddMessageResponse {
                    success: true,
                    error: None,
                }),
            )
        }
        Err(e) => {
            log::error!("Failed to write storage file: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(AddMessageResponse {
                    success: false,
                    error: Some(format!("Failed to save message: {}", e)),
                }),
            )
        }
    }
}

// ============================================================
// WhatsApp Auto-Start Chat Endpoint
// ============================================================

#[derive(Deserialize, Clone, Debug)]
struct StartChatPayload {
    session_id: String,
    prompt: String,
    #[serde(default)]
    whatsapp_recipient: Option<String>,
}

#[derive(Serialize, Clone, Debug)]
struct StartChatResponse {
    success: bool,
    error: Option<String>,
}

/// Start a chat session with auto-send prompt
/// This emits an event that the frontend listens to for auto-starting the chat
async fn handle_start_chat(
    State(state): State<HookState>,
    Json(payload): Json<StartChatPayload>,
) -> (StatusCode, Json<StartChatResponse>) {
    log::info!("🚀 Auto-starting chat for session: {}", payload.session_id);

    // Emit event to frontend to auto-start the chat
    let result = state.app.emit("session-auto-start", serde_json::json!({
        "sessionId": payload.session_id,
        "prompt": payload.prompt,
        "whatsappRecipient": payload.whatsapp_recipient,
        "autoSend": true,
    }));

    match result {
        Ok(_) => {
            log::info!("✅ Auto-start event emitted for session: {}", payload.session_id);
            (
                StatusCode::OK,
                Json(StartChatResponse {
                    success: true,
                    error: None,
                }),
            )
        }
        Err(e) => {
            log::error!("Failed to emit auto-start event: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(StartChatResponse {
                    success: false,
                    error: Some(format!("Failed to emit event: {}", e)),
                }),
            )
        }
    }
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

    // Update in-memory agent status map for REST API
    // Store by both id AND label — the hook may send either, and the API
    // looks up by the internal agent id or name from quack-agents.json.
    if let Ok(mut map) = state.agent_status.write() {
        if let Some(ref id) = sanitized_id {
            map.insert(id.clone(), status.to_string());
        }
        if let Some(ref label) = sanitized_label {
            map.insert(label.clone(), status.to_string());
        }
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
        .manage(automation::AutomationScheduler::new()) // Register automation scheduler state
        .manage(background_tasks::BackgroundTaskManager::new()) // Register background task manager
        .manage(semantic_search::SemanticWatcherManager::new()) // Register semantic search watcher manager
        .manage(git_watcher::GitBranchWatcherManager::new()) // Register git branch watcher manager
        .manage(teammate_watcher::TeammateSessionWatcher::new()) // Register teammate session watcher
        .manage(remote_auth::RemoteAuthState::new()) // Register remote API auth state
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

            // 🌐 Initialize Remote API config and auth state
            {
                let remote_cfg = remote_config::load_config(app.handle());
                let auth_state: tauri::State<remote_auth::RemoteAuthState> = app.state();
                if let Some(token) = &remote_cfg.token {
                    let auth = auth_state.inner().clone();
                    let token = token.clone();
                    let enabled = remote_cfg.enabled;
                    tauri::async_runtime::spawn(async move {
                        auth.set_token(token).await;
                        auth.set_enabled(enabled).await;
                    });
                }
                log::info!(
                    "🌐 Remote API initialized (enabled: {}, port: {})",
                    remote_cfg.enabled,
                    remote_cfg.port
                );
            }

            // 🔐 Migrate API keys from preferences to keychain on first run
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = keychain::migrate_keys_to_keychain(&app_handle).await {
                    log::warn!("⚠️ Failed to migrate API keys to keychain: {}", e);
                }
            });

            // 📜 Install bundled rules for all Quack users on first run
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

                // Create Quack menu with Performance Monitor toggle and AI Settings
                let toggle_perf = CheckMenuItemBuilder::with_id(toggle_perf_id, "Show Performance Monitor")
                    .checked(initial_state)
                    .accelerator("Cmd+Shift+P")
                    .build(app)?;

                let ai_settings_id = "open_ai_settings";
                let ai_settings = tauri::menu::MenuItemBuilder::with_id(ai_settings_id, "AI Settings...")
                    .accelerator("Cmd+Shift+A")
                    .build(app)?;

                let check_updates_id = "check_for_updates";
                let check_updates = tauri::menu::MenuItemBuilder::with_id(check_updates_id, "Check for Updates...")
                    .build(app)?;

                let quack_menu = SubmenuBuilder::new(app, "Quack")
                    .item(&toggle_perf)
                    .separator()
                    .item(&check_updates)
                    .item(&ai_settings)
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
                    } else if event.id() == check_updates_id {
                        let app_handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = app_handle.emit("check-for-updates", ()) {
                                log::error!("Failed to emit check-for-updates event: {}", e);
                            }
                        });
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
                        #[allow(deprecated, unexpected_cfgs)]
                        {
                            use cocoa::appkit::NSApp;
                            use cocoa::base::{id, nil};
                            use cocoa::foundation::{NSAutoreleasePool, NSString};
                            use objc::{msg_send, sel, sel_impl};

                            // Set DEV badge on Dock icon
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
            }

            let app_handle = app.handle().clone();
            // Load remote config for binding decision
            let remote_cfg = remote_config::load_config(app.handle());
            let auth_state: tauri::State<remote_auth::RemoteAuthState> = app.state();
            let auth_for_server = auth_state.inner().clone();

            // 📡 Create WebSocket broadcast hub (capacity 64 events)
            let ws_broadcast = remote_ws::WsBroadcast::new(64);

            // 📡 Bridge Tauri events → WebSocket broadcast for mobile clients
            {
                let bc = ws_broadcast.clone();
                app.listen("external-terminal-status", move |event| {
                    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                        let agent_id = payload.get("id")
                            .or_else(|| payload.get("label"))
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_string();
                        let status = payload.get("status")
                            .and_then(|v| v.as_str())
                            .unwrap_or("unknown")
                            .to_string();
                        let label = payload.get("label")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string());
                        bc.send(remote_ws::WsEvent::AgentStatus { agent_id, status, label });
                    }
                });

                let bc = ws_broadcast.clone();
                app.listen("sessions-updated", move |event| {
                    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                        let action = payload.get("action").and_then(|v| v.as_str()).unwrap_or("");
                        match action {
                            "created" => {
                                bc.send(remote_ws::WsEvent::SessionCreated {
                                    session_id: payload.get("sessionId").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    agent_id: payload.get("agentId").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    title: payload.get("title").and_then(|v| v.as_str()).unwrap_or("New session").to_string(),
                                });
                            }
                            "completed" | "done" => {
                                bc.send(remote_ws::WsEvent::SessionCompleted {
                                    session_id: payload.get("sessionId").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                                    status: payload.get("status").and_then(|v| v.as_str()).unwrap_or("done").to_string(),
                                });
                            }
                            _ => {}
                        }
                    }
                });

                let bc = ws_broadcast.clone();
                app.listen("automation-fire-job", move |event| {
                    if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
                        bc.send(remote_ws::WsEvent::JobFired {
                            job_id: payload.get("jobId").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                            job_name: payload.get("jobName").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                        });
                    }
                });
            }

            tauri::async_runtime::spawn(async move {
                // Use global singleton for agent status — shared with claude_cli streaming
                let agent_status = AGENT_STATUS.clone();

                let state = HookState { app: app_handle.clone(), agent_status: agent_status.clone() };

                // Initialize uptime tracker
                remote_api::init_uptime();

                // Legacy routes (terminal hooks, session management, telegram, proxy)
                let telegram_router = telegram_bot::create_telegram_router(app_handle.clone());
                let legacy_router = Router::new()
                    .route("/terminal/status", post(handle_status_update))
                    .route("/session/create", post(handle_create_session))
                    .route("/session/message", post(handle_add_message))
                    .route("/session/start-chat", post(handle_start_chat))
                    .route("/proxy", get(proxy::proxy_handler))
                    .with_state(state)
                    .merge(telegram_router);

                // Remote API routes (auth-protected, nested under /api)
                let api_router = remote_api::create_api_router(
                    app_handle.clone(),
                    auth_for_server.clone(),
                    agent_status.clone(),
                );

                // 📡 WebSocket route (auth via query param)
                let ws_state = remote_ws::WsState {
                    auth: auth_for_server,
                    broadcast: ws_broadcast,
                };
                let ws_router = Router::new()
                    .route("/ws", get(remote_ws::handle_ws_upgrade))
                    .with_state(ws_state);

                // Dashboard router (PWA mobile UI)
                let dashboard_router = remote_dashboard::create_dashboard_router();

                // Combine: legacy + /api/* + /ws + /dashboard/*
                let router = legacy_router
                    .nest("/api", api_router)
                    .nest("/dashboard", dashboard_router)
                    .merge(ws_router);

                // Bind: 0.0.0.0 if remote enabled, 127.0.0.1 otherwise
                let bind_addr: [u8; 4] = if remote_cfg.enabled {
                    [0, 0, 0, 0]
                } else {
                    [127, 0, 0, 1]
                };
                // In dev mode, use port+1 to avoid conflict with installed build
                let port = if cfg!(debug_assertions) {
                    let dev_port = remote_cfg.port + 1;
                    log::info!("🔧 Dev mode: using port {} (build uses {})", dev_port, remote_cfg.port);
                    dev_port
                } else {
                    remote_cfg.port
                };
                let addr: SocketAddr = (bind_addr, port).into();

                match tokio::net::TcpListener::bind(addr).await {
                    Ok(listener) => {
                        log::info!("🦆 HTTP server started on http://{}", addr);
                        if remote_cfg.enabled {
                            if let Some(ip) = remote_config::get_local_ip_address() {
                                log::info!("🌐 Remote API available at: http://{}:{}/api/status", ip, port);
                                log::info!("📡 WebSocket available at: ws://{}:{}/ws?token=...", ip, port);
                            }
                        }
                        log::info!("🦆 Telegram webhook available at: http://{}/telegram/webhook", addr);
                        log::info!("🦆 Proxy server available at: http://{}/proxy?url=...", addr);
                        if let Err(error) = axum::serve(listener, router.into_make_service()).await
                        {
                            log::error!("HTTP hook server error: {error}");
                        }
                    }
                    Err(error) => {
                        log::error!("Failed to bind HTTP server on {}: {error}", addr);
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
            brain_window::open_brain_window,
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
            fs::write_binary_file,
            fs::read_binary_file,
            fs::create_directory,
            fs::remove_file,
            fs::remove_directory,
            fs::path_exists,
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
            ide_integration::open_folder_in_ide,
            ide_integration::get_installed_apps,
            ide_integration::open_in_app,
            ide_integration::discover_ide_instances,
            ide_integration::get_ide_context,
            ide_integration::register_custom_ide,
            ide_integration::remove_custom_ide,
            ide_integration::get_custom_ides,
            git::git_status_summary,
            git::git_diff,
            git::git_discard_file,
            git::git_stage,
            git::git_unstage,
            git::git_stage_all,
            git::git_commit,
            git::git_commit_history,
            git::git_repository_root,
            git::git_current_branch,
            git::git_list_branches,
            git::git_create_branch,
            git::git_switch_branch,
            git::git_merge_branch,
            git::git_delete_branch,
            git::git_stash_push,
            git::git_stash_pop,
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
            git::git_get_user_config,
            git::git_set_user_config,
            git::is_git_repository,
            git::git_init,
            prerequisites::check_prerequisites,
            prerequisites::install_claude_cli,
            prerequisites::install_xcode_cli_tools,
            prerequisites::open_claude_install_terminal,
            prerequisites::check_claude_auth_status,
            prerequisites::open_claude_login_terminal,
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
            preferences::set_image_model,
            preferences::get_image_model,
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
            preferences::list_available_shells,
            preferences::get_default_shell,
            preferences::set_default_shell,
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
            claude_cli::abort_sdk_stream,         // 🛑 Stop button: kill Node.js process / abort daemon query
            claude_cli::send_tool_result_to_sdk, // 🗣️ AskUserQuestion support (legacy)
            claude_cli::answer_user_question,    // 🗣️ AskUserQuestion via stdin (daemon or legacy)
            claude_cli::rewind_files,            // ⏪ File Checkpointing rewind (SDK 0.2.7+)
            claude_cli::restart_daemon,          // 🔄 Restart persistent daemon (dev/debug)
            claude_cli::reload_mcp_servers,      // 🔌 Hot-reload MCP server configuration
            claude_oauth::start_claude_oauth,
            slash_commands::list_slash_commands,
            slash_commands::create_slash_command,
            slash_commands::update_slash_command,
            slash_commands::delete_slash_command,
            slash_commands::expand_slash_command,
            slash_commands::get_command_details,
            slash_commands::save_command_content,
            // 📜 Rules management commands
            rules::list_rules,
            rules::create_rule,
            rules::update_rule,
            rules::delete_rule,
            rules::get_rule_details,
            rules::save_rule_content,
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
            hooks::get_claude_env_vars,
            hooks::set_claude_env_var,
            hooks::get_claude_settings_flag,
            hooks::set_claude_settings_flag,
            hooks::open_claude_memory_folder,
            plugins::list_available_plugins,
            plugins::list_installed_plugins,
            plugins::install_plugin,
            plugins::uninstall_plugin,
            plugins::search_plugins,
            reveal::reveal_in_finder,
            reveal::open_external_url,
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
            personality::load_active_agents,
            personality::save_active_agents,
            personality::add_active_agent,
            personality::remove_active_agent,
            personality::load_active_agents_with_data,
            // 🦆 Agent Teams commands
            teams::create_team,
            teams::disband_team,
            teams::get_active_team,
            // 📂 Project Grouping commands
            groups::create_group,
            groups::list_groups,
            groups::get_group,
            groups::update_group,
            groups::delete_group,
            groups::get_group_for_project,
            groups::sync_group_contexts,
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
            // Automation scheduler commands
            automation::start_automation_scheduler,
            automation::stop_automation_scheduler,
            automation::validate_cron_expression,
            automation::get_cron_next_fires,
            automation::mark_automation_job_running,
            automation::mark_automation_job_completed,
            automation::is_automation_job_running,
            automation::fire_automation_job,
            // Background tasks commands
            background_tasks::execute_background_agent,
            background_tasks::execute_background_command,
            background_tasks::start_background_watcher,
            background_tasks::pause_background_task,
            background_tasks::resume_background_task,
            background_tasks::cancel_background_task,
            // 📦 Claude Assets Manager commands
            claude_assets::list_claude_assets,
            claude_assets::copy_claude_asset,
            claude_assets::delete_claude_asset,
            claude_assets::move_claude_asset,
            claude_assets::read_claude_asset,
            // 🔍 Semantic Search commands
            semantic_search::start_semantic_watcher,
            semantic_search::stop_semantic_watcher,
            semantic_search::is_semantic_watcher_active,
            semantic_search::get_watched_semantic_projects,
            semantic_search::stop_all_semantic_watchers,
            semantic_search::semantic_search_index_project,
            semantic_search::semantic_search_code,
            semantic_search::semantic_search_get_status,
            semantic_search::semantic_search_generate_embeddings,
            // 🔀 Git Branch Watcher commands
            git_watcher::start_git_branch_watcher,
            git_watcher::stop_git_branch_watcher,
            git_watcher::stop_all_git_branch_watchers,
            // 👥 Teammate Session Watcher commands
            teammate_watcher::start_teammate_watcher,
            teammate_watcher::stop_teammate_watcher,
            teammate_watcher::read_teammate_session,
            // 🌐 Remote API commands
            remote_config::get_remote_config,
            remote_config::set_remote_enabled,
            remote_config::regenerate_remote_token,
            remote_config::get_local_ip,
            remote_config::get_local_hostname,
            // BTW side-chain query
            btw::btw_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
