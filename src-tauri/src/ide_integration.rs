//! IDE Integration Module
//!
//! Provides Tauri commands for detecting and interacting with external IDEs.
//! Supports: VS Code, Cursor, Windsurf, Zed, JetBrains IDEs, Sublime Text, Xcode, Android Studio
//! Also supports: Terminal apps (Terminal, Warp, Ghostty, iTerm) and Finder

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;
use std::process::Command;
use base64::{Engine as _, engine::general_purpose::STANDARD as BASE64};
use tokio_tungstenite::tungstenite::protocol::Message;
use futures_util::{SinkExt, StreamExt};

// Windows-specific helper to hide console windows
#[cfg(target_os = "windows")]
fn hide_console_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

/// Information about a detected IDE
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IDEInfo {
    pub id: String,
    pub name: String,
    pub app_path: String,
    pub cli: String,
    pub cli_available: bool,
    pub app_exists: bool,
    pub supports_diff: bool,
}

/// Information about an installed app (IDE, Terminal, or Finder)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstalledApp {
    pub id: String,
    pub name: String,
    pub app_path: String,
    pub category: String, // "ide", "terminal", "finder"
    pub icon_base64: Option<String>, // Base64 encoded PNG icon
}

/// IDE Registry entry
struct IDEEntry {
    id: &'static str,
    name: &'static str,
    bundle_id: &'static str,
    cli: &'static str,
    /// macOS: /Applications/App.app, Windows: use app_path_windows()
    app_path: &'static str,
    /// Windows-specific: path in LocalAppData (e.g., %LOCALAPPDATA%\Programs\...)
    app_path_local: Option<&'static str>,
    /// Windows-specific: path in Program Files
    app_path_program: Option<&'static str>,
    cli_style: &'static str,
    supports_diff: bool,
}

impl IDEEntry {
    /// Get the app path for the current platform
    #[cfg(target_os = "macos")]
    fn get_app_path(&self) -> &str {
        self.app_path
    }

    #[cfg(target_os = "windows")]
    fn get_app_path(&self) -> Option<String> {
        // Try LocalAppData first
        if let Some(local_path) = self.app_path_local {
            if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
                let full_path = format!("{}\\{}", local_app_data, local_path);
                if std::path::Path::new(&full_path).exists() {
                    return Some(full_path);
                }
            }
        }
        // Try Program Files
        if let Some(program_path) = self.app_path_program {
            // Check if path contains wildcard
            if program_path.contains('*') {
                // Handle glob pattern for JetBrains IDEs
                if let Some(found) = Self::find_jetbrains_path(program_path) {
                    return Some(found);
                }
            } else {
                if let Ok(program_files) = std::env::var("ProgramFiles") {
                    let full_path = format!("{}\\{}", program_files, program_path);
                    if std::path::Path::new(&full_path).exists() {
                        return Some(full_path);
                    }
                }
                // Also try Program Files (x86)
                if let Ok(program_files_x86) = std::env::var("ProgramFiles(x86)") {
                    let full_path = format!("{}\\{}", program_files_x86, program_path);
                    if std::path::Path::new(&full_path).exists() {
                        return Some(full_path);
                    }
                }
            }
        }
        None
    }

    #[cfg(target_os = "windows")]
    fn find_jetbrains_path(pattern: &str) -> Option<String> {
        // Pattern like "JetBrains\\IntelliJ IDEA*\\bin\\idea64.exe"
        // Split by wildcard to get prefix and suffix
        let parts: Vec<&str> = pattern.split('*').collect();
        if parts.len() != 2 {
            return None;
        }

        let prefix = parts[0]; // "JetBrains\\IntelliJ IDEA"
        let suffix = parts[1]; // "\\bin\\idea64.exe"

        // Try both Program Files locations
        let program_dirs = [
            std::env::var("ProgramFiles").ok(),
            std::env::var("ProgramFiles(x86)").ok(),
        ];

        for program_dir in program_dirs.into_iter().flatten() {
            let jetbrains_dir = format!("{}\\JetBrains", program_dir);
            if let Ok(entries) = std::fs::read_dir(&jetbrains_dir) {
                // Get the IDE folder name prefix (e.g., "IntelliJ IDEA")
                let ide_prefix = prefix.trim_start_matches("JetBrains\\");

                // Find matching directories, sort by name descending to get latest version
                let mut matching_dirs: Vec<_> = entries
                    .filter_map(|e| e.ok())
                    .filter(|e| {
                        e.file_name()
                            .to_string_lossy()
                            .starts_with(ide_prefix)
                    })
                    .collect();

                // Sort descending to get latest version first
                matching_dirs.sort_by(|a, b| b.file_name().cmp(&a.file_name()));

                for dir in matching_dirs {
                    let exe_path = format!("{}{}", dir.path().display(), suffix);
                    if std::path::Path::new(&exe_path).exists() {
                        return Some(exe_path);
                    }
                }
            }
        }
        None
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    fn get_app_path(&self) -> Option<String> {
        None
    }
}

