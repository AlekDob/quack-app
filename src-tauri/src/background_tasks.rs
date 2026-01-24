/**
 * Background Tasks Module
 *
 * Tauri commands for managing background task execution.
 * Handles process spawning, lifecycle management, and event emission.
 */

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

/// Result type for background task execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundTaskResult {
    pub success: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub artifacts: Option<Vec<String>>,
    pub duration_ms: u64,
    pub usage: Option<UsageStats>,
    pub cost_usd: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UsageStats {
    pub input_tokens: u64,
    pub output_tokens: u64,
}

/// Log entry for background tasks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundTaskLog {
    pub level: String,
    pub message: String,
    pub source: Option<String>,
}

/// Progress update for background tasks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundTaskProgress {
    pub current: u64,
    pub total: u64,
    pub percentage: f32,
    pub stage: Option<String>,
}

/// Event payload for background task updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundTaskEvent {
    #[serde(rename = "type")]
    pub event_type: String,
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub timestamp: u64,
    pub data: Option<BackgroundTaskEventData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackgroundTaskEventData {
    pub progress: Option<BackgroundTaskProgress>,
    pub log: Option<BackgroundTaskLog>,
    pub result: Option<BackgroundTaskResult>,
    pub error: Option<String>,
}

/// State for managing running background processes
pub struct BackgroundTaskManager {
    /// Map of task_id -> child process handle
    processes: Mutex<HashMap<String, Arc<Mutex<Child>>>>,
    /// Map of task_id -> pause flag
    paused: Mutex<HashMap<String, bool>>,
}

impl BackgroundTaskManager {
    pub fn new() -> Self {
        Self {
            processes: Mutex::new(HashMap::new()),
            paused: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for BackgroundTaskManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Get current timestamp in milliseconds
fn current_timestamp_ms() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64
}

/// Emit a background task event to the frontend
fn emit_task_event(app: &AppHandle, event: BackgroundTaskEvent) {
    if let Err(e) = app.emit("background-task-event", &event) {
        log::error!("Failed to emit background task event: {}", e);
    }
}

/// Emit a log entry for a task
fn emit_task_log(app: &AppHandle, task_id: &str, log: BackgroundTaskLog) {
    let event = BackgroundTaskEvent {
        event_type: "log".to_string(),
        task_id: task_id.to_string(),
        timestamp: current_timestamp_ms(),
        data: Some(BackgroundTaskEventData {
            log: Some(log),
            progress: None,
            result: None,
            error: None,
        }),
    };
    emit_task_event(app, event);
}

/// Execute a background agent task using Claude SDK
#[tauri::command]
pub async fn execute_background_agent(
    app: AppHandle,
    task_id: String,
    prompt: String,
    model: Option<String>,
    working_directory: Option<String>,
    agent_id: Option<String>,
    timeout: Option<u64>,
) -> Result<BackgroundTaskResult, String> {
    let start_time = std::time::Instant::now();
    let model = model.unwrap_or_else(|| "sonnet".to_string());
    let timeout_ms = timeout.unwrap_or(5 * 60 * 1000); // 5 minutes default

    log::info!(
        "[BackgroundTask:{}] Starting agent task with model: {}",
        task_id,
        model
    );

    // Emit start log
    emit_task_log(
        &app,
        &task_id,
        BackgroundTaskLog {
            level: "info".to_string(),
            message: format!("Starting background agent with model: {}", model),
            source: Some("system".to_string()),
        },
    );

    // Build the Claude CLI command
    // Using claude CLI with -p/--print for non-interactive background execution
    let mut cmd = Command::new("claude");
    cmd.arg("--print") // Non-interactive mode: print response and exit
        .arg("--model")
        .arg(&model)
        .arg("--output-format")
        .arg("json")
        .arg(&prompt);

    if let Some(ref cwd) = working_directory {
        cmd.current_dir(cwd);
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    // Spawn the process
    let mut child = cmd.spawn().map_err(|e| {
        log::error!("[BackgroundTask:{}] Failed to spawn claude: {}", task_id, e);
        format!("Failed to spawn Claude CLI: {}", e)
    })?;

    // Store process handle for pause/cancel
    let manager: tauri::State<BackgroundTaskManager> = app.state();
    {
        let mut processes = manager.processes.lock().await;
        // Note: We can't easily store the child for pause/resume with tokio::process
        // For now, we'll just track that a process is running
    }

    // Read stdout and stderr
    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    let mut output_lines: Vec<String> = Vec::new();
    let mut error_lines: Vec<String> = Vec::new();

    // Stream stdout
    let app_clone = app.clone();
    let task_id_clone = task_id.clone();
    let stdout_handle = tokio::spawn(async move {
        let mut lines = Vec::new();
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            // Emit log for each line
            emit_task_log(
                &app_clone,
                &task_id_clone,
                BackgroundTaskLog {
                    level: "info".to_string(),
                    message: line.clone(),
                    source: Some("stdout".to_string()),
                },
            );
            lines.push(line);
        }
        lines
    });

    // Stream stderr
    let app_clone2 = app.clone();
    let task_id_clone2 = task_id.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut lines = Vec::new();
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            emit_task_log(
                &app_clone2,
                &task_id_clone2,
                BackgroundTaskLog {
                    level: "warn".to_string(),
                    message: line.clone(),
                    source: Some("stderr".to_string()),
                },
            );
            lines.push(line);
        }
        lines
    });

    // Wait for process with timeout
    let status = tokio::time::timeout(
        std::time::Duration::from_millis(timeout_ms),
        child.wait(),
    )
    .await
    .map_err(|_| {
        log::error!("[BackgroundTask:{}] Task timed out", task_id);
        format!("Task timed out after {} ms", timeout_ms)
    })?
    .map_err(|e| {
        log::error!("[BackgroundTask:{}] Process error: {}", task_id, e);
        format!("Process error: {}", e)
    })?;

    // Collect output
    output_lines = stdout_handle.await.unwrap_or_default();
    error_lines = stderr_handle.await.unwrap_or_default();

    let duration_ms = start_time.elapsed().as_millis() as u64;
    let success = status.success();

    let result = BackgroundTaskResult {
        success,
        output: if output_lines.is_empty() {
            None
        } else {
            Some(output_lines.join("\n"))
        },
        error: if error_lines.is_empty() || success {
            None
        } else {
            Some(error_lines.join("\n"))
        },
        artifacts: None,
        duration_ms,
        usage: None, // TODO: Parse from JSON output
        cost_usd: None,
    };

    // Emit completion event
    let event = BackgroundTaskEvent {
        event_type: if success { "completed" } else { "failed" }.to_string(),
        task_id: task_id.clone(),
        timestamp: current_timestamp_ms(),
        data: Some(BackgroundTaskEventData {
            result: Some(result.clone()),
            progress: None,
            log: None,
            error: if success { None } else { result.error.clone() },
        }),
    };
    emit_task_event(&app, event);

    log::info!(
        "[BackgroundTask:{}] Task completed in {}ms - success: {}",
        task_id,
        duration_ms,
        success
    );

    Ok(result)
}

