use serde::{Deserialize, Serialize};
use tauri::State;
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseData {
    pub key: String,
    pub email: Option<String>,
    pub device_id: String,  // NEW: Unique device identifier
    pub activated_at: i64,
    pub expires_at: Option<i64>,
    pub license_type: String, // "subscription" for Gumroad annual
    pub valid: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LicenseValidationResponse {
    pub valid: bool,
    pub license_data: Option<LicenseData>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceInfo {
    pub device_id: String,
    pub device_name: String,
    pub activated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceListResponse {
    pub devices: Vec<DeviceInfo>,
    pub count: usize,
}

// Supabase configuration
const MAX_DEVICES_PER_LICENSE: usize = 3;

pub struct LicenseState {
    pub gumroad_product_id: Mutex<Option<String>>,
    pub supabase_url: Mutex<Option<String>>,
    pub supabase_key: Mutex<Option<String>>,
}

impl Default for LicenseState {
    fn default() -> Self {
        Self {
            gumroad_product_id: Mutex::new(None),
            supabase_url: Mutex::new(None),
            supabase_key: Mutex::new(None),
        }
    }
}

// Helper function to get device name
fn get_device_name() -> String {
    hostname::get()
        .ok()
        .and_then(|name| name.into_string().ok())
        .unwrap_or_else(|| "Unknown Device".to_string())
}

// Helper function to check device count in Supabase
async fn get_device_count(
    license_key: &str,
    supabase_url: &str,
    supabase_key: &str,
) -> Result<usize, String> {
    let client = reqwest::Client::new();

    // Query Supabase for devices with this license_key
    let url = format!("{}/rest/v1/license_devices?license_key=eq.{}&select=count", supabase_url, urlencoding::encode(license_key));

    match client
        .get(&url)
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .header("Prefer", "count=exact")
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                // Parse count from Content-Range header
                if let Some(content_range) = response.headers().get("Content-Range") {
                    if let Ok(range_str) = content_range.to_str() {
                        // Format: "0-2/3" where 3 is the total count
                        if let Some(count_str) = range_str.split('/').nth(1) {
                            if let Ok(count) = count_str.parse::<usize>() {
                                return Ok(count);
                            }
                        }
                    }
                }

                // Fallback: parse body as array and count
                match response.json::<Vec<serde_json::Value>>().await {
                    Ok(devices) => Ok(devices.len()),
                    Err(_) => Ok(0),
                }
            } else {
                Err(format!("Supabase query failed: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Network error querying Supabase: {}", e)),
    }
}

// Helper function to check if device is already registered
async fn is_device_registered(
    license_key: &str,
    device_id: &str,
    supabase_url: &str,
    supabase_key: &str,
) -> Result<bool, String> {
    let client = reqwest::Client::new();

    let url = format!(
        "{}/rest/v1/license_devices?license_key=eq.{}&device_id=eq.{}&select=id",
        supabase_url,
        urlencoding::encode(license_key),
        urlencoding::encode(device_id)
    );

    match client
        .get(&url)
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Vec<serde_json::Value>>().await {
                    Ok(devices) => Ok(!devices.is_empty()),
                    Err(_) => Ok(false),
                }
            } else {
                Err(format!("Supabase query failed: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Network error: {}", e)),
    }
}

// Helper function to register device in Supabase
async fn register_device(
    license_key: &str,
    device_id: &str,
    device_name: &str,
    supabase_url: &str,
    supabase_key: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    let url = format!("{}/rest/v1/license_devices", supabase_url);

    match client
        .post(&url)
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal")
        .json(&serde_json::json!({
            "license_key": license_key,
            "device_id": device_id,
            "device_name": device_name
        }))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() || response.status() == 201 {
                Ok(())
            } else {
                let error_text = response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
                Err(format!("Failed to register device: {}", error_text))
            }
        }
        Err(e) => Err(format!("Network error: {}", e)),
    }
}

