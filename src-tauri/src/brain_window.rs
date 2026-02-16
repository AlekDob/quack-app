use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const BRAIN_WINDOW_LABEL: &str = "brain";

#[tauri::command]
pub async fn open_brain_window(
    app: AppHandle,
    project_path: Option<String>,
) -> Result<String, String> {
    // Reuse existing window if already open
    if let Some(existing) = app.get_webview_window(BRAIN_WINDOW_LABEL) {
        existing.set_focus().map_err(|e| format!("Failed to focus brain window: {}", e))?;
        log::info!("🧠 Brain window focused (already open)");
        return Ok(BRAIN_WINDOW_LABEL.to_string());
    }

    let url = if let Some(ref path) = project_path {
        format!("brain.html?project={}", urlencoding::encode(path))
    } else {
        "brain.html".to_string()
    };

    let webview_url = WebviewUrl::App(url.into());

    let builder = WebviewWindowBuilder::new(&app, BRAIN_WINDOW_LABEL, webview_url)
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
            log::info!("🧠 Brain window opened: {}", BRAIN_WINDOW_LABEL);
            Ok(BRAIN_WINDOW_LABEL.to_string())
        }
        Err(e) => {
            log::error!("Failed to create brain window: {}", e);
            Err(format!("Failed to create brain window: {}", e))
        }
    }
}
