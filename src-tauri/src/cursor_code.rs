use parking_lot::Mutex;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicI64, Ordering};
use std::sync::{Arc, OnceLock};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

/// Tool runs (Bash, searches) can be silent for minutes — match Claude bridge.
const IDLE_TIMEOUT: Duration = Duration::from_secs(600);

#[derive(Default)]
pub struct CursorCodeState {
    children: Mutex<HashMap<String, u32>>,
    buffers: Mutex<HashMap<String, StreamBuffer>>,
    session_streams: Mutex<HashMap<String, String>>,
}

#[derive(Clone)]
struct StreamBuffer {
    #[allow(dead_code)]
    chat_session_id: String,
    lines: Vec<serde_json::Value>,
    ended: Option<i32>,
}

/// How we invoke the Cursor CLI — standalone binary or IDE subcommand.
enum CursorBin {
    /// Resolved executable path or name (e.g. `cursor-agent`).
    Standalone(String),
    /// Shell-mediated `cursor agent …` when only the IDE shim is on PATH.
    IdeSubcommand,
}

static CURSOR_BIN: OnceLock<CursorBin> = OnceLock::new();

fn probe_bin(name: &str) -> bool {
    let mut cmd = Command::new(name);
    cmd.arg("--version");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    cmd.output().map(|o| o.status.success()).unwrap_or(false)
}

fn probe_shell(cmd: &str) -> bool {
    #[cfg(windows)]
    {
        let mut c = Command::new("cmd");
        c.args(["/c", cmd]);
        use std::os::windows::process::CommandExt;
        c.creation_flags(0x08000000);
        return c.output().map(|o| o.status.success()).unwrap_or(false);
    }
    #[cfg(not(windows))]
    {
        Command::new("sh")
            .args(["-lc", cmd])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }
}

fn resolve_cursor_bin() -> Option<&'static CursorBin> {
    if let Some(cached) = CURSOR_BIN.get() {
        return Some(cached);
    }
    #[cfg(windows)]
    let names: &[&str] = &["cursor-agent.exe", "cursor-agent.cmd", "cursor-agent"];
    #[cfg(not(windows))]
    let names: &[&str] = &["cursor-agent"];
    for n in names {
        if probe_bin(n) {
            let _ = CURSOR_BIN.set(CursorBin::Standalone(n.to_string()));
            return CURSOR_BIN.get();
        }
    }
    if probe_shell("cursor-agent --version") {
        let _ = CURSOR_BIN.set(CursorBin::Standalone("cursor-agent".to_string()));
        return CURSOR_BIN.get();
    }
    if let Some(home) = dirs::home_dir() {
        #[cfg(windows)]
        let rels: &[&str] = &[".local/bin/cursor-agent.exe", "AppData/Local/cursor-agent/cursor-agent.exe"];
        #[cfg(not(windows))]
        let rels: &[&str] = &[".local/bin/cursor-agent"];
        for rel in rels {
            let path = home.join(rel);
            if path.exists() {
                let s = path.to_string_lossy().to_string();
                if probe_bin(&s) {
                    let _ = CURSOR_BIN.set(CursorBin::Standalone(s));
                    return CURSOR_BIN.get();
                }
            }
        }
    }
    if probe_shell("cursor agent --version") {
        let _ = CURSOR_BIN.set(CursorBin::IdeSubcommand);
        return CURSOR_BIN.get();
    }
    None
}

/// Quick availability check — returns the version string or an error.
#[tauri::command]
pub fn cursor_code_check() -> Result<String, String> {
    let bin = resolve_cursor_bin().ok_or_else(|| {
        "Cursor CLI not found. Install cursor-agent or ensure `cursor agent` is on PATH.".to_string()
    })?;
    match bin {
        CursorBin::Standalone(name) => run_version(name),
        CursorBin::IdeSubcommand => run_version_shell("cursor agent --version"),
    }
}

#[derive(serde::Serialize, Clone)]
pub struct CursorModelEntry {
    pub id: String,
    pub display_name: String,
    pub is_default: bool,
}

/// List models available to this Cursor account via `cursor-agent --list-models`.
#[tauri::command]
pub fn cursor_code_list_models() -> Result<Vec<CursorModelEntry>, String> {
    let text = run_cursor_output(&["--list-models"])?;
    Ok(parse_list_models(&text))
}

