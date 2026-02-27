//! Automation Module
//!
//! Cron-based scheduler for automated agent sessions.
//! Uses tokio interval (30s) + cron crate for expression parsing.
//!
//! The scheduler runs only while Quack is open (desktop app constraint).

use std::collections::HashMap;
use std::sync::Mutex;

use chrono::Local;
use cron::Schedule;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager};

// ─── Data Model ─────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationJobRust {
    pub id: String,
    pub name: String,
    pub cron_expression: String,
    pub agent_id: String,
    pub agent_name: String,
    pub project_path: String,
    pub project_name: String,
    pub prompt_template: String,
    pub model: Option<String>,
    pub enabled: bool,
    pub timeout_minutes: Option<u64>,
    pub next_run_at: Option<i64>,
    pub skip_if_running: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AutomationFireEvent {
    pub job_id: String,
    pub job_name: String,
    pub agent_id: String,
    pub agent_name: String,
    pub project_path: String,
    pub project_name: String,
    pub prompt: String,
    pub model: Option<String>,
    pub timeout_minutes: Option<u64>,
}

// ─── Scheduler State ────────────────────────────────────────────────

pub struct AutomationScheduler {
    /// Currently running job IDs (for skipIfRunning check)
    running_jobs: Mutex<HashMap<String, bool>>,
    /// Flag to stop the scheduler loop
    active: Mutex<bool>,
}

impl AutomationScheduler {
    pub fn new() -> Self {
        Self {
            running_jobs: Mutex::new(HashMap::new()),
            active: Mutex::new(false),
        }
    }
}

impl Default for AutomationScheduler {
    fn default() -> Self {
        Self::new()
    }
}

// ─── Cron Helpers ───────────────────────────────────────────────────

/// Convert 5-field cron to 7-field (add seconds=0, year=*)
fn to_seven_field_cron(expr: &str) -> String {
    let parts: Vec<&str> = expr.trim().split_whitespace().collect();
    if parts.len() == 5 {
        format!("0 {} *", expr.trim())
    } else {
        expr.to_string()
    }
}

// ─── Tauri Commands ─────────────────────────────────────────────────

/// Start the automation scheduler loop
#[tauri::command]
pub async fn start_automation_scheduler(app: AppHandle) -> Result<(), String> {
    let scheduler = app.state::<AutomationScheduler>();

    // Check if already running
    {
        let active = scheduler.active.lock().map_err(|e| e.to_string())?;
        if *active {
            log::debug!("[Automation] Scheduler already running");
            return Ok(());
        }
    }

    // Mark as active
    {
        let mut active = scheduler.active.lock().map_err(|e| e.to_string())?;
        *active = true;
    }

    log::info!("[Automation] Starting scheduler loop (30s interval)");

    let app_handle = app.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(30));

        loop {
            interval.tick().await;

            // Check if scheduler is still active
            let scheduler = app_handle.state::<AutomationScheduler>();
            let is_active = scheduler.active.lock().map(|a| *a).unwrap_or(false);
            if !is_active {
                log::info!("[Automation] Scheduler stopped");
                break;
            }

            // Emit tick event — frontend checks jobs and fires if needed
            if let Err(e) = app_handle.emit("automation-scheduler-tick", ()) {
                log::error!("[Automation] Failed to emit tick: {}", e);
            }
        }
    });

    Ok(())
}

/// Stop the automation scheduler
#[tauri::command]
pub async fn stop_automation_scheduler(app: AppHandle) -> Result<(), String> {
    let scheduler = app.state::<AutomationScheduler>();
    let mut active = scheduler.active.lock().map_err(|e| e.to_string())?;
    *active = false;
    log::info!("[Automation] Scheduler stop requested");
    Ok(())
}

/// Check if a cron expression is valid
#[tauri::command]
pub fn validate_cron_expression(expression: String) -> Result<bool, String> {
    let seven = to_seven_field_cron(&expression);
    Ok(seven.parse::<Schedule>().is_ok())
}

/// Calculate the next N fire times for a cron expression
#[tauri::command]
pub fn get_cron_next_fires(expression: String, count: Option<usize>) -> Result<Vec<i64>, String> {
    let seven = to_seven_field_cron(&expression);
    let schedule = seven.parse::<Schedule>()
        .map_err(|e| format!("Invalid cron: {}", e))?;

    let n = count.unwrap_or(5);
    let fires: Vec<i64> = schedule
        .upcoming(Local)
        .take(n)
        .map(|dt| dt.timestamp_millis())
        .collect();

    Ok(fires)
}

/// Mark a job as running (for skipIfRunning logic)
#[tauri::command]
pub async fn mark_automation_job_running(
    app: AppHandle,
    job_id: String,
) -> Result<(), String> {
    let scheduler = app.state::<AutomationScheduler>();
    let mut running = scheduler.running_jobs.lock().map_err(|e| e.to_string())?;
    running.insert(job_id, true);
    Ok(())
}

/// Mark a job as completed (remove from running set)
#[tauri::command]
pub async fn mark_automation_job_completed(
    app: AppHandle,
    job_id: String,
) -> Result<(), String> {
    let scheduler = app.state::<AutomationScheduler>();
    let mut running = scheduler.running_jobs.lock().map_err(|e| e.to_string())?;
    running.remove(&job_id);
    Ok(())
}

/// Check if a job is currently running
#[tauri::command]
pub async fn is_automation_job_running(
    app: AppHandle,
    job_id: String,
) -> Result<bool, String> {
    let scheduler = app.state::<AutomationScheduler>();
    let running = scheduler.running_jobs.lock().map_err(|e| e.to_string())?;
    Ok(running.contains_key(&job_id))
}

/// Fire an automation job — emits event for frontend to create session
#[tauri::command]
pub async fn fire_automation_job(
    app: AppHandle,
    job: AutomationJobRust,
) -> Result<(), String> {
    log::info!(
        "[Automation] Firing job '{}' (agent: {}, project: {})",
        job.name, job.agent_name, job.project_name
    );

    let event = AutomationFireEvent {
        job_id: job.id.clone(),
        job_name: job.name,
        agent_id: job.agent_id,
        agent_name: job.agent_name,
        project_path: job.project_path,
        project_name: job.project_name,
        prompt: job.prompt_template,
        model: job.model,
        timeout_minutes: job.timeout_minutes,
    };

    app.emit("automation-job-firing", &event)
        .map_err(|e| format!("Failed to emit fire event: {}", e))?;

    Ok(())
}
