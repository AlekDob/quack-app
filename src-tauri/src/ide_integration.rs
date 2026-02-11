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