/// One-shot headless print for the cheap auto-title call. Mirrors
/// `claude_print_title` on the Cursor side. `default`/empty model = CLI default.
#[tauri::command]
pub fn cursor_print_text(prompt: String, model: Option<String>) -> Result<String, String> {
    let use_model = matches!(model.as_deref(), Some(m) if m != "default" && !m.is_empty());
    let mut args: Vec<&str> = vec!["-p", &prompt, "--output-format", "text"];
    if use_model {
        args.push("--model");
        args.push(model.as_deref().unwrap());
    }
    run_cursor_output(&args)
}

fn run_cursor_output(args: &[&str]) -> Result<String, String> {
    let bin = resolve_cursor_bin().ok_or_else(|| "Cursor CLI not found".to_string())?;
    match bin {
        CursorBin::Standalone(exe) => {
            let mut cmd = Command::new(exe);
            cmd.args(args);
            apply_clean_env(&mut cmd);
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x08000000);
            }
            let out = cmd.output().map_err(|e| e.to_string())?;
            if !out.status.success() {
                return Err(format!(
                    "cursor-agent failed: {}",
                    String::from_utf8_lossy(&out.stderr).trim()
                ));
            }
            Ok(String::from_utf8_lossy(&out.stdout).into_owned())
        }
        CursorBin::IdeSubcommand => {
            let joined = args
                .iter()
                .map(|a| shell_quote(a))
                .collect::<Vec<_>>()
                .join(" ");
            run_version_shell(&format!("cursor agent {joined}"))
        }
    }
}

fn parse_list_models(text: &str) -> Vec<CursorModelEntry> {
    let mut out = Vec::new();
    let mut started = false;
    for line in text.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        if line.starts_with("Tip:") {
            break;
        }
        if line == "Available models" {
            started = true;
            continue;
        }
        if !started {
            continue;
        }
        let Some((id, label)) = line.split_once(" - ") else {
            continue;
        };
        let id = id.trim().to_string();
        if id.is_empty() {
            continue;
        }
        let label = label.trim().to_string();
        let is_default = label.contains("(default)") || label.contains("(current)");
        out.push(CursorModelEntry {
            id,
            display_name: label,
            is_default,
        });
    }
    out
}

