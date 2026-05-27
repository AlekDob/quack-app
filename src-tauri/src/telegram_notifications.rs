use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use once_cell::sync::Lazy;
use tauri::{AppHandle, Manager};
use crate::remote_ws::{WsBroadcast, WsEvent};
use crate::telegram_types::InlineKeyboardButton;

// Brain: fix-telegram-partial-stale-notifications
// Track last notification time per agent to prevent duplicate notifications
// from multiple idle event sources (daemon result + hook endpoint).
static LAST_SENT: Lazy<Mutex<HashMap<String, Instant>>> =
    Lazy::new(|| Mutex::new(HashMap::new()));
const DEDUP_WINDOW_SECS: u64 = 30;

/// Shared session mappings accessible from polling and notification modules
#[derive(Clone)]
pub struct TelegramSessionMappings {
    pub session_to_msg: Arc<Mutex<HashMap<String, i64>>>,
    pub msg_to_session: Arc<Mutex<HashMap<i64, String>>>,
}

impl TelegramSessionMappings {
    pub fn new() -> Self {
        Self {
            session_to_msg: Arc::new(Mutex::new(HashMap::new())),
            msg_to_session: Arc::new(Mutex::new(HashMap::new())),
        }
    }
}

/// Start the notification bridge (subscribes to WsBroadcast)
pub fn start_notification_bridge(app: AppHandle) {
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        if !is_telegram_configured(&app_clone).await {
            log::info!("Telegram not configured, notification bridge skipped");
            return;
        }
        // Auto-start polling if telegram is linked (for receiving replies)
        auto_start_polling(&app_clone).await;

        let broadcast = match app_clone.try_state::<WsBroadcast>() {
            Some(bc) => bc.inner().clone(),
            None => {
                log::warn!("WsBroadcast not available, bridge skipped");
                return;
            }
        };
        let mut rx = broadcast.subscribe();
        let last_event: Arc<Mutex<HashMap<String, Instant>>> =
            Arc::new(Mutex::new(HashMap::new()));
        log::info!("Telegram notification bridge started");
        loop {
            match rx.recv().await {
                Ok(event) => handle_ws_event(&app_clone, &event, &last_event).await,
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    log::warn!("Notification bridge lagged, skipped {} events", n);
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    log::info!("Broadcast closed, stopping notification bridge");
                    break;
                }
            }
        }
    });
}

async fn auto_start_polling(app: &AppHandle) {
    let prefs = match crate::preferences::get_preferences(app.clone()).await {
        Ok(p) => p,
        Err(_) => return,
    };
    // Only auto-start if user has linked via Central Bot
    if prefs.telegram_linked_chat_id.is_some() {
        if let Some(state) = app.try_state::<crate::telegram_types::TelegramPollingState>() {
            if !state.is_running() {
                log::info!("[TG-NOTIFY] Auto-starting Telegram polling for reply support");
                crate::telegram_central::start_polling(state.inner().clone()).await;
            }
        }
    }
}

async fn is_telegram_configured(app: &AppHandle) -> bool {
    crate::preferences::get_preferences(app.clone())
        .await
        .map(|p| p.telegram_bot_token.is_some())
        .unwrap_or(false)
}

async fn handle_ws_event(
    app: &AppHandle,
    event: &WsEvent,
    last_event: &Arc<Mutex<HashMap<String, Instant>>>,
) {
    match event {
        WsEvent::AgentStatus { agent_id, status, .. } if status == "idle" => {
            handle_agent_idle(app, agent_id, last_event).await;
        }
        WsEvent::SessionCompleted { session_id, .. } => {
            cleanup_session_mappings(app, session_id);
        }
        _ => {}
    }
}