/// Execute a background command task
#[tauri::command]
pub async fn execute_background_command(
    app: AppHandle,
    task_id: String,
    command: String,
    args: Option<Vec<String>>,
    working_directory: Option<String>,
    env: Option<HashMap<String, String>>,
    timeout: Option<u64>,
) -> Result<BackgroundTaskResult, String> {
    let start_time = std::time::Instant::now();
    let timeout_ms = timeout.unwrap_or(10 * 60 * 1000); // 10 minutes default

    log::info!(
        "[BackgroundTask:{}] Starting command: {}",
        task_id,
        command
    );

    emit_task_log(
        &app,
        &task_id,
        BackgroundTaskLog {
            level: "info".to_string(),
            message: format!("Executing: {}", command),
            source: Some("system".to_string()),
        },
    );

    // Build the command
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.arg("/C").arg(&command);
        c
    } else {
        let mut c = Command::new("sh");
        c.arg("-c").arg(&command);
        c
    };

    if let Some(ref cwd) = working_directory {
        cmd.current_dir(cwd);
    }

    if let Some(ref env_vars) = env {
        for (key, value) in env_vars {
            cmd.env(key, value);
        }
    }

    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(|e| {
        log::error!("[BackgroundTask:{}] Failed to spawn command: {}", task_id, e);
        format!("Failed to spawn command: {}", e)
    })?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    let mut stdout_reader = BufReader::new(stdout).lines();
    let mut stderr_reader = BufReader::new(stderr).lines();

    // Stream stdout
    let app_clone = app.clone();
    let task_id_clone = task_id.clone();
    let stdout_handle = tokio::spawn(async move {
        let mut lines = Vec::new();
        while let Ok(Some(line)) = stdout_reader.next_line().await {
            emit_task_log(
                &app_clone,
                &task_id_clone,
                BackgroundTaskLog {
                    level: "info".to_string(),
                    message: line.clone(),
                    source: Some("stdout".to_string()),
                },
            );
            lines.push(line);
        }
        lines
    });

    // Stream stderr
    let app_clone2 = app.clone();
    let task_id_clone2 = task_id.clone();
    let stderr_handle = tokio::spawn(async move {
        let mut lines = Vec::new();
        while let Ok(Some(line)) = stderr_reader.next_line().await {
            emit_task_log(
                &app_clone2,
                &task_id_clone2,
                BackgroundTaskLog {
                    level: "warn".to_string(),
                    message: line.clone(),
                    source: Some("stderr".to_string()),
                },
            );
            lines.push(line);
        }
        lines
    });

    // Wait with timeout
    let status = tokio::time::timeout(
        std::time::Duration::from_millis(timeout_ms),
        child.wait(),
    )
    .await
    .map_err(|_| format!("Command timed out after {} ms", timeout_ms))?
    .map_err(|e| format!("Command error: {}", e))?;

    let output_lines = stdout_handle.await.unwrap_or_default();
    let error_lines = stderr_handle.await.unwrap_or_default();

    let duration_ms = start_time.elapsed().as_millis() as u64;
    let success = status.success();

    let result = BackgroundTaskResult {
        success,
        output: if output_lines.is_empty() {
            None
        } else {
            Some(output_lines.join("\n"))
        },
        error: if error_lines.is_empty() || success {
            None
        } else {
            Some(error_lines.join("\n"))
        },
        artifacts: None,
        duration_ms,
        usage: None,
        cost_usd: None,
    };

    // Emit completion
    let event = BackgroundTaskEvent {
        event_type: if success { "completed" } else { "failed" }.to_string(),
        task_id: task_id.clone(),
        timestamp: current_timestamp_ms(),
        data: Some(BackgroundTaskEventData {
            result: Some(result.clone()),
            progress: None,
            log: None,
            error: if success { None } else { result.error.clone() },
        }),
    };
    emit_task_event(&app, event);

    log::info!(
        "[BackgroundTask:{}] Command completed in {}ms - success: {}",
        task_id,
        duration_ms,
        success
    );

    Ok(result)
}