/// All supported IDEs
const IDE_REGISTRY: &[IDEEntry] = &[
    // VS Code Family
    IDEEntry {
        id: "vscode",
        name: "VS Code",
        bundle_id: "com.microsoft.VSCode",
        cli: "code",
        app_path: "/Applications/Visual Studio Code.app",
        app_path_local: Some("Programs\\Microsoft VS Code\\Code.exe"),
        app_path_program: Some("Microsoft VS Code\\Code.exe"),
        cli_style: "vscode",
        supports_diff: true,
    },
    IDEEntry {
        id: "cursor",
        name: "Cursor",
        bundle_id: "com.todesktop.230313mzl4w4u92",
        cli: "cursor",
        app_path: "/Applications/Cursor.app",
        app_path_local: Some("Programs\\cursor\\Cursor.exe"),
        app_path_program: None,
        cli_style: "vscode",
        supports_diff: true,
    },
    IDEEntry {
        id: "windsurf",
        name: "Windsurf",
        bundle_id: "com.codeium.windsurf",
        cli: "windsurf",
        app_path: "/Applications/Windsurf.app",
        app_path_local: Some("Programs\\Windsurf\\Windsurf.exe"),
        app_path_program: None,
        cli_style: "vscode",
        supports_diff: false,
    },
    // Zed
    IDEEntry {
        id: "zed",
        name: "Zed",
        bundle_id: "dev.zed.Zed",
        cli: "zed",
        app_path: "/Applications/Zed.app",
        app_path_local: Some("Programs\\Zed\\Zed.exe"),
        app_path_program: None,
        cli_style: "zed",
        supports_diff: false,
    },
    // JetBrains Family
    IDEEntry {
        id: "intellij",
        name: "IntelliJ IDEA",
        bundle_id: "com.jetbrains.intellij",
        cli: "idea",
        app_path: "/Applications/IntelliJ IDEA.app",
        app_path_local: None,
        app_path_program: Some("JetBrains\\IntelliJ IDEA*\\bin\\idea64.exe"),
        cli_style: "jetbrains",
        supports_diff: true,
    },
    IDEEntry {
        id: "webstorm",
        name: "WebStorm",
        bundle_id: "com.jetbrains.WebStorm",
        cli: "webstorm",
        app_path: "/Applications/WebStorm.app",
        app_path_local: None,
        app_path_program: Some("JetBrains\\WebStorm*\\bin\\webstorm64.exe"),
        cli_style: "jetbrains",
        supports_diff: true,
    },
    IDEEntry {
        id: "pycharm",
        name: "PyCharm",
        bundle_id: "com.jetbrains.pycharm",
        cli: "pycharm",
        app_path: "/Applications/PyCharm.app",
        app_path_local: None,
        app_path_program: Some("JetBrains\\PyCharm*\\bin\\pycharm64.exe"),
        cli_style: "jetbrains",
        supports_diff: true,
    },
    IDEEntry {
        id: "goland",
        name: "GoLand",
        bundle_id: "com.jetbrains.goland",
        cli: "goland",
        app_path: "/Applications/GoLand.app",
        app_path_local: None,
        app_path_program: Some("JetBrains\\GoLand*\\bin\\goland64.exe"),
        cli_style: "jetbrains",
        supports_diff: true,
    },
    IDEEntry {
        id: "rubymine",
        name: "RubyMine",
        bundle_id: "com.jetbrains.rubymine",
        cli: "rubymine",
        app_path: "/Applications/RubyMine.app",
        app_path_local: None,
        app_path_program: Some("JetBrains\\RubyMine*\\bin\\rubymine64.exe"),
        cli_style: "jetbrains",
        supports_diff: true,
    },
    IDEEntry {
        id: "phpstorm",
        name: "PhpStorm",
        bundle_id: "com.jetbrains.PhpStorm",
        cli: "phpstorm",
        app_path: "/Applications/PhpStorm.app",
        app_path_local: None,
        app_path_program: Some("JetBrains\\PhpStorm*\\bin\\phpstorm64.exe"),
        cli_style: "jetbrains",
        supports_diff: true,
    },
    // Sublime
    IDEEntry {
        id: "sublime",
        name: "Sublime Text",
        bundle_id: "com.sublimetext.4",
        cli: "subl",
        app_path: "/Applications/Sublime Text.app",
        app_path_local: None,
        app_path_program: Some("Sublime Text\\sublime_text.exe"),
        cli_style: "sublime",
        supports_diff: false,
    },
    // Xcode (macOS only)
    IDEEntry {
        id: "xcode",
        name: "Xcode",
        bundle_id: "com.apple.dt.Xcode",
        cli: "xed",
        app_path: "/Applications/Xcode.app",
        app_path_local: None,
        app_path_program: None, // Not available on Windows
        cli_style: "xcode",
        supports_diff: false,
    },
    // Android Studio
    IDEEntry {
        id: "android-studio",
        name: "Android Studio",
        bundle_id: "com.google.android.studio",
        cli: "studio",
        app_path: "/Applications/Android Studio.app",
        app_path_local: None,
        app_path_program: Some("Android\\Android Studio\\bin\\studio64.exe"),
        cli_style: "jetbrains",
        supports_diff: false,
    },
    // Antigravity (Vue/Nuxt IDE)
    IDEEntry {
        id: "antigravity",
        name: "Antigravity",
        bundle_id: "dev.niceprogrammer.Antigravity",
        cli: "antigravity",
        app_path: "/Applications/Antigravity.app",
        app_path_local: Some("Programs\\Antigravity\\Antigravity.exe"),
        app_path_program: None,
        cli_style: "vscode",
        supports_diff: false,
    },
    // Notepad++ (Windows only)
    IDEEntry {
        id: "notepadpp",
        name: "Notepad++",
        bundle_id: "",
        cli: "notepad++",
        app_path: "", // Not available on macOS
        app_path_local: None,
        app_path_program: Some("Notepad++\\notepad++.exe"),
        cli_style: "notepadpp",
        supports_diff: false,
    },
];

/// App entry for terminals and Finder
struct AppEntry {
    id: &'static str,
    name: &'static str,
    app_path: &'static str,
    category: &'static str,
}

/// Terminals and Finder registry
const APP_REGISTRY: &[AppEntry] = &[
    // Finder (always available on macOS)
    AppEntry {
        id: "finder",
        name: "Finder",
        app_path: "/System/Library/CoreServices/Finder.app",
        category: "finder",
    },
    // Built-in Terminal
    AppEntry {
        id: "terminal",
        name: "Terminal",
        app_path: "/System/Applications/Utilities/Terminal.app",
        category: "terminal",
    },
    // Third-party terminals
    AppEntry {
        id: "ghostty",
        name: "Ghostty",
        app_path: "/Applications/Ghostty.app",
        category: "terminal",
    },
    AppEntry {
        id: "warp",
        name: "Warp",
        app_path: "/Applications/Warp.app",
        category: "terminal",
    },
    AppEntry {
        id: "iterm",
        name: "iTerm",
        app_path: "/Applications/iTerm.app",
        category: "terminal",
    },
];

/// Check if a CLI command is available in PATH
fn is_cli_available(cli: &str) -> bool {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("where");
        cmd.arg(cli);
        hide_console_window(&mut cmd);
        cmd.output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
    #[cfg(not(target_os = "windows"))]
    {
        Command::new("which")
            .arg(cli)
            .output()
            .map(|output| output.status.success())
            .unwrap_or(false)
    }
}

/// Spawn a CLI command - on Windows uses cmd.exe /c to properly handle .cmd files
#[cfg(target_os = "windows")]
fn spawn_cli_command(cli: &str, args: &[String]) -> std::io::Result<std::process::Child> {
    // Build the full command string for cmd.exe
    let mut cmd_args = vec!["/c".to_string(), cli.to_string()];
    cmd_args.extend(args.iter().cloned());

    log::info!("[IDE] Windows: Executing via cmd.exe: {:?}", cmd_args);

    let mut cmd = Command::new("cmd");
    cmd.args(&cmd_args);
    hide_console_window(&mut cmd);
    cmd.spawn()
}

/// Spawn a CLI command - on non-Windows just run directly
#[cfg(not(target_os = "windows"))]
fn spawn_cli_command(cli: &str, args: &[String]) -> std::io::Result<std::process::Child> {
    Command::new(cli)
        .args(args)
        .spawn()
}

/// Detect all installed IDEs on the system
#[tauri::command]
pub fn detect_installed_ides() -> Vec<IDEInfo> {
    let mut installed = Vec::new();

    for entry in IDE_REGISTRY {
        #[cfg(target_os = "macos")]
        let (app_exists, resolved_path) = {
            let exists = Path::new(entry.app_path).exists();
            (exists, entry.app_path.to_string())
        };

        #[cfg(target_os = "windows")]
        let (app_exists, resolved_path) = {
            if let Some(path) = entry.get_app_path() {
                (true, path)
            } else {
                (false, String::new())
            }
        };

        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        let (app_exists, resolved_path) = (false, String::new());

        let cli_available = is_cli_available(entry.cli);

        if app_exists || cli_available {
            installed.push(IDEInfo {
                id: entry.id.to_string(),
                name: entry.name.to_string(),
                app_path: resolved_path,
                cli: entry.cli.to_string(),
                cli_available,
                app_exists,
                supports_diff: entry.supports_diff,
            });
        }
    }

    installed
}

/// IDE config structure for persistence
#[derive(Debug, Clone, Serialize, Deserialize)]
struct IDEConfig {
    #[serde(rename = "preferredIDE")]
    preferred_ide: String,
    #[serde(rename = "autoLaunch")]
    auto_launch: bool,
    #[serde(rename = "syncFocus")]
    sync_focus: bool,
}