fn run_version(exe: &str) -> Result<String, String> {
    let mut cmd = Command::new(exe);
    cmd.arg("--version");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }
    let out = cmd.output().map_err(|e| e.to_string())?;
    if !out.status.success() {
        return Err(format!(
            "cursor-agent failed: {}",
            String::from_utf8_lossy(&out.stderr).trim()
        ));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

fn run_version_shell(shell_cmd: &str) -> Result<String, String> {
    #[cfg(windows)]
    {
        let mut cmd = Command::new("cmd");
        cmd.args(["/c", shell_cmd]);
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
        let out = cmd.output().map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
        return Ok(String::from_utf8_lossy(&out.stdout).trim().to_string());
    }
    #[cfg(not(windows))]
    {
        let out = Command::new("sh")
            .args(["-lc", shell_cmd])
            .output()
            .map_err(|e| e.to_string())?;
        if !out.status.success() {
            return Err(String::from_utf8_lossy(&out.stderr).trim().to_string());
        }
        Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
    }
}

fn apply_clean_env(cmd: &mut Command) {
    cmd.env("NO_COLOR", "1");
    cmd.env("CLICOLOR", "0");
    cmd.env("FORCE_COLOR", "0");
    cmd.env("TERM", "dumb");
    cmd.env("CI", "1");
}

fn shell_quote(s: &str) -> String {
    let mut out = String::with_capacity(s.len() + 2);
    out.push('"');
    for c in s.chars() {
        match c {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            _ => out.push(c),
        }
    }
    out.push('"');
    out
}

fn build_cursor_command(
    model: Option<&str>,
    resume: Option<&str>,
    cwd: Option<&str>,
    force: bool,
) -> Command {
    let model_to_pass = match model {
        Some("default") | Some("") => None,
        other => other,
    };
    let mut flags = String::from("-p --output-format stream-json --stream-partial-output");
    if force {
        flags.push_str(" --force");
    }
    if let Some(m) = model_to_pass {
        flags.push_str(" --model ");
        flags.push_str(&shell_quote(m));
    }
    if let Some(s) = resume {
        flags.push_str(" --resume ");
        flags.push_str(&shell_quote(s));
    }

    let bin = resolve_cursor_bin().expect("checked before spawn");
    let mut cmd = match bin {
        CursorBin::Standalone(exe) => {
            let mut c = Command::new(exe);
            c.arg("-p");
            c.arg("--output-format").arg("stream-json");
            c.arg("--stream-partial-output");
            if force {
                c.arg("--force");
            }
            if let Some(m) = model_to_pass {
                c.arg("--model").arg(m);
            }
            if let Some(s) = resume {
                c.arg("--resume").arg(s);
            }
            c
        }
        CursorBin::IdeSubcommand => {
            let shell_cmd = format!("cursor agent {flags}");
            #[cfg(windows)]
            {
                let mut c = Command::new("cmd");
                c.args(["/c", &shell_cmd]);
                c
            }
            #[cfg(not(windows))]
            {
                let mut c = Command::new("sh");
                c.args(["-lc", &shell_cmd]);
                c
            }
        }
    };
    if let Some(d) = cwd {
        cmd.current_dir(d);
    }
    apply_clean_env(&mut cmd);
    cmd
}

/// Spawn cursor-agent with stream-json output. Events emit on
/// `cursor-stream:<id>`. Returns the stream id.
#[tauri::command]
pub fn cursor_code_chat(
    app: AppHandle,
    state: State<'_, CursorCodeState>,
    prompt: String,
    cwd: Option<String>,
    model: Option<String>,
    resume_session_id: Option<String>,
    chat_session_id: Option<String>,
    force: Option<bool>,
) -> Result<String, String> {
    if resolve_cursor_bin().is_none() {
        return Err("Cursor CLI not found on PATH.".to_string());
    }
    let force = force.unwrap_or(true);
    let id = Uuid::new_v4().to_string();
    let event_name = format!("cursor-stream:{}", id);
    let chat_sid = chat_session_id.clone().unwrap_or_else(|| id.clone());
    {
        let mut streams = state.session_streams.lock();
        if let Some(prev) = streams.insert(chat_sid.clone(), id.clone()) {
            state.buffers.lock().remove(&prev);
        }
    }
    state.buffers.lock().insert(
        id.clone(),
        StreamBuffer {
            chat_session_id: chat_sid.clone(),
            lines: Vec::new(),
            ended: None,
        },
    );

    let mut cmd = build_cursor_command(
        model.as_deref(),
        resume_session_id.as_deref(),
        cwd.as_deref(),
        force,
    );
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    #[cfg(unix)]
    {
        use std::os::unix::process::CommandExt;
        cmd.process_group(0);
    }
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x0000_0200 | 0x0800_0000);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("failed to spawn cursor-agent: {}", e))?;

    if let Some(mut stdin) = child.stdin.take() {
        let prompt_bytes = prompt.into_bytes();
        thread::spawn(move || {
            let _ = stdin.write_all(&prompt_bytes);
        });
    }

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "no stdout from cursor-agent".to_string())?;
    let stderr = child.stderr.take();
    let pid = child.id();
    state.children.lock().insert(id.clone(), pid);

    let finished = Arc::new(AtomicBool::new(false));
    let started = Instant::now();
    let last_activity = Arc::new(AtomicI64::new(0));

    spawn_stdout_reader(app.clone(), event_name.clone(), id.clone(), stdout, started, last_activity.clone());
    if let Some(stderr) = stderr {
        spawn_stderr_reader(app.clone(), event_name.clone(), id.clone(), stderr, started, last_activity.clone());
    }
    spawn_watchdog(app.clone(), event_name.clone(), id.clone(), pid, finished.clone(), started, last_activity);
    spawn_waiter(app, event_name, id.clone(), child, finished);

    Ok(id)
}

fn spawn_stdout_reader(
    app: AppHandle,
    event_name: String,
    id: String,
    stdout: std::process::ChildStdout,
    started: Instant,
    last_activity: Arc<AtomicI64>,
) {
    thread::spawn(move || {
        let mut reader = BufReader::new(stdout);
        let mut buf = String::with_capacity(8 * 1024);
        loop {
            buf.clear();
            match reader.read_line(&mut buf) {
                Ok(0) => break,
                Ok(_) => {
                    let line = buf.trim_end_matches(&['\n', '\r'][..]).to_string();
                    if line.is_empty() {
                        continue;
                    }
                    last_activity.store(started.elapsed().as_millis() as i64, Ordering::Relaxed);
                    emit_line(&app, &event_name, &id, "line", Some(line), None);
                }
                Err(_) => break,
            }
        }
    });
}

