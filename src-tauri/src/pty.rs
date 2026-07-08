use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::sync::mpsc;
use std::sync::Arc;
use std::thread;
use std::time::{Duration, Instant};
#[cfg(not(windows))]
use std::process::Command;
#[cfg(not(windows))]
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;

#[derive(Serialize, Clone)]
pub struct ShellOption {
    pub id: String,
    pub label: String,
    pub path: String,
    pub args: Vec<String>,
}

pub struct PtyEntry {
    pub master: Box<dyn MasterPty + Send>,
    pub writer: Box<dyn Write + Send>,
    pub child: Box<dyn portable_pty::Child + Send + Sync>,
    pub cwd: Option<String>,
    pub shell_path: String,
    pub title: String,
}

#[derive(Serialize, Clone)]
pub struct SessionInfo {
    pub id: String,
    pub cwd: Option<String>,
    pub shell_path: String,
    pub title: String,
}

#[derive(Default)]
pub struct PtyState {
    pub sessions: Arc<Mutex<HashMap<String, PtyEntry>>>,
    /// Rolling scrollback per live session — last ~128 KiB of UTF-8 output.
    /// Lets reattached terminals show what happened before the reload.
    pub scrollbacks: Arc<Mutex<HashMap<String, Arc<Mutex<String>>>>>,
}

const SCROLLBACK_MAX: usize = 128 * 1024;

#[derive(Serialize, Clone)]
pub struct PtyOutput {
    pub id: String,
    pub data: String,
}

#[derive(Serialize, Clone)]
pub struct PtyExit {
    pub id: String,
}

/// Expand %VAR% references in a string using the current process env.
#[cfg(windows)]
fn expand_env_vars(s: &str) -> String {
    let mut out = String::new();
    let mut chars = s.chars().peekable();
    while let Some(c) = chars.next() {
        if c == '%' {
            let mut name = String::new();
            let mut closed = false;
            while let Some(&nc) = chars.peek() {
                chars.next();
                if nc == '%' {
                    closed = true;
                    break;
                }
                name.push(nc);
            }
            if closed {
                if let Ok(v) = std::env::var(&name) {
                    out.push_str(&v);
                } else {
                    out.push('%');
                    out.push_str(&name);
                    out.push('%');
                }
            } else {
                out.push('%');
                out.push_str(&name);
            }
        } else {
            out.push(c);
        }
    }
    out
}

/// Read the current system + user PATH from the Windows registry, expand
/// any `%VAR%` references, and merge with the current process PATH so we
/// pick up post-launch installs (Rust, Node, MSVC) without losing
/// anything already in the launching shell's environment.
#[cfg(windows)]
fn refreshed_windows_path() -> Option<String> {
    use winreg::enums::{HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE};
    use winreg::RegKey;

    let mut parts: Vec<String> = Vec::new();

    if let Ok(sys) = RegKey::predef(HKEY_LOCAL_MACHINE).open_subkey(
        "SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment",
    ) {
        if let Ok(p) = sys.get_value::<String, _>("Path") {
            if !p.is_empty() {
                parts.push(expand_env_vars(&p));
            }
        }
    }
    if let Ok(usr) = RegKey::predef(HKEY_CURRENT_USER).open_subkey("Environment") {
        if let Ok(p) = usr.get_value::<String, _>("Path") {
            if !p.is_empty() {
                parts.push(expand_env_vars(&p));
            }
        }
    }
    // Fallback: include the current process PATH so we never have less
    // than what the launching shell had.
    if let Ok(p) = std::env::var("PATH") {
        if !p.is_empty() {
            parts.push(p);
        }
    }

    if parts.is_empty() {
        None
    } else {
        Some(parts.join(";"))
    }
}

/// PTY shells need a real TERM. GUI apps launched from Finder/DMG inherit
/// no TERM (unlike `tauri dev` from a terminal), so zsh falls back to a
/// crippled terminfo and line-editing backspace can echo spaces instead of
/// erasing. PATH is also minimal unless we resolve it from a login shell.
fn apply_pty_env(cmd: &mut CommandBuilder) {
    cmd.env("TERM", "xterm-256color");
    cmd.env("COLORTERM", "truecolor");
    if std::env::var("LANG").is_err() {
        cmd.env("LANG", "en_US.UTF-8");
    }
    #[cfg(windows)]
    if let Some(p) = refreshed_windows_path() {
        cmd.env("PATH", p);
    }
    #[cfg(not(windows))]
    if let Some(p) = login_shell_path() {
        cmd.env("PATH", p);
    }
}