/// Get the path to ide-config.json in the app support directory
fn get_ide_config_path() -> Result<std::path::PathBuf, String> {
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME not set")?;
        Ok(std::path::PathBuf::from(format!(
            "{}/Library/Application Support/com.quack.terminal/ide-config.json",
            home
        )))
    }

    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var("APPDATA").map_err(|_| "APPDATA not set")?;
        Ok(std::path::PathBuf::from(format!(
            "{}/com.quack.terminal/ide-config.json",
            appdata
        )))
    }

    #[cfg(target_os = "linux")]
    {
        let home = std::env::var("HOME").map_err(|_| "HOME not set")?;
        Ok(std::path::PathBuf::from(format!(
            "{}/.local/share/com.quack.terminal/ide-config.json",
            home
        )))
    }
}

/// Load current IDE config from file
fn load_ide_config() -> IDEConfig {
    if let Ok(path) = get_ide_config_path() {
        if let Ok(content) = fs::read_to_string(&path) {
            if let Ok(config) = serde_json::from_str::<IDEConfig>(&content) {
                return config;
            }
        }
    }
    // Default config
    IDEConfig {
        preferred_ide: String::new(),
        auto_launch: false,
        sync_focus: true,
    }
}

/// Save IDE config to file
fn save_ide_config(config: &IDEConfig) -> Result<(), String> {
    let path = get_ide_config_path()?;

    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| format!("Failed to create dir: {}", e))?;
    }

    let json = serde_json::to_string_pretty(config)
        .map_err(|e| format!("Failed to serialize config: {}", e))?;

    fs::write(&path, json).map_err(|e| format!("Failed to write config: {}", e))?;

    log::info!("[IDE] Saved config to {:?}: preferredIDE={}", path, config.preferred_ide);
    Ok(())
}

/// Set the preferred IDE (saves to config file for MCP server sync)
#[tauri::command]
pub fn set_preferred_ide(ide_id: String) -> Result<(), String> {
    // Validate the IDE exists
    let valid = IDE_REGISTRY.iter().any(|e| e.id == ide_id);

    if !valid {
        return Err(format!("Unknown IDE: {}", ide_id));
    }

    // Load current config and update preferredIDE
    let mut config = load_ide_config();
    config.preferred_ide = ide_id.clone();

    // Save to file (MCP server reads this)
    save_ide_config(&config)?;

    log::info!("[IDE] Set preferred IDE to: {}", ide_id);
    Ok(())
}

/// Execute an IDE CLI command
#[tauri::command]
pub fn execute_ide_command(cli: String, args: Vec<String>) -> Result<String, String> {
    log::info!("[IDE] Executing: {} {:?}", cli, args);

    let result = Command::new(&cli)
        .args(&args)
        .spawn();

    match result {
        Ok(_) => Ok(format!("Launched {} with args: {:?}", cli, args)),
        Err(e) => Err(format!("Failed to execute {}: {}", cli, e)),
    }
}

/// Open a folder in the configured IDE using `open -a` (macOS)
/// This is more reliable than using CLI commands which may not be in PATH
#[tauri::command]
pub fn open_folder_in_ide(ide_id: String, folder_path: String) -> Result<String, String> {
    // Normalize the path (remove \\?\ prefix on Windows)
    let folder_path = normalize_path(&folder_path);
    log::info!("[IDE] Opening folder {} in IDE {}", folder_path, ide_id);

    // Find IDE entry
    let ide = IDE_REGISTRY.iter().find(|e| e.id == ide_id);

    let ide = match ide {
        Some(i) => i,
        None => return Err(format!("Unknown IDE: {}", ide_id)),
    };

    // Verify folder exists
    if !Path::new(&folder_path).exists() {
        return Err(format!("Folder not found: {}", folder_path));
    }

    #[cfg(target_os = "macos")]
    {
        // Use `open -a "App Name" folder_path` which is more reliable than CLI
        let result = Command::new("open")
            .arg("-a")
            .arg(ide.name)
            .arg(&folder_path)
            .spawn();

        match result {
            Ok(_) => Ok(format!("Opened {} in {}", folder_path, ide.name)),
            Err(e) => Err(format!("Failed to open in {}: {}", ide.name, e)),
        }
    }

    #[cfg(target_os = "windows")]
    {
        // Try CLI first
        let cli_available = is_cli_available(ide.cli);
        if cli_available {
            let result = spawn_cli_command(ide.cli, &[folder_path.clone()]);

            match result {
                Ok(_) => return Ok(format!("Opened {} in {}", folder_path, ide.name)),
                Err(e) => log::warn!("[IDE] CLI failed: {}, trying exe path", e),
            }
        }

        // Fallback to exe path
        if let Some(app_path) = ide.get_app_path() {
            log::info!("[IDE] Using exe path: {}", app_path);
            let result = Command::new(&app_path)
                .arg(&folder_path)
                .spawn();

            return match result {
                Ok(_) => Ok(format!("Opened {} in {}", folder_path, ide.name)),
                Err(e) => Err(format!("Failed to open in {}: {}", ide.name, e)),
            };
        }

        Err(format!("{} not found on this system", ide.name))
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        // Fallback to CLI command
        let result = spawn_cli_command(ide.cli, &[folder_path.clone()]);

        match result {
            Ok(_) => Ok(format!("Opened {} in {}", folder_path, ide.name)),
            Err(e) => Err(format!("Failed to open in {}: {}", ide.name, e)),
        }
    }
}

/// Focus an IDE window (macOS only)
#[tauri::command]
pub fn focus_ide(ide_name: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let script = format!(r#"tell application "{}" to activate"#, ide_name);

        let result = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output();

        match result {
            Ok(output) => {
                if output.status.success() {
                    Ok(format!("{} brought to foreground", ide_name))
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to focus {}: {}", ide_name, stderr))
                }
            }
            Err(e) => Err(format!("Failed to run AppleScript: {}", e)),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Window management only supported on macOS".to_string())
    }
}

/// Arrange Quack and IDE windows side-by-side (macOS only)
#[tauri::command]
pub fn arrange_windows_side_by_side(ide_name: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            r#"
            tell application "Finder"
                set screenSize to bounds of window of desktop
                set screenWidth to item 3 of screenSize
                set screenHeight to item 4 of screenSize
            end tell

            tell application "System Events"
                -- Position Quack on left half
                tell process "Quack"
                    try
                        set position of window 1 to {{0, 25}}
                        set size of window 1 to {{screenWidth / 2, screenHeight - 25}}
                    end try
                end tell

                -- Position IDE on right half
                tell process "{}"
                    try
                        set position of window 1 to {{screenWidth / 2, 25}}
                        set size of window 1 to {{screenWidth / 2, screenHeight - 25}}
                    end try
                end tell
            end tell

            tell application "Quack" to activate
            "#,
            ide_name
        );

        let result = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output();

        match result {
            Ok(output) => {
                if output.status.success() {
                    Ok(format!("Windows arranged: Quack (left) | {} (right)", ide_name))
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to arrange windows: {}", stderr))
                }
            }
            Err(e) => Err(format!("Failed to run AppleScript: {}", e)),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Window arrangement only supported on macOS".to_string())
    }
}

