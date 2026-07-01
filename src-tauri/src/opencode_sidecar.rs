use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex as StdMutex;
use std::thread;
use std::time::Duration;
use tauri::State;

pub const SERVER_HOST: &str = "127.0.0.1";
pub const SERVER_PORT: u16 = 17346;

const OPENCODE_NOT_FOUND: &str =
    "OpenCode binary not found. Install from https://opencode.ai/install or `npm i -g opencode-ai`.";

const HEALTH_RETRIES: u32 = 300;
const HEALTH_INTERVAL: Duration = Duration::from_millis(200);

#[derive(Default)]
pub struct OpencodeSidecarState {
    child: StdMutex<Option<Child>>,
    last_error: StdMutex<Option<String>>,
}

#[derive(serde::Serialize, Clone)]
pub struct OpencodeServerStatus {
    pub running: bool,
    pub url: String,
    pub message: Option<String>,
}

impl OpencodeSidecarState {
    pub fn server_url() -> String {
        format!("http://{}:{}", SERVER_HOST, SERVER_PORT)
    }

    pub fn spawn(&self) -> OpencodeServerStatus {
        let mut guard = self.child.lock().unwrap();
        if let Some(child) = guard.as_mut() {
            if child.try_wait().ok().flatten().is_none() {
                return self.status();
            }
            let _ = child.kill();
        }

        let opencode = match resolve_opencode() {
            Some(p) => p,
            None => {
                let msg = OPENCODE_NOT_FOUND.to_string();
                *self.last_error.lock().unwrap() = Some(msg.clone());
                return OpencodeServerStatus {
                    running: false,
                    url: Self::server_url(),
                    message: Some(msg),
                };
            }
        };

        let mut cmd = Command::new(&opencode);
        cmd.arg("serve")
            .arg("--port")
            .arg(SERVER_PORT.to_string())
            .arg("--hostname")
            .arg(SERVER_HOST)
            .env("PATH", augmented_path())
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        match cmd.spawn() {
            Ok(child) => {
                *guard = Some(child);
                *self.last_error.lock().unwrap() = None;
                drop(guard);
                if !wait_for_health() {
                    let msg = format!(
                        "OpenCode server did not become healthy within {}s",
                        HEALTH_RETRIES as u64 * HEALTH_INTERVAL.as_secs()
                    );
                    *self.last_error.lock().unwrap() = Some(msg.clone());
                    self.shutdown();
                    return OpencodeServerStatus {
                        running: false,
                        url: Self::server_url(),
                        message: Some(msg),
                    };
                }
                OpencodeServerStatus {
                    running: true,
                    url: Self::server_url(),
                    message: None,
                }
            }
            Err(e) => {
                let msg = if e.kind() == std::io::ErrorKind::NotFound {
                    OPENCODE_NOT_FOUND.to_string()
                } else {
                    format!("Failed to spawn opencode: {}", e)
                };
                *self.last_error.lock().unwrap() = Some(msg.clone());
                OpencodeServerStatus {
                    running: false,
                    url: Self::server_url(),
                    message: Some(msg),
                }
            }
        }
    }

    pub fn status(&self) -> OpencodeServerStatus {
        let mut guard = self.child.lock().unwrap();
        let running = guard
            .as_mut()
            .and_then(|c| c.try_wait().ok())
            .map(|s| s.is_none())
            .unwrap_or(false);
        OpencodeServerStatus {
            running,
            url: Self::server_url(),
            message: self.last_error.lock().unwrap().clone(),
        }
    }

    pub fn shutdown(&self) {
        if let Some(mut child) = self.child.lock().unwrap().take() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }

    pub fn restart(&self) -> OpencodeServerStatus {
        self.shutdown();
        self.spawn()
    }
}

fn wait_for_health() -> bool {
    let url = format!("{}/global/health", OpencodeSidecarState::server_url());
    for _ in 0..HEALTH_RETRIES {
        if ureq::get(&url).call().map(|r| r.status() == 200).unwrap_or(false) {
            return true;
        }
        thread::sleep(HEALTH_INTERVAL);
    }
    false
}

#[cfg(windows)]
const OPENCODE_BIN: &str = "opencode.exe";
#[cfg(not(windows))]
const OPENCODE_BIN: &str = "opencode";

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .filter(|p| !p.as_os_str().is_empty())
}

fn known_bin_dirs() -> Vec<PathBuf> {
    let mut dirs = vec![
        PathBuf::from("/opt/homebrew/bin"),
        PathBuf::from("/usr/local/bin"),
        PathBuf::from("/usr/bin"),
    ];
    if let Some(home) = home_dir() {
        for sub in [".opencode/bin", ".local/bin", ".bun/bin", ".npm-global/bin"] {
            dirs.push(home.join(sub));
        }
    }
    dirs
}

#[cfg(not(windows))]
fn shell_which_opencode() -> Option<PathBuf> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/sh".to_string());
    let out = Command::new(shell)
        .args(["-lic", "command -v opencode"])
        .output()
        .ok()?;
    let stdout = String::from_utf8_lossy(&out.stdout);
    stdout
        .lines()
        .rev()
        .map(str::trim)
        .find(|l| !l.is_empty())
        .map(PathBuf::from)
}

#[cfg(windows)]
fn shell_which_opencode() -> Option<PathBuf> {
    None
}

fn resolve_opencode() -> Option<PathBuf> {
    if let Some(home) = home_dir() {
        let p = home.join(".opencode/bin").join(OPENCODE_BIN);
        if p.is_file() {
            return Some(p);
        }
    }
    for dir in known_bin_dirs() {
        let p = dir.join(OPENCODE_BIN);
        if p.is_file() {
            return Some(p);
        }
    }
    shell_which_opencode().filter(|p| p.is_file())
}

fn augmented_path() -> std::ffi::OsString {
    let mut parts = known_bin_dirs();
    if let Some(existing) = std::env::var_os("PATH") {
        parts.extend(std::env::split_paths(&existing));
    }
    std::env::join_paths(parts).unwrap_or_default()
}

#[tauri::command]
pub fn opencode_server_status(
    state: State<'_, OpencodeSidecarState>,
) -> OpencodeServerStatus {
    state.status()
}

#[tauri::command]
pub fn opencode_server_start(
    state: State<'_, OpencodeSidecarState>,
) -> OpencodeServerStatus {
    let status = state.status();
    if status.running {
        return status;
    }
    state.spawn()
}

#[tauri::command]
pub fn opencode_server_restart(
    state: State<'_, OpencodeSidecarState>,
) -> OpencodeServerStatus {
    state.restart()
}

#[tauri::command]
pub fn opencode_server_check() -> Result<String, String> {
    resolve_opencode()
        .map(|p| p.to_string_lossy().into_owned())
        .ok_or_else(|| OPENCODE_NOT_FOUND.to_string())
}
