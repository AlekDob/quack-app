use axum::{
    extract::Query,
    http::{HeaderMap, StatusCode},
    response::{Html, IntoResponse, Response},
};
use serde::Deserialize;

#[derive(Deserialize)]
pub struct ProxyParams {
    url: String,
}

/// Proxy handler that fetches external URLs and strips X-Frame-Options headers
/// This allows embedding websites in iframes that would otherwise block framing
pub async fn proxy_handler(
    Query(params): Query<ProxyParams>,
) -> Result<Response, (StatusCode, String)> {
    let url = params.url.trim();

    // Validate URL
    if url.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "URL parameter is required".to_string()));
    }

    // Ensure URL has a protocol
    let full_url = if !url.starts_with("http://") && !url.starts_with("https://") {
        format!("https://{}", url)
    } else {
        url.to_string()
    };

    log::info!("🦆 Proxy request for: {}", full_url);

    // Create HTTP client with user agent
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .redirect(reqwest::redirect::Policy::limited(10))
        .build()
        .map_err(|e| {
            log::error!("Failed to create HTTP client: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Client error: {}", e))
        })?;

    // Fetch the URL
    let response = client
        .get(&full_url)
        .send()
        .await
        .map_err(|e| {
            log::error!("Failed to fetch URL {}: {}", full_url, e);
            (StatusCode::BAD_GATEWAY, format!("Failed to fetch: {}", e))
        })?;

    // Get the status code
    let status = response.status();
    if !status.is_success() {
        log::warn!("Upstream returned non-success status: {}", status);
    }

    // Get headers from upstream
    let upstream_headers = response.headers().clone();

    // Get response body
    let body = response
        .bytes()
        .await
        .map_err(|e| {
            log::error!("Failed to read response body: {}", e);
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Body read error: {}", e))
        })?;

    // Determine content type
    let content_type = upstream_headers
        .get("content-type")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("text/html; charset=utf-8");

    // Build response headers (strip X-Frame-Options and CSP)
    let mut headers = HeaderMap::new();
    for (name, value) in upstream_headers.iter() {
        let name_lower = name.as_str().to_lowercase();

        // Skip security headers that prevent iframe embedding
        if name_lower == "x-frame-options"
            || name_lower == "content-security-policy"
            || name_lower == "content-security-policy-report-only" {
            log::debug!("🦆 Stripped header: {}", name);
            continue;
        }

        // Skip transfer-encoding (handled by axum)
        if name_lower == "transfer-encoding" {
            continue;
        }

        // Copy other headers
        if let Ok(value_clone) = value.to_str() {
            if let Ok(header_value) = value_clone.parse() {
                headers.insert(name.clone(), header_value);
            }
        }
    }

    // Ensure content-type is set
    if !headers.contains_key("content-type") {
        headers.insert("content-type", content_type.parse().unwrap());
    }

    // Add CORS headers to allow iframe access
    headers.insert(
        "access-control-allow-origin",
        "*".parse().unwrap(),
    );
    headers.insert(
        "access-control-allow-methods",
        "GET, POST, OPTIONS".parse().unwrap(),
    );

    log::info!("🦆 Proxy response for {}: {} ({} bytes)", full_url, status, body.len());

    // Return response with modified headers
    Ok((status, headers, body).into_response())
}

/// Create a simple HTML error page
#[allow(dead_code)]
fn error_page(title: &str, message: &str) -> Html<String> {
    Html(format!(
        r#"<!DOCTYPE html>
<html>
<head>
    <title>{}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }}
        .error-container {{
            text-align: center;
            padding: 2rem;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            max-width: 500px;
        }}
        h1 {{
            color: #e74c3c;
            margin-top: 0;
        }}
        p {{
            color: #555;
        }}
        .duck {{
            font-size: 4rem;
            margin-bottom: 1rem;
        }}
    </style>
</head>
<body>
    <div class="error-container">
        <div class="duck">🦆</div>
        <h1>{}</h1>
        <p>{}</p>
    </div>
</body>
</html>"#,
        title, title, message
    ))
}