/// Sync focus between Quack and IDE (bring both to foreground)
#[tauri::command]
pub fn sync_focus_both_apps(ide_name: String) -> Result<String, String> {
    #[cfg(target_os = "macos")]
    {
        let script = format!(
            r#"
            tell application "{}" to activate
            delay 0.1
            tell application "Quack" to activate
            "#,
            ide_name
        );

        let result = Command::new("osascript")
            .arg("-e")
            .arg(&script)
            .output();

        match result {
            Ok(output) => {
                if output.status.success() {
                    Ok(format!("Both Quack and {} brought to foreground", ide_name))
                } else {
                    let stderr = String::from_utf8_lossy(&output.stderr);
                    Err(format!("Failed to sync focus: {}", stderr))
                }
            }
            Err(e) => Err(format!("Failed to run AppleScript: {}", e)),
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err("Focus sync only supported on macOS".to_string())
    }
}

/// Find the project root from a file path
/// Looks for common project markers (.git, package.json, Cargo.toml, etc.)
fn find_project_root(file_path: &str) -> Option<String> {
    let path = Path::new(file_path);
    let mut current = path.parent();

    let project_markers = [
        ".git",
        "package.json",
        "Cargo.toml",
        "go.mod",
        "pom.xml",
        "build.gradle",
        "CMakeLists.txt",
        ".project",
        "Makefile",
        "pyproject.toml",
        "setup.py",
        ".obsidian", // For Obsidian vaults
    ];

    while let Some(dir) = current {
        for marker in &project_markers {
            if dir.join(marker).exists() {
                return Some(dir.to_string_lossy().to_string());
            }
        }
        current = dir.parent();
    }

    // If no project marker found, use the parent directory of the file
    path.parent().map(|p| p.to_string_lossy().to_string())
}

/// Open a file in the specified IDE with optional line number
/// Also opens the project folder so the file explorer is available
#[tauri::command]
pub fn open_file_in_ide(
    ide_id: String,
    file_path: String,
    line: Option<u32>,
    column: Option<u32>,
) -> Result<String, String> {
    // Normalize the path (remove \\?\ prefix on Windows)
    let file_path = normalize_path(&file_path);
    log::info!(
        "[IDE] open_file_in_ide called: ide_id={}, file_path={}, line={:?}, column={:?}",
        ide_id, file_path, line, column
    );

    let entry = IDE_REGISTRY
        .iter()
        .find(|e| e.id == ide_id)
        .ok_or_else(|| format!("Unknown IDE: {}", ide_id))?;

    log::info!("[IDE] Found IDE entry: id={}, name={}, cli={}, cli_style={}",
        entry.id, entry.name, entry.cli, entry.cli_style);

    // Check if CLI is available
    let cli_available = is_cli_available(entry.cli);
    log::info!("[IDE] CLI '{}' available: {}", entry.cli, cli_available);

    // Find the project root to open with file explorer
    let project_root = find_project_root(&file_path);
    log::info!("[IDE] Project root detected: {:?}", project_root);

    // For VS Code family (cursor, code, windsurf), use the --add flag approach:
    // 1. First open project folder to ensure it's in the workspace
    // 2. Then open the specific file with --goto
    // This is more reliable than trying to pass both in one command

    match entry.cli_style {
        "vscode" => {
            // If CLI not available, try platform-specific fallback
            if !cli_available {
                #[cfg(target_os = "macos")]
                {
                    log::info!("[IDE] CLI not available, using 'open -a' with app: {}", entry.app_path);

                    // Open project folder first
                    if let Some(ref root) = project_root {
                        let _ = Command::new("open")
                            .arg("-a")
                            .arg(entry.app_path)
                            .arg(root)
                            .spawn();
                        std::thread::sleep(std::time::Duration::from_millis(500));
                    }

                    // Then open the file
                    let result = Command::new("open")
                        .arg("-a")
                        .arg(entry.app_path)
                        .arg(&file_path)
                        .spawn();

                    return match result {
                        Ok(_) => Ok(format!("Opened {} in {}", file_path, entry.name)),
                        Err(e) => Err(format!("Failed to open file: {}", e)),
                    };
                }

                #[cfg(target_os = "windows")]
                {
                    if let Some(app_path) = entry.get_app_path() {
                        log::info!("[IDE] CLI not available, launching app directly: {}", app_path);

                        // Open project folder first
                        if let Some(ref root) = project_root {
                            let _ = Command::new(&app_path)
                                .arg(root)
                                .spawn();
                            std::thread::sleep(std::time::Duration::from_millis(500));
                        }

                        // Then open the file
                        let result = Command::new(&app_path)
                            .arg(&file_path)
                            .spawn();

                        return match result {
                            Ok(_) => Ok(format!("Opened {} in {}", file_path, entry.name)),
                            Err(e) => Err(format!("Failed to open file: {}", e)),
                        };
                    } else {
                        return Err(format!("{} not found on this system", entry.name));
                    }
                }

                #[cfg(not(any(target_os = "macos", target_os = "windows")))]
                {
                    return Err(format!("{} CLI not available and no fallback for this platform", entry.name));
                }
            }

            // Step 1: Open project folder first (if found)
            if let Some(ref root) = project_root {
                log::info!("[IDE] Step 1: Opening project folder with CLI '{}': {}", entry.cli, root);
                let _ = spawn_cli_command(entry.cli, &[root.clone()]);

                // Small delay to let IDE initialize
                std::thread::sleep(std::time::Duration::from_millis(500));
            }

            // Step 2: Open file with --goto (reuse existing window with -r)
            let mut args = vec!["-r".to_string()];

            // Build goto argument
            let goto_arg = if let Some(l) = line {
                if let Some(c) = column {
                    format!("{}:{}:{}", file_path, l, c)
                } else {
                    format!("{}:{}", file_path, l)
                }
            } else {
                file_path.clone()
            };

            args.push("--goto".to_string());
            args.push(goto_arg);

            log::info!("[IDE] Step 2: Opening file with CLI '{}' and args: {:?}", entry.cli, args);

            let result = spawn_cli_command(entry.cli, &args);

            match result {
                Ok(_) => Ok(format!("Opened {} in {}", file_path, entry.name)),
                Err(e) => Err(format!("Failed to open file: {}", e)),
            }
        }
        "jetbrains" => {
            // JetBrains: open project first, then file
            let mut args = Vec::new();

            if let Some(ref root) = project_root {
                args.push(root.clone());
            }

            if let Some(l) = line {
                args.push("--line".to_string());
                args.push(l.to_string());
            }
            args.push(file_path.clone());

            log::info!("[IDE] JetBrains args: {:?}", args);

            let result = spawn_cli_command(entry.cli, &args);

            match result {
                Ok(_) => Ok(format!("Opened {} in {}", file_path, entry.name)),
                Err(e) => Err(format!("Failed to open file: {}", e)),
            }
        }
        "zed" => {
            // Zed: If CLI not available, use platform-specific fallback
            if !cli_available {
                #[cfg(target_os = "macos")]
                {
                    log::info!("[IDE] Zed CLI not available, using 'open -a' with app: {}", entry.app_path);

                    // Open project folder first
                    if let Some(ref root) = project_root {
                        let _ = Command::new("open")
                            .arg("-a")
                            .arg(entry.app_path)
                            .arg(root)
                            .spawn();
                        std::thread::sleep(std::time::Duration::from_millis(500));
                    }

                    // Then open the file
                    let result = Command::new("open")
                        .arg("-a")
                        .arg(entry.app_path)
                        .arg(&file_path)
                        .spawn();

                    return match result {
                        Ok(_) => Ok(format!("Opened {} in {}", file_path, entry.name)),
                        Err(e) => Err(format!("Failed to open file: {}", e)),
                    };
                }

                #[cfg(target_os = "windows")]
                {
                    if let Some(app_path) = entry.get_app_path() {
                        log::info!("[IDE] Zed CLI not available, launching app directly: {}", app_path);

                        if let Some(ref root) = project_root {
                            let _ = Command::new(&app_path)
                                .arg(root)
                                .spawn();
                            std::thread::sleep(std::time::Duration::from_millis(500));
                        }

                        let result = Command::new(&app_path)
                            .arg(&file_path)
                            .spawn();

                        return match result {
                            Ok(_) => Ok(format!("Opened {} in {}", file_path, entry.name)),
                            Err(e) => Err(format!("Failed to open file: {}", e)),
                        };
                    } else {
                        return Err(format!("Zed not found on this system"));
                    }
                }

                #[cfg(not(any(target_os = "macos", target_os = "windows")))]
                {
                    return Err(format!("Zed CLI not available and no fallback for this platform"));
                }
            }

            // Zed with CLI: project then file:line
            let mut args = Vec::new();

            if let Some(ref root) = project_root {
                args.push(root.clone());
            }

            let file_arg = if let Some(l) = line {
                format!("{}:{}", file_path, l)
            } else {
                file_path.clone()
            };
            args.push(file_arg);

            log::info!("[IDE] Zed args: {:?}", args);

            let result = spawn_cli_command(entry.cli, &args);

            match result {
                Ok(_) => Ok(format!("Opened {} in {}", file_path, entry.name)),
                Err(e) => Err(format!("Failed to open file: {}", e)),
            }
        }
        "sublime" => {
            // Sublime: subl project file:line
            let mut args = Vec::new();

            if let Some(ref root) = project_root {
                args.push(root.clone());
            }

            let file_arg = if let Some(l) = line {
                format!("{}:{}", file_path, l)
            } else {
                file_path.clone()
            };
            args.push(file_arg);

            log::info!("[IDE] Sublime args: {:?}", args);

            let result = spawn_cli_command(entry.cli, &args);

            match result {
                Ok(_) => Ok(format!("Opened {} in {}", file_path, entry.name)),
                Err(e) => Err(format!("Failed to open file: {}", e)),
            }
        }
        _ => {
            let result = spawn_cli_command(entry.cli, &[file_path.clone()]);

            match result {
                Ok(_) => Ok(format!("Opened {} in {}", file_path, entry.name)),
                Err(e) => Err(format!("Failed to open file: {}", e)),
            }
        }
    }
}

/// Open multiple files in IDE tabs
#[tauri::command]
pub fn open_multiple_files_in_ide(ide_id: String, file_paths: Vec<String>) -> Result<String, String> {
    let entry = IDE_REGISTRY
        .iter()
        .find(|e| e.id == ide_id)
        .ok_or_else(|| format!("Unknown IDE: {}", ide_id))?;

    log::info!("[IDE] Opening {} files in {}", file_paths.len(), entry.name);

    // Find project root from first file
    let project_root = file_paths.first().and_then(|p| find_project_root(p));

    // Build shell command with properly quoted paths
    let mut cmd = String::new();
    cmd.push_str(entry.cli);

    // Add project folder first
    if let Some(ref root) = project_root {
        cmd.push_str(&format!(" \"{}\"", root));
    }

    // Add all file paths quoted
    for path in &file_paths {
        cmd.push_str(&format!(" \"{}\"", path));
    }

    log::info!("[IDE] Running shell command: {}", cmd);

    let result = Command::new("sh")
        .arg("-c")
        .arg(&cmd)
        .spawn();

    match result {
        Ok(_) => Ok(format!("Opened {} files in {}", file_paths.len(), entry.name)),
        Err(e) => Err(format!("Failed to open files: {}", e)),
    }
}

/// Extract app icon as base64 PNG using sips (macOS built-in)
fn get_app_icon_base64(app_path: &str) -> Option<String> {
    // Find the .icns file in the app bundle
    let contents_path = format!("{}/Contents", app_path);
    let info_plist = format!("{}/Info.plist", contents_path);

    // Try to read CFBundleIconFile from Info.plist
    let icon_name = Command::new("defaults")
        .arg("read")
        .arg(&info_plist)
        .arg("CFBundleIconFile")
        .output()
        .ok()
        .and_then(|o| {
            if o.status.success() {
                let name = String::from_utf8_lossy(&o.stdout).trim().to_string();
                Some(if name.ends_with(".icns") { name } else { format!("{}.icns", name) })
            } else {
                None
            }
        })
        .unwrap_or_else(|| "AppIcon.icns".to_string());

    let icns_path = format!("{}/Resources/{}", contents_path, icon_name);

    // Check if icns exists
    if !Path::new(&icns_path).exists() {
        // Try alternative icon locations
        let alternatives = [
            format!("{}/Resources/AppIcon.icns", contents_path),
            format!("{}/Resources/app.icns", contents_path),
            format!("{}/Resources/Icon.icns", contents_path),
        ];

        let found_icns = alternatives.iter().find(|p| Path::new(p).exists());
        if found_icns.is_none() {
            log::warn!("[IDE] No icon found for {}", app_path);
            return None;
        }
    }

    // Create temp file for PNG output
    let temp_png = format!("/tmp/quack_icon_{}.png", std::process::id());

    // Use sips to convert icns to PNG (32x32 for menu)
    let result = Command::new("sips")
        .args(["-s", "format", "png", "-z", "32", "32", &icns_path, "--out", &temp_png])
        .output();

    if result.is_err() || !result.as_ref().unwrap().status.success() {
        log::warn!("[IDE] Failed to convert icon for {}", app_path);
        return None;
    }

    // Read PNG and convert to base64
    let png_data = fs::read(&temp_png).ok()?;
    let _ = fs::remove_file(&temp_png); // Cleanup temp file

    Some(BASE64.encode(&png_data))
}

/// Get all installed apps (IDEs, terminals, and Finder)
#[tauri::command]
pub fn get_installed_apps() -> Vec<InstalledApp> {
    let mut apps = Vec::new();

    // Check IDEs
    for entry in IDE_REGISTRY {
        #[cfg(target_os = "macos")]
        {
            if Path::new(entry.app_path).exists() {
                let icon = get_app_icon_base64(entry.app_path);
                apps.push(InstalledApp {
                    id: entry.id.to_string(),
                    name: entry.name.to_string(),
                    app_path: entry.app_path.to_string(),
                    category: "ide".to_string(),
                    icon_base64: icon,
                });
            }
        }

        #[cfg(target_os = "windows")]
        {
            if let Some(app_path) = entry.get_app_path() {
                apps.push(InstalledApp {
                    id: entry.id.to_string(),
                    name: entry.name.to_string(),
                    app_path,
                    category: "ide".to_string(),
                    icon_base64: None, // TODO: Windows icon extraction
                });
            }
        }
    }

    // Check terminals and Finder (macOS only for now)
    #[cfg(target_os = "macos")]
    for entry in APP_REGISTRY {
        if Path::new(entry.app_path).exists() {
            let icon = get_app_icon_base64(entry.app_path);
            apps.push(InstalledApp {
                id: entry.id.to_string(),
                name: entry.name.to_string(),
                app_path: entry.app_path.to_string(),
                category: entry.category.to_string(),
                icon_base64: icon,
            });
        }
    }

    // On Windows, add common terminals
    #[cfg(target_os = "windows")]
    {
        // Windows Terminal
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let wt_path = format!("{}\\Microsoft\\WindowsApps\\wt.exe", local_app_data);
            if Path::new(&wt_path).exists() {
                apps.push(InstalledApp {
                    id: "windows-terminal".to_string(),
                    name: "Windows Terminal".to_string(),
                    app_path: wt_path,
                    category: "terminal".to_string(),
                    icon_base64: None,
                });
            }
        }
        // PowerShell
        if let Ok(sys_root) = std::env::var("SystemRoot") {
            let ps_path = format!("{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", sys_root);
            if Path::new(&ps_path).exists() {
                apps.push(InstalledApp {
                    id: "powershell".to_string(),
                    name: "PowerShell".to_string(),
                    app_path: ps_path,
                    category: "terminal".to_string(),
                    icon_base64: None,
                });
            }
        }
        // File Explorer
        if let Ok(sys_root) = std::env::var("SystemRoot") {
            let explorer_path = format!("{}\\explorer.exe", sys_root);
            if Path::new(&explorer_path).exists() {
                apps.push(InstalledApp {
                    id: "explorer".to_string(),
                    name: "File Explorer".to_string(),
                    app_path: explorer_path,
                    category: "finder".to_string(),
                    icon_base64: None,
                });
            }
        }
        // Git Bash
        let git_bash_paths = [
            std::env::var("ProgramFiles")
                .map(|pf| format!("{}\\Git\\git-bash.exe", pf))
                .ok(),
            std::env::var("ProgramFiles(x86)")
                .map(|pf| format!("{}\\Git\\git-bash.exe", pf))
                .ok(),
        ];
        for git_bash_path in git_bash_paths.into_iter().flatten() {
            if Path::new(&git_bash_path).exists() {
                apps.push(InstalledApp {
                    id: "git-bash".to_string(),
                    name: "Git Bash".to_string(),
                    app_path: git_bash_path,
                    category: "terminal".to_string(),
                    icon_base64: None,
                });
                break; // Only add once
            }
        }
    }

    log::info!("[IDE] Found {} installed apps", apps.len());
    apps
}

