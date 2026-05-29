use std::{
  collections::{HashMap, VecDeque},
  fs,
  io::{Read, Write},
  path::{Path, PathBuf},
  sync::{Arc, Mutex},
};

use anyhow::{anyhow, Context, Result};
use once_cell::sync::Lazy;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use regex::Regex;
use serde::Serialize;
use tauri::{AppHandle, Emitter};
use tauri_plugin_store::StoreExt;
use uuid::Uuid;

#[derive(Default)]
pub(crate) struct TerminalRegistry {
  sessions: HashMap<String, TerminalSession>,
  order: Vec<String>,
  counter: usize,
}

pub(crate) struct TerminalSession {
  label: String,
  color: String,
  cwd: PathBuf,
  alive: bool,
  process: Option<TerminalProcess>,
  detected_port: Option<u16>,
  output_ring: OutputRingBuffer,
  working_on: Option<String>,
  avatar: Option<String>,
  branch: Option<String>,
}

struct TerminalProcess {
  master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
  writer: Arc<Mutex<Box<dyn Write + Send>>>,
  child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

// ─── Output Ring Buffer ────────────────────────────────────────
// Captures terminal output for Remote API polling (GET /api/terminals/:id/output).
// Stored per-session, fed by the PTY output thread alongside Tauri event emission.

struct OutputRingBuffer {
  lines: VecDeque<String>,
  pending: String,
  max_lines: usize,
  total_lines_seen: usize,
}

impl OutputRingBuffer {
  fn new(max_lines: usize) -> Self {
    Self { lines: VecDeque::with_capacity(max_lines), pending: String::new(), max_lines, total_lines_seen: 0 }
  }

  fn push(&mut self, text: &str) {
    self.pending.push_str(text);
    while let Some(pos) = self.pending.find('\n') {
      let line = self.pending[..pos].trim_end_matches('\r').to_string();
      self.pending.drain(..=pos);
      self.lines.push_back(line);
      self.total_lines_seen += 1;
      if self.lines.len() > self.max_lines {
        self.lines.pop_front();
      }
    }
  }

