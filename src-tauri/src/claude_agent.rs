use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use base64::{Engine as _, engine::general_purpose};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOptions {
    #[serde(default = "default_model")]
    pub model: String,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub system_prompt: Option<String>,
    #[serde(default)]
    pub thinking_enabled: bool,
}

fn default_model() -> String {
    "claude-sonnet-4-20250514".to_string()
}

impl Default for AgentOptions {
    fn default() -> Self {
        Self {
            model: default_model(),
            temperature: None,
            max_tokens: None,
            system_prompt: None,
            thinking_enabled: false,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageAttachment {
    pub data: String, // base64 encoded
    pub media_type: String, // e.g. "image/jpeg", "image/png"
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentMessage {
    pub role: String,
    pub content: Vec<ContentPart>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ContentPart {
    #[serde(rename = "text")]
    Text { text: String },
    #[serde(rename = "image")]
    Image {
        source: ImageSource
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImageSource {
    #[serde(rename = "type")]
    pub source_type: String, // "base64"
    pub media_type: String,  // "image/jpeg", "image/png", etc
    pub data: String,        // base64 encoded image
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentResponse {
    pub result: String,
    pub thinking: Option<String>,
    pub model: String,
    pub usage: AgentUsage,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentUsage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    #[serde(default)]
    pub cache_read_input_tokens: u32,
    #[serde(default)]
    pub cache_creation_input_tokens: u32,
}

/// Convert image file bytes to base64 ContentPart
pub fn create_image_content_part(image_data: &[u8], media_type: &str) -> ContentPart {
    let base64_data = general_purpose::STANDARD.encode(image_data);

    ContentPart::Image {
        source: ImageSource {
            source_type: "base64".to_string(),
            media_type: media_type.to_string(),
            data: base64_data,
        }
    }
}

/// Send message to Claude using Anthropic API
/// This uses the existing Claude Code CLI credentials from keychain/config
#[tauri::command]
pub async fn send_message_with_agent(
    prompt: String,
    images: Option<Vec<ImageAttachment>>,
    options: Option<AgentOptions>,
) -> Result<AgentResponse, String> {
    // Get credentials from CLI (keychain or ~/.claude/.credentials.json)
    let creds = crate::claude_auth::get_claude_credentials()
        .map_err(|e| format!("Failed to read Claude credentials: {}", e))?
        .ok_or("No Claude CLI credentials found. Please run 'claude login' first.")?;

    let opts = options.unwrap_or_default();

    // Build content array with text and images
    let mut content_parts: Vec<ContentPart> = vec![
        ContentPart::Text { text: prompt }
    ];

    // Add images if provided
    if let Some(imgs) = images {
        for img in imgs {
            content_parts.push(ContentPart::Image {
                source: ImageSource {
                    source_type: "base64".to_string(),
                    media_type: img.media_type,
                    data: img.data,
                }
            });
        }
    }

    // Build the message
    let message = AgentMessage {
        role: "user".to_string(),
        content: content_parts,
    };

    // Build API request
    let mut request_body = serde_json::json!({
        "model": opts.model,
        "messages": vec![message],
        "max_tokens": opts.max_tokens.unwrap_or(4096),
    });

    // Add optional parameters
    if let Some(temp) = opts.temperature {
        request_body["temperature"] = serde_json::json!(temp);
    }

    if let Some(system) = opts.system_prompt {
        request_body["system"] = serde_json::json!(system);
    }

    // Enable thinking if requested
    if opts.thinking_enabled {
        request_body["thinking"] = serde_json::json!({
            "type": "enabled",
            "budget_tokens": 10000
        });
    }

    // Make API request using CLI credentials
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.anthropic.com/v1/messages")
        .header("x-api-key", creds.token)
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("Failed to send request: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await
            .unwrap_or_else(|_| "Unknown error".to_string());
        return Err(format!("API request failed with status {}: {}", status, error_text));
    }

    // Parse response
    let response_json: serde_json::Value = response.json().await
        .map_err(|e| format!("Failed to parse response: {}", e))?;

    // Extract text from content array
    let content = response_json["content"].as_array()
        .ok_or("Invalid response format: missing content")?;

    let mut result_text = String::new();
    let mut thinking_text: Option<String> = None;

    for item in content {
        match item["type"].as_str() {
            Some("text") => {
                if let Some(text) = item["text"].as_str() {
                    result_text.push_str(text);
                }
            },
            Some("thinking") => {
                if let Some(thinking) = item["thinking"].as_str() {
                    thinking_text = Some(thinking.to_string());
                }
            },
            _ => {}
        }
    }

    // Extract usage
    let usage = response_json["usage"].as_object()
        .ok_or("Invalid response format: missing usage")?;

    let agent_response = AgentResponse {
        result: result_text,
        thinking: thinking_text,
        model: response_json["model"].as_str()
            .unwrap_or(&opts.model)
            .to_string(),
        usage: AgentUsage {
            input_tokens: usage["input_tokens"].as_u64().unwrap_or(0) as u32,
            output_tokens: usage["output_tokens"].as_u64().unwrap_or(0) as u32,
            cache_read_input_tokens: usage.get("cache_read_input_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
            cache_creation_input_tokens: usage.get("cache_creation_input_tokens")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as u32,
        },
    };

    Ok(agent_response)
}

/// List available Claude models
#[tauri::command]
pub fn list_available_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "claude-sonnet-4-20250514".to_string(),
            name: "Claude Sonnet 4.5".to_string(),
            description: "Our fastest model with extended thinking capability".to_string(),
            supports_vision: true,
            supports_thinking: true,
        },
        ModelInfo {
            id: "claude-opus-4-20250514".to_string(),
            name: "Claude Opus 4".to_string(),
            description: "Our most intelligent model".to_string(),
            supports_vision: true,
            supports_thinking: false,
        },
        ModelInfo {
            id: "claude-3-7-sonnet-20250219".to_string(),
            name: "Claude 3.7 Sonnet".to_string(),
            description: "Previous generation Sonnet".to_string(),
            supports_vision: true,
            supports_thinking: false,
        },
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub description: String,
    pub supports_vision: bool,
    pub supports_thinking: bool,
}
