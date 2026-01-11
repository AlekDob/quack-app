use std::path::PathBuf;
use std::process::Command;

/// Opens an external URL or URI scheme (obsidian://, vscode://, https://, etc.)
/// Only allows whitelisted schemes for security
#[tauri::command]
pub fn open_external_url(url: String) -> Result<(), String> {
    // Whitelist of allowed URL schemes
    let allowed_schemes = [
        "https://",
        "http://",
        "obsidian://",
        "vscode://",
        "cursor://",
        "mailto:",
        "tel:",
    ];

    // Check if URL starts with allowed scheme
    let is_allowed = allowed_schemes.iter().any(|scheme| url.starts_with(scheme));
    if !is_allowed {
        return Err(format!("URL scheme not allowed: {}", url));
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("open")
            .arg(&url)
            .output()
            .map_err(|e| format!("Failed to execute open command: {}", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(format!("open command failed: {}", error));
        }

        Ok(())
    }

    #[cfg(target_os = "windows")]
    {
        let output = Command::new("cmd")
            .args(["/C", "start", "", &url])
            .output()
            .map_err(|e| format!("Failed to execute start command: {}", e))?;

        if !output.status.success() {
            return Err("Failed to open URL".to_string());
        }

        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        let output = Command::new("xdg-open")
            .arg(&url)
            .output()
            .map_err(|e| format!("Failed to execute xdg-open: {}", e))?;

        if !output.status.success() {
            return Err("Failed to open URL".to_string());
        }

        Ok(())
    }
}

/// Reveals a file or directory in Finder (macOS)
/// Uses the `open -R` command which highlights the item in Finder
#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    // Verifica che il path esista
    if !path_buf.exists() {
        return Err(format!("Path not found: {}", path));
    }

    #[cfg(target_os = "macos")]
    {
        // Su macOS usa `open -R` per rivelare il file nel Finder
        let output = Command::new("open")
            .arg("-R")
            .arg(&path)
            .output()
            .map_err(|e| format!("Failed to execute open command: {}", e))?;

        if !output.status.success() {
            let error = String::from_utf8_lossy(&output.stderr);
            return Err(format!("open command failed: {}", error));
        }

        Ok(())
    }

    #[cfg(not(target_os = "macos"))]
    {
        // Su altri OS (Linux/Windows) apri semplicemente la directory parent
        if let Some(parent) = path_buf.parent() {
            let output = Command::new("open")
                .arg(parent)
                .output()
                .map_err(|e| format!("Failed to open directory: {}", e))?;

            if !output.status.success() {
                return Err("Failed to open directory".to_string());
            }
            Ok(())
        } else {
            Err("Cannot determine parent directory".to_string())
        }
    }
}
