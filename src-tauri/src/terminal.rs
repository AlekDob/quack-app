use std::{
  collections::HashMap,
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
use uuid::Uuid;

#[derive(Default)]
struct TerminalRegistry {
  sessions: HashMap<String, TerminalSession>,
  order: Vec<String>,
  counter: usize,
}

struct TerminalSession {
  label: String,
  color: String,
  cwd: PathBuf,
  alive: bool,
  process: Option<TerminalProcess>,
  detected_port: Option<u16>,
  output_buffer: String,
  working_on: Option<String>,
  avatar: Option<String>,
  branch: Option<String>,
}

struct TerminalProcess {
  master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
  writer: Arc<Mutex<Box<dyn Write + Send>>>,
  child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
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

static REGISTRY: Lazy<Mutex<TerminalRegistry>> = Lazy::new(|| Mutex::new(TerminalRegistry::default()));

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

// Update detected port for terminal
fn update_terminal_port(id: &str, port: u16) {
  if let Ok(mut registry) = REGISTRY.lock() {
    if let Some(session) = registry.sessions.get_mut(id) {
      if session.detected_port != Some(port) {
        session.detected_port = Some(port);
        eprintln!("🦆 Detected port {} for terminal {}", port, session.label);
      }
    }
  }
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

fn list_terminals_impl() -> Result<Vec<TerminalInfo>> {
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

fn create_terminal_impl(
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

  let process = spawn_process(app, &id, &cwd)?;

  let session = TerminalSession {
    label: display_label.clone(),
    color: default_color.clone(),
    cwd: cwd.clone(),
    alive: true,
    process: Some(process),
    detected_port: None,
    output_buffer: String::new(),
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

fn write_to_terminal_impl(id: &str, data: &str) -> Result<()> {
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

fn close_terminal_impl(id: &str) -> Result<()> {
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

fn spawn_process(app: &AppHandle, id: &str, cwd: &Path) -> Result<TerminalProcess> {
  let pty_system = native_pty_system();
  // Dimensioni iniziali conservative per evitare problemi di sync
  // Il frontend farà resize immediato appena il terminale viene montato
  // Usando dimensioni piccole (24x80) evitiamo il problema delle righe vuote
  // durante il caricamento iniziale quando XTerm.js non è ancora pronto
  let pair = pty_system
    .openpty(PtySize {
      rows: 24,  // Standard terminal height
      cols: 80,  // Standard terminal width
      pixel_width: 0,
      pixel_height: 0,
    })
    .context("Impossibile aprire il PTY")?;

  let shell = detect_shell();
  let mut cmd = CommandBuilder::new(shell);
  cmd.env("TERM", "xterm-256color");
  cmd.cwd(cwd);

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

fn start_output_thread(
  app: AppHandle,
  id: String,
  mut reader: Box<dyn Read + Send>,
  child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
) {
  std::thread::spawn(move || {
    // Performance: buffer più grande per leggere più dati per volta
    let mut buffer = [0u8; 65536]; // 64KB invece di 8KB

    // Performance: accumulator per batching temporale ADATTIVO
    let mut accumulated_bytes = Vec::with_capacity(131072); // 128KB capacity
    let mut last_flush = std::time::Instant::now();

    // Performance: batch interval ADATTIVO basato sul volume di dati
    // - Input utente (pochi bytes): flush quasi immediato (1ms)
    // - Output massiccio (molti bytes): batch ottimizzato (8ms) per output fluido
    let min_flush_interval = std::time::Duration::from_millis(1);
    let max_flush_interval = std::time::Duration::from_millis(8);

    loop {
      match reader.read(&mut buffer) {
        Ok(0) => break,
        Ok(size) => {
          // Aggiungi bytes all'accumulator
          accumulated_bytes.extend_from_slice(&buffer[..size]);

          // Check se ci sono caratteri critici che richiedono flush immediato
          // \r (13) = Enter, \n (10) = Newline, \x03 (3) = Ctrl+C
          let has_critical_char = buffer[..size].iter().any(|&b| b == 13 || b == 10 || b == 3);

          // Batching ADATTIVO: se pochi dati (probabile input utente), flush rapido
          let is_small_input = accumulated_bytes.len() < 64; // < 64 bytes = probabilmente input utente
          let flush_interval = if is_small_input {
            min_flush_interval // 1ms per input responsivo
          } else {
            max_flush_interval // 50ms per output massiccio
          };

          // Flush se: caratteri critici O timeout scaduto O accumulator troppo grande (>64KB)
          let should_flush = has_critical_char
            || last_flush.elapsed() >= flush_interval
            || accumulated_bytes.len() >= 65536;

          if should_flush && !accumulated_bytes.is_empty() {
            // Converti tutto in una volta sola
            let text = String::from_utf8_lossy(&accumulated_bytes).to_string();

            // Port detection solo al flush (non su ogni chunk)
            if let Some(port) = detect_port_from_output(&text) {
              update_terminal_port(&id, port);
            }

            let payload = TerminalDataPayload {
              id: id.clone(),
              data: text,
            };
            let _ = app.emit("terminal-data", payload);

            // Reset accumulator
            accumulated_bytes.clear();
            last_flush = std::time::Instant::now();
          }
        }
        Err(_) => break,
      }
    }

    // Flush eventuali dati rimanenti
    if !accumulated_bytes.is_empty() {
      let text = String::from_utf8_lossy(&accumulated_bytes).to_string();
      if let Some(port) = detect_port_from_output(&text) {
        update_terminal_port(&id, port);
      }
      let payload = TerminalDataPayload {
        id: id.clone(),
        data: text,
      };
      let _ = app.emit("terminal-data", payload);
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

fn compile_info(id: &str, session: &TerminalSession) -> TerminalInfo {
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

fn detect_shell() -> String {
  // Try SHELL env var first (Unix)
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

  // Execute the command
  let mut cmd = Command::new(program);
  cmd.args(args).current_dir(cwd_path);

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