  fn last_n(&self, n: usize) -> Vec<String> {
    let start = self.lines.len().saturating_sub(n);
    self.lines.iter().skip(start).cloned().collect()
  }
}

impl Default for OutputRingBuffer {
  fn default() -> Self { Self::new(5000) }
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TerminalInfo {
  pub id: String,
  pub label: String,
  pub color: String,
  pub cwd: String,
  pub alive: bool,
  pub detected_port: Option<u16>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub working_on: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub avatar: Option<String>,
  #[serde(skip_serializing_if = "Option::is_none")]
  pub branch: Option<String>,
}

#[derive(Serialize, Clone)]
pub struct TerminalDataPayload {
  pub id: String,
  pub data: String,
}

#[derive(Serialize, Clone)]
pub struct TerminalExitPayload {
  pub id: String,
  pub code: u32,
  pub success: bool,
  pub message: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ProcessInfo {
  pub terminal_id: String,
  pub terminal_label: String,
  pub command: Option<String>,
  pub pid: Option<u32>,
  pub port: Option<u16>,
  pub uptime_seconds: u64,
  pub status: String, // "running" | "idle"
}

pub(crate) static REGISTRY: Lazy<Mutex<TerminalRegistry>> = Lazy::new(|| Mutex::new(TerminalRegistry::default()));

// Detect port from terminal output
fn detect_port_from_output(text: &str) -> Option<u16> {
  // Pattern per rilevare porte comuni nei dev server
  let patterns = [
    // http://localhost:3000 o https://localhost:3000
    r"https?://(?:localhost|127\.0\.0\.1):(\d{4,5})",
    // localhost:3000 o 127.0.0.1:3000
    r"(?:localhost|127\.0\.0\.1):(\d{4,5})",
    // port 3000 o Port: 3000
    r"[Pp]ort[:\s]+(\d{4,5})",
    // :3000 (da solo)
    r"(?:^|[^\d]):(\d{4,5})(?:[^\d]|$)",
  ];

  for pattern_str in &patterns {
    if let Ok(pattern) = Regex::new(pattern_str) {
      if let Some(captures) = pattern.captures(text) {
        if let Some(port_match) = captures.get(1) {
          if let Ok(port) = port_match.as_str().parse::<u16>() {
            // Valida range porte comuni dev server
            if (1024..=65535).contains(&port) {
              return Some(port);
            }
          }
        }
      }
    }
  }

  None
}


#[tauri::command]
pub fn create_terminal(
  app: AppHandle,
  id: Option<String>,
  label: Option<String>,
  color: Option<String>,
  cwd: Option<String>,
  working_on: Option<String>,
  avatar: Option<String>,
  branch: Option<String>,
) -> Result<TerminalInfo, String> {
  create_terminal_impl(&app, id, label, color, cwd, working_on, avatar, branch).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn list_terminals() -> Result<Vec<TerminalInfo>, String> {
  list_terminals_impl().map_err(|err| err.to_string())
}

pub(crate) fn list_terminals_impl() -> Result<Vec<TerminalInfo>> {
  let registry = REGISTRY
    .lock()
    .map_err(|_| anyhow!("Errore di sincronizzazione"))?;

  let mut result = Vec::with_capacity(registry.sessions.len());
  for id in &registry.order {
    if let Some(session) = registry.sessions.get(id) {
      result.push(compile_info(id, session));
    }
  }

  Ok(result)
}

#[tauri::command]
pub fn get_active_processes() -> Result<Vec<ProcessInfo>, String> {
  get_active_processes_impl().map_err(|err| err.to_string())
}

fn get_active_processes_impl() -> Result<Vec<ProcessInfo>> {
  let registry = REGISTRY
    .lock()
    .map_err(|_| anyhow!("Errore di sincronizzazione"))?;

  let mut processes = Vec::new();

  for (id, session) in &registry.sessions {
    // Include only alive terminals with detected ports
    if session.alive && session.detected_port.is_some() {
      processes.push(ProcessInfo {
        terminal_id: id.clone(),
        terminal_label: session.label.clone(),
        command: None, // Could be enhanced to track actual command
        pid: None,     // Could be enhanced to track PID
        port: session.detected_port,
        uptime_seconds: 0, // Could be enhanced to track uptime
        status: "running".to_string(),
      });
    }
  }

  Ok(processes)
}

#[tauri::command]
pub fn write_to_terminal(id: String, data: String) -> Result<(), String> {
  write_to_terminal_impl(&id, &data).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn resize_terminal(id: String, rows: u16, cols: u16) -> Result<(), String> {
  resize_terminal_impl(&id, rows, cols).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn close_terminal(id: String) -> Result<(), String> {
  close_terminal_impl(&id).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn terminal_exists(id: String) -> bool {
  let registry = match REGISTRY.lock() {
    Ok(r) => r,
    Err(_) => return false,
  };
  registry.sessions.contains_key(&id)
}

#[tauri::command]
pub fn set_terminal_color(id: String, color: String) -> Result<TerminalInfo, String> {
  set_terminal_color_impl(&id, color).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_terminal(
  id: String,
  label: Option<String>,
  color: Option<String>,
  cwd: Option<String>,
  working_on: Option<String>,
  avatar: Option<String>,
  branch: Option<String>,
) -> Result<TerminalInfo, String> {
  update_terminal_impl(&id, label, color, cwd, working_on, avatar, branch).map_err(|err| err.to_string())
}

#[tauri::command]
pub fn update_terminal_working_on(
  terminal_id: String,
  working_on: String,
) -> Result<TerminalInfo, String> {
  update_terminal(terminal_id, None, None, None, Some(working_on), None, None)
}

pub(crate) fn create_terminal_impl(
  app: &AppHandle,
  id_input: Option<String>,
  label: Option<String>,
  color: Option<String>,
  cwd_input: Option<String>,
  working_on: Option<String>,
  avatar: Option<String>,
  branch: Option<String>,
) -> Result<TerminalInfo> {
  let default_color = color.unwrap_or_else(|| "#4ecdc4".to_string());

  let mut registry = REGISTRY
    .lock()
    .map_err(|_| anyhow!("Errore di sincronizzazione"))?;

  let cwd = resolve_cwd(cwd_input)?;
  // Use provided ID if available, otherwise generate new UUID
  let id = id_input.unwrap_or_else(|| Uuid::new_v4().to_string());
  let display_label = label.unwrap_or_else(|| {
    registry.counter += 1;
    format!("Terminal {}", registry.counter)
  });

  let process = spawn_process(app, &id, &cwd, &[], None)?;

  let session = TerminalSession {
    label: display_label.clone(),
    color: default_color.clone(),
    cwd: cwd.clone(),
    alive: true,
    process: Some(process),
    detected_port: None,
    output_ring: OutputRingBuffer::default(),
    working_on: working_on.clone(),
    avatar: avatar.clone(),
    branch: branch.clone(),
  };

  registry.order.push(id.clone());
  registry.sessions.insert(id.clone(), session);

  Ok(TerminalInfo {
    id,
    label: display_label,
    color: default_color,
    cwd: cwd_to_string(&cwd),
    alive: true,
    detected_port: None,
    working_on,
    avatar,
    branch,
  })
}

/// WS-pivot: create a terminal that runs the interactive Claude Code CLI, with
/// Quack env injected so hooks can report status back. Also ensures the target
/// project's `.claude/settings.json` registers the `quack-status.js` hook.
/// Brain: 069-embedded-cli-hooks-pivot
#[tauri::command]
#[allow(clippy::too_many_arguments)]
pub fn create_agent_terminal(
  app: AppHandle,
  id: Option<String>,
  label: Option<String>,
  color: Option<String>,
  cwd: Option<String>,
  session_id: String,
  working_on: Option<String>,
  avatar: Option<String>,
  branch: Option<String>,
  cols: Option<u16>,
  rows: Option<u16>,
) -> Result<TerminalInfo, String> {
  create_agent_terminal_impl(
    &app, id, label, color, cwd, session_id, working_on, avatar, branch, cols, rows,
  )
  .map_err(|err| err.to_string())
}

#[allow(clippy::too_many_arguments)]
pub(crate) fn create_agent_terminal_impl(
  app: &AppHandle,
  id_input: Option<String>,
  label: Option<String>,
  color: Option<String>,
  cwd_input: Option<String>,
  session_id: String,
  working_on: Option<String>,
  avatar: Option<String>,
  branch: Option<String>,
  cols: Option<u16>,
  rows: Option<u16>,
) -> Result<TerminalInfo> {
  let default_color = color.unwrap_or_else(|| "#4ecdc4".to_string());
  let cwd = resolve_cwd(cwd_input)?;

  // Best-effort: register the status hook in the project's settings.json so the
  // CLI fires quack-status.js. Never block terminal creation on this.
  if let Err(err) = ensure_status_hooks_installed(&cwd) {
    log::warn!("[agent-terminal] hook install skipped: {err}");
  }

  // Resolve the Remote API runtime port + token (single source of truth).
  let remote_cfg = crate::remote_config::load_config(app);
  let port = if cfg!(debug_assertions) { remote_cfg.port + 1 } else { remote_cfg.port };
  let mut env_extra: Vec<(String, String)> = vec![
    ("QUACK_SESSION_ID".to_string(), session_id.clone()),
    ("QUACK_API_PORT".to_string(), port.to_string()),
    // Richer colors for the interactive CLI TUI (suppresses Claude's own tip).
    ("COLORTERM".to_string(), "truecolor".to_string()),
  ];
  if let Some(token) = remote_cfg.token {
    env_extra.push(("QUACK_HOOK_TOKEN".to_string(), token));
  }

  let mut registry = REGISTRY
    .lock()
    .map_err(|_| anyhow!("Errore di sincronizzazione"))?;

  let id = id_input.unwrap_or_else(|| Uuid::new_v4().to_string());
  let display_label = label.unwrap_or_else(|| {
    registry.counter += 1;
    format!("Agent {}", registry.counter)
  });

  let init_size = match (cols, rows) {
    (Some(c), Some(r)) => Some((c, r)),
    _ => None,
  };
  let process = spawn_process(app, &id, &cwd, &env_extra, init_size)?;

  let session = TerminalSession {
    label: display_label.clone(),
    color: default_color.clone(),
    cwd: cwd.clone(),
    alive: true,
    process: Some(process),
    detected_port: None,
    output_ring: OutputRingBuffer::default(),
    working_on: working_on.clone(),
    avatar: avatar.clone(),
    branch: branch.clone(),
  };

  registry.order.push(id.clone());
  registry.sessions.insert(id.clone(), session);

  Ok(TerminalInfo {
    id,
    label: display_label,
    color: default_color,
    cwd: cwd_to_string(&cwd),
    alive: true,
    detected_port: None,
    working_on,
    avatar,
    branch,
  })
}

/// Idempotently register the `quack-status.js` hook in a project's
/// `.claude/settings.json` for Stop / Notification / PermissionRequest /
/// UserPromptSubmit. Operates on raw JSON so existing hooks (of any event
/// type) are preserved. Writes only when something changed.
/// Brain: 069-embedded-cli-hooks-pivot
fn ensure_status_hooks_installed(cwd: &Path) -> Result<()> {
  use serde_json::{json, Value};

  const EVENTS: [&str; 4] = ["Stop", "Notification", "PermissionRequest", "UserPromptSubmit"];
  const MARKER: &str = "quack-status.js";

  let claude_dir = cwd.join(".claude");
  let settings_path = claude_dir.join("settings.json");

  let mut root: Value = if settings_path.exists() {
    let content = fs::read_to_string(&settings_path)?;
    serde_json::from_str(&content).unwrap_or_else(|_| json!({}))
  } else {
    json!({})
  };

  if !root.is_object() {
    root = json!({});
  }

  // Ensure root.hooks is an object.
  if !root.get("hooks").map(|v| v.is_object()).unwrap_or(false) {
    root["hooks"] = json!({});
  }

  let hook_entry = json!({
    "matcher": "",
    "hooks": [{
      "type": "command",
      "command": "node \"$HOME/.quack/hooks/brain/quack-status.js\"",
      "timeout": 5
    }]
  });

  let mut changed = false;
  for event in EVENTS {
    let arr = {
      let hooks = root["hooks"].as_object_mut().unwrap();
      hooks.entry(event.to_string()).or_insert_with(|| json!([]));
      hooks.get_mut(event).unwrap()
    };
    if !arr.is_array() {
      *arr = json!([]);
    }
    let already = arr
      .as_array()
      .map(|entries| {
        entries.iter().any(|matcher| {
          matcher
            .get("hooks")
            .and_then(|h| h.as_array())
            .map(|actions| {
              actions.iter().any(|a| {
                a.get("command")
                  .and_then(|c| c.as_str())
                  .map(|c| c.contains(MARKER))
                  .unwrap_or(false)
              })
            })
            .unwrap_or(false)
        })
      })
      .unwrap_or(false);

    if !already {
      arr.as_array_mut().unwrap().push(hook_entry.clone());
      changed = true;
    }
  }

  if changed {
    if !claude_dir.exists() {
      fs::create_dir_all(&claude_dir)?;
    }
    let pretty = serde_json::to_string_pretty(&root)?;
    fs::write(&settings_path, pretty)?;
    log::info!("[agent-terminal] installed quack-status hooks in {settings_path:?}");
  }

  Ok(())
}

pub(crate) fn write_to_terminal_impl(id: &str, data: &str) -> Result<()> {
  let writer = {
    let registry = REGISTRY
      .lock()
      .map_err(|_| anyhow!("Errore di sincronizzazione"))?;
    let session = registry
      .sessions
      .get(id)
      .ok_or_else(|| anyhow!("Terminale non trovato"))?;

    let process = session
      .process
      .as_ref()
      .ok_or_else(|| anyhow!("Il terminale non è più attivo"))?;

    Arc::clone(&process.writer)
  };

  let mut guard = writer
    .lock()
    .map_err(|_| anyhow!("Errore di sincronizzazione sul writer"))?;
  guard
    .write_all(data.as_bytes())
    .context("Impossibile scrivere sul terminale")?;
  guard
    .flush()
    .context("Impossibile completare la scrittura sul terminale")
}

fn resize_terminal_impl(id: &str, rows: u16, cols: u16) -> Result<()> {
  let master = {
    let registry = REGISTRY
      .lock()
      .map_err(|_| anyhow!("Errore di sincronizzazione"))?;
    let session = registry
      .sessions
      .get(id)
      .ok_or_else(|| anyhow!("Terminale non trovato"))?;
    let process = session
      .process
      .as_ref()
      .ok_or_else(|| anyhow!("Il terminale non è più attivo"))?;

    Arc::clone(&process.master)
  };

  let guard = master
    .lock()
    .map_err(|_| anyhow!("Errore di sincronizzazione sul master"))?;
  guard
    .resize(PtySize {
      rows,
      cols,
      pixel_width: 0,
      pixel_height: 0,
    })
    .context("Impossibile ridimensionare il terminale")
}

pub(crate) fn close_terminal_impl(id: &str) -> Result<()> {
  let process = {
    let mut registry = REGISTRY
      .lock()
      .map_err(|_| anyhow!("Errore di sincronizzazione"))?;
    if let Some(mut session) = registry.sessions.remove(id) {
      registry.order.retain(|entry| entry != id);
      session.process.take()
    } else {
      return Err(anyhow!("Terminale non trovato"));
    }
  };

  if let Some(process) = process {
    if let Ok(mut child) = process.child.lock() {
      let _ = child.kill();
      let _ = child.wait();
    }
  }

  Ok(())
}

fn set_terminal_color_impl(id: &str, color: String) -> Result<TerminalInfo> {
  let mut registry = REGISTRY
    .lock()
    .map_err(|_| anyhow!("Errore di sincronizzazione"))?;
  let session = registry
    .sessions
    .get_mut(id)
    .ok_or_else(|| anyhow!("Terminale non trovato"))?;
  session.color = color;
  Ok(compile_info(id, session))
}

fn update_terminal_impl(
  id: &str,
  label: Option<String>,
  color: Option<String>,
  cwd: Option<String>,
  working_on: Option<String>,
  avatar: Option<String>,
  branch: Option<String>,
) -> Result<TerminalInfo> {
  let mut registry = REGISTRY
    .lock()
    .map_err(|_| anyhow!("Errore di sincronizzazione"))?;

  let session = registry
    .sessions
    .get_mut(id)
    .ok_or_else(|| anyhow!("Terminale non trovato"))?;

  // Update label if provided
  if let Some(new_label) = label {
    session.label = new_label;
  }

  // Update color if provided
  if let Some(new_color) = color {
    session.color = new_color;
  }

  // Update cwd if provided and valid
  if let Some(cwd_input) = cwd {
    let new_cwd = resolve_cwd(Some(cwd_input))?;
    session.cwd = new_cwd;
  }

  // Update working_on if provided
  session.working_on = working_on;

  // Update avatar if provided
  session.avatar = avatar;

  // Update branch if provided
  session.branch = branch;

  Ok(compile_info(id, session))
}

fn spawn_process(
  app: &AppHandle,
  id: &str,
  cwd: &Path,
  env_extra: &[(String, String)],
  init_size: Option<(u16, u16)>,
) -> Result<TerminalProcess> {
  let pty_system = native_pty_system();
  // Spawn at the caller-provided size when known (agent terminals measure the
  // viewport up-front), so the shell/TUI starts at the FINAL size and no initial
  // resize SIGWINCH fires — that resize is what makes zsh/claude re-draw the
  // prompt and leave a duplicate in the scrollback. Falls back to 24x80.
  // Brain: 069-embedded-cli-hooks-pivot
  let (cols, rows) = init_size
    .map(|(c, r)| (c.max(20), r.max(5)))
    .unwrap_or((80, 24));
  let pair = pty_system
    .openpty(PtySize {
      rows,
      cols,
      pixel_width: 0,
      pixel_height: 0,
    })
    .context("Impossibile aprire il PTY")?;

  // Read shell preference from store (if available)
  let preferred_shell = app.store("app-preferences.json").ok()
    .and_then(|store| store.get("preferences"))
    .and_then(|v| serde_json::from_value::<serde_json::Value>(v.clone()).ok())
    .and_then(|v| v.get("default_shell")?.as_str().map(|s| s.to_string()));

  let shell = detect_shell_with_preference(preferred_shell.as_deref());
  let mut cmd = CommandBuilder::new(&shell);

  // Spawn as login shell so user profiles (.zshrc, .bash_profile) are sourced.
  // This ensures PATH from NVM, Volta, Homebrew, etc. is available.
  // We also inject the login-shell PATH as a baseline so the shell starts with
  // the user's PATH even before the profile finishes loading.
  // Brain: fix-shell-env-gui-launch
  #[cfg(not(target_os = "windows"))]
  cmd.arg("-l");

  // Set the login-shell PATH so tools are discoverable immediately.
  // The -l flag will re-source profiles which may override this, but having
  // it set upfront ensures the shell startup scripts themselves can find tools.
  cmd.env("PATH", crate::shell_env::get_login_path());
  cmd.env("TERM", "xterm-256color");
  cmd.cwd(cwd);

  // WS-pivot: inject Quack env (QUACK_SESSION_ID / QUACK_API_PORT / QUACK_HOOK_TOKEN)
  // so the interactive `claude` launched in this PTY — and its status hooks — can
  // report back to the running app. A login shell re-sources profiles but does not
  // unset these exported vars, so they survive into `claude`.
  // Brain: 069-embedded-cli-hooks-pivot
  for (key, value) in env_extra {
    cmd.env(key, value);
  }

  let child = pair
    .slave
    .spawn_command(cmd)
    .context("Impossibile avviare il processo del terminale")?;
  drop(pair.slave);

  let reader = pair
    .master
    .try_clone_reader()
    .context("Impossibile clonare il reader del PTY")?;
  let writer = pair
    .master
    .take_writer()
    .context("Impossibile ottenere il writer del PTY")?;

  let master_arc = Arc::new(Mutex::new(pair.master));
  let writer_arc = Arc::new(Mutex::new(writer));
  let child_arc = Arc::new(Mutex::new(child));

  start_output_thread(app.clone(), id.to_string(), reader, Arc::clone(&child_arc));

  Ok(TerminalProcess {
    master: master_arc,
    writer: writer_arc,
    child: child_arc,
  })
}

pub(crate) fn get_terminal_info(id: &str) -> Result<TerminalInfo> {
  let registry = REGISTRY.lock().map_err(|_| anyhow!("Sync error"))?;
  let session = registry.sessions.get(id).ok_or_else(|| anyhow!("Terminal not found"))?;
  Ok(compile_info(id, session))
}

static ANSI_RE: Lazy<Regex> = Lazy::new(|| {
  Regex::new(r"[\x1b\x9b][\[\]()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><~]|\x1b[PX^_].*?\x1b\\|\x1b\][^\x07]*\x07").unwrap()
});

pub(crate) fn read_terminal_output(id: &str, lines: usize, strip_ansi: bool) -> Result<(Vec<String>, usize, bool)> {
  let (mut output, total, alive) = {
    let registry = REGISTRY.lock().map_err(|_| anyhow!("Sync error"))?;
    let session = registry.sessions.get(id).ok_or_else(|| anyhow!("Terminal not found"))?;
    (session.output_ring.last_n(lines), session.output_ring.total_lines_seen, session.alive)
  };
  if strip_ansi {
    output = output.iter().map(|l| ANSI_RE.replace_all(l, "").to_string()).collect();
  }
  Ok((output, total, alive))
}

fn flush_and_store(app: &AppHandle, id: &str, text: &str) {
  if let Ok(mut reg) = REGISTRY.lock() {
    if let Some(session) = reg.sessions.get_mut(id) {
      session.output_ring.push(text);
      if let Some(port) = detect_port_from_output(text) {
        if session.detected_port != Some(port) {
          session.detected_port = Some(port);
          eprintln!("🦆 Detected port {} for terminal {}", port, session.label);
        }
      }
    }
  }
  let payload = TerminalDataPayload { id: id.to_string(), data: text.to_string() };
  let _ = app.emit("terminal-data", payload);
  if let Some(broadcast) = crate::remote_ws::WS_BROADCAST.get() {
    broadcast.send(crate::remote_ws::WsEvent::TerminalOutput {
      terminal_id: id.to_string(),
      data: text.to_string(),
    });
  }
}

fn start_output_thread(
  app: AppHandle,
  id: String,
  mut reader: Box<dyn Read + Send>,
  child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
) {
  std::thread::spawn(move || {
    // Channel-based architecture: a dedicated reader thread sends chunks
    // through a channel, while the main loop uses recv_timeout to ensure
    // buffered data is flushed even when the reader blocks (e.g. password
    // prompts that don't end with \n).
    // Brain: fix-pty-output-flush-blocking-read
    let (tx, rx) = std::sync::mpsc::channel::<Vec<u8>>();

    // Reader thread — blocks on PTY read, sends chunks through channel
    std::thread::spawn(move || {
      let mut buffer = [0u8; 65536]; // 64KB read buffer
      loop {
        match reader.read(&mut buffer) {
          Ok(0) => break,           // EOF
          Ok(size) => {
            if tx.send(buffer[..size].to_vec()).is_err() {
              break; // Receiver dropped
            }
          }
          Err(_) => break,
        }
      }
    });

    // Accumulator for adaptive batching
    let mut accumulated_bytes = Vec::with_capacity(131072); // 128KB capacity
    let mut last_flush = std::time::Instant::now();

    // Adaptive batch intervals based on data volume:
    // - Small input (likely user typing): flush almost immediately (1ms)
    // - Large output (command output): optimized batching (8ms)
    let min_flush_interval = std::time::Duration::from_millis(1);
    let max_flush_interval = std::time::Duration::from_millis(8);

    // Timeout for recv — ensures we flush buffered data even when the PTY
    // reader is blocked waiting for more output (e.g. password prompts)
    let recv_timeout = std::time::Duration::from_millis(10);

    loop {
      match rx.recv_timeout(recv_timeout) {
        Ok(data) => {
          // Check for critical chars that require immediate flush
          // \r (13) = Enter, \n (10) = Newline, \x03 (3) = Ctrl+C
          let has_critical_char = data.iter().any(|&b| b == 13 || b == 10 || b == 3);

          accumulated_bytes.extend_from_slice(&data);

          // Adaptive batching: small data = likely user input, flush fast
          let is_small_input = accumulated_bytes.len() < 64;
          let flush_interval = if is_small_input {
            min_flush_interval
          } else {
            max_flush_interval
          };

          // Flush on: critical chars OR timeout elapsed OR accumulator full (>64KB)
          let should_flush = has_critical_char
            || last_flush.elapsed() >= flush_interval
            || accumulated_bytes.len() >= 65536;

          if should_flush && !accumulated_bytes.is_empty() {
            let text = String::from_utf8_lossy(&accumulated_bytes).to_string();
            flush_and_store(&app, &id, &text);
            accumulated_bytes.clear();
            last_flush = std::time::Instant::now();
          }
        }
        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
          // Reader is blocked (e.g. process waiting for password input).
          // Flush any accumulated data so prompts without trailing \n are shown.
          if !accumulated_bytes.is_empty() {
            let text = String::from_utf8_lossy(&accumulated_bytes).to_string();
            flush_and_store(&app, &id, &text);
            accumulated_bytes.clear();
            last_flush = std::time::Instant::now();
          }
        }
        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break, // Reader thread exited
      }
    }

    // Flush any remaining data
    if !accumulated_bytes.is_empty() {
      let text = String::from_utf8_lossy(&accumulated_bytes).to_string();
      flush_and_store(&app, &id, &text);
    }

    let (code, success, message) = match child.lock() {
      Ok(mut handle) => match handle.wait() {
        Ok(status) => {
          let code = status.exit_code();
          let success = status.success();
          let description = if success {
            None
          } else {
            Some(status.to_string())
          };
          (code, success, description)
        }
        Err(error) => (
          1,
          false,
          Some(format!("Errore nel terminare il processo: {error}")),
        ),
      },
      Err(_) => (1, false, Some("Impossibile accedere al processo figlio".to_string())),
    };

    mark_terminal_exited(&id);

    let payload = TerminalExitPayload {
      id: id.clone(),
      code,
      success,
      message,
    };

    let _ = app.emit("terminal-exit", payload);
  });
}

fn mark_terminal_exited(id: &str) {
  if let Ok(mut registry) = REGISTRY.lock() {
    if let Some(session) = registry.sessions.get_mut(id) {
      session.alive = false;
      session.process = None;
    }
  }
}

fn resolve_cwd(cwd_input: Option<String>) -> Result<PathBuf> {
  if let Some(raw_path) = cwd_input {
    if raw_path.trim().is_empty() {
      return default_cwd();
    }

    let provided = PathBuf::from(raw_path);
    let canonical = fs::canonicalize(&provided)
      .or_else(|_| if provided.exists() { Ok(provided.clone()) } else { Err(anyhow!("Percorso non valido")) })?;

    if !canonical.is_dir() {
      return Err(anyhow!("Il percorso selezionato non è una cartella"));
    }

    return Ok(canonical);
  }

  default_cwd()
}

pub(crate) fn compile_info(id: &str, session: &TerminalSession) -> TerminalInfo {
  TerminalInfo {
    id: id.to_string(),
    label: session.label.clone(),
    color: session.color.clone(),
    cwd: cwd_to_string(&session.cwd),
    alive: session.alive,
    detected_port: session.detected_port,
    working_on: session.working_on.clone(),
    avatar: session.avatar.clone(),
    branch: session.branch.clone(),
  }
}

/// Detect the shell to use. If `preferred` is Some and the path exists, use it.
/// Otherwise fall back to $SHELL env var, then platform defaults.
fn detect_shell_with_preference(preferred: Option<&str>) -> String {
  // Check user preference first
  if let Some(pref) = preferred {
    if !pref.is_empty() && std::path::Path::new(pref).exists() {
      return pref.to_string();
    }
  }

  // Try SHELL env var (Unix)
  if let Ok(shell) = std::env::var("SHELL") {
    return shell;
  }

  // Windows-specific shell detection
  #[cfg(target_os = "windows")]
  {
    // Try PowerShell Core (pwsh) first
    let mut cmd = std::process::Command::new("where");
    cmd.arg("pwsh");

    // Windows: Hide console window
    {
      use std::os::windows::process::CommandExt;
      const CREATE_NO_WINDOW: u32 = 0x08000000;
      cmd.creation_flags(CREATE_NO_WINDOW);
    }

    if let Ok(output) = cmd.output() {
      if output.status.success() {
        if let Ok(path) = String::from_utf8(output.stdout) {
          if let Some(first_line) = path.lines().next() {
            return first_line.trim().to_string();
          }
        }
      }
    }

    // Fall back to Windows PowerShell
    if let Ok(system_root) = std::env::var("SystemRoot") {
      let powershell = format!("{}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe", system_root);
      if std::path::Path::new(&powershell).exists() {
        return powershell;
      }
    }

    // Last resort: cmd.exe
    if let Ok(comspec) = std::env::var("COMSPEC") {
      return comspec;
    }

    return "cmd.exe".to_string();
  }

  // Unix fallback
  #[cfg(not(target_os = "windows"))]
  {
    "/bin/bash".to_string()
  }
}

fn default_cwd() -> Result<PathBuf> {
  if let Ok(value) = std::env::var("PWD") {
    let path = PathBuf::from(value);
    if path.exists() {
      return Ok(path);
    }
  }

  if let Some(home) = dirs::home_dir() {
    return Ok(home);
  }

  std::env::current_dir().context("Impossibile determinare la cartella di lavoro")
}

fn cwd_to_string(path: &Path) -> String {
  path.to_string_lossy().to_string()
}

// Execute a command in a specific working directory and return the result
#[derive(Serialize)]
pub struct CommandResult {
  pub success: bool,
  pub stdout: String,
  pub stderr: String,
}

#[tauri::command]
pub fn execute_command(command: String, cwd: String) -> Result<CommandResult, String> {
  execute_command_impl(command, cwd).map_err(|err| err.to_string())
}

fn execute_command_impl(command: String, cwd: String) -> Result<CommandResult> {
  use std::process::Command;

  let cwd_path = PathBuf::from(&cwd);
  if !cwd_path.exists() || !cwd_path.is_dir() {
    return Err(anyhow!("Invalid working directory: {}", cwd));
  }

  // Parse the command (split by spaces, respecting quotes)
  let parts: Vec<&str> = command.split_whitespace().collect();
  if parts.is_empty() {
    return Err(anyhow!("Empty command"));
  }

  let program = parts[0];
  let args = &parts[1..];

  // Execute the command with the user's login-shell PATH so tools like
  // 'idea', 'ng', etc. installed via NVM/Homebrew are discoverable.
  // Brain: fix-shell-env-gui-launch
  let mut cmd = Command::new(program);
  cmd.args(args)
    .current_dir(cwd_path)
    .env("PATH", crate::shell_env::get_login_path());

  // Windows: Hide console window
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;
    cmd.creation_flags(CREATE_NO_WINDOW);
  }

  let output = cmd.output()
    .context(format!("Failed to execute command: {}", command))?;

  let stdout = String::from_utf8_lossy(&output.stdout).to_string();
  let stderr = String::from_utf8_lossy(&output.stderr).to_string();

  Ok(CommandResult {
    success: output.status.success(),
    stdout,
    stderr,
  })
}
