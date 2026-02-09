use std::process::Command;
use std::path::PathBuf;
use anyhow::{Result, Context};
use serde::Serialize;

#[derive(Serialize, Clone)]
pub struct PrerequisiteStatus {
    pub name: String,
    pub installed: bool,
    pub version: Option<String>,
    pub download_url: Option<String>,
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

fn check_prerequisites_impl() -> Result<PrerequisitesCheck> {
    let git = check_git()?;
    let nodejs = check_nodejs()?;
    let claude_cli = check_claude_cli()?;

    let all_installed = git.installed && nodejs.installed && claude_cli.installed;

    Ok(PrerequisitesCheck {
        git,
        nodejs,
        claude_cli,
        all_installed,
    })
}

fn check_git() -> Result<PrerequisiteStatus> {
    let output = Command::new("git")
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
            })
        }
        _ => Ok(PrerequisiteStatus {
            name: "Git".to_string(),
            installed: false,
            version: None,
            download_url: Some("https://git-scm.com/downloads".to_string()),
        }),
    }
}

fn check_nodejs() -> Result<PrerequisiteStatus> {
    let output = Command::new("node")
        .arg("--version")
        .output();

    match output {
        Ok(output) if output.status.success() => {
            let version = String::from_utf8_lossy(&output.stdout)
                .trim()
                .to_string();

            Ok(PrerequisiteStatus {
                name: "Node.js".to_string(),
                installed: true,
                version: Some(version),
                download_url: None,
            })
        }
        _ => Ok(PrerequisiteStatus {
            name: "Node.js".to_string(),
            installed: false,
            version: None,
            download_url: Some("https://nodejs.org/".to_string()),
        }),
    }
}

/// Find the claude CLI executable, checking PATH and common install locations
fn find_claude_executable() -> Option<PathBuf> {
    // 1. Try "claude" directly from PATH
    if let Ok(output) = Command::new("claude").arg("--version").output() {
        if output.status.success() {
            return Some(PathBuf::from("claude"));
        }
    }

    // 2. On Windows, also try "claude.exe" and "claude.cmd"
    #[cfg(target_os = "windows")]
    {
        for ext in &["claude.exe", "claude.cmd"] {
            if let Ok(output) = Command::new(ext).arg("--version").output() {
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
                if let Ok(output) = Command::new(path).arg("--version").output() {
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
        let output = Command::new(&claude_path)
            .arg("--version")
            .output();

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
                });
            }
        }
    }

    // Fallback: try npm list as last resort
    if let Ok(npm_output) = Command::new("npm")
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
                });
            }
        }
    }

    Ok(PrerequisiteStatus {
        name: "Claude Code CLI".to_string(),
        installed: false,
        version: None,
        download_url: None,
    })
}

#[tauri::command]
pub fn install_claude_cli() -> Result<String, String> {
    install_claude_cli_impl().map_err(|err| err.to_string())
}

fn install_claude_cli_impl() -> Result<String> {
    let output = Command::new("npm")
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
        let output = Command::new("cmd")
            .args(["/c", "start", "cmd", "/k", "claude login"])
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
