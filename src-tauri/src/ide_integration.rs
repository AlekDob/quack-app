//! IDE Integration Module
//!
//! Provides Tauri commands for detecting and interacting with external IDEs.
//! Supports: VS Code, Cursor, Windsurf, Zed, JetBrains IDEs, Sublime Text

use serde::{Deserialize, Serialize};
use std::path::Path;
use std::process::Command;

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

/// IDE Registry entry
struct IDEEntry {
    id: &'static str,
    name: &'static str,
    bundle_id: &'static str,
    cli: &'static str,
    app_path: &'static str,
    cli_style: &'static str,
    supports_diff: bool,
}

/// All supported IDEs
const IDE_REGISTRY: &[IDEEntry] = &[
    // VS Code Family
    IDEEntry {
        id: "vscode",
        name: "Visual Studio Code",
        bundle_id: "com.microsoft.VSCode",
        cli: "code",
        app_path: "/Applications/Visual Studio Code.app",
        cli_style: "vscode",
        supports_diff: true,
    },
    IDEEntry {
        id: "cursor",
        name: "Cursor",
        bundle_id: "com.todesktop.230313mzl4w4u92",
        cli: "cursor",
        app_path: "/Applications/Cursor.app",
        cli_style: "vscode",
        supports_diff: true,
    },
    IDEEntry {
        id: "windsurf",
        name: "Windsurf",
        bundle_id: "com.codeium.windsurf",
        cli: "windsurf",
        app_path: "/Applications/Windsurf.app",
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
        cli_style: "jetbrains",
        supports_diff: true,
    },
    IDEEntry {
        id: "webstorm",
        name: "WebStorm",
        bundle_id: "com.jetbrains.WebStorm",
        cli: "webstorm",
        app_path: "/Applications/WebStorm.app",
        cli_style: "jetbrains",
        supports_diff: true,
    },
    IDEEntry {
        id: "pycharm",
        name: "PyCharm",
        bundle_id: "com.jetbrains.pycharm",
        cli: "pycharm",
        app_path: "/Applications/PyCharm.app",
        cli_style: "jetbrains",
        supports_diff: true,
    },
    IDEEntry {
        id: "goland",
        name: "GoLand",
        bundle_id: "com.jetbrains.goland",
        cli: "goland",
        app_path: "/Applications/GoLand.app",
        cli_style: "jetbrains",
        supports_diff: true,
    },
    IDEEntry {
        id: "rubymine",
        name: "RubyMine",
        bundle_id: "com.jetbrains.rubymine",
        cli: "rubymine",
        app_path: "/Applications/RubyMine.app",
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
        cli_style: "sublime",
        supports_diff: false,
    },
];

/// Check if a CLI command is available in PATH
fn is_cli_available(cli: &str) -> bool {
    Command::new("which")
        .arg(cli)
        .output()
        .map(|output| output.status.success())
        .unwrap_or(false)
}

/// Detect all installed IDEs on the system
#[tauri::command]
pub fn detect_installed_ides() -> Vec<IDEInfo> {
    let mut installed = Vec::new();

    for entry in IDE_REGISTRY {
        let app_exists = Path::new(entry.app_path).exists();
        let cli_available = is_cli_available(entry.cli);

        if app_exists || cli_available {
            installed.push(IDEInfo {
                id: entry.id.to_string(),
                name: entry.name.to_string(),
                app_path: entry.app_path.to_string(),
                cli: entry.cli.to_string(),
                cli_available,
                app_exists,
                supports_diff: entry.supports_diff,
            });
        }
    }

    installed
}

/// Set the preferred IDE (saves to config file)
#[tauri::command]
pub fn set_preferred_ide(ide_id: String) -> Result<(), String> {
    // For now, we just validate the IDE exists
    // The actual preference is stored in the frontend store
    let valid = IDE_REGISTRY.iter().any(|e| e.id == ide_id);

    if !valid {
        return Err(format!("Unknown IDE: {}", ide_id));
    }

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
            // If CLI not available, try using 'open -a' with the app
            if !cli_available {
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

            // Step 1: Open project folder first (if found)
            if let Some(ref root) = project_root {
                log::info!("[IDE] Step 1: Opening project folder with CLI '{}': {}", entry.cli, root);
                let _ = Command::new(entry.cli)
                    .arg(root)
                    .spawn();

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

            let result = Command::new(entry.cli)
                .args(&args)
                .spawn();

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

            let result = Command::new(entry.cli)
                .args(&args)
                .spawn();

            match result {
                Ok(_) => Ok(format!("Opened {} in {}", file_path, entry.name)),
                Err(e) => Err(format!("Failed to open file: {}", e)),
            }
        }
        "zed" => {
            // Zed: If CLI not available, use 'open -a'
            if !cli_available {
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

            let result = Command::new(entry.cli)
                .args(&args)
                .spawn();

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

            let result = Command::new(entry.cli)
                .args(&args)
                .spawn();

            match result {
                Ok(_) => Ok(format!("Opened {} in {}", file_path, entry.name)),
                Err(e) => Err(format!("Failed to open file: {}", e)),
            }
        }
        _ => {
            let result = Command::new(entry.cli)
                .arg(&file_path)
                .spawn();

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