/// Normalize Windows extended paths (remove \\?\ prefix)
fn normalize_path(path: &str) -> String {
    if path.starts_with(r"\\?\") {
        path[4..].to_string()
    } else {
        path.to_string()
    }
}

/// Open path in an app (IDE, terminal, or Finder)
#[tauri::command]
pub fn open_in_app(app_id: String, path: String) -> Result<String, String> {
    // Normalize the path (remove \\?\ prefix on Windows)
    let path = normalize_path(&path);
    log::info!("[IDE] Opening {} in {}", path, app_id);

    // Check if it's an IDE
    if IDE_REGISTRY.iter().any(|e| e.id == app_id) {
        return open_folder_in_ide(app_id, path);
    }

    // Check if it's a terminal or Finder (macOS)
    #[cfg(target_os = "macos")]
    if let Some(app) = APP_REGISTRY.iter().find(|e| e.id == app_id) {
        let result = Command::new("open")
            .arg("-a")
            .arg(app.app_path)
            .arg(&path)
            .spawn();

        return match result {
            Ok(_) => Ok(format!("Opened {} in {}", path, app.name)),
            Err(e) => Err(format!("Failed to open: {}", e)),
        };
    }

    // Handle Windows-specific apps
    #[cfg(target_os = "windows")]
    {
        match app_id.as_str() {
            "explorer" => {
                // Windows File Explorer - use full path
                let explorer_path = std::env::var("SystemRoot")
                    .map(|sr| format!("{}\\explorer.exe", sr))
                    .unwrap_or_else(|_| "C:\\Windows\\explorer.exe".to_string());

                let result = Command::new(&explorer_path)
                    .arg(&path)
                    .spawn();

                return match result {
                    Ok(_) => Ok(format!("Opened {} in File Explorer", path)),
                    Err(e) => Err(format!("Failed to open File Explorer: {}", e)),
                };
            }
            "windows-terminal" => {
                // Windows Terminal with Command Prompt profile
                let wt_paths = [
                    std::env::var("LOCALAPPDATA")
                        .map(|la| format!("{}\\Microsoft\\WindowsApps\\wt.exe", la))
                        .ok(),
                    Some("wt.exe".to_string()), // fallback to PATH
                ];

                for wt_path in wt_paths.into_iter().flatten() {
                    // Open Command Prompt in Windows Terminal
                    let result = Command::new(&wt_path)
                        .arg("-d")
                        .arg(&path)
                        .arg("cmd")
                        .spawn();

                    if result.is_ok() {
                        return Ok(format!("Opened Command Prompt in {}", path));
                    }
                }

                return Err("Windows Terminal not found".to_string());
            }
            "powershell" => {
                // PowerShell via Windows Terminal (default profile)
                let wt_paths = [
                    std::env::var("LOCALAPPDATA")
                        .map(|la| format!("{}\\Microsoft\\WindowsApps\\wt.exe", la))
                        .ok(),
                    Some("wt.exe".to_string()), // fallback to PATH
                ];

                for wt_path in wt_paths.into_iter().flatten() {
                    let result = Command::new(&wt_path)
                        .arg("-d")
                        .arg(&path)
                        .spawn();

                    if result.is_ok() {
                        return Ok(format!("Opened PowerShell in {}", path));
                    }
                }

                return Err("Windows Terminal not found".to_string());
            }
            "git-bash" => {
                // Git Bash - try multiple locations
                let git_bash_paths = [
                    std::env::var("ProgramFiles")
                        .map(|pf| format!("{}\\Git\\git-bash.exe", pf))
                        .ok(),
                    std::env::var("ProgramFiles(x86)")
                        .map(|pf| format!("{}\\Git\\git-bash.exe", pf))
                        .ok(),
                ];

                for git_bash_path in git_bash_paths.into_iter().flatten() {
                    if Path::new(&git_bash_path).exists() {
                        let result = Command::new(&git_bash_path)
                            .arg(format!("--cd={}", path))
                            .spawn();

                        return match result {
                            Ok(_) => Ok(format!("Opened Git Bash in {}", path)),
                            Err(e) => Err(format!("Failed to open Git Bash: {}", e)),
                        };
                    }
                }

                return Err("Git Bash not found".to_string());
            }
            _ => {}
        }
    }

    Err(format!("Unknown app: {}", app_id))
}

