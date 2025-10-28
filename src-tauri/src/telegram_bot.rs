use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use axum::{
    extract::{Json, State},
    http::StatusCode,
    routing::post,
    Router,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

use crate::preferences;

// Telegram Bot API types
#[derive(Debug, Deserialize, Clone)]
pub struct TelegramUpdate {
    pub update_id: i64,
    #[serde(default)]
    pub message: Option<TelegramMessage>,
    #[serde(default)]
    pub callback_query: Option<TelegramCallbackQuery>,
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

#[derive(Debug, Deserialize, Clone)]
pub struct TelegramCallbackQuery {
    pub id: String,
    pub from: TelegramUser,
    pub message: Option<TelegramMessage>,
    #[serde(default)]
    pub data: Option<String>,
}

// Bot commands
#[derive(Debug, Clone)]
pub enum BotCommand {
    Status,                                    // /status - List all active agents
    New { prompt: String },                    // /new <prompt> - Start new agent
    Stop { session_id: String },               // /stop <session_id> - Stop agent
    Chat { session_id: String, message: String }, // /chat <session_id> <message> - Send message to agent
    Screenshot { session_id: String },         // /screenshot <session_id> - Request screenshot
    Help,                                      // /help - Show available commands
    Unknown,
}

impl BotCommand {
    pub fn parse(text: &str) -> Self {
        let parts: Vec<&str> = text.trim().split_whitespace().collect();

        if parts.is_empty() {
            return Self::Unknown;
        }

        match parts[0] {
            "/status" => Self::Status,
            "/help" | "/start" => Self::Help,
            "/new" => {
                if parts.len() > 1 {
                    let prompt = parts[1..].join(" ");
                    Self::New { prompt }
                } else {
                    Self::Unknown
                }
            }
            "/stop" => {
                if parts.len() > 1 {
                    Self::Stop {
                        session_id: parts[1].to_string(),
                    }
                } else {
                    Self::Unknown
                }
            }
            "/chat" => {
                if parts.len() > 2 {
                    let session_id = parts[1].to_string();
                    let message = parts[2..].join(" ");
                    Self::Chat { session_id, message }
                } else {
                    Self::Unknown
                }
            }
            "/screenshot" => {
                if parts.len() > 1 {
                    Self::Screenshot {
                        session_id: parts[1].to_string(),
                    }
                } else {
                    Self::Unknown
                }
            }
            _ => Self::Unknown,
        }
    }
}

// Session tracking - maps Telegram message_thread_id to agent session_id
#[derive(Clone)]
pub struct TelegramBotState {
    pub app: AppHandle,
    pub sessions: Arc<Mutex<HashMap<i64, String>>>, // thread_id -> session_id
}

impl TelegramBotState {
    pub fn new(app: AppHandle) -> Self {
        Self {
            app,
            sessions: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub fn register_session(&self, thread_id: i64, session_id: String) {
        if let Ok(mut sessions) = self.sessions.lock() {
            sessions.insert(thread_id, session_id);
        }
    }

    pub fn get_session(&self, thread_id: i64) -> Option<String> {
        self.sessions.lock().ok()?.get(&thread_id).cloned()
    }

    pub fn remove_session(&self, thread_id: i64) {
        if let Ok(mut sessions) = self.sessions.lock() {
            sessions.remove(&thread_id);
        }
    }
}

// Webhook handler
async fn handle_webhook(
    State(state): State<TelegramBotState>,
    Json(update): Json<TelegramUpdate>,
) -> StatusCode {
    log::info!("🦆 Telegram webhook received: {:?}", update);

    // Handle text messages
    if let Some(message) = update.message {
        if let Some(ref text) = message.text {
            let command = BotCommand::parse(text);

            match command {
                BotCommand::Status => {
                    handle_status_command(&state, &message).await;
                }
                BotCommand::New { prompt } => {
                    handle_new_command(&state, &message, prompt).await;
                }
                BotCommand::Stop { session_id } => {
                    handle_stop_command(&state, &message, session_id).await;
                }
                BotCommand::Chat { session_id, message: msg } => {
                    handle_chat_command(&state, &message, session_id, msg).await;
                }
                BotCommand::Screenshot { session_id } => {
                    handle_screenshot_command(&state, &message, session_id).await;
                }
                BotCommand::Help => {
                    handle_help_command(&state, &message).await;
                }
                BotCommand::Unknown => {
                    send_telegram_reply(&state, message.chat.id, "Unknown command. Use /help to see available commands.", None).await;
                }
            }
        }
    }

    // Handle callback queries (inline keyboard buttons)
    if let Some(callback_query) = update.callback_query {
        handle_callback_query(&state, callback_query).await;
    }

    StatusCode::OK
}

// Command handlers
async fn handle_status_command(state: &TelegramBotState, message: &TelegramMessage) {
    // Emit event to main window to get active sessions
    if let Err(e) = state.app.emit("telegram-command-status", ()) {
        log::error!("🦆 Failed to emit telegram-command-status: {}", e);
        send_telegram_reply(state, message.chat.id, "Failed to retrieve agent status.", None).await;
        return;
    }

    // Response will be sent via telegram-send-status event from frontend
}

async fn handle_new_command(state: &TelegramBotState, message: &TelegramMessage, prompt: String) {
    log::info!("🦆 Starting new agent with prompt: {}", prompt);

    // Emit event to main window to create new agent
    #[derive(Serialize, Clone)]
    struct NewAgentPayload {
        prompt: String,
        telegram_chat_id: i64,
        telegram_message_id: i64,
    }

    let payload = NewAgentPayload {
        prompt: prompt.clone(),
        telegram_chat_id: message.chat.id,
        telegram_message_id: message.message_id,
    };

    if let Err(e) = state.app.emit("telegram-command-new", payload) {
        log::error!("🦆 Failed to emit telegram-command-new: {}", e);
        send_telegram_reply(state, message.chat.id, "Failed to start new agent.", None).await;
        return;
    }

    // Confirmation will be sent via telegram-agent-started event from frontend
}

async fn handle_stop_command(state: &TelegramBotState, message: &TelegramMessage, session_id: String) {
    log::info!("🦆 Stopping agent: {}", session_id);

    #[derive(Serialize, Clone)]
    struct StopAgentPayload {
        session_id: String,
        telegram_chat_id: i64,
    }

    let payload = StopAgentPayload {
        session_id: session_id.clone(),
        telegram_chat_id: message.chat.id,
    };

    if let Err(e) = state.app.emit("telegram-command-stop", payload) {
        log::error!("🦆 Failed to emit telegram-command-stop: {}", e);
        send_telegram_reply(state, message.chat.id, &format!("Failed to stop agent: {}", session_id), None).await;
        return;
    }

    // Confirmation will be sent from frontend
}

async fn handle_chat_command(state: &TelegramBotState, message: &TelegramMessage, session_id: String, msg: String) {
    log::info!("🦆 Sending message to agent {}: {}", session_id, msg);

    #[derive(Serialize, Clone)]
    struct ChatAgentPayload {
        session_id: String,
        message: String,
        telegram_chat_id: i64,
    }

    let payload = ChatAgentPayload {
        session_id: session_id.clone(),
        message: msg.clone(),
        telegram_chat_id: message.chat.id,
    };

    if let Err(e) = state.app.emit("telegram-command-chat", payload) {
        log::error!("🦆 Failed to emit telegram-command-chat: {}", e);
        send_telegram_reply(state, message.chat.id, &format!("Failed to send message to agent: {}", session_id), None).await;
        return;
    }

    // Confirmation will be sent from frontend
}

async fn handle_screenshot_command(state: &TelegramBotState, message: &TelegramMessage, session_id: String) {
    log::info!("🦆 Requesting screenshot for agent: {}", session_id);

    #[derive(Serialize, Clone)]
    struct ScreenshotPayload {
        session_id: String,
        telegram_chat_id: i64,
    }

    let payload = ScreenshotPayload {
        session_id: session_id.clone(),
        telegram_chat_id: message.chat.id,
    };

    if let Err(e) = state.app.emit("telegram-command-screenshot", payload) {
        log::error!("🦆 Failed to emit telegram-command-screenshot: {}", e);
        send_telegram_reply(state, message.chat.id, &format!("Failed to request screenshot for agent: {}", session_id), None).await;
        return;
    }

    // Screenshot will be sent from frontend
}

async fn handle_help_command(state: &TelegramBotState, message: &TelegramMessage) {
    let help_text = r#"🦆 *Quack Bot Commands*

/status - List all active agents
/new <prompt> - Start a new agent with a prompt
/chat <session_id> <message> - Send a message to an agent
/stop <session_id> - Stop an agent
/screenshot <session_id> - Get a screenshot from an agent
/help - Show this help message

*Examples:*
`/new Create a React component`
`/chat abc123 What's the current status?`
`/stop abc123`
"#;

    send_telegram_reply(state, message.chat.id, help_text, None).await;
}

async fn handle_callback_query(state: &TelegramBotState, callback_query: TelegramCallbackQuery) {
    log::info!("🦆 Callback query: {:?}", callback_query.data);

    // Parse callback data format: "action:session_id"
    if let Some(data) = callback_query.data {
        let parts: Vec<&str> = data.split(':').collect();
        if parts.len() == 2 {
            let action = parts[0];
            let session_id = parts[1].to_string();

            match action {
                "approve" => {
                    #[derive(Serialize, Clone)]
                    struct ApprovePayload {
                        session_id: String,
                    }
                    let _ = state.app.emit("telegram-callback-approve", ApprovePayload { session_id });
                }
                "cancel" => {
                    #[derive(Serialize, Clone)]
                    struct CancelPayload {
                        session_id: String,
                    }
                    let _ = state.app.emit("telegram-callback-cancel", CancelPayload { session_id });
                }
                "retry" => {
                    #[derive(Serialize, Clone)]
                    struct RetryPayload {
                        session_id: String,
                    }
                    let _ = state.app.emit("telegram-callback-retry", RetryPayload { session_id });
                }
                _ => {}
            }
        }
    }

    // Answer callback query to remove loading state
    answer_callback_query(&state.app, &callback_query.id).await;
}

// Helper functions for sending Telegram messages
async fn send_telegram_reply(state: &TelegramBotState, chat_id: i64, text: &str, reply_markup: Option<serde_json::Value>) {
    let app = state.app.clone();
    let text = text.to_string();

    tauri::async_runtime::spawn(async move {
        if let Ok(prefs) = preferences::get_preferences(app.clone()).await {
            if let Some(bot_token) = prefs.telegram_bot_token {
                let url = format!("https://api.telegram.org/bot{}/sendMessage", bot_token);

                let mut payload = serde_json::json!({
                    "chat_id": chat_id,
                    "text": text,
                    "parse_mode": "Markdown",
                });

                if let Some(markup) = reply_markup {
                    payload["reply_markup"] = markup;
                }

                let client = reqwest::Client::new();
                match client.post(&url).json(&payload).send().await {
                    Ok(response) => {
                        if !response.status().is_success() {
                            log::error!("🦆 Telegram API error: {:?}", response.text().await);
                        }
                    }
                    Err(e) => {
                        log::error!("🦆 Failed to send Telegram message: {}", e);
                    }
                }
            }
        }
    });
}

async fn answer_callback_query(app: &AppHandle, callback_query_id: &str) {
    let app = app.clone();
    let callback_query_id = callback_query_id.to_string();

    tauri::async_runtime::spawn(async move {
        if let Ok(prefs) = preferences::get_preferences(app.clone()).await {
            if let Some(bot_token) = prefs.telegram_bot_token {
                let url = format!("https://api.telegram.org/bot{}/answerCallbackQuery", bot_token);

                let payload = serde_json::json!({
                    "callback_query_id": callback_query_id,
                });

                let client = reqwest::Client::new();
                let _ = client.post(&url).json(&payload).send().await;
            }
        }
    });
}

// Public API
pub fn create_telegram_router(app: AppHandle) -> Router {
    let state = TelegramBotState::new(app);

    Router::new()
        .route("/telegram/webhook", post(handle_webhook))
        .with_state(state)
}

// Utility function to send notifications from Rust backend
pub async fn send_agent_notification(app: AppHandle, chat_id: i64, session_id: &str, message_text: &str, show_actions: bool) {
    let reply_markup = if show_actions {
        Some(serde_json::json!({
            "inline_keyboard": [[
                {"text": "✅ Approve", "callback_data": format!("approve:{}", session_id)},
                {"text": "❌ Cancel", "callback_data": format!("cancel:{}", session_id)},
                {"text": "🔄 Retry", "callback_data": format!("retry:{}", session_id)},
            ]]
        }))
    } else {
        None
    };

    if let Ok(prefs) = preferences::get_preferences(app.clone()).await {
        if let Some(bot_token) = prefs.telegram_bot_token {
            let url = format!("https://api.telegram.org/bot{}/sendMessage", bot_token);

            let mut payload = serde_json::json!({
                "chat_id": chat_id,
                "text": message_text,
                "parse_mode": "Markdown",
            });

            if let Some(markup) = reply_markup {
                payload["reply_markup"] = markup;
            }

            let client = reqwest::Client::new();
            match client.post(&url).json(&payload).send().await {
                Ok(response) => {
                    if !response.status().is_success() {
                        log::error!("🦆 Telegram API error: {:?}", response.text().await);
                    }
                }
                Err(e) => {
                    log::error!("🦆 Failed to send Telegram notification: {}", e);
                }
            }
        }
    }
}

// Tauri commands for sending Telegram messages from frontend
#[derive(Deserialize)]
pub struct TelegramMessagePayload {
    pub chat_id: i64,
    pub text: String,
}

#[derive(Deserialize)]
pub struct TelegramNotificationPayload {
    pub chat_id: i64,
    pub session_id: String,
    pub message: String,
    pub show_actions: bool,
}

#[derive(Deserialize)]
pub struct TelegramPhotoPayload {
    pub chat_id: i64,
    pub photo_path: String,
    pub caption: Option<String>,
}

#[tauri::command]
pub async fn send_telegram_message(app: AppHandle, payload: TelegramMessagePayload) -> Result<(), String> {
    if let Ok(prefs) = preferences::get_preferences(app.clone()).await {
        if let Some(bot_token) = prefs.telegram_bot_token {
            let url = format!("https://api.telegram.org/bot{}/sendMessage", bot_token);

            let json_payload = serde_json::json!({
                "chat_id": payload.chat_id,
                "text": payload.text,
                "parse_mode": "Markdown",
            });

            let client = reqwest::Client::new();
            match client.post(&url).json(&json_payload).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        Ok(())
                    } else {
                        Err(format!("Telegram API error: {:?}", response.text().await))
                    }
                }
                Err(e) => Err(format!("Failed to send message: {}", e)),
            }
        } else {
            Err("Telegram not configured".to_string())
        }
    } else {
        Err("Failed to get preferences".to_string())
    }
}

#[tauri::command]
pub async fn send_telegram_notification_command(app: AppHandle, payload: TelegramNotificationPayload) -> Result<(), String> {
    send_agent_notification(
        app,
        payload.chat_id,
        &payload.session_id,
        &payload.message,
        payload.show_actions,
    )
    .await;
    Ok(())
}

#[tauri::command]
pub async fn send_telegram_photo(app: AppHandle, payload: TelegramPhotoPayload) -> Result<(), String> {
    if let Ok(prefs) = preferences::get_preferences(app.clone()).await {
        if let Some(bot_token) = prefs.telegram_bot_token {
            let url = format!("https://api.telegram.org/bot{}/sendPhoto", bot_token);

            // Read photo file
            let photo_data = tokio::fs::read(&payload.photo_path)
                .await
                .map_err(|e| format!("Failed to read photo: {}", e))?;

            // Create multipart form
            let part = reqwest::multipart::Part::bytes(photo_data)
                .file_name("screenshot.png")
                .mime_str("image/png")
                .map_err(|e| format!("Failed to create multipart: {}", e))?;

            let mut form = reqwest::multipart::Form::new()
                .text("chat_id", payload.chat_id.to_string())
                .part("photo", part);

            if let Some(caption) = payload.caption {
                form = form.text("caption", caption).text("parse_mode", "Markdown");
            }

            let client = reqwest::Client::new();
            match client.post(&url).multipart(form).send().await {
                Ok(response) => {
                    if response.status().is_success() {
                        Ok(())
                    } else {
                        Err(format!("Telegram API error: {:?}", response.text().await))
                    }
                }
                Err(e) => Err(format!("Failed to send photo: {}", e)),
            }
        } else {
            Err("Telegram not configured".to_string())
        }
    } else {
        Err("Failed to get preferences".to_string())
    }
}
