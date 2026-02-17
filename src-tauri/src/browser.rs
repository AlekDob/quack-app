use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use std::time::Duration;
use reqwest;

#[tauri::command]
pub async fn emit_to_main(
    app: AppHandle,
    event: String,
    payload: serde_json::Value,
) -> Result<(), String> {
    if let Some(main_window) = app.get_webview_window("main") {
        main_window
            .emit(&event, payload)
            .map_err(|e| format!("Failed to emit to main window: {}", e))?;
        log::info!("🦆 Emitted event to main window: {}", event);
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
pub async fn open_browser_window(
    app: AppHandle,
    initial_url: Option<String>,
) -> Result<String, String> {
    let window_label = format!("browser-{}", chrono::Utc::now().timestamp_millis());
    let url = initial_url.unwrap_or_else(|| "https://quack.build".to_string());

    // Check if this is a localhost URL
    let is_localhost = url.contains("localhost") || url.contains("127.0.0.1");

    // Check if the site is reachable (both localhost and external)
    let final_url = match check_url_reachable(&url).await {
        Ok(true) => url.clone(),
        Ok(false) | Err(_) => {
            // URL is not reachable, show inline 404 page
            log::warn!("🦆 URL not reachable: {}, showing 404 page", url);
            // Use data URL with inline HTML
            create_404_page()
        }
    };

    // Create native WebView window that navigates directly to the URL
    let webview_url = WebviewUrl::External(final_url.parse().map_err(|e| format!("Invalid URL: {}", e))?);

    let builder = WebviewWindowBuilder::new(
        &app,
        &window_label,
        webview_url,
    )
    .title("Quack Browser")
    .inner_size(1200.0, 800.0)
    .min_inner_size(800.0, 600.0)
    .resizable(true)
    .fullscreen(false)
    .decorations(true);

    match builder.build() {
        Ok(_window) => {
            log::info!("🦆 Native browser window opened: {} with URL: {}", window_label, final_url);

            let app_handle = app.clone();
            let label = window_label.clone();

            // Spawn async task to inject scripts after page loads
            tauri::async_runtime::spawn(async move {
                // Wait for page to load
                tokio::time::sleep(Duration::from_millis(1500)).await;

                // If localhost (original URL), inject inspector
                if is_localhost {
                    if let Err(e) = inject_inspector(&app_handle, &label).await {
                        log::error!("Failed to inject inspector: {}", e);
                    }
                }

                // Always inject OAuth navigation interceptor
                if let Err(e) = inject_oauth_interceptor(&app_handle, &label).await {
                    log::error!("Failed to inject OAuth interceptor: {}", e);
                }
            });

            Ok(window_label)
        }
        Err(e) => {
            log::error!("Failed to create browser window: {}", e);
            Err(format!("Failed to create browser window: {}", e))
        }
    }
}

/// Create a 404 page as a data URL
fn create_404_page() -> String {
    let html = r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>404 - Page Not Found | Quack Browser</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%);
      color: #e0e0e0;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 600px;
      animation: fadeIn 0.6s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .duck-emoji {
      font-size: 8rem;
      margin-bottom: 30px;
      animation: float 3s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0px); }
      50% { transform: translateY(-10px); }
    }
    h1 {
      font-size: 3rem;
      font-weight: 700;
      color: #fbbf24;
      margin-bottom: 16px;
      text-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);
    }
    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #f3f4f6;
      margin-bottom: 12px;
    }
    p {
      font-size: 1rem;
      color: #9ca3af;
      margin-bottom: 32px;
      line-height: 1.6;
    }
    .buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }
    button {
      padding: 12px 24px;
      font-size: 1rem;
      font-weight: 600;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .btn-primary {
      background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
      color: #1a1a1a;
      box-shadow: 0 4px 12px rgba(251, 191, 36, 0.3);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 16px rgba(251, 191, 36, 0.4);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.1);
      color: #e0e0e0;
      border: 1px solid rgba(255, 255, 255, 0.2);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
    }
    .error-code {
      display: inline-block;
      background: rgba(251, 191, 36, 0.1);
      color: #fbbf24;
      padding: 4px 12px;
      border-radius: 6px;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 20px;
      border: 1px solid rgba(251, 191, 36, 0.2);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="duck-emoji">🦆</div>
    <div class="error-code">ERROR 404</div>
    <h1>Quack!</h1>
    <h2>Page Not Found</h2>
    <p>
      Oops! This duck couldn't find the page you're looking for.<br>
      The site might be down, the URL might be incorrect, or the page may have flown away.
    </p>
    <div class="buttons">
      <button class="btn-primary" onclick="window.location.reload()">
        Try Again
      </button>
      <button class="btn-secondary" onclick="window.history.length > 1 ? window.history.back() : window.close()">
        Go Back
      </button>
    </div>
  </div>
</body>
</html>"#;

    // Create data URL with base64 encoding (more reliable than URL encoding)
    use base64::Engine;
    let encoded = base64::engine::general_purpose::STANDARD.encode(html);
    format!("data:text/html;base64,{}", encoded)
}