// =============================================================================
// Claude Code IDE Extension WebSocket Client (Phase 2)
// =============================================================================
// Connects to the Claude Code VSCode/Cursor extension's WebSocket server
// to get real-time IDE context (open files, selections, diagnostics).
// Uses lock file discovery + auth token handshake + MCP protocol.

/// Information about a discovered Claude Code IDE extension instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeLockFile {
    pub port: u16,
    pub pid: u64,
    pub workspace_folders: Vec<String>,
    pub ide_name: String,
    pub transport: String,
    pub auth_token: String,
}

/// Context retrieved from an external IDE via WebSocket
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExternalIdeContext {
    pub active_file: Option<String>,
    pub selection: Option<IdeSelectionContext>,
    pub open_tabs: Vec<String>,
    pub diagnostics: Vec<IdeDiagnostic>,
    pub ide_name: String,
}

/// Selected text in the IDE editor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeSelectionContext {
    pub file_path: String,
    pub language: String,
    pub text: String,
    pub start_line: u32,
    pub end_line: u32,
}

/// A diagnostic (error/warning) from the IDE
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IdeDiagnostic {
    pub file: String,
    pub severity: String,
    pub message: String,
    pub line: u32,
}

/// Internal: JSON format of ~/.claude/ide/*.lock files
#[derive(Deserialize)]
struct LockFileJson {
    pid: u64,
    #[serde(rename = "workspaceFolders")]
    workspace_folders: Vec<String>,
    #[serde(rename = "ideName")]
    ide_name: String,
    transport: String,
    #[serde(rename = "authToken")]
    auth_token: String,
}

/// Type alias for the WebSocket stream
type WsStream = tokio_tungstenite::WebSocketStream<
    tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
>;