async fn handle_agent_idle(
    app: &AppHandle,
    agent_id: &str,
    last_event: &Arc<Mutex<HashMap<String, Instant>>>,
) {
    log::info!("[TG-NOTIFY] Agent idle event: agent_id={}", agent_id);
    let now = Instant::now();
    let agent_key = agent_id.to_string();
    if let Ok(mut map) = last_event.lock() {
        map.insert(agent_key.clone(), now);
    }
    let app_clone = app.clone();
    let last_event_clone = last_event.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(3)).await;
        let is_current = last_event_clone.lock().ok()
            .and_then(|map| map.get(&agent_key).map(|t| *t == now))
            .unwrap_or(false);
        if is_current {
            log::info!("[TG-NOTIFY] Debounce passed, sending for {}", agent_key);
            if let Err(e) = send_agent_notification(&app_clone, &agent_key).await {
                log::error!("[TG-NOTIFY] Failed: {}", e);
            }
        } else {
            log::info!("[TG-NOTIFY] Debounce superseded for {}", agent_key);
        }
    });
}

async fn send_agent_notification(app: &AppHandle, agent_id: &str) -> Result<(), String> {
    log::info!("[TG-NOTIFY] Starting for agent_id={}", agent_id);

    // Brain: fix-telegram-partial-stale-notifications
    // Dedup: skip if we already sent a notification for this agent recently.
    if let Ok(map) = LAST_SENT.lock() {
        if let Some(last) = map.get(agent_id) {
            if last.elapsed().as_secs() < DEDUP_WINDOW_SECS {
                log::info!("[TG-NOTIFY] Dedup: already sent for {} {}s ago, skipping",
                    agent_id, last.elapsed().as_secs());
                return Ok(());
            }
        }
    }

    let prefs = crate::preferences::get_preferences(app.clone()).await?;
    if prefs.telegram_mute_notifications {
        log::info!("[TG-NOTIFY] Muted, skipping");
        return Ok(());
    }
    if prefs.telegram_bot_token.is_none() {
        log::info!("[TG-NOTIFY] No bot token, skipping");
        return Ok(());
    }
    let chat_id = resolve_chat_id(&prefs).map_err(|e| {
        log::error!("[TG-NOTIFY] Chat ID error: {}", e);
        e
    })?;
    log::info!("[TG-NOTIFY] chat_id={}", chat_id);
    let storage = crate::remote_api::read_agents_storage().map_err(|e| {
        log::error!("[TG-NOTIFY] Storage error: {}", e);
        e
    })?;
    let (agent_name, project_name, store_session_id, claude_session_id) =
        find_agent_session(&storage, agent_id).map_err(|e| {
            log::error!("[TG-NOTIFY] Agent/session error: {}", e);
            e
        })?;
    log::info!("[TG-NOTIFY] agent={} project={} store={}", agent_name, project_name, store_session_id);

    // Brain: fix-telegram-partial-stale-notifications
    // Prefer the result text captured from the SDK Result event — it's the actual
    // final agent output, not an intermediate tool-use step from the JSONL file.
    let (session_title, last_message) = get_session_summary_with_result(agent_id, &claude_session_id).await;

    log::info!("[TG-NOTIFY] title={}", clean_message_content(&session_title));
    let text = format_notification(&agent_name, &project_name, &session_title, &last_message);
    let keyboard = build_notification_keyboard(&store_session_id, app).await;
    let msg_id = crate::telegram_send::send_message_with_keyboard(
        app, chat_id, &text, keyboard,
    ).await.map_err(|e| {
        log::error!("[TG-NOTIFY] Send error: {}", e);
        e
    })?;
    log::info!("[TG-NOTIFY] Sent! msg_id={}", msg_id);
    store_session_mapping(app, &store_session_id, msg_id);

    // Record send time for dedup
    if let Ok(mut map) = LAST_SENT.lock() {
        map.insert(agent_id.to_string(), Instant::now());
    }

    Ok(())
}

