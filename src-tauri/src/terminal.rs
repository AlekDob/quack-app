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

static REGISTRY: Lazy<Mutex<TerminalRegistry>> = Lazy::new(|| Mutex::new(TerminalRegistry::default()));

#[tauri::command]
pub fn create_terminal(
  app: AppHandle,
  color: Option<String>,
  label: Option<String>,
  cwd: Option<String>,
) -> Result<TerminalInfo, String> {
  create_terminal_impl(&app, color, label, cwd).map_err(|err| err.to_string())
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
pub fn set_terminal_color(id: String, color: String) -> Result<TerminalInfo, String> {
  set_terminal_color_impl(&id, color).map_err(|err| err.to_string())
}

fn create_terminal_impl(
  app: &AppHandle,
  color: Option<String>,
  label: Option<String>,
  cwd_input: Option<String>,
) -> Result<TerminalInfo> {
  let default_color = color.unwrap_or_else(|| "#4ecdc4".to_string());

  let mut registry = REGISTRY
    .lock()
    .map_err(|_| anyhow!("Errore di sincronizzazione"))?;

  let cwd = resolve_cwd(cwd_input)?;
  let id = Uuid::new_v4().to_string();
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
  };

  registry.order.push(id.clone());
  registry.sessions.insert(id.clone(), session);

  Ok(TerminalInfo {
    id,
    label: display_label,
    color: default_color,
    cwd: cwd_to_string(&cwd),
    alive: true,
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

fn spawn_process(app: &AppHandle, id: &str, cwd: &Path) -> Result<TerminalProcess> {
  let pty_system = native_pty_system();
  let pair = pty_system
    .openpty(PtySize {
      rows: 24,
      cols: 80,
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
    let mut buffer = [0u8; 8192];

    loop {
      match reader.read(&mut buffer) {
        Ok(0) => break,
        Ok(size) => {
          let text = String::from_utf8_lossy(&buffer[..size]).to_string();
          let payload = TerminalDataPayload {
            id: id.clone(),
            data: text,
          };
          let _ = app.emit("terminal-data", payload);
        }
        Err(_) => break,
      }
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
  }
}

fn detect_shell() -> String {
  std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
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
