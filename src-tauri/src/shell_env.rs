//! Centralized shell environment management.
//!
//! When Quack is launched from macOS Finder (or any GUI launcher), the process
//! inherits a minimal environment without the user's shell profile (PATH from
//! NVM, Volta, Homebrew, etc. is missing). This module captures the user's
//! full login-shell environment once at first access and caches it for reuse
//! by the embedded terminal, SDK daemon, and command execution.

use std::collections::HashMap;
use std::env;
use std::sync::OnceLock;
use std::time::Duration;

/// Cached login-shell environment, captured once on first access.
static LOGIN_ENV: OnceLock<HashMap<String, String>> = OnceLock::new();

/// Capture the user's full login-shell environment.
///
/// Runs `$SHELL -l -c 'env'` with a 5-second timeout. On failure (timeout,
/// parse error, exotic shell), falls back to the current process env merged
/// with `get_extended_path()`.
fn capture_login_env() -> HashMap<String, String> {
    #[cfg(not(target_os = "windows"))]
    {
        let shell = env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());
        log::info!("[shell_env] Capturing login environment via: {} -l -c 'env -0'", shell);

        let result = std::process::Command::new(&shell)
            .args(["-l", "-c", "env -0"])
            .stdout(std::process::Stdio::piped())
            .stderr(std::process::Stdio::null())
            // Prevent the login shell from reading stdin (avoids interactive hangs)
            .stdin(std::process::Stdio::null())
            .spawn();

        if let Ok(child) = result {
            // Wait with timeout
            match wait_with_timeout(child, Duration::from_secs(5)) {
                Some(output) if output.status.success() => {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    let env_map = parse_env_output(&stdout);
                    if !env_map.is_empty() {
                        log::info!(
                            "[shell_env] Captured {} environment variables from login shell",
                            env_map.len()
                        );
                        return env_map;
                    }
                    log::warn!("[shell_env] Login shell returned empty env, using fallback");
                }
                Some(output) => {
                    log::warn!(
                        "[shell_env] Login shell exited with status {}, using fallback",
                        output.status
                    );
                }
                None => {
                    log::warn!("[shell_env] Login shell timed out after 5s, using fallback");
                }
            }
        } else {
            log::warn!("[shell_env] Failed to spawn login shell, using fallback");
        }
    }

    // Fallback: current process env with extended PATH
    log::info!("[shell_env] Using fallback: process env + extended PATH");
    let mut env_map: HashMap<String, String> = env::vars().collect();
    env_map.insert("PATH".to_string(), get_extended_path());
    env_map
}

/// Wait for a child process with a timeout. Returns None if timed out (and kills the process).
#[cfg(not(target_os = "windows"))]
fn wait_with_timeout(
    mut child: std::process::Child,
    timeout: Duration,
) -> Option<std::process::Output> {
    use std::thread;

    let start = std::time::Instant::now();
    let poll_interval = Duration::from_millis(50);

    loop {
        match child.try_wait() {
            Ok(Some(_status)) => {
                // Process finished — collect output
                let stdout = {
                    use std::io::Read;
                    let mut buf = Vec::new();
                    if let Some(mut out) = child.stdout.take() {
                        let _ = out.read_to_end(&mut buf);
                    }
                    buf
                };
                let status = _status;
                return Some(std::process::Output {
                    status,
                    stdout,
                    stderr: Vec::new(),
                });
            }
            Ok(None) => {
                // Still running
                if start.elapsed() >= timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    return None;
                }
                thread::sleep(poll_interval);
            }
            Err(_) => {
                let _ = child.kill();
                let _ = child.wait();
                return None;
            }
        }
    }
}

