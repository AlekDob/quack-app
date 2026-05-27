use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const JACK_WINDOW_LABEL: &str = "jack";

#[tauri::command]
pub async fn open_jack_window(app: AppHandle) -> Result<String, String> {
    if let Some(existing) = app.get_webview_window(JACK_WINDOW_LABEL) {
        existing
            .set_focus()
            .map_err(|e| format!("Failed to focus Jack window: {}", e))?;
        log::info!("Jack window focused (already open)");
        return Ok(JACK_WINDOW_LABEL.to_string());
    }

    let webview_url = WebviewUrl::App("jack.html".into());

    let builder = WebviewWindowBuilder::new(&app, JACK_WINDOW_LABEL, webview_url)
        .title("Jack — Project Manager")
        .inner_size(1000.0, 700.0)
        .min_inner_size(800.0, 600.0)
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
            log::info!("Jack window opened: {}", JACK_WINDOW_LABEL);
            Ok(JACK_WINDOW_LABEL.to_string())
        }
        Err(e) => {
            log::error!("Failed to create Jack window: {}", e);
            Err(format!("Failed to create Jack window: {}", e))
        }
    }
}
