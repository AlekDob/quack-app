use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseData {
    pub key: String,
    pub email: Option<String>,
    pub activated_at: i64,
    pub expires_at: Option<i64>,
    pub license_type: String, // "lifetime" or "subscription"
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseValidationResponse {
    pub valid: bool,
    pub license_data: Option<LicenseData>,
    pub error: Option<String>,
}

// Lemon Squeezy API configuration
const LEMON_SQUEEZY_API_URL: &str = "https://api.lemonsqueezy.com/v1";

pub struct LicenseState {
    pub api_key: Mutex<Option<String>>,
    pub store_id: Mutex<Option<String>>,
}

impl Default for LicenseState {
    fn default() -> Self {
        Self {
            api_key: Mutex::new(None),
            store_id: Mutex::new(None),
        }
    }
}

/// Configure Lemon Squeezy API credentials
#[tauri::command]
pub async fn configure_license_api(
    api_key: String,
    store_id: String,
    state: State<'_, LicenseState>,
) -> Result<(), String> {
    *state.api_key.lock().unwrap() = Some(api_key);
    *state.store_id.lock().unwrap() = Some(store_id);
    Ok(())
}

/// Validate license key with Lemon Squeezy
#[tauri::command]
pub async fn validate_license(
    license_key: String,
    state: State<'_, LicenseState>,
) -> Result<LicenseValidationResponse, String> {
    // Get API credentials
    let api_key = state.api_key.lock().unwrap().clone();

    if api_key.is_none() {
        return Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some("License API not configured".to_string()),
        });
    }

    // Lemon Squeezy License Key Activation API
    // https://docs.lemonsqueezy.com/api/license-keys#activate-a-license-key

    let client = reqwest::Client::new();
    let api_key = api_key.unwrap();

    // First, validate the license key format
    if license_key.is_empty() {
        return Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some("License key cannot be empty".to_string()),
        });
    }

    match client
        .post(format!("{}/licenses/activate", LEMON_SQUEEZY_API_URL))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "license_key": license_key,
            "instance_name": format!("Quack-{}", uuid::Uuid::new_v4())
        }))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();

            if status.is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        // Parse Lemon Squeezy activate response
                        // Response structure: { "activated": true, "license_key": {...}, "instance": {...}, "meta": {...} }
                        let activated = data["activated"].as_bool().unwrap_or(false);

                        if activated {
                            let license_key_data = &data["license_key"];
                            let meta_data = &data["meta"];

                            let license_data = LicenseData {
                                key: license_key.clone(),
                                email: meta_data["customer_email"].as_str().map(|s| s.to_string())
                                    .or_else(|| license_key_data["customer_email"].as_str().map(|s| s.to_string())),
                                activated_at: chrono::Utc::now().timestamp(),
                                expires_at: license_key_data["expires_at"]
                                    .as_str()
                                    .filter(|s| !s.is_empty() && *s != "null")
                                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                                    .map(|dt| dt.timestamp()),
                                license_type: if license_key_data["expires_at"].is_null()
                                    || license_key_data["expires_at"].as_str() == Some("null")
                                    || license_key_data["expires_at"].as_str() == Some("") {
                                    "lifetime".to_string()
                                } else {
                                    "subscription".to_string()
                                },
                                valid: true,
                            };

                            Ok(LicenseValidationResponse {
                                valid: true,
                                license_data: Some(license_data),
                                error: None,
                            })
                        } else {
                            Ok(LicenseValidationResponse {
                                valid: false,
                                license_data: None,
                                error: Some(data["error"].as_str().unwrap_or("License activation failed").to_string()),
                            })
                        }
                    }
                    Err(e) => Ok(LicenseValidationResponse {
                        valid: false,
                        license_data: None,
                        error: Some(format!("Failed to parse API response: {}", e)),
                    }),
                }
            } else {
                // Try to parse error message from response body
                let error_msg = match response.text().await {
                    Ok(body) => {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                            json["error"].as_str()
                                .or_else(|| json["message"].as_str())
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| format!("API request failed: {} - {}", status, body))
                        } else {
                            format!("API request failed: {} - {}", status, body)
                        }
                    }
                    Err(_) => format!("API request failed: {}", status)
                };

                Ok(LicenseValidationResponse {
                    valid: false,
                    license_data: None,
                    error: Some(error_msg),
                })
            }
        }
        Err(e) => Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some(format!("Network error: {}", e)),
        }),
    }
}