/// Get the ~/.claude/ide/ directory path
fn get_claude_ide_dir() -> Option<std::path::PathBuf> {
    dirs::home_dir().map(|h| h.join(".claude").join("ide"))
}

/// Check if a PID is alive (cross-platform)
fn is_pid_alive(pid: u64) -> bool {
    #[cfg(unix)]
    {
        Command::new("kill")
            .args(["-0", &pid.to_string()])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
    #[cfg(windows)]
    {
        let mut cmd = Command::new("tasklist");
        cmd.args(["/FI", &format!("PID eq {}", pid), "/NH"]);
        hide_console_window(&mut cmd);
        cmd.output()
            .map(|o| {
                let stdout = String::from_utf8_lossy(&o.stdout);
                o.status.success() && stdout.contains(&pid.to_string())
            })
            .unwrap_or(false)
    }
}

/// Scan ~/.claude/ide/*.lock files and return valid IDE instances
fn discover_lock_files() -> Vec<IdeLockFile> {
    let ide_dir = match get_claude_ide_dir() {
        Some(d) => d,
        None => return vec![],
    };

    if !ide_dir.exists() {
        return vec![];
    }

    let mut result = vec![];

    if let Ok(entries) = fs::read_dir(&ide_dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            if path.extension().and_then(|e| e.to_str()) != Some("lock") {
                continue;
            }

            // Extract port from filename (e.g., "12345.lock")
            let port: u16 = match path
                .file_stem()
                .and_then(|s| s.to_str())
                .and_then(|s| s.parse().ok())
            {
                Some(p) => p,
                None => continue,
            };

            // Parse lock file JSON
            let content = match fs::read_to_string(&path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let lock_json: LockFileJson = match serde_json::from_str(&content) {
                Ok(l) => l,
                Err(e) => {
                    log::debug!("[IDE-WS] Failed to parse lock file {:?}: {}", path, e);
                    continue;
                }
            };

            // Validate PID is alive
            if !is_pid_alive(lock_json.pid) {
                log::debug!(
                    "[IDE-WS] Stale lock file {:?} (pid {} not alive), removing",
                    path,
                    lock_json.pid
                );
                let _ = fs::remove_file(&path);
                continue;
            }

            result.push(IdeLockFile {
                port,
                pid: lock_json.pid,
                workspace_folders: lock_json.workspace_folders,
                ide_name: lock_json.ide_name,
                transport: lock_json.transport,
                auth_token: lock_json.auth_token,
            });
        }
    }

    result
}

/// Discover all running Claude Code IDE extension instances
#[tauri::command]
pub fn discover_ide_instances() -> Vec<IdeLockFile> {
    let instances = discover_lock_files();
    log::info!("[IDE-WS] Discovered {} IDE instances", instances.len());
    for inst in &instances {
        log::info!(
            "[IDE-WS]   - {} on port {} (pid {}), workspaces: {:?}",
            inst.ide_name,
            inst.port,
            inst.pid,
            inst.workspace_folders
        );
    }
    instances
}

/// Find the IDE instance whose workspace matches the given path
fn find_ide_for_workspace(workspace_path: &str) -> Option<IdeLockFile> {
    let instances = discover_lock_files();
    let normalized = workspace_path.trim_end_matches('/');

    instances.into_iter().find(|inst| {
        inst.workspace_folders.iter().any(|folder| {
            let folder_normalized = folder.trim_end_matches('/');
            normalized == folder_normalized
                || normalized.starts_with(&format!("{}/", folder_normalized))
        })
    })
}

/// Get IDE context from the Claude Code extension via WebSocket MCP protocol
#[tauri::command]
pub async fn get_ide_context(workspace_path: String) -> Option<ExternalIdeContext> {
    let lock_file = match find_ide_for_workspace(&workspace_path) {
        Some(lf) => lf,
        None => {
            log::debug!(
                "[IDE-WS] No IDE instance found for workspace: {}",
                workspace_path
            );
            return None;
        }
    };

    log::info!(
        "[IDE-WS] Connecting to {} on port {} for workspace context",
        lock_file.ide_name,
        lock_file.port
    );

    match query_ide_context(&lock_file).await {
        Ok(ctx) => Some(ctx),
        Err(e) => {
            log::warn!(
                "[IDE-WS] Failed to get context from {}: {}",
                lock_file.ide_name,
                e
            );
            None
        }
    }
}

/// Send a JSON-RPC request over WebSocket and wait for the matching response.
/// Skips interleaved notifications and handles pings.
async fn ws_request(
    ws: &mut WsStream,
    id: u64,
    method: &str,
    params: serde_json::Value,
) -> Result<serde_json::Value, String> {
    let request = serde_json::json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params
    });

    ws.send(Message::Text(request.to_string()))
        .await
        .map_err(|e| format!("Failed to send {}: {}", method, e))?;

    // Read messages until we get a response matching our request ID
    loop {
        let msg = tokio::time::timeout(std::time::Duration::from_secs(5), ws.next())
            .await
            .map_err(|_| format!("{} response timeout", method))?
            .ok_or_else(|| format!("Connection closed during {}", method))?
            .map_err(|e| format!("Error reading {} response: {}", method, e))?;

        match msg {
            Message::Text(text) => {
                let json: serde_json::Value = serde_json::from_str(&text)
                    .map_err(|e| format!("Failed to parse response: {}", e))?;

                // Check if this is a response (has "id" field matching ours)
                if let Some(resp_id) = json.get("id").and_then(|v| v.as_u64()) {
                    if resp_id == id {
                        return Ok(json);
                    }
                    log::debug!("[IDE-WS] Received response for different id: {}", resp_id);
                } else {
                    // Notification - log and continue waiting
                    let method_name = json
                        .get("method")
                        .and_then(|m| m.as_str())
                        .unwrap_or("unknown");
                    log::debug!("[IDE-WS] Received notification: {}", method_name);
                }
            }
            Message::Ping(data) => {
                let _ = ws.send(Message::Pong(data)).await;
            }
            Message::Close(_) => {
                return Err(format!("Connection closed by server during {}", method));
            }
            _ => {} // Ignore binary, pong, etc.
        }
    }
}

/// Send a JSON-RPC notification (no response expected)
async fn ws_notify(ws: &mut WsStream, method: &str) -> Result<(), String> {
    let notification = serde_json::json!({
        "jsonrpc": "2.0",
        "method": method
    });

    ws.send(Message::Text(notification.to_string()))
        .await
        .map_err(|e| format!("Failed to send {}: {}", method, e))
}