/// Check if a URL is reachable by making a HEAD request
async fn check_url_reachable(url: &str) -> Result<bool, String> {
    log::info!("🦆 Checking if URL is reachable: {}", url);

    // Create a client with timeout
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| format!("Failed to create HTTP client: {}", e))?;

    // Try HEAD request first (faster)
    match client.head(url).send().await {
        Ok(response) => {
            let is_success = response.status().is_success() || response.status().is_redirection();
            log::info!("🦆 HEAD request result: {} - {}", response.status(), is_success);
            Ok(is_success)
        }
        Err(e) => {
            // If HEAD fails, try GET as fallback (some servers don't support HEAD)
            log::warn!("🦆 HEAD request failed: {}, trying GET", e);
            match client.get(url).send().await {
                Ok(response) => {
                    let is_success = response.status().is_success() || response.status().is_redirection();
                    log::info!("🦆 GET request result: {} - {}", response.status(), is_success);
                    Ok(is_success)
                }
                Err(e) => {
                    log::error!("🦆 GET request failed: {}", e);
                    Ok(false) // Return false instead of error to show 404 page
                }
            }
        }
    }
}

/// Inject OAuth navigation interceptor script
async fn inject_oauth_interceptor(app: &AppHandle, window_label: &str) -> Result<(), String> {
    let window = app.get_webview_window(window_label)
        .ok_or_else(|| format!("Browser window not found: {}", window_label))?;

    let oauth_script = r#"
        (function() {
            console.log('🦆 OAuth interceptor initialized');

            // Store original window.open
            const originalOpen = window.open;

            // Override window.open to intercept OAuth popups
            window.open = function(url, target, features) {
                console.log('🦆 Intercepted window.open:', url);

                // Check if this is an OAuth URL
                const oauthPatterns = [
                    'accounts.google.com',
                    'github.com/login/oauth',
                    'login.microsoftonline.com',
                    'facebook.com/dialog/oauth',
                    'appleid.apple.com/auth',
                    'oauth',
                    'auth/authorize',
                    'login/oauth'
                ];

                const isOAuth = oauthPatterns.some(pattern =>
                    url && url.includes(pattern)
                );

                if (isOAuth) {
                    console.log('🦆 OAuth URL detected, opening in Quack window');

                    // Send to Tauri backend to open OAuth window
                    window.__TAURI__.invoke('open_oauth_window', {
                        url: url,
                        parentLabel: window.__TAURI_INTERNALS__.metadata.currentWindow.label
                    }).then(oauthLabel => {
                        console.log('🦆 OAuth window opened:', oauthLabel);
                    }).catch(err => {
                        console.error('Failed to open OAuth window:', err);
                        // Fallback to original window.open
                        return originalOpen.call(window, url, target, features);
                    });

                    // Return a proxy window object to prevent errors
                    return {
                        focus: () => {},
                        close: () => {},
                        closed: false
                    };
                } else {
                    // Not OAuth, use original window.open
                    return originalOpen.call(window, url, target, features);
                }
            };

            // Intercept link clicks that might open OAuth popups
            document.addEventListener('click', function(e) {
                const target = e.target.closest('a');
                if (!target) return;

                const href = target.getAttribute('href');
                if (!href) return;

                // Check if target is _blank (new window)
                if (target.getAttribute('target') === '_blank') {
                    const oauthPatterns = [
                        'accounts.google.com',
                        'github.com/login/oauth',
                        'login.microsoftonline.com',
                        'facebook.com/dialog/oauth',
                        'appleid.apple.com/auth',
                        'oauth',
                        'auth/authorize'
                    ];

                    const isOAuth = oauthPatterns.some(pattern => href.includes(pattern));

                    if (isOAuth) {
                        e.preventDefault();
                        console.log('🦆 OAuth link intercepted:', href);

                        window.__TAURI__.invoke('open_oauth_window', {
                            url: href,
                            parentLabel: window.__TAURI_INTERNALS__.metadata.currentWindow.label
                        }).catch(err => {
                            console.error('Failed to open OAuth window:', err);
                        });
                    }
                }
            }, true);

            console.log('🦆 OAuth interceptor ready');
        })();
    "#;

    window.eval(oauth_script)
        .map_err(|e| format!("Failed to inject OAuth interceptor: {}", e))?;

    log::info!("🦆 OAuth interceptor injected into {}", window_label);
    Ok(())
}

