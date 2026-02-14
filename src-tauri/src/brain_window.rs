use tauri::{AppHandle, WebviewUrl, WebviewWindowBuilder};

#[tauri::command]
pub async fn open_brain_window(
    app: AppHandle,
    project_path: Option<String>,
) -> Result<String, String> {
    let window_label = format!("brain-{}", chrono::Utc::now().timestamp_millis());

    let url = if let Some(ref path) = project_path {
        format!("brain.html?project={}", urlencoding::encode(path))
    } else {
        "brain.html".to_string()
    };

    let webview_url = WebviewUrl::App(url.into());

    let builder = WebviewWindowBuilder::new(&app, &window_label, webview_url)
        .title("")
        .inner_size(1200.0, 800.0)
        .min_inner_size(900.0, 600.0)
        .resizable(true)
        .fullscreen(false)
        .decorations(true);

    #[cfg(target_os = "macos")]
    let builder = {
        use tauri::TitleBarStyle;
        builder.title_bar_style(TitleBarStyle::Overlay)
    };

    match builder.build() {
        Ok(_window) => {
            log::info!("🧠 Brain window opened: {}", window_label);
            Ok(window_label)
        }
        Err(e) => {
            log::error!("Failed to create brain window: {}", e);
            Err(format!("Failed to create brain window: {}", e))
        }
    }
}
