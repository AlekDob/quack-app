use std::process::Command;
use std::path::PathBuf;
use std::env;
use anyhow::{Result, Context};
use serde::Serialize;

/// Minimum supported Node.js version (major)
/// Symbol.dispose polyfill in stream-claude.js enables Node 18+ support
const MIN_NODE_VERSION: u32 = 18;

#[derive(Serialize, Clone)]
pub struct PrerequisiteStatus {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub download_url: Option<String>,
    pub min_version: Option<String>,
    pub version_satisfied: bool,
}

#[derive(Serialize, Clone)]
pub struct PrerequisitesCheck {
    pub git: PrerequisiteStatus,
    pub nodejs: PrerequisiteStatus,
    pub claude_cli: PrerequisiteStatus,
    pub all_installed: bool,
}

#[tauri::command]
pub fn check_prerequisites() -> Result<PrerequisitesCheck, String> {
    check_prerequisites_impl().map_err(|err| err.to_string())
}

/// Build extended PATH for macOS app bundles.
/// When launched as .app, Tauri processes don't inherit the user's shell PATH,
/// so tools installed via Homebrew, nvm, volta, fnm, etc. are invisible.
fn get_extended_path() -> String {
    let current = env::var("PATH").unwrap_or_default();
    let home = dirs::home_dir().unwrap_or_default();

    let extra_dirs: Vec<String> = vec![
        // Homebrew (Apple Silicon + Intel)
        "/opt/homebrew/bin".to_string(),
        "/usr/local/bin".to_string(),
        // nvm
        home.join(".nvm/versions/node").to_string_lossy().to_string(),
        // volta
        home.join(".volta/bin").to_string_lossy().to_string(),
        // fnm
        home.join(".local/share/fnm/aliases/default/bin").to_string_lossy().to_string(),
        home.join("Library/Application Support/fnm/aliases/default/bin").to_string_lossy().to_string(),
        // n (tj/n)
        "/usr/local/n/versions/node".to_string(),
        // asdf
        home.join(".asdf/shims").to_string_lossy().to_string(),
        // mise/rtx
        home.join(".local/share/mise/shims").to_string_lossy().to_string(),
        // pnpm global
        home.join(".local/share/pnpm").to_string_lossy().to_string(),
        // User local bin
        home.join(".local/bin").to_string_lossy().to_string(),
    ];

    let mut parts: Vec<String> = extra_dirs;
    parts.push(current);
    parts.join(":")
}

/// Hide the console window on Windows to prevent command prompts from flashing
#[cfg(target_os = "windows")]
fn hide_console_window(cmd: &mut Command) {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
}

/// Create a Command with extended PATH so tools are found in macOS .app bundles.
/// On Windows, also hides the console window to prevent command prompts from flashing.
fn command_with_path(program: &str) -> Command {
    let mut cmd = Command::new(program);
    cmd.env("PATH", get_extended_path());
    #[cfg(target_os = "windows")]
    hide_console_window(&mut cmd);
    cmd
}

fn check_prerequisites_impl() -> Result<PrerequisitesCheck> {
    let git = check_git()?;
    let nodejs = check_nodejs()?;
    let claude_cli = check_claude_cli()?;

    let all_installed = git.installed && nodejs.installed && nodejs.version_satisfied && claude_cli.installed;

    Ok(PrerequisitesCheck {
        git,
        nodejs,
        claude_cli,
        all_installed,
    })
}

fn check_git() -> Result<PrerequisiteStatus> {
    let output = command_with_path("git")
        .arg("--version")
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let version_str = String::from_utf8_lossy(&output.stdout);
            let version = version_str
                .split_whitespace()
                .nth(2)
                .map(|v| v.trim().to_string());

            Ok(PrerequisiteStatus {
                name: "Git".to_string(),
                installed: true,
                version,
                download_url: None,
                min_version: None,
                version_satisfied: true,
            })
        }
        _ => Ok(PrerequisiteStatus {
            name: "Git".to_string(),
            installed: false,
            version: None,
            download_url: Some("https://git-scm.com/downloads".to_string()),
            min_version: None,
            version_satisfied: false,
        }),
    }
}

