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

/// Reveals a file or directory in the system file manager
/// - macOS: Finder (open -R)
/// - Windows: Explorer (explorer /select,)
/// - Linux: xdg-open on parent directory
#[tauri::command]
pub fn reveal_in_finder(path: String) -> Result<(), String> {
    let path_buf = PathBuf::from(&path);

    // Strip Windows UNC prefix if present
    let clean_path = path.trim_start_matches("\\\\?\\");

    // Verify path exists
    if !path_buf.exists() {
        return Err(format!("Path not found: {}", clean_path));
    }

    #[cfg(target_os = "macos")]
    {
        let output = Command::new("open")
            .arg("-R")
            .arg(clean_path)
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
        // On Windows, use explorer.exe /select, to highlight the file
        let output = Command::new("explorer")
            .arg("/select,")
            .arg(clean_path)
            .output()
            .map_err(|e| format!("Failed to execute explorer command: {}", e))?;

        // explorer.exe returns exit code 1 even on success, so we don't check status
        let _ = output;
        Ok(())
    }

    #[cfg(target_os = "linux")]
    {
        // On Linux, open the parent directory
        if let Some(parent) = path_buf.parent() {
            let output = Command::new("xdg-open")
                .arg(parent)
                .output()
                .map_err(|e| format!("Failed to execute xdg-open: {}", e))?;

            if !output.status.success() {
                return Err("Failed to open directory".to_string());
            }
            Ok(())
        } else {
            Err("Cannot determine parent directory".to_string())
        }
    }
}