/// Connect to IDE extension WebSocket, do MCP handshake, query context
async fn query_ide_context(lock_file: &IdeLockFile) -> Result<ExternalIdeContext, String> {
    let url = format!("ws://127.0.0.1:{}", lock_file.port);

    // Build WebSocket request with auth header
    let request = tokio_tungstenite::tungstenite::http::Request::builder()
        .uri(&url)
        .header(
            "x-claude-code-ide-authorization",
            &lock_file.auth_token,
        )
        .header("Host", format!("127.0.0.1:{}", lock_file.port))
        .header("Connection", "Upgrade")
        .header("Upgrade", "websocket")
        .header("Sec-WebSocket-Version", "13")
        .header(
            "Sec-WebSocket-Key",
            tokio_tungstenite::tungstenite::handshake::client::generate_key(),
        )
        .body(())
        .map_err(|e| format!("Failed to build request: {}", e))?;

    // Connect with timeout
    let (mut ws, _) = tokio::time::timeout(
        std::time::Duration::from_secs(5),
        tokio_tungstenite::connect_async(request),
    )
    .await
    .map_err(|_| "WebSocket connection timeout".to_string())?
    .map_err(|e| format!("WebSocket connection failed: {}", e))?;

    log::info!("[IDE-WS] Connected to {} on port {}", lock_file.ide_name, lock_file.port);

    // MCP Initialize handshake
    let init_response = ws_request(
        &mut ws,
        1,
        "initialize",
        serde_json::json!({
            "protocolVersion": "2024-11-05",
            "capabilities": {},
            "clientInfo": {
                "name": "quack",
                "version": "0.6.0"
            }
        }),
    )
    .await?;

    log::info!("[IDE-WS] Initialize response received");
    log::debug!("[IDE-WS] Init details: {}", init_response);

    // Send initialized notification
    ws_notify(&mut ws, "notifications/initialized").await?;

    // List available tools
    let tools_response = ws_request(&mut ws, 2, "tools/list", serde_json::json!({})).await?;

    let tool_names: Vec<String> = tools_response["result"]["tools"]
        .as_array()
        .map(|tools| {
            tools
                .iter()
                .filter_map(|t| t["name"].as_str().map(String::from))
                .collect()
        })
        .unwrap_or_default();

    log::info!("[IDE-WS] Available tools: {:?}", tool_names);

    // Build context by calling available tools
    let mut context = ExternalIdeContext {
        active_file: None,
        selection: None,
        open_tabs: vec![],
        diagnostics: vec![],
        ide_name: lock_file.ide_name.clone(),
    };

    let mut request_id: u64 = 3;

    for tool_name in &tool_names {
        match tool_name.as_str() {
            // Selection tools
            "getCurrentSelection" | "getSelection" => {
                if let Ok(result) = ws_request(
                    &mut ws,
                    request_id,
                    "tools/call",
                    serde_json::json!({ "name": tool_name, "arguments": {} }),
                )
                .await
                {
                    parse_selection_result(&result, &mut context);
                }
                request_id += 1;
            }
            // Open editors / tabs
            "getOpenEditors" | "getOpenTabs" | "openedDocuments" => {
                if let Ok(result) = ws_request(
                    &mut ws,
                    request_id,
                    "tools/call",
                    serde_json::json!({ "name": tool_name, "arguments": {} }),
                )
                .await
                {
                    parse_open_editors_result(&result, &mut context);
                }
                request_id += 1;
            }
            // Diagnostics
            "getDiagnostics" => {
                if let Ok(result) = ws_request(
                    &mut ws,
                    request_id,
                    "tools/call",
                    serde_json::json!({ "name": tool_name, "arguments": {} }),
                )
                .await
                {
                    parse_diagnostics_result(&result, &mut context);
                }
                request_id += 1;
            }
            // Active file
            "getActiveFile" | "getOpenFile" | "getActiveDocument" => {
                if let Ok(result) = ws_request(
                    &mut ws,
                    request_id,
                    "tools/call",
                    serde_json::json!({ "name": tool_name, "arguments": {} }),
                )
                .await
                {
                    parse_active_file_result(&result, &mut context);
                }
                request_id += 1;
            }
            other => {
                log::debug!("[IDE-WS] Skipping unknown tool: {}", other);
            }
        }
    }

    // Close WebSocket gracefully
    let _ = ws.close(None).await;

    log::info!(
        "[IDE-WS] Context retrieved: active_file={:?}, selection={}, open_tabs={}, diagnostics={}",
        context.active_file,
        context.selection.is_some(),
        context.open_tabs.len(),
        context.diagnostics.len()
    );

    Ok(context)
}

/// Parse MCP tools/call response content text as JSON
fn extract_tool_content_text(result: &serde_json::Value) -> Option<String> {
    result["result"]["content"]
        .as_array()?
        .iter()
        .find(|item| item["type"].as_str() == Some("text"))
        .and_then(|item| item["text"].as_str())
        .map(String::from)
}

fn parse_selection_result(result: &serde_json::Value, ctx: &mut ExternalIdeContext) {
    if let Some(text) = extract_tool_content_text(result) {
        if let Ok(sel) = serde_json::from_str::<serde_json::Value>(&text) {
            ctx.selection = Some(IdeSelectionContext {
                file_path: sel["filePath"]
                    .as_str()
                    .or(sel["file_path"].as_str())
                    .unwrap_or("")
                    .to_string(),
                language: sel["language"]
                    .as_str()
                    .or(sel["languageId"].as_str())
                    .unwrap_or("plaintext")
                    .to_string(),
                text: sel["text"]
                    .as_str()
                    .or(sel["selectedText"].as_str())
                    .unwrap_or("")
                    .to_string(),
                start_line: sel["startLine"]
                    .as_u64()
                    .or(sel["start_line"].as_u64())
                    .unwrap_or(0) as u32,
                end_line: sel["endLine"]
                    .as_u64()
                    .or(sel["end_line"].as_u64())
                    .unwrap_or(0) as u32,
            });

            // Also set active file from selection if not already set
            if ctx.active_file.is_none() {
                ctx.active_file = sel["filePath"]
                    .as_str()
                    .or(sel["file_path"].as_str())
                    .map(String::from);
            }
        }
    }
}

fn parse_open_editors_result(result: &serde_json::Value, ctx: &mut ExternalIdeContext) {
    if let Some(text) = extract_tool_content_text(result) {
        if let Ok(editors) = serde_json::from_str::<Vec<serde_json::Value>>(&text) {
            ctx.open_tabs = editors
                .iter()
                .filter_map(|e| {
                    e["filePath"]
                        .as_str()
                        .or(e["path"].as_str())
                        .or(e["file_path"].as_str())
                        .map(String::from)
                })
                .collect();

            // Set active file from first editor if not already set
            if ctx.active_file.is_none() && !ctx.open_tabs.is_empty() {
                ctx.active_file = Some(ctx.open_tabs[0].clone());
            }
        }
    }
}

fn parse_diagnostics_result(result: &serde_json::Value, ctx: &mut ExternalIdeContext) {
    if let Some(text) = extract_tool_content_text(result) {
        if let Ok(diags) = serde_json::from_str::<Vec<serde_json::Value>>(&text) {
            ctx.diagnostics = diags
                .iter()
                .filter_map(|d| {
                    Some(IdeDiagnostic {
                        file: d["file"]
                            .as_str()
                            .or(d["filePath"].as_str())
                            .or(d["path"].as_str())?
                            .to_string(),
                        severity: d["severity"]
                            .as_str()
                            .unwrap_or("info")
                            .to_string(),
                        message: d["message"].as_str()?.to_string(),
                        line: d["line"]
                            .as_u64()
                            .or(d["range"]["start"]["line"].as_u64())
                            .unwrap_or(0) as u32,
                    })
                })
                .take(10) // Cap at 10 diagnostics
                .collect();
        }
    }
}

fn parse_active_file_result(result: &serde_json::Value, ctx: &mut ExternalIdeContext) {
    if let Some(text) = extract_tool_content_text(result) {
        if let Ok(file_info) = serde_json::from_str::<serde_json::Value>(&text) {
            ctx.active_file = file_info["filePath"]
                .as_str()
                .or(file_info["path"].as_str())
                .or(file_info["file_path"].as_str())
                .map(String::from);
        } else {
            // Maybe the text is just a plain file path
            let trimmed = text.trim();
            if !trimmed.is_empty() && !trimmed.starts_with('{') {
                ctx.active_file = Some(trimmed.to_string());
            }
        }
    }
}
