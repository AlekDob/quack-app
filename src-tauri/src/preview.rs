use std::sync::Mutex;
use anyhow::{anyhow, Result};
use once_cell::sync::Lazy;
use serde::Serialize;
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

static PREVIEW_WEBVIEW_LABEL: &str = "preview-webview";
static WEBVIEW_STATE: Lazy<Mutex<Option<WebviewState>>> = Lazy::new(|| Mutex::new(None));

#[allow(dead_code)]
#[derive(Clone)]
struct WebviewState {
  label: String,
  url: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebviewInfo {
  pub label: String,
  pub url: String,
  pub visible: bool,
}

#[tauri::command]
pub async fn create_preview_webview(
  app: AppHandle,
  url: String,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) -> Result<WebviewInfo, String> {
  create_preview_webview_impl(&app, url, x, y, width, height)
    .await
    .map_err(|e| e.to_string())
}

async fn create_preview_webview_impl(
  app: &AppHandle,
  url: String,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) -> Result<WebviewInfo> {
  // Close existing webview if any
  if let Some(existing) = app.get_webview_window(PREVIEW_WEBVIEW_LABEL) {
    let _ = existing.close();
  }

  // Parse URL
  let webview_url = WebviewUrl::External(url.parse()?);

  // Create webview window
  let _webview = WebviewWindowBuilder::new(app, PREVIEW_WEBVIEW_LABEL, webview_url)
    .title("🦆 Preview Inspector")
    .inner_size(width, height)
    .position(x, y)
    .resizable(true)
    .decorations(true)
    .always_on_top(false)
    .visible(true)
    .build()
    .map_err(|e| anyhow!("Failed to create webview: {}", e))?;

  // Store state
  let state = WebviewState {
    label: PREVIEW_WEBVIEW_LABEL.to_string(),
    url: url.clone(),
  };

  *WEBVIEW_STATE.lock().unwrap() = Some(state);

  Ok(WebviewInfo {
    label: PREVIEW_WEBVIEW_LABEL.to_string(),
    url,
    visible: true,
  })
}

#[tauri::command]
pub async fn update_preview_webview_position(
  app: AppHandle,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) -> Result<(), String> {
  update_preview_webview_position_impl(&app, x, y, width, height)
    .await
    .map_err(|e| e.to_string())
}

async fn update_preview_webview_position_impl(
  app: &AppHandle,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) -> Result<()> {
  if let Some(webview) = app.get_webview_window(PREVIEW_WEBVIEW_LABEL) {
    let position = tauri::PhysicalPosition::new(x as i32, y as i32);
    let size = tauri::PhysicalSize::new(width as u32, height as u32);

    webview.set_position(position)?;
    webview.set_size(size)?;
  }

  Ok(())
}

#[tauri::command]
pub async fn destroy_preview_webview(app: AppHandle) -> Result<(), String> {
  destroy_preview_webview_impl(&app)
    .await
    .map_err(|e| e.to_string())
}

async fn destroy_preview_webview_impl(app: &AppHandle) -> Result<()> {
  if let Some(webview) = app.get_webview_window(PREVIEW_WEBVIEW_LABEL) {
    webview.close()?;
  }

  *WEBVIEW_STATE.lock().unwrap() = None;

  Ok(())
}

#[tauri::command]
pub async fn show_preview_webview(app: AppHandle) -> Result<(), String> {
  show_preview_webview_impl(&app)
    .await
    .map_err(|e| e.to_string())
}

async fn show_preview_webview_impl(app: &AppHandle) -> Result<()> {
  if let Some(webview) = app.get_webview_window(PREVIEW_WEBVIEW_LABEL) {
    webview.show()?;
  }

  Ok(())
}

#[tauri::command]
pub async fn hide_preview_webview(app: AppHandle) -> Result<(), String> {
  hide_preview_webview_impl(&app)
    .await
    .map_err(|e| e.to_string())
}

async fn hide_preview_webview_impl(app: &AppHandle) -> Result<()> {
  if let Some(webview) = app.get_webview_window(PREVIEW_WEBVIEW_LABEL) {
    webview.hide()?;
  }

  Ok(())
}

#[tauri::command]
pub async fn inject_preview_script(
  app: AppHandle,
  script: String,
) -> Result<(), String> {
  inject_preview_script_impl(&app, script)
    .await
    .map_err(|e| e.to_string())
}

async fn inject_preview_script_impl(app: &AppHandle, script: String) -> Result<()> {
  if let Some(webview) = app.get_webview_window(PREVIEW_WEBVIEW_LABEL) {
    webview.eval(&script)?;

    // Setup bridge script to forward postMessage events to Tauri events
    let bridge_script = r#"
      (function() {
        // Listen for inspector events from the injected script
        window.addEventListener('message', function(event) {
          if (event.data && event.data.type && event.data.type.startsWith('quack-inspector-')) {
            // Forward to main window via Tauri IPC
            if (window.__TAURI__) {
              window.__TAURI__.event.emit('preview-inspector-event', event.data);
            }
          }
        });
        console.log('🦆 Preview IPC bridge ready');
      })();
    "#;

    webview.eval(bridge_script)?;
  }

  Ok(())
}