fn resolve_chat_id(prefs: &crate::preferences::AppPreferences) -> Result<i64, String> {
    if let Some(id) = prefs.telegram_linked_chat_id {
        return Ok(id);
    }
    if let Some(ref id_str) = prefs.telegram_chat_id {
        return id_str.parse::<i64>().map_err(|_| "Invalid telegram_chat_id".to_string());
    }
    Err("No telegram chat_id configured".to_string())
}

/// Returns (agent_name, project_name, store_session_id, claude_session_id)
fn find_agent_session(
    storage: &serde_json::Value,
    agent_id: &str,
) -> Result<(String, String, String, String), String> {
    let (agent_name, project_name) = find_agent_info(storage, agent_id);
    let (store_id, claude_id) = find_latest_session(storage, agent_id)?;
    Ok((agent_name, project_name, store_id, claude_id))
}

fn find_agent_info(storage: &serde_json::Value, agent_id: &str) -> (String, String) {
    let agent = storage.get("agents")
        .and_then(|a| a.as_array())
        .and_then(|arr| arr.iter().find(|a| {
            a.get("id").and_then(|v| v.as_str()) == Some(agent_id)
        }));
    let name = agent
        .and_then(|a| a.get("name").and_then(|v| v.as_str()))
        .unwrap_or(agent_id)
        .to_string();
    let project = agent
        .and_then(|a| a.get("projectName").and_then(|v| v.as_str()))
        .unwrap_or("")
        .to_string();
    (name, project)
}

/// Sessions are at top-level storage["sessions"], linked by agentId.
/// Returns (store_session_id, claude_session_id).
fn find_latest_session(
    storage: &serde_json::Value,
    agent_id: &str,
) -> Result<(String, String), String> {
    let sessions = storage.get("sessions")
        .and_then(|s| s.as_array())
        .ok_or("No sessions array found")?;
    let session = sessions.iter()
        .filter(|s| s.get("agentId").and_then(|v| v.as_str()) == Some(agent_id))
        .max_by_key(|s| s.get("createdAt").and_then(|v| v.as_i64()).unwrap_or(0))
        .ok_or_else(|| format!("No session for agent {}", agent_id))?;
    let store_id = session.get("id")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    let claude_id = session.get("claudeSessionId")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string();
    if claude_id.is_empty() {
        return Err("Session has no claudeSessionId yet".to_string());
    }
    Ok((store_id, claude_id))
}

// Brain: fix-telegram-partial-stale-notifications
/// Prefer result text from AGENT_LAST_RESULT (captured from the SDK Result event)
/// over reading the JSONL session file. The JSONL's last "assistant" entry is often
/// an intermediate tool-use step, not the final summary the user sees.
async fn get_session_summary_with_result(agent_id: &str, claude_session_id: &str) -> (String, String) {
    let captured_result = {
        let mut last = crate::claude_cli::AGENT_LAST_RESULT.lock().await;
        last.remove(agent_id)
    };

    match crate::sessions::get_session_details(claude_session_id.to_string()) {
        Ok(details) => {
            let title = clean_message_content(&details.title);
            let last_msg = if let Some(result_text) = captured_result {
                log::info!("[TG-NOTIFY] Using captured result text for {}", agent_id);
                clean_message_content(&result_text)
            } else {
                log::info!("[TG-NOTIFY] No captured result, falling back to JSONL for {}", agent_id);
                details.messages.iter().rev()
                    .find(|m| m.role == "assistant")
                    .map(|m| clean_message_content(&m.content))
                    .unwrap_or_default()
            };
            (title, last_msg)
        }
        Err(e) => {
            log::warn!("[TG-NOTIFY] Can't read session: {}", e);
            let last_msg = captured_result
                .map(|r| clean_message_content(&r))
                .unwrap_or_default();
            ("Session".to_string(), last_msg)
        }
    }
}