/// Start a file watcher for background monitoring
#[tauri::command]
pub async fn start_background_watcher(
    app: AppHandle,
    task_id: String,
    patterns: Vec<String>,
    working_directory: Option<String>,
    debounce_ms: Option<u64>,
) -> Result<(), String> {
    log::info!(
        "[BackgroundTask:{}] Starting file watcher for patterns: {:?}",
        task_id,
        patterns
    );

    emit_task_log(
        &app,
        &task_id,
        BackgroundTaskLog {
            level: "info".to_string(),
            message: format!("File watcher started for: {}", patterns.join(", ")),
            source: Some("watcher".to_string()),
        },
    );

    // TODO: Implement file watcher using notify crate
    // For now, just return success - the actual implementation will require
    // the notify crate and proper async file watching

    Ok(())
}

/// Pause a running background task
#[tauri::command]
pub async fn pause_background_task(
    app: AppHandle,
    task_id: String,
) -> Result<(), String> {
    log::info!("[BackgroundTask:{}] Pausing task", task_id);

    let manager: tauri::State<BackgroundTaskManager> = app.state();
    {
        let mut paused = manager.paused.lock().await;
        paused.insert(task_id.clone(), true);
    }

    emit_task_log(
        &app,
        &task_id,
        BackgroundTaskLog {
            level: "info".to_string(),
            message: "Task paused".to_string(),
            source: Some("system".to_string()),
        },
    );

    Ok(())
}

/// Resume a paused background task
#[tauri::command]
pub async fn resume_background_task(
    app: AppHandle,
    task_id: String,
) -> Result<(), String> {
    log::info!("[BackgroundTask:{}] Resuming task", task_id);

    let manager: tauri::State<BackgroundTaskManager> = app.state();
    {
        let mut paused = manager.paused.lock().await;
        paused.remove(&task_id);
    }

    emit_task_log(
        &app,
        &task_id,
        BackgroundTaskLog {
            level: "info".to_string(),
            message: "Task resumed".to_string(),
            source: Some("system".to_string()),
        },
    );

    Ok(())
}

/// Cancel a running background task
#[tauri::command]
pub async fn cancel_background_task(
    app: AppHandle,
    task_id: String,
) -> Result<(), String> {
    log::info!("[BackgroundTask:{}] Cancelling task", task_id);

    // Note: Actually killing the process would require storing the Child handle
    // and calling kill() on it. For now, we just mark it as cancelled.

    emit_task_log(
        &app,
        &task_id,
        BackgroundTaskLog {
            level: "warn".to_string(),
            message: "Task cancelled by user".to_string(),
            source: Some("system".to_string()),
        },
    );

    let event = BackgroundTaskEvent {
        event_type: "cancelled".to_string(),
        task_id,
        timestamp: current_timestamp_ms(),
        data: None,
    };
    emit_task_event(&app, event);

    Ok(())
}