/// Deactivate license on this device
#[tauri::command]
pub async fn deactivate_license(
    license_key: String,
    state: State<'_, LicenseState>,
) -> Result<bool, String> {
    let api_key = state.api_key.lock().unwrap().clone();

    if api_key.is_none() {
        return Err("License API not configured".to_string());
    }

    let client = reqwest::Client::new();
    let api_key = api_key.unwrap();

    match client
        .post(format!("{}/licenses/deactivate", LEMON_SQUEEZY_API_URL))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "license_key": license_key
        }))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok(true)
            } else {
                Err(format!("Failed to deactivate license: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Network error: {}", e)),
    }
}

/// Get license information without validating
#[tauri::command]
pub async fn get_license_info(
    license_key: String,
    state: State<'_, LicenseState>,
) -> Result<Option<LicenseData>, String> {
    let api_key = state.api_key.lock().unwrap().clone();

    if api_key.is_none() {
        return Err("License API not configured".to_string());
    }

    // Similar to validate_license but just retrieves info
    // Implementation would be similar to validate_license
    // but without activation logic

    Ok(None)
}

/// Revalidate an existing license (check if still valid on Lemon Squeezy)
/// Used for periodic checks to detect refunds, chargebacks, or expiration
#[tauri::command]
pub async fn revalidate_license(
    license_key: String,
    state: State<'_, LicenseState>,
) -> Result<serde_json::Value, String> {
    let api_key = state.api_key.lock().unwrap().clone();

    if api_key.is_none() {
        return Ok(serde_json::json!({
            "valid": false,
            "error": "License API not configured"
        }));
    }

    let client = reqwest::Client::new();
    let api_key = api_key.unwrap();

    // Use the /licenses/validate endpoint (not activate)
    // https://docs.lemonsqueezy.com/api/license-keys#validate-a-license-key
    match client
        .post(format!("{}/licenses/validate", LEMON_SQUEEZY_API_URL))
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Accept", "application/json")
        .header("Content-Type", "application/json")
        .json(&serde_json::json!({
            "license_key": license_key
        }))
        .send()
        .await
    {
        Ok(response) => {
            let status = response.status();

            if status.is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        // Check if license is valid
                        let valid = data["valid"].as_bool().unwrap_or(false);

                        if valid {
                            // Check license status field
                            let license_status = data["license_key"]["status"]
                                .as_str()
                                .unwrap_or("inactive");

                            // Lemon Squeezy status values: active, inactive, expired, refunded, etc.
                            let is_active = license_status == "active";

                            if is_active {
                                Ok(serde_json::json!({
                                    "valid": true,
                                    "status": license_status
                                }))
                            } else {
                                Ok(serde_json::json!({
                                    "valid": false,
                                    "error": format!("License status: {}", license_status)
                                }))
                            }
                        } else {
                            Ok(serde_json::json!({
                                "valid": false,
                                "error": data["error"].as_str().unwrap_or("License is not valid")
                            }))
                        }
                    }
                    Err(e) => Ok(serde_json::json!({
                        "valid": false,
                        "error": format!("Failed to parse API response: {}", e)
                    })),
                }
            } else {
                let error_msg = match response.text().await {
                    Ok(body) => {
                        if let Ok(json) = serde_json::from_str::<serde_json::Value>(&body) {
                            json["error"].as_str()
                                .or_else(|| json["message"].as_str())
                                .map(|s| s.to_string())
                                .unwrap_or_else(|| format!("API request failed: {}", status))
                        } else {
                            format!("API request failed: {}", status)
                        }
                    }
                    Err(_) => format!("API request failed: {}", status)
                };

                Ok(serde_json::json!({
                    "valid": false,
                    "error": error_msg
                }))
            }
        }
        Err(e) => Ok(serde_json::json!({
            "valid": false,
            "error": format!("Network error: {}", e)
        })),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_license_validation() {
        // Add tests here
        assert!(true);
    }
}