/// Open OAuth authentication window
#[tauri::command]
pub async fn open_oauth_window(
    app: AppHandle,
    url: String,
    parent_label: String,
) -> Result<String, String> {
    let window_label = format!("oauth-{}", chrono::Utc::now().timestamp_millis());

    log::info!("🦆 Opening OAuth window: {} for parent: {}", url, parent_label);

    let webview_url = WebviewUrl::External(url.parse().map_err(|e| format!("Invalid URL: {}", e))?);

    let builder = WebviewWindowBuilder::new(&app, &window_label, webview_url)
        .title("Sign In - Quack Browser")
        .inner_size(600.0, 700.0)
        .resizable(true)
        .center()
        .decorations(true);

    match builder.build() {
        Ok(_window) => {
            log::info!("🦆 OAuth window opened: {}", window_label);

            let app_handle = app.clone();
            let label = window_label.clone();
            let parent = parent_label.clone();

            // Monitor OAuth window for callback
            tauri::async_runtime::spawn(async move {
                tokio::time::sleep(Duration::from_millis(1500)).await;

                if let Err(e) = inject_oauth_callback_monitor(&app_handle, &label, &parent).await {
                    log::error!("Failed to inject OAuth callback monitor: {}", e);
                }
            });

            Ok(window_label)
        }
        Err(e) => {
            log::error!("Failed to create OAuth window: {}", e);
            Err(format!("Failed to create OAuth window: {}", e))
        }
    }
}

