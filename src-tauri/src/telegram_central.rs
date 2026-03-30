use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tokio::time;

use crate::preferences;
use crate::telegram_types::*;
use crate::telegram_commands;
use crate::telegram_send;

// ========================================
// POLLING SERVICE
// ========================================

/// Start the Telegram polling service
pub async fn start_polling(state: TelegramPollingState) {
    log::info!("Starting Telegram Central Polling Service...");

    if state.is_running() {
        log::warn!("Polling service already running");
        return;
    }

    state.set_running(true);
    let _ = state.app.emit("telegram-polling-started", ());

    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(2));
        loop {
            interval.tick().await;
            if !state.is_running() {
                log::info!("Polling service stopped");
                break;
            }
            if let Err(e) = poll_updates(&state).await {
                log::error!("Error polling updates: {}", e);
            }
        }
        let _ = state.app.emit("telegram-polling-stopped", ());
    });
}

/// Stop the polling service
pub fn stop_polling(state: &TelegramPollingState) {
    log::info!("Stopping Telegram Central Polling Service...");
    state.set_running(false);
}

/// Poll for new updates from Telegram
async fn poll_updates(state: &TelegramPollingState) -> Result<(), String> {
    let prefs = preferences::get_preferences(state.app.clone())
        .await
        .map_err(|e| format!("Failed to get preferences: {}", e))?;

    let bot_token = prefs
        .telegram_bot_token
        .ok_or("Telegram bot token not configured")?;

    let offset = {
        let last_id = state.last_update_id.lock().map_err(|_| "Lock error")?;
        *last_id + 1
    };

    let url = format!(
        "https://api.telegram.org/bot{}/getUpdates?offset={}&timeout=10",
        bot_token, offset
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch updates: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Telegram API error: {}", response.status()));
    }

    let api_response: GetUpdatesResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if !api_response.ok {
        return Err("Telegram API returned ok=false".to_string());
    }

    for update in api_response.result {
        update_last_id(state, update.update_id)?;
        if let Err(e) = process_update(state, &update).await {
            log::error!("Error processing update {}: {}", update.update_id, e);
        }
    }

    Ok(())
}

fn update_last_id(state: &TelegramPollingState, id: i64) -> Result<(), String> {
    let mut last_id = state.last_update_id.lock().map_err(|_| "Lock error")?;
    *last_id = id;
    Ok(())
}

/// Process a single Telegram update
async fn process_update(
    state: &TelegramPollingState,
    update: &TelegramUpdate,
) -> Result<(), String> {
    // Handle callback queries first
    if let Some(ref query) = update.callback_query {
        return telegram_commands::handle_callback_query(&state.app, query).await;
    }

    let message = match &update.message {
        Some(msg) => msg,
        None => return Ok(()),
    };

    let text = match &message.text {
        Some(t) => t,
        None => return Ok(()),
    };

    let chat_id = message.chat.id;
    log::info!("Received message from chat_id={}: {}", chat_id, text);

    // Handle reply-to-message (bidirectional chat)
    if let Some(ref reply_msg) = message.reply_to_message {
        return telegram_commands::handle_reply_message(
            &state.app, chat_id, text, reply_msg.message_id,
        ).await;
    }

    // Handle /start command
    if text.starts_with("/start ") {
        return telegram_commands::handle_start_command(state, message).await;
    }

    // Check if user is registered
    let unique_id = match state.get_unique_id(chat_id) {
        Some(id) => id,
        None => {
            telegram_send::send_message(
                &state.app, chat_id,
                "Welcome to Quack!\n\nPlease link your Quack app first by clicking the \"Connect Telegram\" button in the app.",
            ).await?;
            return Ok(());
        }
    };

    telegram_commands::handle_user_command(state, &unique_id, chat_id, text).await
}

// ========================================
// TAURI COMMANDS
// ========================================

/// Generate a unique ID for this Quack installation
#[tauri::command]
pub fn generate_unique_id() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let mut rng = rand::thread_rng();

    let random_part: String = (0..8)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect();

    format!("QUACK-{}", random_part)
}

/// Generate deep link for Telegram bot
#[tauri::command]
pub async fn generate_telegram_deep_link(unique_id: String) -> Result<String, String> {
    let bot_username = "JackTheDuck_bot";
    Ok(format!("https://t.me/{}?start={}", bot_username, unique_id))
}

/// Start polling service (called from frontend)
#[tauri::command]
pub async fn start_telegram_polling(app: AppHandle) -> Result<(), String> {
    let state = app
        .state::<TelegramPollingState>()
        .inner()
        .clone();

    start_polling(state).await;
    Ok(())
}

/// Stop polling service (called from frontend)
#[tauri::command]
pub fn stop_telegram_polling(app: AppHandle) -> Result<(), String> {
    let state = app.state::<TelegramPollingState>();
    stop_polling(state.inner());
    Ok(())
}
