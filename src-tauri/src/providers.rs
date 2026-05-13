// Brain: 037-anthropic-compatible-providers
// Tauri command for testing connection to an Anthropic-compatible provider.
// Performs a real POST /v1/messages with max_tokens=1 to validate URL + token + model.

use serde::Serialize;
use std::time::{Duration, Instant};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestConnectionResult {
    pub ok: bool,
    pub latency_ms: u64,
    pub model_echo: Option<String>,
    pub status_code: Option<u16>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn test_provider_connection(
    base_url: String,
    auth_token: String,
    model: String,
) -> Result<TestConnectionResult, String> {
    let trimmed = base_url.trim_end_matches('/');
    let url = format!("{}/v1/messages", trimmed);

    let body = serde_json::json!({
        "model": model,
        "max_tokens": 1,
        "messages": [{ "role": "user", "content": "hi" }],
    });

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return Ok(TestConnectionResult {
                ok: false,
                latency_ms: 0,
                model_echo: None,
                status_code: None,
                error: Some(format!("client build error: {}", e)),
            });
        }
    };

    let started = Instant::now();
    let resp = client
        .post(&url)
        .header("Authorization", format!("Bearer {}", auth_token))
        .header("anthropic-version", "2023-06-01")
        .header("content-type", "application/json")
        .json(&body)
        .send()
        .await;

    let elapsed = started.elapsed().as_millis() as u64;

    match resp {
        Ok(r) => {
            let status = r.status().as_u16();
            let ok = r.status().is_success();
            let text = r.text().await.unwrap_or_default();
            if ok {
                let model_echo = serde_json::from_str::<serde_json::Value>(&text)
                    .ok()
                    .and_then(|v| v.get("model").and_then(|m| m.as_str().map(String::from)));
                Ok(TestConnectionResult {
                    ok: true,
                    latency_ms: elapsed,
                    model_echo,
                    status_code: Some(status),
                    error: None,
                })
            } else {
                Ok(TestConnectionResult {
                    ok: false,
                    latency_ms: elapsed,
                    model_echo: None,
                    status_code: Some(status),
                    error: Some(truncate_error(&text)),
                })
            }
        }
        Err(e) => Ok(TestConnectionResult {
            ok: false,
            latency_ms: elapsed,
            model_echo: None,
            status_code: None,
            error: Some(e.to_string()),
        }),
    }
}

fn truncate_error(body: &str) -> String {
    if body.len() > 500 {
        format!("{}…", &body[..500])
    } else {
        body.to_string()
    }
}

// Brain: 037-anthropic-compatible-providers
// GET /v1/models on the Anthropic-compatible endpoint.
// Handles both Anthropic shape ({data:[{id,...}]}) and OpenAI shape
// ({object:"list", data:[{id,...}]}) — both expose `data[].id`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FetchModelsResult {
    pub ok: bool,
    pub models: Vec<String>,
    pub status_code: Option<u16>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn fetch_provider_models(
    base_url: String,
    auth_token: String,
) -> Result<FetchModelsResult, String> {
    let trimmed = base_url.trim_end_matches('/');
    let url = format!("{}/v1/models", trimmed);

    let client = match reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return Ok(FetchModelsResult {
                ok: false,
                models: vec![],
                status_code: None,
                error: Some(format!("client build error: {}", e)),
            });
        }
    };

    let resp = client
        .get(&url)
        .header("Authorization", format!("Bearer {}", auth_token))
        .header("x-api-key", &auth_token)
        .header("anthropic-version", "2023-06-01")
        .send()
        .await;

    match resp {
        Ok(r) => {
            let status = r.status().as_u16();
            let ok = r.status().is_success();
            let text = r.text().await.unwrap_or_default();
            if !ok {
                return Ok(FetchModelsResult {
                    ok: false,
                    models: vec![],
                    status_code: Some(status),
                    error: Some(truncate_error(&text)),
                });
            }
            let parsed = serde_json::from_str::<serde_json::Value>(&text).ok();
            let models = parsed
                .as_ref()
                .and_then(|v| v.get("data"))
                .and_then(|d| d.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|item| {
                            item.get("id")
                                .and_then(|i| i.as_str())
                                .map(String::from)
                        })
                        .collect::<Vec<String>>()
                })
                .unwrap_or_default();
            Ok(FetchModelsResult {
                ok: true,
                models,
                status_code: Some(status),
                error: None,
            })
        }
        Err(e) => Ok(FetchModelsResult {
            ok: false,
            models: vec![],
            status_code: None,
            error: Some(e.to_string()),
        }),
    }
}
