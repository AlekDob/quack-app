use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};
use tokio::time;

use crate::preferences;

// ========================================
// TYPES
// ========================================

/// Telegram Update structure from getUpdates API
#[derive(Debug, Deserialize, Clone)]
pub struct TelegramUpdate {
    pub update_id: i64,
    #[serde(default)]
    pub message: Option<TelegramMessage>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TelegramMessage {
    pub message_id: i64,
    pub from: Option<TelegramUser>,
    pub chat: TelegramChat,
    #[serde(default)]
    pub text: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TelegramUser {
    pub id: i64,
    pub first_name: String,
    #[serde(default)]
    pub username: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TelegramChat {
    pub id: i64,
    #[serde(rename = "type")]
    pub chat_type: String,
}

/// Polling state shared across the app
#[derive(Clone)]
pub struct TelegramPollingState {
    pub app: AppHandle,
    pub is_running: Arc<Mutex<bool>>,
    pub last_update_id: Arc<Mutex<i64>>,
    /// Maps telegram_chat_id -> unique_id (QUACK-XXX)
    pub user_mappings: Arc<Mutex<HashMap<i64, String>>>,
}

impl TelegramPollingState {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            is_running: Arc::new(Mutex::new(false)),
            last_update_id: Arc::new(Mutex::new(0)),
            user_mappings: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Register a new user mapping (telegram_chat_id -> unique_id)
    pub fn register_user(&self, chat_id: i64, unique_id: String) {
        if let Ok(mut mappings) = self.user_mappings.lock() {
            mappings.insert(chat_id, unique_id.clone());
            log::info!("🦆 Registered user mapping: chat_id={} -> unique_id={}", chat_id, unique_id);
        }
    }

    /// Get unique_id from telegram_chat_id
    pub fn get_unique_id(&self, chat_id: i64) -> Option<String> {
        self.user_mappings.lock().ok()?.get(&chat_id).cloned()
    }

    /// Check if polling is running
    pub fn is_running(&self) -> bool {
        self.is_running.lock().map(|r| *r).unwrap_or(false)
    }

    /// Set polling running state
    pub fn set_running(&self, running: bool) {
        if let Ok(mut r) = self.is_running.lock() {
            *r = running;
        }
    }
}

// ========================================
// POLLING SERVICE
// ========================================

/// Start the Telegram polling service
pub async fn start_polling(state: TelegramPollingState) {
    log::info!("🦆 Starting Telegram Central Polling Service...");

    // Check if already running
    if state.is_running() {
        log::warn!("🦆 Polling service already running");
        return;
    }

    state.set_running(true);

    // Emit event to UI that polling started
    let _ = state.app.emit("telegram-polling-started", ());

    // Start polling loop in background
    tokio::spawn(async move {
        let mut interval = time::interval(Duration::from_secs(2)); // Poll every 2 seconds

        loop {
            interval.tick().await;

            // Check if we should stop
            if !state.is_running() {
                log::info!("🦆 Polling service stopped");
                break;
            }

            // Fetch updates from Telegram
            if let Err(e) = poll_updates(&state).await {
                log::error!("🦆 Error polling updates: {}", e);
                // Continue polling even on error
            }
        }

        // Emit event to UI that polling stopped
        let _ = state.app.emit("telegram-polling-stopped", ());
    });
}

/// Stop the polling service
pub fn stop_polling(state: &TelegramPollingState) {
    log::info!("🦆 Stopping Telegram Central Polling Service...");
    state.set_running(false);
}

/// Poll for new updates from Telegram
async fn poll_updates(state: &TelegramPollingState) -> Result<(), String> {
    // Get bot token from preferences
    let prefs = preferences::get_preferences(state.app.clone())
        .await
        .map_err(|e| format!("Failed to get preferences: {}", e))?;

    let bot_token = prefs
        .telegram_bot_token
        .ok_or("Telegram bot token not configured")?;

    // Get last update ID
    let offset = {
        let last_id = state.last_update_id.lock().map_err(|_| "Lock error")?;
        *last_id + 1
    };

    // Call Telegram getUpdates API
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

    #[derive(Deserialize)]
    struct GetUpdatesResponse {
        ok: bool,
        result: Vec<TelegramUpdate>,
    }

    let api_response: GetUpdatesResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    if !api_response.ok {
        return Err("Telegram API returned ok=false".to_string());
    }

    // Process each update
    for update in api_response.result {
        // Update last_update_id
        {
            let mut last_id = state.last_update_id.lock().map_err(|_| "Lock error")?;
            *last_id = update.update_id;
        }

        // Process the update
        if let Err(e) = process_update(state, &update).await {
            log::error!("🦆 Error processing update {}: {}", update.update_id, e);
        }
    }

    Ok(())
}

/// Process a single Telegram update
async fn process_update(state: &TelegramPollingState, update: &TelegramUpdate) -> Result<(), String> {
    let message = match &update.message {
        Some(msg) => msg,
        None => return Ok(()), // Skip non-message updates
    };

    let text = match &message.text {
        Some(t) => t,
        None => return Ok(()), // Skip non-text messages
    };

    let chat_id = message.chat.id;

    log::info!("🦆 Received message from chat_id={}: {}", chat_id, text);

    // Check if this is a /start command with unique_id parameter
    if text.starts_with("/start ") {
        handle_start_command(state, message).await?;
        return Ok(());
    }

    // Check if this user is registered
    let unique_id = match state.get_unique_id(chat_id) {
        Some(id) => id,
        None => {
            // User not registered yet
            send_message(
                &state.app,
                chat_id,
                "🦆 Welcome to Quack!\n\nPlease link your Quack app first by clicking the \"Connect Telegram\" button in the app.",
            )
            .await?;
            return Ok(());
        }
    };

    // Parse command and emit event to frontend
    handle_user_command(state, &unique_id, chat_id, text).await?;

    Ok(())
}

/// Handle /start command (user registration)
async fn handle_start_command(
    state: &TelegramPollingState,
    message: &TelegramMessage,
) -> Result<(), String> {
    let text = message.text.as_ref().unwrap();
    let parts: Vec<&str> = text.split_whitespace().collect();

    log::info!("🦆 Processing /start command: {:?}", parts);

    if parts.len() < 2 {
        log::warn!("🦆 /start without unique_id");
        send_message(
            &state.app,
            message.chat.id,
            "🦆 Welcome to Quack!\n\nPlease use the \"Connect Telegram\" button in your Quack app to link your account.",
        )
        .await?;
        return Ok(());
    }

    let unique_id = parts[1].to_string();

    // Validate unique_id format (should start with QUACK-)
    if !unique_id.starts_with("QUACK-") {
        log::error!("🦆 Invalid unique_id format: {}", unique_id);
        return Err("Invalid unique_id format".to_string());
    }

    log::info!("🦆 Registering user: chat_id={} unique_id={}", message.chat.id, unique_id);

    // Register this user
    state.register_user(message.chat.id, unique_id.clone());

    // Send confirmation
    log::info!("🦆 Sending confirmation message to chat_id={}", message.chat.id);
    match send_message(
        &state.app,
        message.chat.id,
        "🦆 *Successfully linked!*\n\nYour Quack app is now connected to Telegram.\n\nYou can now:\n• Receive notifications\n• Control your agents\n• Get status updates\n\nType /help to see available commands.",
    )
    .await {
        Ok(_) => log::info!("🦆 Confirmation message sent successfully"),
        Err(e) => log::error!("🦆 Failed to send confirmation message: {}", e),
    }

    // Emit event to frontend that user is linked
    #[derive(Serialize, Clone)]
    struct UserLinkedPayload {
        unique_id: String,
        telegram_chat_id: i64,
    }

    let _ = state.app.emit(
        "telegram-user-linked",
        UserLinkedPayload {
            unique_id: unique_id.clone(),
            telegram_chat_id: message.chat.id,
        },
    );

    log::info!("🦆 User linked: unique_id={} chat_id={}", unique_id, message.chat.id);

    Ok(())
}

/// Handle commands from registered users
async fn handle_user_command(
    state: &TelegramPollingState,
    unique_id: &str,
    chat_id: i64,
    text: &str,
) -> Result<(), String> {
    log::info!("🦆 Command from user {}: {}", unique_id, text);

    // Parse command
    let parts: Vec<&str> = text.trim().split_whitespace().collect();
    if parts.is_empty() {
        return Ok(());
    }

    match parts[0] {
        "/status" => {
            // Emit event to frontend to get agent status
            #[derive(Serialize, Clone)]
            struct StatusRequestPayload {
                unique_id: String,
                telegram_chat_id: i64,
            }

            let _ = state.app.emit(
                "telegram-command-status",
                StatusRequestPayload {
                    unique_id: unique_id.to_string(),
                    telegram_chat_id: chat_id,
                },
            );
        }
        "/help" => {
            send_message(
                &state.app,
                chat_id,
                "🦆 *Quack Bot Commands*\n\n/status - View active agents\n/help - Show this help\n\nMore commands coming soon!",
            )
            .await?;
        }
        _ => {
            send_message(
                &state.app,
                chat_id,
                "🦆 Unknown command. Type /help to see available commands.",
            )
            .await?;
        }
    }

    Ok(())
}

// ========================================
// HELPER FUNCTIONS
// ========================================

/// Send a message to a Telegram chat
pub async fn send_message(app: &AppHandle, chat_id: i64, text: &str) -> Result<(), String> {
    log::info!("🦆 send_message called: chat_id={} text_len={}", chat_id, text.len());

    let prefs = preferences::get_preferences(app.clone())
        .await
        .map_err(|e| {
            log::error!("🦆 Failed to get preferences: {}", e);
            format!("Failed to get preferences: {}", e)
        })?;

    let bot_token = prefs
        .telegram_bot_token
        .ok_or_else(|| {
            log::error!("🦆 Telegram bot token not configured");
            "Telegram bot token not configured".to_string()
        })?;

    log::info!("🦆 Bot token found, length: {}", bot_token.len());

    let url = format!("https://api.telegram.org/bot{}/sendMessage", bot_token);

    let payload = serde_json::json!({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
    });

    log::info!("🦆 Sending POST to Telegram API...");

    let client = reqwest::Client::new();
    let response = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            log::error!("🦆 HTTP error: {}", e);
            format!("Failed to send message: {}", e)
        })?;

    log::info!("🦆 Telegram API response status: {}", response.status());

    if !response.status().is_success() {
        let error_body = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        log::error!("🦆 Telegram API error response: {}", error_body);
        return Err(format!("Telegram API error: {}", error_body));
    }

    log::info!("🦆 Message sent successfully!");
    Ok(())
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
    // JackTheDuck_bot - Quack Central Bot for all Quack users
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
    let state = app
        .state::<TelegramPollingState>()
        .inner();

    stop_polling(state);
    Ok(())
}