/// Inject OAuth callback monitoring script
async fn inject_oauth_callback_monitor(
    app: &AppHandle,
    window_label: &str,
    parent_label: &str,
) -> Result<(), String> {
    let window = app.get_webview_window(window_label)
        .ok_or_else(|| format!("OAuth window not found: {}", window_label))?;

    let parent_label_owned = parent_label.to_string();
    let callback_script = format!(r#"
        (function() {{
            console.log('🦆 OAuth callback monitor initialized');

            // Monitor URL changes
            let lastUrl = window.location.href;

            setInterval(() => {{
                const currentUrl = window.location.href;

                if (currentUrl !== lastUrl) {{
                    console.log('🦆 OAuth URL changed:', currentUrl);
                    lastUrl = currentUrl;

                    // Check if this is a callback URL
                    const isCallback =
                        currentUrl.includes('callback') ||
                        currentUrl.includes('redirect_uri') ||
                        currentUrl.includes('code=') ||
                        currentUrl.includes('access_token=') ||
                        currentUrl.includes('id_token=');

                    if (isCallback) {{
                        console.log('🦆 OAuth callback detected!');

                        // Extract OAuth data from URL
                        const urlParams = new URLSearchParams(window.location.search);
                        const hashParams = new URLSearchParams(window.location.hash.substring(1));

                        const oauthData = {{
                            code: urlParams.get('code') || hashParams.get('code'),
                            access_token: urlParams.get('access_token') || hashParams.get('access_token'),
                            id_token: urlParams.get('id_token') || hashParams.get('id_token'),
                            state: urlParams.get('state') || hashParams.get('state'),
                            callback_url: currentUrl
                        }};

                        console.log('🦆 OAuth data extracted:', oauthData);

                        // Send callback data to parent window
                        window.__TAURI__.invoke('handle_oauth_callback', {{
                            parentLabel: '{}',
                            oauthData: oauthData
                        }}).then(() => {{
                            console.log('🦆 OAuth callback sent to parent');
                            // Close OAuth window after successful callback
                            setTimeout(() => {{
                                window.__TAURI__.window.getCurrent().close();
                            }}, 500);
                        }}).catch(err => {{
                            console.error('Failed to send OAuth callback:', err);
                        }});
                    }}
                }}
            }}, 500);

            console.log('🦆 OAuth callback monitor ready');
        }})();
    "#, parent_label_owned);

    window.eval(&callback_script)
        .map_err(|e| format!("Failed to inject OAuth callback monitor: {}", e))?;

    log::info!("🦆 OAuth callback monitor injected into {}", window_label);
    Ok(())
}

/// Handle OAuth callback from OAuth window
#[tauri::command]
pub async fn handle_oauth_callback(
    app: AppHandle,
    parent_label: String,
    oauth_data: serde_json::Value,
) -> Result<(), String> {
    log::info!("🦆 OAuth callback received for parent: {}", parent_label);
    log::info!("🦆 OAuth data: {:?}", oauth_data);

    // Get parent browser window
    if let Some(parent_window) = app.get_webview_window(&parent_label) {
        // Inject OAuth data into parent window
        let oauth_json = serde_json::to_string(&oauth_data)
            .map_err(|e| format!("Failed to serialize OAuth data: {}", e))?;

        let inject_script = format!(r#"
            (function() {{
                console.log('🦆 Received OAuth callback data');

                // Store OAuth data
                window.__QUACK_OAUTH_DATA__ = {};

                // Dispatch custom event
                const event = new CustomEvent('quack-oauth-complete', {{
                    detail: window.__QUACK_OAUTH_DATA__
                }});
                window.dispatchEvent(event);

                // Also try postMessage for compatibility
                window.postMessage({{
                    type: 'quack-oauth-complete',
                    data: window.__QUACK_OAUTH_DATA__
                }}, '*');

                console.log('🦆 OAuth data injected into parent window');
            }})();
        "#, oauth_json);

        parent_window.eval(&inject_script)
            .map_err(|e| format!("Failed to inject OAuth data into parent: {}", e))?;

        log::info!("🦆 OAuth data sent to parent window: {}", parent_label);
        Ok(())
    } else {
        Err(format!("Parent window not found: {}", parent_label))
    }
}

async fn inject_inspector(app: &AppHandle, window_label: &str) -> Result<(), String> {
    // Get the browser window
    let window = app.get_webview_window(window_label)
        .ok_or_else(|| format!("Browser window not found: {}", window_label))?;

    // Read inspector script from public folder
    let inspector_script = include_str!("../../public/inspector-script.js");

    // Inject the script
    window.eval(inspector_script)
        .map_err(|e| format!("Failed to evaluate inspector script: {}", e))?;

    log::info!("🦆 Inspector script injected successfully into {}", window_label);

    // Setup message listener bridge
    // The inspector will use window.postMessage, we need to setup a listener
    // that forwards messages to the main window
    let bridge_script = r#"
        (function() {
            // Listen for messages from inspector
            window.addEventListener('message', (event) => {
                if (event.data && event.data.type === 'quack-open-file') {
                    // Forward to Tauri backend
                    window.__TAURI__.invoke('handle_inspector_message', {
                        fileName: event.data.fileName,
                        lineNumber: event.data.lineNumber,
                        columnNumber: event.data.columnNumber
                    }).catch(err => {
                        console.error('Failed to forward inspector message:', err);
                    });
                }
            });

            console.log('🦆 Inspector bridge setup complete!');
        })();
    "#;

    window.eval(bridge_script)
        .map_err(|e| format!("Failed to setup inspector bridge: {}", e))?;

    Ok(())
}

#[tauri::command]
pub async fn handle_inspector_message(
    app: AppHandle,
    file_name: String,
    line_number: Option<u32>,
    column_number: Option<u32>,
) -> Result<(), String> {
    log::info!("🦆 Inspector message received: {} ({}:{})",
        file_name,
        line_number.unwrap_or(0),
        column_number.unwrap_or(0)
    );

    // Forward to main window
    if let Some(main_window) = app.get_webview_window("main") {
        let payload = serde_json::json!({
            "filePath": file_name,
            "line": line_number,
            "column": column_number
        });

        main_window
            .emit("open-file-from-browser", payload)
            .map_err(|e| format!("Failed to emit to main window: {}", e))?;

        log::info!("🦆 File open event sent to main window");
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[tauri::command]
pub async fn close_browser_window(
    app: AppHandle,
    window_label: String,
) -> Result<(), String> {
    if let Some(window) = app.get_webview_window(&window_label) {
        window
            .close()
            .map_err(|e| format!("Failed to close browser window: {}", e))?;
        log::info!("🦆 Browser window closed: {}", window_label);
        Ok(())
    } else {
        Err(format!("Browser window not found: {}", window_label))
    }
}