// Helper function to update device validation timestamp
async fn update_device_validation(
    license_key: &str,
    device_id: &str,
    supabase_url: &str,
    supabase_key: &str,
) -> Result<(), String> {
    let client = reqwest::Client::new();

    let url = format!(
        "{}/rest/v1/license_devices?license_key=eq.{}&device_id=eq.{}",
        supabase_url,
        urlencoding::encode(license_key),
        urlencoding::encode(device_id)
    );

    match client
        .patch(&url)
        .header("apikey", supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .header("Content-Type", "application/json")
        .header("Prefer", "return=minimal")
        .json(&serde_json::json!({
            "last_validated_at": chrono::Utc::now().to_rfc3339()
        }))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                Ok(())
            } else {
                Err(format!("Failed to update device validation: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Network error: {}", e)),
    }
}

/// Validate license key with Gumroad and register device
#[tauri::command]
pub async fn validate_license(
    license_key: String,
    device_id: String,
    state: State<'_, LicenseState>,
) -> Result<LicenseValidationResponse, String> {
    // Get API credentials
    let product_id = state.gumroad_product_id.lock().unwrap().clone();
    let supabase_url = state.supabase_url.lock().unwrap().clone();
    let supabase_key = state.supabase_key.lock().unwrap().clone();

    if product_id.is_none() {
        return Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some("Gumroad Product ID not configured".to_string()),
        });
    }

    if supabase_url.is_none() || supabase_key.is_none() {
        return Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some("Supabase not configured".to_string()),
        });
    }

    let _product_id = product_id.unwrap();
    let supabase_url = supabase_url.unwrap();
    let supabase_key = supabase_key.unwrap();

    // Validate license key format
    if license_key.is_empty() {
        return Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some("License key cannot be empty".to_string()),
        });
    }

    // Step 1: Verify license with Supabase (check valid_licenses table)
    let client = reqwest::Client::new();

    let url = format!(
        "{}/rest/v1/valid_licenses?license_key=eq.{}&select=*",
        supabase_url,
        urlencoding::encode(&license_key)
    );

    let supabase_response = match client
        .get(&url)
        .header("apikey", &supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await
    {
        Ok(response) => response,
        Err(e) => {
            return Ok(LicenseValidationResponse {
                valid: false,
                license_data: None,
                error: Some(format!("Network error: {}", e)),
            });
        }
    };

    if !supabase_response.status().is_success() {
        let error_text = supabase_response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some(format!("Supabase query error: {}", error_text)),
        });
    }

    let licenses = match supabase_response.json::<Vec<serde_json::Value>>().await {
        Ok(data) => data,
        Err(e) => {
            return Ok(LicenseValidationResponse {
                valid: false,
                license_data: None,
                error: Some(format!("Failed to parse Supabase response: {}", e)),
            });
        }
    };

    // Check if license exists in database
    if licenses.is_empty() {
        return Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some("License not found. Please check your license key or contact support.".to_string()),
        });
    }

    let license_record = &licenses[0];

    // Check if license is valid
    let is_valid = license_record["is_valid"].as_bool().unwrap_or(false);
    if !is_valid {
        return Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some("License is not valid".to_string()),
        });
    }

    // Check for refunds, chargebacks, disputes
    let refunded = license_record["is_refunded"].as_bool().unwrap_or(false);
    let chargebacked = license_record["is_chargebacked"].as_bool().unwrap_or(false);
    let disputed = license_record["is_disputed"].as_bool().unwrap_or(false);

    if refunded {
        return Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some("License has been refunded".to_string()),
        });
    }

    if chargebacked {
        return Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some("License has been charged back".to_string()),
        });
    }

    if disputed {
        return Ok(LicenseValidationResponse {
            valid: false,
            license_data: None,
            error: Some("License is disputed".to_string()),
        });
    }

    // Step 2: Check device count in Supabase
    let already_registered = is_device_registered(
        &license_key,
        &device_id,
        &supabase_url,
        &supabase_key
    ).await.unwrap_or(false);

    if !already_registered {
        // Check if we've reached the device limit
        let device_count = get_device_count(&license_key, &supabase_url, &supabase_key)
            .await
            .unwrap_or(0);

        if device_count >= MAX_DEVICES_PER_LICENSE {
            return Ok(LicenseValidationResponse {
                valid: false,
                license_data: None,
                error: Some(format!(
                    "Maximum device limit reached ({}/{}). Please deactivate a device first.",
                    device_count, MAX_DEVICES_PER_LICENSE
                )),
            });
        }

        // Register this device
        let device_name = get_device_name();
        if let Err(e) = register_device(
            &license_key,
            &device_id,
            &device_name,
            &supabase_url,
            &supabase_key
        ).await {
            return Ok(LicenseValidationResponse {
                valid: false,
                license_data: None,
                error: Some(format!("Failed to register device: {}", e)),
            });
        }
    }

    // Parse subscription info from Supabase record
    let email = license_record["email"].as_str().map(|s| s.to_string());
    let purchased_at = license_record["purchased_at"].as_str();

    // Calculate expiration for annual subscription (default to 1 year from purchase)
    let expires_at = if let Some(timestamp_str) = purchased_at {
        if let Ok(purchase_dt) = chrono::DateTime::parse_from_rfc3339(timestamp_str) {
            // Annual subscription: add 1 year from purchase date
            let expiry = purchase_dt + chrono::Duration::days(365);
            Some(expiry.timestamp())
        } else {
            None
        }
    } else {
        None
    };

    let license_data = LicenseData {
        key: license_key.clone(),
        email,
        device_id: device_id.clone(),
        activated_at: chrono::Utc::now().timestamp(),
        expires_at,
        license_type: "subscription".to_string(),
        valid: true,
    };

    Ok(LicenseValidationResponse {
        valid: true,
        license_data: Some(license_data),
        error: None,
    })
}