#[cfg(not(windows))]
static LOGIN_PATH_CACHE: OnceLock<Option<String>> = OnceLock::new();

#[cfg(not(windows))]
fn login_shell_path() -> Option<String> {
    LOGIN_PATH_CACHE
        .get_or_init(resolve_login_shell_path)
        .clone()
}

#[cfg(not(windows))]
fn resolve_login_shell_path() -> Option<String> {
    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".into());
    let output = Command::new(&shell)
        .args(["-ilc", "echo -n \"$PATH\""])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        None
    } else {
        Some(path)
    }
}

fn default_shell_login_args(shell_path: &str) -> Vec<String> {
    let lower = shell_path.to_lowercase();
    #[cfg(windows)]
    {
        if lower.contains("powershell") || lower.ends_with("pwsh.exe") {
            return vec!["-NoLogo".into()];
        }
        vec![]
    }
    #[cfg(not(windows))]
    {
        if lower.ends_with("zsh") {
            vec!["-l".into()]
        } else if lower.contains("bash") {
            vec!["--login".into()]
        } else {
            vec![]
        }
    }
}

fn default_shell(shell: Option<String>) -> String {
    if let Some(s) = shell {
        return s;
    }
    if cfg!(windows) {
        if let Some(systemroot) = std::env::var_os("SystemRoot") {
            let pwsh = PathBuf::from(systemroot)
                .join("System32")
                .join("WindowsPowerShell")
                .join("v1.0")
                .join("powershell.exe");
            if pwsh.exists() {
                return pwsh.to_string_lossy().into_owned();
            }
        }
        std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".into())
    } else {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into())
    }
}

#[cfg(windows)]
fn find_in_path(name: &str) -> Option<String> {
    let path_str = refreshed_windows_path()
        .or_else(|| std::env::var("PATH").ok())
        .unwrap_or_default();
    for p in std::env::split_paths(&path_str) {
        let candidate = p.join(name);
        if candidate.exists() {
            return Some(candidate.to_string_lossy().into_owned());
        }
    }
    None
}

#[tauri::command]
pub fn available_shells() -> Vec<ShellOption> {
    let mut out: Vec<ShellOption> = Vec::new();
    #[cfg(windows)]
    {
        // PowerShell 7+
        if let Some(p) = find_in_path("pwsh.exe") {
            out.push(ShellOption {
                id: "pwsh".into(),
                label: "PowerShell 7".into(),
                path: p,
                args: vec!["-NoLogo".into()],
            });
        }
        // Built-in Windows PowerShell
        if let Some(systemroot) = std::env::var_os("SystemRoot") {
            let ps = PathBuf::from(systemroot)
                .join("System32")
                .join("WindowsPowerShell")
                .join("v1.0")
                .join("powershell.exe");
            if ps.exists() {
                out.push(ShellOption {
                    id: "powershell".into(),
                    label: "Windows PowerShell".into(),
                    path: ps.to_string_lossy().into_owned(),
                    args: vec!["-NoLogo".into()],
                });
            }
        }
        // Cmd
        let cmd_path = std::env::var("COMSPEC").unwrap_or_else(|_| "cmd.exe".into());
        if Path::new(&cmd_path).exists() {
            out.push(ShellOption {
                id: "cmd".into(),
                label: "Command Prompt".into(),
                path: cmd_path,
                args: vec![],
            });
        }
        // Git Bash
        for guess in &[
            "C:\\Program Files\\Git\\bin\\bash.exe",
            "C:\\Program Files (x86)\\Git\\bin\\bash.exe",
        ] {
            if Path::new(guess).exists() {
                out.push(ShellOption {
                    id: "gitbash".into(),
                    label: "Git Bash".into(),
                    path: (*guess).into(),
                    args: vec!["--login".into(), "-i".into()],
                });
                break;
            }
        }
        // WSL
        if let Some(p) = find_in_path("wsl.exe") {
            out.push(ShellOption {
                id: "wsl".into(),
                label: "WSL".into(),
                path: p,
                args: vec![],
            });
        }
    }
    #[cfg(not(windows))]
    {
        let sh = std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".into());
        if Path::new(&sh).exists() {
            out.push(ShellOption {
                id: "default".into(),
                label: "Default shell".into(),
                path: sh.clone(),
                args: default_shell_login_args(&sh),
            });
        }
        for cand in &["/bin/bash", "/bin/zsh", "/bin/sh"] {
            if Path::new(cand).exists() && !out.iter().any(|s| s.path == *cand) {
                out.push(ShellOption {
                    id: cand.trim_start_matches('/').replace('/', "_"),
                    label: cand.split('/').last().unwrap_or(cand).into(),
                    path: (*cand).into(),
                    args: default_shell_login_args(cand),
                });
            }
        }
    }
    out
}