/// Find the node executable, checking extended PATH and common install locations
fn find_node_executable() -> Option<(PathBuf, String)> {
    // 1. Try "node" with extended PATH
    if let Ok(output) = command_with_path("node").arg("--version").output() {
        if output.status.success() {
            let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
            return Some((PathBuf::from("node"), version));
        }
    }

    // 2. Check common installation paths on macOS
    if let Some(home) = dirs::home_dir() {
        let static_paths = vec![
            // Homebrew (Apple Silicon)
            PathBuf::from("/opt/homebrew/bin/node"),
            // Homebrew (Intel)
            PathBuf::from("/usr/local/bin/node"),
            // volta
            home.join(".volta/bin/node"),
            // asdf shims
            home.join(".asdf/shims/node"),
            // mise shims
            home.join(".local/share/mise/shims/node"),
        ];

        for path in &static_paths {
            if path.exists() {
                let mut cmd = Command::new(path);
                cmd.arg("--version");
                #[cfg(target_os = "windows")]
                hide_console_window(&mut cmd);
                if let Ok(output) = cmd.output() {
                    if output.status.success() {
                        let version = String::from_utf8_lossy(&output.stdout)
                            .trim().to_string();
                        return Some((path.clone(), version));
                    }
                }
            }
        }

        // 3. Search nvm directories (version-specific paths)
        let nvm_dir = home.join(".nvm/versions/node");
        if nvm_dir.exists() {
            if let Ok(entries) = std::fs::read_dir(&nvm_dir) {
                let mut versions: Vec<PathBuf> = entries
                    .filter_map(|e| e.ok())
                    .map(|e| e.path().join("bin/node"))
                    .filter(|p| p.exists())
                    .collect();
                // Sort descending to pick the latest version
                versions.sort();
                versions.reverse();
                for node_path in versions {
                    let mut cmd = Command::new(&node_path);
                    cmd.arg("--version");
                    #[cfg(target_os = "windows")]
                    hide_console_window(&mut cmd);
                    if let Ok(output) = cmd.output() {
                        if output.status.success() {
                            let version = String::from_utf8_lossy(&output.stdout)
                                .trim().to_string();
                            return Some((node_path, version));
                        }
                    }
                }
            }
        }

        // 4. Search fnm directories
        let fnm_dirs = vec![
            home.join(".local/share/fnm/aliases/default/bin/node"),
            home.join("Library/Application Support/fnm/aliases/default/bin/node"),
        ];
        for path in &fnm_dirs {
            if path.exists() {
                let mut cmd = Command::new(path);
                cmd.arg("--version");
                #[cfg(target_os = "windows")]
                hide_console_window(&mut cmd);
                if let Ok(output) = cmd.output() {
                    if output.status.success() {
                        let version = String::from_utf8_lossy(&output.stdout)
                            .trim().to_string();
                        return Some((path.clone(), version));
                    }
                }
            }
        }
    }

    None
}

/// Parse Node.js version string (e.g., "v22.8.0" -> 22)
fn parse_node_major_version(version_str: &str) -> Option<u32> {
    let trimmed = version_str.trim().trim_start_matches('v');
    trimmed.split('.').next()?.parse().ok()
}

fn check_nodejs() -> Result<PrerequisiteStatus> {
    let min_version_str = format!(">= {}", MIN_NODE_VERSION);
    let download_url = "https://nodejs.org/en/download".to_string();

    match find_node_executable() {
        Some((_path, version)) => {
            let version_satisfied = parse_node_major_version(&version)
                .map(|major| major >= MIN_NODE_VERSION)
                .unwrap_or(false); // If we can't parse, assume incompatible (safe default)

            Ok(PrerequisiteStatus {
                name: "Node.js".to_string(),
                installed: true,
                version: Some(version),
                download_url: if version_satisfied { None } else { Some(download_url) },
                min_version: Some(min_version_str),
                version_satisfied,
            })
        }
        None => {
            Ok(PrerequisiteStatus {
                name: "Node.js".to_string(),
                installed: false,
                version: None,
                download_url: Some(download_url),
                min_version: Some(min_version_str),
                version_satisfied: false,
            })
        }
    }
}