/// Revalidate an existing license (check if still valid on Gumroad)
/// Used on app startup to detect refunds, chargebacks, or expiration
#[tauri::command]
pub async fn revalidate_license(
    license_key: String,
    device_id: String,
    state: State<'_, LicenseState>,
) -> Result<serde_json::Value, String> {
    let product_id = state.gumroad_product_id.lock().unwrap().clone();
    let supabase_url = state.supabase_url.lock().unwrap().clone();
    let supabase_key = state.supabase_key.lock().unwrap().clone();

    if product_id.is_none() {
        return Ok(serde_json::json!({
            "valid": false,
            "error": "Gumroad Product ID not configured"
        }));
    }

    if supabase_url.is_none() || supabase_key.is_none() {
        return Ok(serde_json::json!({
            "valid": false,
            "error": "Supabase not configured"
        }));
    }

    let _product_id = product_id.unwrap();
    let supabase_url = supabase_url.unwrap();
    let supabase_key = supabase_key.unwrap();

    // Verify with Supabase (check valid_licenses table)
    let client = reqwest::Client::new();

    let url = format!(
        "{}/rest/v1/valid_licenses?license_key=eq.{}&select=*",
        supabase_url,
        urlencoding::encode(&license_key)
    );

    let supabase_response = match client
        .get(&url)
        .header("apikey", &supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await
    {
        Ok(response) => response,
        Err(e) => {
            return Ok(serde_json::json!({
                "valid": false,
                "error": format!("Network error: {}", e)
            }));
        }
    };

    if !supabase_response.status().is_success() {
        let error_text = supabase_response.text().await.unwrap_or_else(|_| "Unknown error".to_string());
        return Ok(serde_json::json!({
            "valid": false,
            "error": format!("Supabase query error: {}", error_text)
        }));
    }

    let licenses = match supabase_response.json::<Vec<serde_json::Value>>().await {
        Ok(data) => data,
        Err(e) => {
            return Ok(serde_json::json!({
                "valid": false,
                "error": format!("Failed to parse response: {}", e)
            }));
        }
    };

    // Check if license exists
    if licenses.is_empty() {
        return Ok(serde_json::json!({
            "valid": false,
            "error": "License not found"
        }));
    }

    let license_record = &licenses[0];

    // Check if license is valid
    let is_valid = license_record["is_valid"].as_bool().unwrap_or(false);
    if !is_valid {
        return Ok(serde_json::json!({
            "valid": false,
            "error": "License is not valid"
        }));
    }

    // Check for refunds, chargebacks, disputes
    if license_record["is_refunded"].as_bool().unwrap_or(false) {
        return Ok(serde_json::json!({
            "valid": false,
            "error": "License has been refunded"
        }));
    }

    if license_record["is_chargebacked"].as_bool().unwrap_or(false) {
        return Ok(serde_json::json!({
            "valid": false,
            "error": "License has been charged back"
        }));
    }

    if license_record["is_disputed"].as_bool().unwrap_or(false) {
        return Ok(serde_json::json!({
            "valid": false,
            "error": "License is disputed"
        }));
    }

    // Check if subscription has expired (1 year from purchase)
    if let Some(purchased_at_str) = license_record["purchased_at"].as_str() {
        if let Ok(purchase_dt) = chrono::DateTime::parse_from_rfc3339(purchased_at_str) {
            let expiry = purchase_dt + chrono::Duration::days(365);
            if expiry.timestamp() < chrono::Utc::now().timestamp() {
                return Ok(serde_json::json!({
                    "valid": false,
                    "error": "Subscription has expired"
                }));
            }
        }
    }

    // Update last_validated_at in Supabase
    let _ = update_device_validation(
        &license_key,
        &device_id,
        &supabase_url,
        &supabase_key
    ).await;

    Ok(serde_json::json!({
        "valid": true,
        "status": "active"
    }))
}

/// Deactivate license on this device (removes from Supabase)
#[tauri::command]
pub async fn deactivate_license(
    license_key: String,
    device_id: String,
    state: State<'_, LicenseState>,
) -> Result<bool, String> {
    let supabase_url = state.supabase_url.lock().unwrap().clone();
    let supabase_key = state.supabase_key.lock().unwrap().clone();

    if supabase_url.is_none() || supabase_key.is_none() {
        return Err("Supabase not configured".to_string());
    }

    let supabase_url = supabase_url.unwrap();
    let supabase_key = supabase_key.unwrap();

    let client = reqwest::Client::new();

    let url = format!(
        "{}/rest/v1/license_devices?license_key=eq.{}&device_id=eq.{}",
        supabase_url,
        urlencoding::encode(&license_key),
        urlencoding::encode(&device_id)
    );

    match client
        .delete(&url)
        .header("apikey", &supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() || response.status() == 204 {
                Ok(true)
            } else {
                Err(format!("Failed to deactivate device: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Network error: {}", e)),
    }
}

/// Get list of devices activated for this license
#[tauri::command]
pub async fn get_license_devices(
    license_key: String,
    state: State<'_, LicenseState>,
) -> Result<DeviceListResponse, String> {
    let supabase_url = state.supabase_url.lock().unwrap().clone();
    let supabase_key = state.supabase_key.lock().unwrap().clone();

    if supabase_url.is_none() || supabase_key.is_none() {
        return Err("Supabase not configured".to_string());
    }

    let supabase_url = supabase_url.unwrap();
    let supabase_key = supabase_key.unwrap();

    let client = reqwest::Client::new();

    let url = format!(
        "{}/rest/v1/license_devices?license_key=eq.{}&select=device_id,device_name,activated_at",
        supabase_url,
        urlencoding::encode(&license_key)
    );

    match client
        .get(&url)
        .header("apikey", &supabase_key)
        .header("Authorization", format!("Bearer {}", supabase_key))
        .send()
        .await
    {
        Ok(response) => {
            if response.status().is_success() {
                match response.json::<Vec<serde_json::Value>>().await {
                    Ok(devices_data) => {
                        let devices: Vec<DeviceInfo> = devices_data
                            .iter()
                            .map(|d| DeviceInfo {
                                device_id: d["device_id"].as_str().unwrap_or("").to_string(),
                                device_name: d["device_name"].as_str().unwrap_or("Unknown").to_string(),
                                activated_at: d["activated_at"].as_str().unwrap_or("").to_string(),
                            })
                            .collect();

                        let count = devices.len();

                        Ok(DeviceListResponse { devices, count })
                    }
                    Err(e) => Err(format!("Failed to parse devices: {}", e)),
                }
            } else {
                Err(format!("Failed to get devices: {}", response.status()))
            }
        }
        Err(e) => Err(format!("Network error: {}", e)),
    }
}

#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_license_validation() {
        // Add tests here
        assert!(true);
    }
}