// Tauri commands bind each parameter to a JS-side property by name, so
// collapsing these into a single struct would require a parallel rename
// of every caller. The 8 args here are the JS-API surface — keep them
// flat and silence the lint at the function site.
#[allow(clippy::too_many_arguments)]
#[tauri::command]
pub fn pty_spawn(
    app: AppHandle,
    state: State<'_, PtyState>,
    shell: Option<String>,
    args: Option<Vec<String>>,
    cwd: Option<String>,
    cols: u16,
    rows: u16,
    title: Option<String>,
) -> Result<String, String> {
    let pty_system = native_pty_system();
    let pair = pty_system
        .openpty(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let shell_path = default_shell(shell);
    let mut cmd = CommandBuilder::new(&shell_path);
    let custom_args = args.filter(|a| !a.is_empty());
    if let Some(extra) = custom_args {
        for a in extra {
            cmd.arg(a);
        }
    } else {
        for a in default_shell_login_args(&shell_path) {
            cmd.arg(a);
        }
    }
    if let Some(dir) = cwd.as_ref() {
        cmd.cwd(dir);
    }

    apply_pty_env(&mut cmd);

    let child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;
    let reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| e.to_string())?;

    let id = Uuid::new_v4().to_string();

    state.sessions.lock().insert(
        id.clone(),
        PtyEntry {
            master: pair.master,
            writer,
            child,
            cwd: cwd.clone(),
            shell_path: shell_path.clone(),
            title: title.unwrap_or_else(|| "Terminal".into()),
        },
    );

    let scrollback: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    state
        .scrollbacks
        .lock()
        .insert(id.clone(), scrollback.clone());

    // Reader thread → channel → flusher thread.
    // The flusher coalesces output (8ms / 64KB) and emits aligned UTF-8 chunks.
    let (tx, rx) = mpsc::channel::<Vec<u8>>();

    {
        let mut reader = reader;
        thread::spawn(move || {
            let mut buf = [0u8; 16 * 1024];
            loop {
                match reader.read(&mut buf) {
                    Ok(0) => break,
                    Ok(n) => {
                        if tx.send(buf[..n].to_vec()).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });
    }

    let app_for_flush = app.clone();
    let id_for_flush = id.clone();
    let sessions_for_flush = state.sessions.clone();
    let scrollbacks_for_flush = state.scrollbacks.clone();
    let scrollback_for_flush = scrollback;
    thread::spawn(move || {
        let flush_interval = Duration::from_millis(8);
        let flush_threshold = 64 * 1024usize;
        let mut residual: Vec<u8> = Vec::with_capacity(flush_threshold);
        let mut last_flush = Instant::now();

        let flush = |residual: &mut Vec<u8>| {
            let valid = match std::str::from_utf8(residual) {
                Ok(_) => residual.len(),
                Err(e) => e.valid_up_to(),
            };
            if valid == 0 {
                return;
            }
            let s = match std::str::from_utf8(&residual[..valid]) {
                Ok(s) => s.to_string(),
                Err(_) => return,
            };
            *residual = residual.split_off(valid);
            // Append to the rolling scrollback, trimming once it gets too big.
            {
                let mut sb = scrollback_for_flush.lock();
                sb.push_str(&s);
                if sb.len() > SCROLLBACK_MAX {
                    let target = SCROLLBACK_MAX / 2;
                    let drop_to = sb.len() - target;
                    let mut idx = drop_to;
                    while idx < sb.len() && !sb.is_char_boundary(idx) {
                        idx += 1;
                    }
                    sb.drain(..idx);
                }
            }
            let _ = app_for_flush.emit(
                "pty:output",
                PtyOutput {
                    id: id_for_flush.clone(),
                    data: s,
                },
            );
        };

        loop {
            let elapsed = last_flush.elapsed();
            let timeout = if elapsed >= flush_interval {
                Duration::from_millis(1)
            } else {
                flush_interval - elapsed
            };
            match rx.recv_timeout(timeout) {
                Ok(chunk) => {
                    residual.extend_from_slice(&chunk);
                    if residual.len() >= flush_threshold
                        || last_flush.elapsed() >= flush_interval
                    {
                        flush(&mut residual);
                        last_flush = Instant::now();
                    }
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {
                    if !residual.is_empty() {
                        flush(&mut residual);
                        last_flush = Instant::now();
                    }
                }
                Err(mpsc::RecvTimeoutError::Disconnected) => {
                    if !residual.is_empty() {
                        flush(&mut residual);
                    }
                    if !residual.is_empty() {
                        let s = String::from_utf8_lossy(&residual).into_owned();
                        let _ = app_for_flush.emit(
                            "pty:output",
                            PtyOutput {
                                id: id_for_flush.clone(),
                                data: s,
                            },
                        );
                        residual.clear();
                    }
                    break;
                }
            }
        }

        sessions_for_flush.lock().remove(&id_for_flush);
        scrollbacks_for_flush.lock().remove(&id_for_flush);
        let _ = app_for_flush.emit(
            "pty:exit",
            PtyExit {
                id: id_for_flush.clone(),
            },
        );
    });

    Ok(id)
}

#[tauri::command]
pub fn pty_write(state: State<'_, PtyState>, id: String, data: String) -> Result<(), String> {
    let mut sessions = state.sessions.lock();
    let entry = sessions
        .get_mut(&id)
        .ok_or_else(|| format!("pty session {} not found", id))?;
    entry
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| e.to_string())?;
    entry.writer.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn pty_resize(
    state: State<'_, PtyState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let sessions = state.sessions.lock();
    let entry = sessions
        .get(&id)
        .ok_or_else(|| format!("pty session {} not found", id))?;
    entry
        .master
        .resize(PtySize {
            rows: rows.max(1),
            cols: cols.max(1),
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())
}

/// Reap the whole PTY session tree (zsh + make/node children). Killing
/// only the shell pid orphans background jobs started from that terminal.
#[cfg(unix)]
fn kill_pty_tree(child: &mut Box<dyn portable_pty::Child + Send + Sync>) {
    if let Some(pid) = child.process_id() {
        unsafe {
            libc::kill(-(pid as i32), libc::SIGHUP);
            libc::kill(-(pid as i32), libc::SIGKILL);
        }
    } else {
        let _ = child.kill();
    }
}

#[cfg(windows)]
fn kill_pty_tree(child: &mut Box<dyn portable_pty::Child + Send + Sync>) {
    use std::os::windows::process::CommandExt;
    if let Some(pid) = child.process_id() {
        let _ = Command::new("taskkill")
            .args(["/PID", &pid.to_string(), "/T", "/F"])
            .creation_flags(0x0800_0000)
            .status();
    } else {
        let _ = child.kill();
    }
}

#[tauri::command]
pub fn pty_kill(state: State<'_, PtyState>, id: String) -> Result<(), String> {
    if let Some(mut entry) = state.sessions.lock().remove(&id) {
        kill_pty_tree(&mut entry.child);
    }
    state.scrollbacks.lock().remove(&id);
    Ok(())
}

#[tauri::command]
pub fn pty_get_buffer(state: State<'_, PtyState>, id: String) -> String {
    let sbs = state.scrollbacks.lock();
    if let Some(sb) = sbs.get(&id) {
        sb.lock().clone()
    } else {
        String::new()
    }
}

#[tauri::command]
pub fn pty_list_sessions(state: State<'_, PtyState>) -> Vec<SessionInfo> {
    let sessions = state.sessions.lock();
    sessions
        .iter()
        .map(|(id, e)| SessionInfo {
            id: id.clone(),
            cwd: e.cwd.clone(),
            shell_path: e.shell_path.clone(),
            title: e.title.clone(),
        })
        .collect()
}

#[tauri::command]
pub fn pty_session_exists(state: State<'_, PtyState>, id: String) -> bool {
    state.sessions.lock().contains_key(&id)
}
