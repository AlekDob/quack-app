// Tauri commands for testing deep link functionality
use tauri::{command, AppHandle, Emitter, Listener};
use super::deep_link::{parse_deep_link, OpenFilePayload};

#[command]
pub async fn test_deep_link(app: AppHandle, url: String) -> Result<OpenFilePayload, String> {
    log::info!("🦆 Testing deep link: {}", url);

    match parse_deep_link(&url) {
        Some(payload) => {
            // Emit event to frontend
            if let Err(e) = app.emit("deep-link-open-file", payload.clone()) {
                return Err(format!("Failed to emit event: {}", e));
            }
            Ok(payload)
        }
        None => Err("Invalid deep link format".to_string()),
    }
}

#[command]
pub async fn register_deep_link_handler(app: AppHandle) -> Result<(), String> {
    log::info!("🦆 Registering deep link handler");

    // On macOS, URL events are handled via the `open-url` event
    #[cfg(target_os = "macos")]
    {
        let app_clone = app.clone();
        app.listen("open-url", move |event| {
            let url = event.payload();
            log::info!("🦆 Received open-url event: {}", url);
            super::deep_link::handle_deep_link(app_clone.clone(), url.to_string());
        });
    }

    Ok(())
}
