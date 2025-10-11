use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};
use tiny_http::{Response, Server};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthConfig {
    pub client_id: String,
    pub redirect_uri: String,
    pub auth_url: String,
    pub token_url: String,
}

impl Default for OAuthConfig {
    fn default() -> Self {
        Self {
            client_id: "quack-app".to_string(),
            redirect_uri: "http://localhost:8765/callback".to_string(),
            auth_url: "https://claude.ai/oauth/authorize".to_string(),
            token_url: "https://claude.ai/oauth/token".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OAuthTokenResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: Option<u64>,
    pub refresh_token: Option<String>,
}

static OAUTH_STATE: Mutex<Option<String>> = Mutex::new(None);

/// Generate a random state for OAuth flow
fn generate_state() -> String {
    use rand::Rng;
    rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect()
}

/// Start OAuth flow by opening browser with authorization URL
#[tauri::command]
pub async fn start_claude_oauth(app: AppHandle) -> Result<String, String> {
    let config = OAuthConfig::default();
    let state = generate_state();

    // Store state for validation
    *OAUTH_STATE.lock().unwrap() = Some(state.clone());

    // Build authorization URL
    let auth_url = format!(
        "{}?client_id={}&redirect_uri={}&response_type=code&state={}",
        config.auth_url,
        urlencoding::encode(&config.client_id),
        urlencoding::encode(&config.redirect_uri),
        urlencoding::encode(&state)
    );

    // Start local server to receive callback
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        if let Err(e) = run_oauth_callback_server(app_clone).await {
            log::error!("OAuth callback server error: {}", e);
        }
    });

    // Open browser
    if let Err(e) = open::that(&auth_url) {
        return Err(format!("Failed to open browser: {}", e));
    }

    Ok(auth_url)
}

/// Run local HTTP server to receive OAuth callback
async fn run_oauth_callback_server(app: AppHandle) -> Result<()> {
    let server = Server::http("127.0.0.1:8765")
        .map_err(|e| anyhow::anyhow!("Failed to start OAuth callback server: {}", e))?;

    log::info!("OAuth callback server listening on http://localhost:8765");

    for request in server.incoming_requests() {
        let url = request.url();
        log::info!("Received OAuth callback: {}", url);

        // Parse query parameters
        if let Some(query) = url.split('?').nth(1) {
            let params: std::collections::HashMap<String, String> = query
                .split('&')
                .filter_map(|param| {
                    let mut parts = param.split('=');
                    Some((
                        parts.next()?.to_string(),
                        parts.next()?.to_string(),
                    ))
                })
                .collect();

            // Validate state
            if let Some(received_state) = params.get("state") {
                let stored_state = OAUTH_STATE.lock().unwrap().clone();

                if stored_state.as_ref() != Some(received_state) {
                    let response = Response::from_string("Invalid state parameter")
                        .with_status_code(400);
                    let _ = request.respond(response);
                    continue;
                }
            }

            // Check for authorization code
            if let Some(code) = params.get("code") {
                // Exchange code for token
                match exchange_code_for_token(code).await {
                    Ok(token_response) => {
                        // Send success response to browser
                        let html = r#"
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>Authentication Successful</title>
                                <style>
                                    body {
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                        display: flex;
                                        justify-content: center;
                                        align-items: center;
                                        height: 100vh;
                                        margin: 0;
                                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                                    }
                                    .container {
                                        background: white;
                                        padding: 2rem;
                                        border-radius: 1rem;
                                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                                        text-align: center;
                                    }
                                    h1 { color: #667eea; margin-bottom: 1rem; }
                                    p { color: #666; }
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <h1>✅ Authentication Successful!</h1>
                                    <p>You can close this window and return to Quack.</p>
                                </div>
                                <script>setTimeout(() => window.close(), 3000);</script>
                            </body>
                            </html>
                        "#;

                        let response = Response::from_string(html)
                            .with_header(tiny_http::Header::from_bytes(
                                &b"Content-Type"[..],
                                &b"text/html; charset=utf-8"[..],
                            ).unwrap());

                        let _ = request.respond(response);

                        // Emit event with token to frontend
                        let _ = app.emit("claude-oauth-success", token_response);

                        break; // Close server
                    }
                    Err(e) => {
                        log::error!("Failed to exchange code for token: {}", e);

                        let html = format!(r#"
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <title>Authentication Failed</title>
                                <style>
                                    body {{
                                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                        display: flex;
                                        justify-content: center;
                                        align-items: center;
                                        height: 100vh;
                                        margin: 0;
                                        background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                                    }}
                                    .container {{
                                        background: white;
                                        padding: 2rem;
                                        border-radius: 1rem;
                                        box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                                        text-align: center;
                                    }}
                                    h1 {{ color: #f5576c; margin-bottom: 1rem; }}
                                    p {{ color: #666; }}
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <h1>❌ Authentication Failed</h1>
                                    <p>{}</p>
                                    <p>Please try again or contact support.</p>
                                </div>
                            </body>
                            </html>
                        "#, e);

                        let response = Response::from_string(html)
                            .with_header(tiny_http::Header::from_bytes(
                                &b"Content-Type"[..],
                                &b"text/html; charset=utf-8"[..],
                            ).unwrap());

                        let _ = request.respond(response);

                        // Emit error event
                        let _ = app.emit("claude-oauth-error", e.to_string());

                        break;
                    }
                }
            } else if let Some(error) = params.get("error") {
                // OAuth error
                let error_desc = params.get("error_description")
                    .map(|s| s.as_str())
                    .unwrap_or("Unknown error");

                let html = format!(r#"
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Authentication Error</title>
                        <style>
                            body {{
                                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                                display: flex;
                                justify-content: center;
                                align-items: center;
                                height: 100vh;
                                margin: 0;
                                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                            }}
                            .container {{
                                background: white;
                                padding: 2rem;
                                border-radius: 1rem;
                                box-shadow: 0 10px 40px rgba(0,0,0,0.2);
                                text-align: center;
                            }}
                            h1 {{ color: #f5576c; margin-bottom: 1rem; }}
                            p {{ color: #666; }}
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <h1>❌ Authentication Error</h1>
                            <p><strong>{}</strong></p>
                            <p>{}</p>
                        </div>
                    </body>
                    </html>
                "#, error, error_desc);

                let response = Response::from_string(html)
                    .with_header(tiny_http::Header::from_bytes(
                        &b"Content-Type"[..],
                        &b"text/html; charset=utf-8"[..],
                    ).unwrap());

                let _ = request.respond(response);

                // Emit error event
                let _ = app.emit("claude-oauth-error", format!("{}: {}", error, error_desc));

                break;
            }
        }
    }

    Ok(())
}

/// Exchange authorization code for access token
async fn exchange_code_for_token(code: &str) -> Result<OAuthTokenResponse> {
    let config = OAuthConfig::default();

    let client = reqwest::Client::new();
    let response = client
        .post(&config.token_url)
        .form(&[
            ("grant_type", "authorization_code"),
            ("code", code),
            ("redirect_uri", &config.redirect_uri),
            ("client_id", &config.client_id),
        ])
        .send()
        .await
        .context("Failed to send token request")?;

    if !response.status().is_success() {
        let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Err(anyhow::anyhow!("Token exchange failed: {}", error_text));
    }

    let token_response: OAuthTokenResponse = response
        .json()
        .await
        .context("Failed to parse token response")?;

    Ok(token_response)
}