fn spawn_stderr_reader(
    app: AppHandle,
    event_name: String,
    id: String,
    stderr: std::process::ChildStderr,
    started: Instant,
    last_activity: Arc<AtomicI64>,
) {
    thread::spawn(move || {
        let mut reader = BufReader::new(stderr);
        let mut buf = String::with_capacity(2 * 1024);
        loop {
            buf.clear();
            match reader.read_line(&mut buf) {
                Ok(0) => break,
                Ok(_) => {
                    let line = buf.trim_end_matches(&['\n', '\r'][..]).to_string();
                    if line.is_empty() {
                        continue;
                    }
                    last_activity.store(started.elapsed().as_millis() as i64, Ordering::Relaxed);
                    emit_line(&app, &event_name, &id, "stderr", Some(line), None);
                }
                Err(_) => break,
            }
        }
    });
}

fn emit_line(
    app: &AppHandle,
    event_name: &str,
    id: &str,
    kind: &str,
    line: Option<String>,
    code: Option<i32>,
) {
    let mut payload = serde_json::json!({ "kind": kind });
    if let Some(l) = line {
        payload["line"] = serde_json::Value::String(l);
    }
    if let Some(c) = code {
        payload["code"] = serde_json::json!(c);
    }
    if let Some(state) = app.try_state::<CursorCodeState>() {
        if let Some(buf) = state.buffers.lock().get_mut(id) {
            buf.lines.push(payload.clone());
        }
    }
    let _ = app.emit(event_name, payload);
}

fn spawn_watchdog(
    app: AppHandle,
    event_name: String,
    id: String,
    pid: u32,
    finished: Arc<AtomicBool>,
    started: Instant,
    last_activity: Arc<AtomicI64>,
) {
    thread::spawn(move || {
        loop {
            thread::sleep(Duration::from_secs(5));
            if finished.load(Ordering::Relaxed) {
                return;
            }
            let last = last_activity.load(Ordering::Relaxed);
            if last == 0 {
                continue;
            }
            let now = started.elapsed().as_millis() as i64;
            if now - last > IDLE_TIMEOUT.as_millis() as i64 {
                emit_line(
                    &app,
                    &event_name,
                    &id,
                    "stderr",
                    Some(format!(
                        "[cursor] no events for {}s — force-closing the stream.",
                        IDLE_TIMEOUT.as_secs()
                    )),
                    None,
                );
                kill_process_tree(pid);
                return;
            }
        }
    });
}

fn spawn_waiter(
    app: AppHandle,
    event_name: String,
    id: String,
    mut child: std::process::Child,
    finished: Arc<AtomicBool>,
) {
    thread::spawn(move || {
        let exit_code = match child.wait() {
            Ok(s) => s.code().unwrap_or(-1),
            Err(_) => -1,
        };
        finished.store(true, Ordering::Relaxed);
        emit_line(&app, &event_name, &id, "end", None, Some(exit_code));
        if let Some(state) = app.try_state::<CursorCodeState>() {
            if let Some(buf) = state.buffers.lock().get_mut(&id) {
                buf.ended = Some(exit_code);
            }
            state.children.lock().remove(&id);
        }
    });
}

#[cfg(unix)]
fn kill_process_tree(pid: u32) {
    unsafe {
        libc::kill(-(pid as i32), libc::SIGKILL);
    }
}

#[cfg(windows)]
fn kill_process_tree(pid: u32) {
    use std::os::windows::process::CommandExt;
    let _ = Command::new("taskkill")
        .args(["/PID", &pid.to_string(), "/T", "/F"])
        .creation_flags(0x0800_0000)
        .status();
}

/// Kill an in-flight cursor-agent process (and its subtree) by stream id.
#[tauri::command]
pub fn cursor_code_kill(state: State<'_, CursorCodeState>, id: String) -> Result<(), String> {
    if let Some(pid) = state.children.lock().get(&id).copied() {
        kill_process_tree(pid);
    }
    Ok(())
}

/// Kill by chat-tab session id — same lookup pattern as Claude Code.
#[tauri::command]
pub fn cursor_code_kill_session(
    state: State<'_, CursorCodeState>,
    chat_session_id: String,
) -> Result<(), String> {
    let stream_id = state
        .session_streams
        .lock()
        .get(&chat_session_id)
        .cloned();
    if let Some(stream_id) = stream_id {
        if let Some(pid) = state.children.lock().get(&stream_id).copied() {
            kill_process_tree(pid);
        }
    }
    Ok(())
}
