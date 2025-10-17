use std::path::Path;
use std::process::Command;
use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct NativeTerminalResult {
    pub success: bool,
    pub message: String,
    pub pid: Option<u32>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct NativeTerminalRequest {
    name: String,
    directory: Option<String>,
    app: Option<String>,
}

fn resolve_app(app: Option<String>) -> String {
    app.unwrap_or_else(|| "Terminal".to_string())
}

fn get_app_bundle_path(app: &str) -> &str {
    match app {
        "Terminal" => "/System/Applications/Utilities/Terminal.app",
        "iTerm" => "/Applications/iTerm.app",
        "Warp" => "/Applications/Warp.app",
        "WezTerm" => "/Applications/WezTerm.app",
        "Hyper" => "/Applications/Hyper.app",
        "Alacritty" => "/Applications/Alacritty.app",
        _ => "/System/Applications/Utilities/Terminal.app",
    }
}

fn sanitize_app_name(app: &str) -> &str {
    match app {
        "iTerm" => "iTerm",
        other => other,
    }
}

#[tauri::command]
pub fn open_native_terminal(
    name: String,
    directory: Option<String>,
    app: Option<String>,
) -> Result<NativeTerminalResult, String> {
    let request = NativeTerminalRequest { name, directory, app };
    open_native_terminal_impl(request).map_err(|err| err.to_string())
}

fn open_native_terminal_impl(request: NativeTerminalRequest) -> Result<NativeTerminalResult> {
    let app = resolve_app(request.app.clone());
    if !Path::new(get_app_bundle_path(&app)).exists() {
        return Err(anyhow!("Requested app '{}' not found", app));
    }

    let dir = if let Some(d) = request.directory {
        if d.trim().is_empty() {
            dirs::home_dir()
                .ok_or_else(|| anyhow!("Unable to determine home directory"))?
                .to_string_lossy()
                .to_string()
        } else {
            d
        }
    } else {
        dirs::home_dir()
            .ok_or_else(|| anyhow!("Unable to determine home directory"))?
            .to_string_lossy()
            .to_string()
    };

    let escaped_dir = dir.replace("'", "\\'");
    let escaped_name = request.name.replace("'", "\\'");

    let applescript = match app.as_str() {
        "iTerm" => format!(
            r#"
            tell application "iTerm"
                activate
                try
                    tell current window
                        create tab with default profile
                        tell current session to write text "cd '{}' && clear && echo 'Terminal: {}'"
                    end tell
                on error
                    create window with default profile
                    tell current window's current session to write text "cd '{}' && clear && echo 'Terminal: {}'"
                end try
            end tell
            "#,
            escaped_dir,
            escaped_name,
            escaped_dir,
            escaped_name,
        ),
        _ => format!(
            r#"
            tell application "{}"
                activate
                do script "cd '{}' && clear && echo 'Terminal: {}' && exec $SHELL"
            end tell
            "#,
            sanitize_app_name(&app),
            escaped_dir,
            escaped_name,
        ),
    };

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&applescript)
        .output()
        .map_err(|e| anyhow!("Failed to execute osascript: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(anyhow!("Failed to open {}: {}", app, error_msg));
    }

    Ok(NativeTerminalResult {
        success: true,
        message: format!("Opened {} in directory: {}", app, dir),
        pid: None,
    })
}

#[tauri::command]
pub fn focus_native_terminal(name: String, app: Option<String>) -> Result<NativeTerminalResult, String> {
    focus_native_terminal_impl(name, app).map_err(|err| err.to_string())
}

fn focus_native_terminal_impl(name: String, app: Option<String>) -> Result<NativeTerminalResult> {
    let app = resolve_app(app);
    if !Path::new(get_app_bundle_path(&app)).exists() {
        return Err(anyhow!("Requested app '{}' not found", app));
    }

    let applescript = match app.as_str() {
        "iTerm" => format!(
            r#"
            tell application "iTerm"
                activate
                set targetName to "{}"
                repeat with w in windows
                    repeat with t in tabs of w
                        if (name of t) contains targetName then
                            select t
                            select w
                            return true
                        end if
                    end repeat
                end repeat
                return false
            end tell
            "#,
            name.replace('"', "\\\""),
        ),
        _ => format!(
            r#"
            tell application "{}"
                activate
                set targetName to "{}"
                repeat with w in windows
                    if name of w contains targetName then
                        set index of w to 1
                        return true
                    end if
                end repeat
                return false
            end tell
            "#,
            sanitize_app_name(&app),
            name.replace('"', "\\\""),
        ),
    };

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&applescript)
        .output()
        .map_err(|e| anyhow!("Failed to execute osascript: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(anyhow!("Failed to focus {} window: {}", app, error_msg));
    }

    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let found = result == "true";

    if found {
        Ok(NativeTerminalResult {
            success: true,
            message: format!("Focused {} window: {}", app, name),
            pid: None,
        })
    } else {
        Ok(NativeTerminalResult {
            success: false,
            message: format!("{} window '{}' not found (might be closed)", app, name),
            pid: None,
        })
    }
}

#[tauri::command]
pub fn close_native_terminal(name: String, app: Option<String>) -> Result<NativeTerminalResult, String> {
    close_native_terminal_impl(name, app).map_err(|err| err.to_string())
}

fn close_native_terminal_impl(name: String, app: Option<String>) -> Result<NativeTerminalResult> {
    let app = resolve_app(app);
    if !Path::new(get_app_bundle_path(&app)).exists() {
        return Err(anyhow!("Requested app '{}' not found", app));
    }

    let applescript = match app.as_str() {
        "iTerm" => format!(
            r#"
            tell application "iTerm"
                set targetName to "{}"
                repeat with w in windows
                    repeat with t in tabs of w
                        if (name of t) contains targetName then
                            close t
                            return true
                        end if
                    end repeat
                end repeat
                return false
            end tell
            "#,
            name.replace('"', "\\\""),
        ),
        _ => format!(
            r#"
            tell application "{}"
                set targetName to "{}"
                repeat with w in windows
                    if name of w contains targetName then
                        close w
                        return true
                    end if
                end repeat
                return false
            end tell
            "#,
            sanitize_app_name(&app),
            name.replace('"', "\\\""),
        ),
    };

    let output = Command::new("osascript")
        .arg("-e")
        .arg(&applescript)
        .output()
        .map_err(|e| anyhow!("Failed to execute osascript: {}", e))?;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(anyhow!("Failed to close {} window: {}", app, error_msg));
    }

    let result = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let found = result == "true";

    Ok(NativeTerminalResult {
        success: found,
        message: if found {
            format!("Closed {} window: {}", app, name)
        } else {
            format!("{} window '{}' not found", app, name)
        },
        pid: None,
    })
}
