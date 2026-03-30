use std::collections::HashMap;
use std::sync::{Arc, Mutex};

use serde::Deserialize;
use tauri::AppHandle;

// ========================================
// TELEGRAM API TYPES
// ========================================

#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
pub struct TelegramUpdate {
    pub update_id: i64,
    #[serde(default)]
    pub message: Option<TelegramMessage>,
    #[serde(default)]
    pub callback_query: Option<CallbackQuery>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
pub struct TelegramMessage {
    pub message_id: i64,
    pub from: Option<TelegramUser>,
    pub chat: TelegramChat,
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default)]
    pub reply_to_message: Option<Box<TelegramMessage>>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
pub struct TelegramUser {
    pub id: i64,
    pub first_name: String,
    #[serde(default)]
    pub username: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
pub struct TelegramChat {
    pub id: i64,
    #[serde(rename = "type")]
    pub chat_type: String,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
pub struct CallbackQuery {
    pub id: String,
    pub from: TelegramUser,
    #[serde(default)]
    pub message: Option<TelegramMessage>,
    #[serde(default)]
    pub data: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, serde::Serialize, Deserialize)]
pub struct InlineKeyboardButton {
    pub text: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub callback_data: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
pub struct SendMessageResponse {
    pub ok: bool,
    pub result: Option<SendMessageResult>,
}

#[allow(dead_code)]
#[derive(Debug, Deserialize, Clone)]
pub struct SendMessageResult {
    pub message_id: i64,
}

#[allow(dead_code)]
#[derive(Deserialize)]
pub struct GetUpdatesResponse {
    pub ok: bool,
    pub result: Vec<TelegramUpdate>,
}

// ========================================
// POLLING STATE
// ========================================

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

    pub fn register_user(&self, chat_id: i64, unique_id: String) {
        if let Ok(mut mappings) = self.user_mappings.lock() {
            mappings.insert(chat_id, unique_id.clone());
            log::info!("Registered mapping: chat_id={} -> {}", chat_id, unique_id);
        }
    }

    pub fn get_unique_id(&self, chat_id: i64) -> Option<String> {
        self.user_mappings.lock().ok()?.get(&chat_id).cloned()
    }

    pub fn is_running(&self) -> bool {
        self.is_running.lock().map(|r| *r).unwrap_or(false)
    }

    pub fn set_running(&self, running: bool) {
        if let Ok(mut r) = self.is_running.lock() {
            *r = running;
        }
    }
}