/// Find the claude CLI executable, checking PATH and common install locations
fn find_claude_executable() -> Option<PathBuf> {
    // 1. Try "claude" with extended PATH
    if let Ok(output) = command_with_path("claude").arg("--version").output() {
        if output.status.success() {
            return Some(PathBuf::from("claude"));
        }
    }

    // 2. On Windows, also try "claude.exe" and "claude.cmd"
    #[cfg(target_os = "windows")]
    {
        for ext in &["claude.exe", "claude.cmd"] {
            let mut cmd = Command::new(ext);
            cmd.arg("--version");
            hide_console_window(&mut cmd);
            if let Ok(output) = cmd.output() {
                if output.status.success() {
                    return Some(PathBuf::from(ext));
                }
            }
        }
    }

    // 3. Check common installation paths
    if let Some(home) = dirs::home_dir() {
        let common_paths = vec![
            // Claude Code local install (used by official installer)
            home.join(".local").join("bin").join("claude"),
            // npm global on macOS/Linux
            PathBuf::from("/usr/local/bin/claude"),
            // npm global on macOS with Homebrew Node
            PathBuf::from("/opt/homebrew/bin/claude"),
        ];

        // On Windows, also check with .exe and .cmd extensions
        #[cfg(target_os = "windows")]
        let common_paths = {
            let mut paths = common_paths;
            let local_bin = home.join(".local").join("bin");
            paths.push(local_bin.join("claude.exe"));
            paths.push(local_bin.join("claude.cmd"));
            // npm global on Windows
            let appdata = home.join("AppData").join("Roaming").join("npm");
            paths.push(appdata.join("claude.cmd"));
            paths.push(appdata.join("claude"));
            paths
        };

        for path in &common_paths {
            if path.exists() {
                // Use extended PATH: claude is a Node.js wrapper that needs node in PATH
                let mut cmd = Command::new(path);
                cmd.env("PATH", get_extended_path());
                cmd.arg("--version");
                #[cfg(target_os = "windows")]
                hide_console_window(&mut cmd);
                if let Ok(output) = cmd.output() {
                    if output.status.success() {
                        return Some(path.clone());
                    }
                }
            }
        }
    }

    None
}

fn check_claude_cli() -> Result<PrerequisiteStatus> {
    // Try to find claude executable in PATH or common locations
    if let Some(claude_path) = find_claude_executable() {
        // Use extended PATH: claude is a Node.js wrapper that needs node in PATH
        let mut cmd = Command::new(&claude_path);
        cmd.env("PATH", get_extended_path());
        let output = cmd.arg("--version").output();

        if let Ok(output) = output {
            if output.status.success() {
                let version_str = String::from_utf8_lossy(&output.stdout);
                // Parse version: output is like "2.1.31 (Claude Code)"
                let version = version_str
                    .trim()
                    .split_whitespace()
                    .next()
                    .map(|v| v.trim().to_string());

                return Ok(PrerequisiteStatus {
                    name: "Claude Code CLI".to_string(),
                    installed: true,
                    version,
                    download_url: None,
                    min_version: None,
                    version_satisfied: true,
                });
            }
        }
    }

    // Fallback: try npm list as last resort
    if let Ok(npm_output) = command_with_path("npm")
        .args(["list", "-g", "@anthropic-ai/claude-code", "--depth=0"])
        .output()
    {
        if npm_output.status.success() {
            let stdout = String::from_utf8_lossy(&npm_output.stdout);
            if stdout.contains("@anthropic-ai/claude-code") {
                let version = stdout
                    .lines()
                    .find(|line| line.contains("@anthropic-ai/claude-code"))
                    .and_then(|line| line.split('@').last().map(|v| v.trim().to_string()));

                return Ok(PrerequisiteStatus {
                    name: "Claude Code CLI".to_string(),
                    installed: true,
                    version,
                    download_url: None,
                    min_version: None,
                    version_satisfied: true,
                });
            }
        }
    }

    Ok(PrerequisiteStatus {
        name: "Claude Code CLI".to_string(),
        installed: false,
        version: None,
        download_url: None,
        min_version: None,
        version_satisfied: false,
    })
}

#[tauri::command]
pub fn install_claude_cli() -> Result<String, String> {
    install_claude_cli_impl().map_err(|err| err.to_string())
}

fn install_claude_cli_impl() -> Result<String> {
    let output = command_with_path("npm")
        .args(["install", "-g", "@anthropic-ai/claude-code"])
        .output()
        .context("Failed to execute npm install command")?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(anyhow::anyhow!("Failed to install Claude CLI: {}", stderr));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(stdout.to_string())
}

/// Install Xcode Command Line Tools on macOS (triggers native dialog)
#[tauri::command]
pub fn install_xcode_cli_tools() -> Result<String, String> {
    install_xcode_cli_tools_impl().map_err(|err| err.to_string())
}

fn install_xcode_cli_tools_impl() -> Result<String> {
    #[cfg(target_os = "macos")]
    {
        let output = Command::new("xcode-select")
            .arg("--install")
            .output()
            .context("Failed to execute xcode-select --install")?;

        // xcode-select --install returns exit code 1 if already installed,
        // but still shows the dialog if tools are missing
        let stdout = String::from_utf8_lossy(&output.stdout);
        let stderr = String::from_utf8_lossy(&output.stderr);

        if stderr.contains("already installed") {
            return Ok("Xcode Command Line Tools are already installed".to_string());
        }

        Ok(format!("Xcode CLI Tools installation dialog opened. {}{}", stdout, stderr))
    }

    #[cfg(not(target_os = "macos"))]
    {
        Err(anyhow::anyhow!("install_xcode_cli_tools is only supported on macOS"))
    }
}