/// Parse null-separated `env -0` output into a HashMap. Falls back to
/// line-based parsing if the output contains no null bytes.
/// Only accepts entries with a valid KEY (starts with letter/underscore,
/// contains only [A-Za-z0-9_]).
fn parse_env_output(output: &str) -> HashMap<String, String> {
    let mut map = HashMap::new();

    // Use null-byte splitting if available (handles multi-line values correctly),
    // otherwise fall back to line-by-line parsing.
    let entries: Vec<&str> = if output.contains('\0') {
        output.split('\0').collect()
    } else {
        output.lines().collect()
    };

    for entry in entries {
        if let Some(eq_pos) = entry.find('=') {
            let key = &entry[..eq_pos];
            let value = &entry[eq_pos + 1..];
            // Validate key: non-empty, starts with letter or underscore,
            // contains only alphanumeric or underscore
            if !key.is_empty()
                && (key.as_bytes()[0].is_ascii_alphabetic() || key.as_bytes()[0] == b'_')
                && key.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'_')
            {
                map.insert(key.to_string(), value.to_string());
            }
        }
    }
    map
}

/// Get the cached login-shell environment. Lazy-initialized on first call.
pub fn get_login_env() -> &'static HashMap<String, String> {
    LOGIN_ENV.get_or_init(capture_login_env)
}

/// Get the PATH from the user's login shell. Falls back to `get_extended_path()`.
pub fn get_login_path() -> String {
    get_login_env()
        .get("PATH")
        .cloned()
        .unwrap_or_else(get_extended_path)
}

/// Build extended PATH for GUI-launched app bundles.
/// When launched as .app (macOS) or from Start Menu (Windows), Tauri processes
/// don't inherit the user's shell PATH, so tools installed via Homebrew, nvm,
/// volta, fnm, etc. are invisible.
///
/// This is used as a fallback when login-shell capture fails, and also by
/// `prerequisites.rs` for prerequisite checks.
// Brain: fix-windows-shell-env-path
// Brain: gotcha-windows-path-separators
pub fn get_extended_path() -> String {
    let current = env::var("PATH").unwrap_or_default();
    let home = dirs::home_dir().unwrap_or_default();

    #[cfg(target_os = "windows")]
    let extra_dirs: Vec<String> = {
        let appdata = env::var("APPDATA").unwrap_or_default();
        let localappdata = env::var("LOCALAPPDATA").unwrap_or_default();
        let programfiles = env::var("ProgramFiles")
            .unwrap_or_else(|_| r"C:\Program Files".to_string());
        vec![
            // Default Node.js installer location
            format!(r"{}\nodejs", programfiles),
            // nvm-windows
            format!(r"{}\nvm", appdata),
            // volta
            home.join(".volta").join("bin")
                .to_string_lossy().to_string(),
            // fnm
            format!(r"{}\fnm_multishells", localappdata),
            home.join(".fnm").join("aliases").join("default")
                .to_string_lossy().to_string(),
            // pnpm global
            format!(r"{}\pnpm", localappdata),
            // npm global
            format!(r"{}\npm", appdata),
        ]
    };

    #[cfg(not(target_os = "windows"))]
    let extra_dirs: Vec<String> = vec![
        // Homebrew (Apple Silicon + Intel)
        "/opt/homebrew/bin".to_string(),
        "/usr/local/bin".to_string(),
        // nvm
        home.join(".nvm/versions/node")
            .to_string_lossy()
            .to_string(),
        // volta
        home.join(".volta/bin").to_string_lossy().to_string(),
        // fnm
        home.join(".local/share/fnm/aliases/default/bin")
            .to_string_lossy()
            .to_string(),
        home.join("Library/Application Support/fnm/aliases/default/bin")
            .to_string_lossy()
            .to_string(),
        // n (tj/n)
        "/usr/local/n/versions/node".to_string(),
        // asdf
        home.join(".asdf/shims").to_string_lossy().to_string(),
        // mise/rtx
        home.join(".local/share/mise/shims")
            .to_string_lossy()
            .to_string(),
        // pnpm global
        home.join(".local/share/pnpm")
            .to_string_lossy()
            .to_string(),
        // User local bin
        home.join(".local/bin").to_string_lossy().to_string(),
    ];

    let mut parts: Vec<String> = extra_dirs;
    parts.push(current);

    // Brain: fix-windows-shell-env-path
    #[cfg(target_os = "windows")]
    { parts.join(";") }
    #[cfg(not(target_os = "windows"))]
    { parts.join(":") }
}