/// Strip system-reminder tags, IDE context, and other SDK artifacts
fn clean_message_content(content: &str) -> String {
    let mut result = content.to_string();
    // Remove <system-reminder>...</system-reminder> blocks
    while let Some(start) = result.find("<system-reminder>") {
        if let Some(end) = result.find("</system-reminder>") {
            let end_tag_len = "</system-reminder>".len();
            result = format!("{}{}", &result[..start], &result[end + end_tag_len..]);
        } else {
            // No closing tag — remove from start to end of string
            result = result[..start].to_string();
            break;
        }
    }
    // Remove standalone opening tags without closing
    result = result.replace("<system-reminder>", "");
    // Trim leading/trailing whitespace and newlines
    result.trim().to_string()
}

pub fn format_notification(
    agent_name: &str,
    project_name: &str,
    session_title: &str,
    last_message: &str,
) -> String {
    let safe_name = escape_markdown(agent_name);
    let safe_title = escape_markdown(session_title);
    let summary = truncate_at_sentence(last_message, 500);
    let header = if project_name.is_empty() {
        format!("*{}*", safe_name)
    } else {
        let safe_project = escape_markdown(project_name);
        format!("*{}* ({})", safe_name, safe_project)
    };
    let msg = format!(
        "{} — _{}_\n\n{}\n\n_Swipe per rispondere all'agente_",
        header, safe_title, summary
    );
    if msg.len() > 4096 { msg[..4093].to_string() + "..." } else { msg }
}

fn escape_markdown(text: &str) -> String {
    text.replace('_', "\\_")
        .replace('*', "\\*")
        .replace('[', "\\[")
        .replace(']', "\\]")
        .replace('`', "\\`")
}

fn truncate_at_sentence(text: &str, max_len: usize) -> String {
    if text.len() <= max_len { return text.to_string(); }
    let slice = &text[..max_len];
    if let Some(pos) = slice.rfind(". ") { return slice[..=pos].to_string(); }
    if let Some(pos) = slice.rfind(".\n") { return slice[..=pos].to_string(); }
    if let Some(pos) = slice.rfind(' ') { return format!("{}...", &slice[..pos]); }
    format!("{}...", slice)
}

pub async fn build_notification_keyboard(
    session_id: &str,
    app: &AppHandle,
) -> Vec<Vec<InlineKeyboardButton>> {
    let dashboard_url = build_dashboard_url(session_id, app).await;
    vec![vec![
        InlineKeyboardButton {
            text: "Dashboard".to_string(),
            url: Some(dashboard_url),
            callback_data: None,
        },
        InlineKeyboardButton {
            text: "Stop".to_string(),
            url: None,
            callback_data: Some(format!("stop:{}", session_id)),
        },
    ]]
}

async fn build_dashboard_url(session_id: &str, app: &AppHandle) -> String {
    let hostname = crate::remote_config::get_local_hostname()
        .await.unwrap_or_else(|_| "localhost".to_string());
    let config = crate::remote_config::load_config(app);
    format!(
        "http://{}:{}/dashboard?token={}#session/{}",
        hostname, config.port, config.token.unwrap_or_default(), session_id
    )
}

fn store_session_mapping(app: &AppHandle, session_id: &str, msg_id: i64) {
    if let Some(mappings) = app.try_state::<TelegramSessionMappings>() {
        if let Ok(mut s2m) = mappings.session_to_msg.lock() {
            s2m.insert(session_id.to_string(), msg_id);
        }
        if let Ok(mut m2s) = mappings.msg_to_session.lock() {
            m2s.insert(msg_id, session_id.to_string());
        }
    }
}

fn cleanup_session_mappings(app: &AppHandle, session_id: &str) {
    let mappings = match app.try_state::<TelegramSessionMappings>() {
        Some(m) => m,
        None => return,
    };
    let msg_id = match mappings.session_to_msg.lock() {
        Ok(mut m) => m.remove(session_id),
        Err(_) => return,
    };
    if let Some(mid) = msg_id {
        if let Ok(mut m2s) = mappings.msg_to_session.lock() {
            m2s.remove(&mid);
        }
    }
}
