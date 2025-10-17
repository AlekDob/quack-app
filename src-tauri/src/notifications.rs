use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_store::StoreExt;

#[derive(Debug, Serialize, Deserialize)]
struct TelegramMessage {
    chat_id: String,
    text: String,
    parse_mode: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct NtfyMessage {
    topic: String,
    message: String,
    title: String,
    priority: Option<u8>,
    tags: Option<Vec<String>>,
}

/// Send notification via Telegram Bot API
async fn send_telegram_message(
    token: &str,
    chat_id: &str,
    text: &str,
) -> Result<(), String> {
    let url = format!("https://api.telegram.org/bot{}/sendMessage", token);

    let payload = TelegramMessage {
        chat_id: chat_id.to_string(),
        text: text.to_string(),
        parse_mode: Some("Markdown".to_string()),
    };

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(&url)
        .json(&payload)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("Telegram API error: {}", error_text));
    }

    Ok(())
}

/// Send notification via ntfy.sh
async fn send_ntfy_notification(
    topic: &str,
    title: &str,
    message: &str,
) -> Result<(), String> {
    let url = format!("https://ntfy.sh/{}", topic);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(&url)
        .header("Title", title)
        .header("Priority", "default")
        .header("Tags", "duck,ai")
        .body(message.to_string())
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("ntfy.sh error: {}", error_text));
    }

    Ok(())
}

/// Tauri command: Send AI completion notification to mobile devices
#[tauri::command]
pub async fn send_ai_completion_notification(
    app: AppHandle,
    content: String,
) -> Result<String, String> {
    // Load preferences
    let store = app.store("app-preferences.json").map_err(|e| e.to_string())?;

    let prefs: Option<serde_json::Value> = store.get("preferences");

    if prefs.is_none() {
        return Ok("Preferences not found".to_string());
    }

    let prefs = prefs.unwrap();

    let telegram_enabled = prefs
        .get("enable_mobile_notifications")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);

    if !telegram_enabled {
        return Ok("Mobile notifications disabled".to_string());
    }

    let telegram_token = prefs
        .get("telegram_bot_token")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let telegram_chat_id = prefs
        .get("telegram_chat_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let ntfy_topic = prefs
        .get("ntfy_topic")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Prepare notification content
    let truncated_content = if content.len() > 100 {
        format!("{}...", &content[..97])
    } else {
        content.clone()
    };

    let title = "🦆 Quack - AI Chat Complete";
    let message = format!("Chat completed!\n\n{}", truncated_content);

    // Send notifications in parallel (best effort - don't block on failures)
    let mut results = Vec::new();

    // Telegram notification
    if let (Some(token), Some(chat_id)) = (telegram_token, telegram_chat_id) {
        let message_clone = message.clone();
        let telegram_result = tokio::spawn(async move {
            match send_telegram_message(&token, &chat_id, &message_clone).await {
                Ok(_) => {
                    log::info!("✅ Telegram notification sent successfully");
                    Ok(())
                }
                Err(e) => {
                    log::warn!("⚠️ Telegram notification failed: {}", e);
                    Err(e)
                }
            }
        });
        results.push(("Telegram", telegram_result));
    }

    // ntfy.sh notification
    if let Some(topic) = ntfy_topic {
        let title_owned = title.to_string();
        let message_clone = message.clone();
        let ntfy_result = tokio::spawn(async move {
            match send_ntfy_notification(&topic, &title_owned, &message_clone).await {
                Ok(_) => {
                    log::info!("✅ ntfy.sh notification sent successfully");
                    Ok(())
                }
                Err(e) => {
                    log::warn!("⚠️ ntfy.sh notification failed: {}", e);
                    Err(e)
                }
            }
        });
        results.push(("ntfy.sh", ntfy_result));
    }

    // Wait for all notifications to complete
    let mut success_count = 0;
    let mut failure_count = 0;

    for (service, handle) in results {
        match handle.await {
            Ok(Ok(_)) => {
                success_count += 1;
            }
            Ok(Err(_)) | Err(_) => {
                failure_count += 1;
            }
        }
    }

    if success_count > 0 {
        Ok(format!(
            "Sent {} notification(s) successfully",
            success_count
        ))
    } else if failure_count > 0 {
        Err("All notification channels failed".to_string())
    } else {
        Ok("No notification channels configured".to_string())
    }
}

/// Tauri command: Test Telegram notification
#[tauri::command]
pub async fn send_telegram_test(
    app: AppHandle,
) -> Result<String, String> {
    let store = app.store("app-preferences.json").map_err(|e| e.to_string())?;

    let prefs: Option<serde_json::Value> = store.get("preferences");

    if prefs.is_none() {
        return Err("Preferences not found".to_string());
    }

    let prefs = prefs.unwrap();

    let token = prefs
        .get("telegram_bot_token")
        .and_then(|v| v.as_str())
        .ok_or("Telegram bot token not configured")?;

    let chat_id = prefs
        .get("telegram_chat_id")
        .and_then(|v| v.as_str())
        .ok_or("Telegram chat ID not configured")?;

    let message = "🦆 Quack! Test notification from Quack\n\nIf you see this, Telegram notifications are working!";

    send_telegram_message(token, chat_id, message)
        .await
        .map_err(|e| format!("Telegram test failed: {}", e))?;

    Ok("Telegram test notification sent successfully!".to_string())
}

/// Tauri command: Test ntfy.sh notification
#[tauri::command]
pub async fn send_ntfy_test(
    app: AppHandle,
) -> Result<String, String> {
    let store = app.store("app-preferences.json").map_err(|e| e.to_string())?;

    let prefs: Option<serde_json::Value> = store.get("preferences");

    if prefs.is_none() {
        return Err("Preferences not found".to_string());
    }

    let prefs = prefs.unwrap();

    let topic = prefs
        .get("ntfy_topic")
        .and_then(|v| v.as_str())
        .ok_or("ntfy.sh topic not configured")?;

    let title = "🦆 Quack Test";
    let message = "Test notification from Quack\n\nIf you see this, ntfy.sh notifications are working!";

    send_ntfy_notification(topic, title, message)
        .await
        .map_err(|e| format!("ntfy.sh test failed: {}", e))?;

    Ok("ntfy.sh test notification sent successfully!".to_string())
}
