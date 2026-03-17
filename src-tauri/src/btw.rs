// BTW (By The Way) - One-shot side-chain chat via Anthropic Messages API
// Used for quick AI queries without spawning a full Claude Code session

use serde::{Deserialize, Serialize};

/// Map friendly model aliases to Anthropic model IDs
fn resolve_model(alias: &str) -> &str {
    match alias {
        "haiku45" => "claude-haiku-4-5-20251001",
        "sonnet46" => "claude-sonnet-4-6",
        "opus46" => "claude-opus-4-6",
        other => other, // pass through full model IDs as-is
    }
}

/// Retrieve API key: keychain first, then env var fallback
fn get_api_key() -> Result<String, String> {
    // Try keychain
    if let Ok(Some(key)) = crate::keychain::get_claude_key() {
        return Ok(key);
    }
    // Fallback to env var
    std::env::var("ANTHROPIC_API_KEY")
        .map_err(|_| "No API key found in keychain or ANTHROPIC_API_KEY env var".to_string())
}

#[derive(Serialize)]
struct MessageRequest {
    model: String,
    max_tokens: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    system: Option<String>,
    messages: Vec<Message>,
}

#[derive(Serialize)]
struct Message {
    role: String,
    content: String,
}

#[derive(Deserialize)]
struct ApiResponse {
    content: Vec<ContentBlock>,
}

#[derive(Deserialize)]
struct ContentBlock {
    #[serde(default)]
    text: Option<String>,
}

/// One-shot query to Anthropic Messages API (no streaming)
#[tauri::command]
pub async fn btw_query(
    model: String,
    prompt: String,
    system_context: Option<String>,
) -> Result<String, String> {
    let api_key = get_api_key()?;
    let resolved_model = resolve_model(&model);

    log::info!("BTW query: model={} prompt_len={}", resolved_model, prompt.len());

    let body = MessageRequest {
        model: resolved_model.to_string(),
        max_tokens: 4096,
        system: system_context,
        messages: vec![Message {
            role: "user".to_string(),
            content: prompt,
        }],
    };

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", &api_key)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {}", e))?;

    let status = response.status();
    if !status.is_success() {
        let error_text = response.text().await.unwrap_or_default();
        return Err(format!("API error ({}): {}", status, error_text));
    }

    let api_resp: ApiResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    let text = api_resp
        .content
        .iter()
        .filter_map(|block| block.text.as_deref())
        .collect::<Vec<_>>()
        .join("");

    if text.is_empty() {
        return Err("Empty response from API".to_string());
    }

    log::info!("BTW response received: {} chars", text.len());
    Ok(text)
}