/// Open the system terminal and run `sudo npm install -g @anthropic-ai/claude-code`
#[tauri::command]
pub fn open_claude_install_terminal() -> Result<String, String> {
    open_claude_install_terminal_impl().map_err(|err| err.to_string())
}

fn open_claude_install_terminal_impl() -> Result<String> {
    let install_cmd = "sudo npm install -g @anthropic-ai/claude-code";

    #[cfg(target_os = "macos")]
    {
        let applescript = format!(
            r#"tell application "Terminal"
                activate
                do script "{}"
            end tell"#,
            install_cmd
        );

        let output = Command::new("osascript")
            .arg("-e")
            .arg(&applescript)
            .output()
            .context("Failed to open Terminal.app on macOS")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Failed to open terminal: {}", stderr));
        }

        return Ok("Opened macOS Terminal with Claude CLI install command".to_string());
    }

    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("cmd");
        cmd.args(["/c", "start", "cmd", "/k", "npm install -g @anthropic-ai/claude-code"]);
        hide_console_window(&mut cmd);
        let output = cmd
            .output()
            .context("Failed to open terminal on Windows")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Failed to open terminal: {}", stderr));
        }

        return Ok("Opened Windows terminal with Claude CLI install command".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        let terminals = vec![
            ("x-terminal-emulator", vec!["-e", "sh", "-c", install_cmd]),
            ("gnome-terminal", vec!["--", "sh", "-c", install_cmd]),
            ("konsole", vec!["-e", "sh", "-c", install_cmd]),
            ("xterm", vec!["-e", "sh", "-c", install_cmd]),
        ];

        for (term, args) in &terminals {
            if let Ok(output) = Command::new(term).args(args).output() {
                if output.status.success() {
                    return Ok(format!("Opened {} with Claude CLI install command", term));
                }
            }
        }

        return Err(anyhow::anyhow!("No supported terminal emulator found on Linux"));
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err(anyhow::anyhow!("Unsupported operating system"))
    }
}

/// Check if Claude CLI is authenticated (logged in)
#[tauri::command]
pub fn check_claude_auth_status() -> Result<bool, String> {
    check_claude_auth_status_impl().map_err(|err| err.to_string())
}

fn check_claude_auth_status_impl() -> Result<bool> {
    // Use the existing auth module to check credentials
    Ok(crate::claude_auth::is_claude_cli_authenticated())
}

/// Open the system terminal and run `claude login`
#[tauri::command]
pub fn open_claude_login_terminal() -> Result<String, String> {
    open_claude_login_terminal_impl().map_err(|err| err.to_string())
}

fn open_claude_login_terminal_impl() -> Result<String> {
    #[cfg(target_os = "windows")]
    {
        // On Windows, open cmd.exe with claude login command
        // Use "start" to open a new terminal window
        // Hide the wrapper command's console window (the new terminal opened by "start" will still be visible)
        let mut cmd = Command::new("cmd");
        cmd.args(["/c", "start", "cmd", "/k", "claude login"]);
        hide_console_window(&mut cmd);
        let output = cmd
            .output()
            .context("Failed to open terminal on Windows")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Failed to open terminal: {}", stderr));
        }

        return Ok("Opened Windows terminal with claude login".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        // On macOS, use osascript to open Terminal.app with claude login
        let applescript = r#"
            tell application "Terminal"
                activate
                do script "claude login"
            end tell
        "#;

        let output = Command::new("osascript")
            .arg("-e")
            .arg(applescript)
            .output()
            .context("Failed to open Terminal.app on macOS")?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(anyhow::anyhow!("Failed to open terminal: {}", stderr));
        }

        return Ok("Opened macOS Terminal with claude login".to_string());
    }

    #[cfg(target_os = "linux")]
    {
        // Try common Linux terminal emulators
        let terminals = vec![
            ("x-terminal-emulator", vec!["-e", "claude login"]),
            ("gnome-terminal", vec!["--", "claude", "login"]),
            ("konsole", vec!["-e", "claude", "login"]),
            ("xterm", vec!["-e", "claude", "login"]),
        ];

        for (term, args) in &terminals {
            if let Ok(output) = Command::new(term).args(args).output() {
                if output.status.success() {
                    return Ok(format!("Opened {} with claude login", term));
                }
            }
        }

        return Err(anyhow::anyhow!("No supported terminal emulator found on Linux"));
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err(anyhow::anyhow!("Unsupported operating system"))
    }
}
