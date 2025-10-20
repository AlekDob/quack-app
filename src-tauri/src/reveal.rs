use std::path::PathBuf;
use std::process::Command;

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
