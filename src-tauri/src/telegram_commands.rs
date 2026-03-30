use serde::Serialize;
use tauri::{AppHandle, Emitter, Manager};

use crate::telegram_send;
use crate::telegram_types::{CallbackQuery, TelegramMessage, TelegramPollingState};

/// Handle /start command (user registration)
pub async fn handle_start_command(
    state: &TelegramPollingState,
    message: &TelegramMessage,
) -> Result<(), String> {
    let text = message.text.as_ref().unwrap();
    let parts: Vec<&str> = text.split_whitespace().collect();
    let chat_id = message.chat.id;

    if parts.len() < 2 {
        return send_no_unique_id_message(state, chat_id).await;
    }

    let unique_id = parts[1].to_string();
    if !unique_id.starts_with("QUACK-") {
        log::error!("Invalid unique_id format: {}", unique_id);
        return Err("Invalid unique_id format".to_string());
    }

    register_and_confirm(state, chat_id, unique_id).await
}

/// Handle commands from registered users
pub async fn handle_user_command(
    state: &TelegramPollingState,
    unique_id: &str,
    chat_id: i64,
    text: &str,
) -> Result<(), String> {
    log::info!("Command from user {}: {}", unique_id, text);

    let parts: Vec<&str> = text.trim().split_whitespace().collect();
    if parts.is_empty() {
        return Ok(());
    }

    match parts[0] {
        "/status" => emit_status_request(&state.app, unique_id, chat_id),
        "/help" => send_help_message(&state.app, chat_id).await?,
        _ => send_unknown_command(&state.app, chat_id).await?,
    }

    Ok(())
}

/// Handle reply-to-message (bidirectional chat)
pub async fn handle_reply_message(
    app: &AppHandle,
    chat_id: i64,
    text: &str,
    reply_to_message_id: i64,
) -> Result<(), String> {
    let mappings = app
        .try_state::<crate::telegram_notifications::TelegramSessionMappings>();

    let mappings = match mappings {
        Some(m) => m,
        None => {
            return send_expired_session_message(app, chat_id).await;
        }
    };

    let session_id = {
        let map = mappings.msg_to_session.lock().map_err(|_| "Lock error")?;
        map.get(&reply_to_message_id).cloned()
    };

    let session_id = match session_id {
        Some(id) => id,
        None => {
            return send_expired_session_message(app, chat_id).await;
        }
    };

    if is_session_active(&session_id) {
        emit_remote_send_message(app, &session_id, text);
        Ok(())
    } else {
        send_inactive_session_message(app, chat_id).await
    }
}

/// Handle callback query (inline button presses)
pub async fn handle_callback_query(
    app: &AppHandle,
    query: &CallbackQuery,
) -> Result<(), String> {
    let data = match &query.data {
        Some(d) => d.as_str(),
        None => {
            return telegram_send::answer_callback_query(
                app, &query.id, "Comando non riconosciuto", false,
            ).await;
        }
    };

    if let Some(session_id) = data.strip_prefix("stop:") {
        handle_stop_callback(app, query, session_id).await
    } else {
        telegram_send::answer_callback_query(
            app, &query.id, "Comando non riconosciuto", false,
        ).await
    }
}

// ── Private helpers ─────────────────────────────────────

async fn send_no_unique_id_message(
    state: &TelegramPollingState,
    chat_id: i64,
) -> Result<(), String> {
    telegram_send::send_message(
        &state.app,
        chat_id,
        "Welcome to Quack!\n\nPlease use the \"Connect Telegram\" button in your Quack app to link your account.",
    ).await
}

async fn register_and_confirm(
    state: &TelegramPollingState,
    chat_id: i64,
    unique_id: String,
) -> Result<(), String> {
    state.register_user(chat_id, unique_id.clone());

    let _ = telegram_send::send_message(
        &state.app,
        chat_id,
        "*Successfully linked!*\n\nYour Quack app is now connected to Telegram.\n\nYou can now:\n- Receive notifications\n- Control your agents\n- Get status updates\n\nType /help to see available commands.",
    ).await;

    emit_user_linked(&state.app, &unique_id, chat_id);
    Ok(())
}

fn emit_status_request(app: &AppHandle, unique_id: &str, chat_id: i64) {
    #[derive(Serialize, Clone)]
    struct StatusPayload {
        unique_id: String,
        telegram_chat_id: i64,
    }
    let _ = app.emit("telegram-command-status", StatusPayload {
        unique_id: unique_id.to_string(),
        telegram_chat_id: chat_id,
    });
}

async fn send_help_message(app: &AppHandle, chat_id: i64) -> Result<(), String> {
    telegram_send::send_message(
        app,
        chat_id,
        "*Quack Bot Commands*\n\n/status - View active agents\n/help - Show this help\n\nMore commands coming soon!",
    ).await
}

async fn send_unknown_command(app: &AppHandle, chat_id: i64) -> Result<(), String> {
    telegram_send::send_message(
        app, chat_id, "Unknown command. Type /help to see available commands.",
    ).await
}

fn emit_user_linked(app: &AppHandle, unique_id: &str, chat_id: i64) {
    #[derive(Serialize, Clone)]
    struct Payload { unique_id: String, telegram_chat_id: i64 }
    let _ = app.emit("telegram-user-linked", Payload {
        unique_id: unique_id.to_string(),
        telegram_chat_id: chat_id,
    });
}

async fn send_expired_session_message(
    app: &AppHandle,
    chat_id: i64,
) -> Result<(), String> {
    telegram_send::send_message(
        app, chat_id,
        "Sessione scaduta. Questa notifica non e' piu' collegata a una sessione attiva.",
    ).await
}

async fn send_inactive_session_message(
    app: &AppHandle,
    chat_id: i64,
) -> Result<(), String> {
    telegram_send::send_message(
        app, chat_id,
        "Questa sessione non e' piu' attiva. Usa /status per vedere le sessioni correnti.",
    ).await
}

fn is_session_active(session_id: &str) -> bool {
    if let Ok(status_map) = crate::AGENT_STATUS.read() {
        return status_map.values().any(|s| s == "busy");
    }
    // If we can't read status, check agents storage
    check_session_in_agents(session_id)
}

fn check_session_in_agents(session_id: &str) -> bool {
    if let Ok(storage) = crate::remote_api::read_agents_storage() {
        if let Some(agents) = storage.get("agents").and_then(|a| a.as_array()) {
            for agent in agents {
                if let Some(sessions) = agent.get("sessions").and_then(|s| s.as_array()) {
                    for session in sessions {
                        let sid = session.get("claudeSessionId")
                            .and_then(|v| v.as_str())
                            .unwrap_or("");
                        if sid == session_id {
                            return true;
                        }
                    }
                }
            }
        }
    }
    false
}

fn emit_remote_send_message(app: &AppHandle, session_id: &str, text: &str) {
    let _ = app.emit("remote-send-message", serde_json::json!({
        "sessionId": session_id,
        "message": text,
        "source": "telegram"
    }));
}

async fn handle_stop_callback(
    app: &AppHandle,
    query: &CallbackQuery,
    session_id: &str,
) -> Result<(), String> {
    if is_session_active(session_id) {
        let _ = app.emit("telegram-command-stop", serde_json::json!({
            "sessionId": session_id,
            "source": "telegram"
        }));
        telegram_send::answer_callback_query(
            app, &query.id, "Sessione fermata", false,
        ).await
    } else {
        telegram_send::answer_callback_query(
            app, &query.id, "Sessione gia' terminata", true,
        ).await
    }
}
