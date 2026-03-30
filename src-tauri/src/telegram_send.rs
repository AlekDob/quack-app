use std::time::Duration;

use once_cell::sync::Lazy;
use tauri::AppHandle;

use crate::preferences;
use crate::telegram_types::{InlineKeyboardButton, SendMessageResponse};

/// Shared HTTP client with 5s timeout for all Telegram API calls
static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .expect("Failed to build reqwest client")
});

/// Send a plain text message to a Telegram chat
pub async fn send_message(
    app: &AppHandle,
    chat_id: i64,
    text: &str,
) -> Result<(), String> {
    let bot_token = get_bot_token(app).await?;
    let url = format!(
        "https://api.telegram.org/bot{}/sendMessage",
        bot_token
    );

    let payload = serde_json::json!({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
    });

    let response = HTTP_CLIENT
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            log::error!("Telegram send_message HTTP error: {}", e);
            format!("Failed to send message: {}", e)
        })?;

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        log::error!("Telegram API error: {}", body);
        return Err(format!("Telegram API error: {}", body));
    }

    Ok(())
}

/// Send a message with inline keyboard buttons
pub async fn send_message_with_keyboard(
    app: &AppHandle,
    chat_id: i64,
    text: &str,
    keyboard: Vec<Vec<InlineKeyboardButton>>,
) -> Result<i64, String> {
    let bot_token = get_bot_token(app).await?;
    let url = format!(
        "https://api.telegram.org/bot{}/sendMessage",
        bot_token
    );

    let payload = serde_json::json!({
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "Markdown",
        "reply_markup": { "inline_keyboard": keyboard },
    });

    let response = HTTP_CLIENT
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            log::error!("Telegram send_with_keyboard HTTP error: {}", e);
            format!("Failed to send message: {}", e)
        })?;

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        log::error!("Telegram API error (keyboard): {}", body);
        return Err(format!("Telegram API error: {}", body));
    }

    let parsed: SendMessageResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let message_id = parsed
        .result
        .map(|r| r.message_id)
        .unwrap_or(0);

    Ok(message_id)
}

/// Answer a callback query (button press acknowledgment)
pub async fn answer_callback_query(
    app: &AppHandle,
    callback_id: &str,
    text: &str,
    show_alert: bool,
) -> Result<(), String> {
    let bot_token = get_bot_token(app).await?;
    let url = format!(
        "https://api.telegram.org/bot{}/answerCallbackQuery",
        bot_token
    );

    let payload = serde_json::json!({
        "callback_query_id": callback_id,
        "text": text,
        "show_alert": show_alert,
    });

    let response = HTTP_CLIENT
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| {
            log::error!("Telegram answer_callback HTTP error: {}", e);
            format!("Failed to answer callback: {}", e)
        })?;

    if !response.status().is_success() {
        let body = response.text().await.unwrap_or_default();
        log::error!("Telegram API error (callback): {}", body);
        return Err(format!("Telegram API error: {}", body));
    }

    Ok(())
}

/// Extract bot token from app preferences
async fn get_bot_token(app: &AppHandle) -> Result<String, String> {
    let prefs = preferences::get_preferences(app.clone())
        .await
        .map_err(|e| format!("Failed to get preferences: {}", e))?;

    prefs
        .telegram_bot_token
        .ok_or_else(|| "Telegram bot token not configured".to_string())
}
