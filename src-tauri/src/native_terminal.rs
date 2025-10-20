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
pub struct TerminalApp {
    pub name: String,
    pub display_name: String,
    pub path: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
struct NativeTerminalRequest {
    name: String,
    directory: Option<String>,
    app: Option<String>,
    command: Option<String>,
}

fn resolve_app(app: Option<String>) -> String {
    app.unwrap_or_else(|| "Terminal".to_string())
}

fn get_app_bundle_path(app: &str) -> String {
    // Prima prova nei percorsi standard
    let standard_paths = match app {
        "Terminal" => vec!["/System/Applications/Utilities/Terminal.app"],
        "iTerm" | "iTerm2" => vec!["/Applications/iTerm.app", "/Applications/iTerm2.app"],
        "Warp" => vec!["/Applications/Warp.app"],
        "WezTerm" => vec!["/Applications/WezTerm.app"],
        "Hyper" => vec!["/Applications/Hyper.app"],
        "Alacritty" => vec!["/Applications/Alacritty.app"],
        "Kitty" => vec!["/Applications/kitty.app"],
        "Tabby" => vec!["/Applications/Tabby.app"],
        "Termius" => vec!["/Applications/Termius.app"],
        _ => vec!["/System/Applications/Utilities/Terminal.app"],
    };

    // Controlla i percorsi standard
    for path in &standard_paths {
        if Path::new(path).exists() {
            return path.to_string();
        }
    }

    // Controlla anche in ~/Applications
    if let Some(home_dir) = dirs::home_dir() {
        let home_apps = home_dir.join("Applications");
        for path in standard_paths {
            if let Some(app_name) = Path::new(path).file_name() {
                let home_path = home_apps.join(app_name);
                if home_path.exists() {
                    return home_path.to_string_lossy().to_string();
                }
            }
        }
    }

    // Fallback a Terminal.app
    "/System/Applications/Utilities/Terminal.app".to_string()
}

fn sanitize_app_name(app: &str) -> &str {
    match app {
        "iTerm" | "iTerm2" => "iTerm",
        other => other,
    }
}

/// Get list of installed terminal applications on the system
#[tauri::command]
pub fn get_installed_terminal_apps() -> Result<Vec<TerminalApp>, String> {
    get_installed_terminal_apps_impl().map_err(|err| err.to_string())
}

fn get_installed_terminal_apps_impl() -> Result<Vec<TerminalApp>> {
    let mut apps = Vec::new();

    // Lista di applicazioni terminali comuni da cercare
    let terminal_candidates = vec![
        ("Terminal", "Terminal.app", "/System/Applications/Utilities/Terminal.app"),
        ("iTerm", "iTerm.app", "/Applications/iTerm.app"),
        ("iTerm2", "iTerm2.app", "/Applications/iTerm2.app"),
        ("Warp", "Warp.app", "/Applications/Warp.app"),
        ("WezTerm", "WezTerm.app", "/Applications/WezTerm.app"),
        ("Hyper", "Hyper.app", "/Applications/Hyper.app"),
        ("Alacritty", "Alacritty.app", "/Applications/Alacritty.app"),
        ("Kitty", "kitty.app", "/Applications/kitty.app"),
        ("Tabby", "Tabby.app", "/Applications/Tabby.app"),
        ("Termius", "Termius.app", "/Applications/Termius.app"),
    ];

    // Controlla ogni applicazione e aggiungi quelle installate
    for (name, display_name, path) in terminal_candidates {
        if Path::new(path).exists() {
            apps.push(TerminalApp {
                name: name.to_string(),
                display_name: display_name.to_string(),
                path: path.to_string(),
            });
        }
    }

    // Cerca anche in ~/Applications
    let home_apps_dir = dirs::home_dir()
        .map(|h| h.join("Applications"))
        .filter(|p| p.exists());

    if let Some(home_apps) = home_apps_dir {
        for (name, display_name, default_path) in vec![
            ("iTerm", "iTerm.app", ""),
            ("iTerm2", "iTerm2.app", ""),
            ("Warp", "Warp.app", ""),
            ("WezTerm", "WezTerm.app", ""),
            ("Hyper", "Hyper.app", ""),
            ("Alacritty", "Alacritty.app", ""),
            ("Kitty", "kitty.app", ""),
            ("Tabby", "Tabby.app", ""),
            ("Termius", "Termius.app", ""),
        ] {
            let home_path = home_apps.join(display_name);
            if home_path.exists() && !apps.iter().any(|a| a.name == name) {
                apps.push(TerminalApp {
                    name: name.to_string(),
                    display_name: display_name.to_string(),
                    path: home_path.to_string_lossy().to_string(),
                });
            }
        }
    }

    // Se non troviamo nessuna app, almeno restituiamo Terminal.app che è sempre presente su macOS
    if apps.is_empty() {
        apps.push(TerminalApp {
            name: "Terminal".to_string(),
            display_name: "Terminal.app".to_string(),
            path: "/System/Applications/Utilities/Terminal.app".to_string(),
        });
    }

    Ok(apps)
}

#[tauri::command]
pub fn open_native_terminal(
    name: String,
    directory: Option<String>,
    app: Option<String>,
    command: Option<String>,
) -> Result<NativeTerminalResult, String> {
    let request = NativeTerminalRequest { name, directory, app, command };
    open_native_terminal_impl(request).map_err(|err| err.to_string())
}

fn open_native_terminal_impl(request: NativeTerminalRequest) -> Result<NativeTerminalResult> {
    let app = resolve_app(request.app.clone());
    let app_path = get_app_bundle_path(&app);
    if !Path::new(&app_path).exists() {
        return Err(anyhow!("Requested app '{}' not found at path: {}", app, app_path));
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
    let escaped_command = request.command.as_ref().map(|cmd| cmd.replace("'", "\\'"));

    // Build the command string to execute
    let command_str = if let Some(ref cmd) = escaped_command {
        format!("cd '{}' && clear && {}", escaped_dir, cmd)
    } else {
        format!("cd '{}' && clear && echo 'Terminal: {}'", escaped_dir, escaped_name)
    };

    let applescript = match app.as_str() {
        "iTerm" | "iTerm2" => format!(
            r#"
            tell application "iTerm"
                activate
                try
                    tell current window
                        create tab with default profile
                        tell current session to write text "{}"
                    end tell
                on error
                    create window with default profile
                    tell current window's current session to write text "{}"
                end try
            end tell
            "#,
            command_str,
            command_str,
        ),
        "Warp" => {
            // Warp doesn't support AppleScript well, so we use 'open' command with URL scheme
            // First, just open Warp and let it handle the directory
            let warp_command = format!(
                r#"
                tell application "Warp"
                    activate
                end tell
                "#
            );

            // After opening Warp, we'll use 'open' command to open a new window in the directory
            // Note: This is a workaround since Warp's AppleScript support is limited
            return Command::new("open")
                .arg("-a")
                .arg("Warp")
                .arg(&dir)
                .output()
                .map_err(|e| anyhow!("Failed to open Warp: {}", e))
                .and_then(|output| {
                    if output.status.success() {
                        Ok(NativeTerminalResult {
                            success: true,
                            message: format!("Opened Warp in directory: {}", dir),
                            pid: None,
                        })
                    } else {
                        let error_msg = String::from_utf8_lossy(&output.stderr).to_string();
                        Err(anyhow!("Failed to open Warp: {}", error_msg))
                    }
                });
        },
        "Alacritty" | "Kitty" | "WezTerm" => {
            // These terminals don't support AppleScript, use 'open' command instead
            return Command::new("open")
                .arg("-a")
                .arg(sanitize_app_name(&app))
                .arg("--args")
                .arg("--working-directory")
                .arg(&dir)
                .output()
                .map_err(|e| anyhow!("Failed to open {}: {}", app, e))
                .and_then(|output| {
                    if output.status.success() {
                        Ok(NativeTerminalResult {
                            success: true,
                            message: format!("Opened {} in directory: {}", app, dir),
                            pid: None,
                        })
                    } else {
                        // Fallback: just open the app without directory argument
                        Command::new("open")
                            .arg("-a")
                            .arg(sanitize_app_name(&app))
                            .output()
                            .map_err(|e| anyhow!("Failed to open {}: {}", app, e))
                            .and_then(|output2| {
                                if output2.status.success() {
                                    Ok(NativeTerminalResult {
                                        success: true,
                                        message: format!("Opened {} (couldn't set directory)", app),
                                        pid: None,
                                    })
                                } else {
                                    let error_msg = String::from_utf8_lossy(&output2.stderr).to_string();
                                    Err(anyhow!("Failed to open {}: {}", app, error_msg))
                                }
                            })
                    }
                });
        },
        "Terminal" => {
            let terminal_command = if escaped_command.is_some() {
                // If we have a command, execute it
                format!(
                    r#"
            tell application "Terminal"
                activate
                -- Do everything in a single do script to avoid opening multiple windows
                set newTab to do script "{}"
                -- Also set custom title property for reliable searching later
                set custom title of newTab to "Terminal: {}"
            end tell
            "#,
                    command_str,
                    escaped_name,
                )
            } else {
                // No command, use the default behavior with custom prompt
                format!(
                    r#"
            tell application "Terminal"
                activate
                -- Do everything in a single do script to avoid opening multiple windows
                set newTab to do script "cd '{}' && clear; export PS1='\\[\\033]0;Terminal: {}\\007\\]$PS1'; exec $SHELL"
                -- Also set custom title property for reliable searching later
                set custom title of newTab to "Terminal: {}"
            end tell
            "#,
                    escaped_dir,
                    escaped_name,
                    escaped_name,
                )
            };
            terminal_command
        },
        _ => format!(
            r#"
            tell application "{}"
                activate
                do script "{}"
            end tell
            "#,
            sanitize_app_name(&app),
            command_str,
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
    let app_path = get_app_bundle_path(&app);
    if !Path::new(&app_path).exists() {
        return Err(anyhow!("Requested app '{}' not found at path: {}", app, app_path));
    }

    let applescript = match app.as_str() {
        "iTerm" | "iTerm2" => format!(
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
        "Terminal" => format!(
            r#"
            tell application "Terminal"
                activate
                set targetName to "{}"
                set foundWindow to false

                -- Try to find by custom title (what we set with echo)
                repeat with w in windows
                    repeat with t in (every tab of w)
                        try
                            set tabTitle to custom title of t
                            if tabTitle contains targetName then
                                set frontmost of w to true
                                set selected tab of w to t
                                set foundWindow to true
                                exit repeat
                            end if
                        end try
                    end repeat
                    if foundWindow then exit repeat
                end repeat

                -- If not found by custom title, try window name
                if not foundWindow then
                    repeat with w in windows
                        if name of w contains targetName then
                            set frontmost of w to true
                            set foundWindow to true
                            exit repeat
                        end if
                    end repeat
                end if

                return foundWindow
            end tell
            "#,
            name.replace('"', "\\\""),
        ),
        "Warp" | "Alacritty" | "Kitty" | "WezTerm" => {
            // These apps don't support AppleScript window selection well
            // Just activate the app - it will bring all windows to front
            format!(
                r#"
                tell application "{}"
                    activate
                end tell
                return true
                "#,
                sanitize_app_name(&app),
            )
        },
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
    let app_path = get_app_bundle_path(&app);
    if !Path::new(&app_path).exists() {
        return Err(anyhow!("Requested app '{}' not found at path: {}", app, app_path));
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
