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

    // For now, implement a simple validation
    // In production, this would call Lemon Squeezy API
    // https://docs.lemonsqueezy.com/api/license-keys#validate-a-license-key

    let client = reqwest::Client::new();
    let api_key = api_key.unwrap();

    match client
        .post(format!("{}/licenses/validate", LEMON_SQUEEZY_API_URL))
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "license_key": license_key
        }))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        // Parse Lemon Squeezy response
                        let valid = data["valid"].as_bool().unwrap_or(false);

                        if valid {
                            let license_data = LicenseData {
                                key: license_key.clone(),
                                email: data["meta"]["customer_email"].as_str().map(|s| s.to_string()),
                                activated_at: chrono::Utc::now().timestamp(),
                                expires_at: data["license_key"]["expires_at"]
                                    .as_str()
                                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                                    .map(|dt| dt.timestamp()),
                                license_type: if data["license_key"]["expires_at"].is_null() {
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
                                error: Some(data["error"].as_str().unwrap_or("Invalid license key").to_string()),
                            })
                        }
                    }
                    Err(e) => Ok(LicenseValidationResponse {
                        valid: false,
                        license_data: None,
                        error: Some(format!("Failed to parse response: {}", e)),
                    }),
                }
            } else {
                Ok(LicenseValidationResponse {
                    valid: false,
                    license_data: None,
                    error: Some(format!("API request failed: {}", response.status())),
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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_license_validation() {
        // Add tests here
        assert!(true);
    }
}
