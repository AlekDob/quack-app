/**
 * Git Branch Watcher Module
 *
 * Watches .git/HEAD for changes to detect branch switches in real-time.
 * Emits "git:branch-changed" events so the frontend can update the UI.
 */

use notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, FileIdMap};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};
use tokio::sync::Mutex;

use crate::git::git_root;

/// Event payload emitted when the git branch changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBranchChangedEvent {
    #[serde(rename = "projectPath")]
    pub project_path: String,
    pub branch: String,
}

/// Manager for git branch watchers (one per project)
pub struct GitBranchWatcherManager {
    watchers: Arc<Mutex<HashMap<String, Debouncer<RecommendedWatcher, FileIdMap>>>>,
}

impl GitBranchWatcherManager {
    pub fn new() -> Self {
        Self {
            watchers: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    pub async fn start_watching(
        &self,
        app: AppHandle,
        project_path: String,
    ) -> Result<(), String> {
        let mut watchers = self.watchers.lock().await;

        // Idempotent: already watching this project
        if watchers.contains_key(&project_path) {
            return Ok(());
        }

        // Resolve git root
        let root = git_root(Some(PathBuf::from(&project_path)))
            .map_err(|e| format!("Not a git repository: {}", e))?;

        // Determine .git/HEAD path (handle worktrees)
        let head_path = resolve_head_path(&root)?;

        if !head_path.exists() {
            return Err(format!(".git/HEAD not found at: {}", head_path.display()));
        }

        let watch_dir = head_path
            .parent()
            .ok_or("Cannot determine parent of HEAD file")?
            .to_path_buf();

        log::info!(
            "[GitBranchWatcher] Watching HEAD at: {}",
            head_path.display()
        );

        let project_path_clone = project_path.clone();
        let head_path_clone = head_path.clone();

        let mut debouncer = new_debouncer(
            Duration::from_millis(200),
            None,
            move |result: DebounceEventResult| {
                match result {
                    Ok(events) => {
                        // Check if any event involves our HEAD file
                        let head_changed = events.iter().any(|e| {
                            e.event.paths.iter().any(|p| p.ends_with("HEAD"))
                        });

                        if head_changed {
                            if let Ok(branch) = read_branch_from_head(&head_path_clone) {
                                let event = GitBranchChangedEvent {
                                    project_path: project_path_clone.clone(),
                                    branch,
                                };
                                if let Err(e) = app.emit("git:branch-changed", &event) {
                                    log::error!(
                                        "[GitBranchWatcher] Failed to emit event: {}",
                                        e
                                    );
                                }
                            }
                        }
                    }
                    Err(errors) => {
                        for error in errors.iter() {
                            log::error!("[GitBranchWatcher] Watch error: {}", error);
                        }
                    }
                }
            },
        )
        .map_err(|e| format!("Failed to create git watcher: {}", e))?;

        // Watch the directory containing HEAD (NonRecursive)
        debouncer
            .watch(&watch_dir, RecursiveMode::NonRecursive)
            .map_err(|e| format!("Failed to watch .git directory: {}", e))?;

        watchers.insert(project_path.clone(), debouncer);
        log::info!(
            "[GitBranchWatcher] Started for: {}",
            project_path
        );
        Ok(())
    }

    pub async fn stop_watching(&self, project_path: &str) {
        let mut watchers = self.watchers.lock().await;
        if watchers.remove(project_path).is_some() {
            log::info!("[GitBranchWatcher] Stopped for: {}", project_path);
        }
    }

    pub async fn stop_all(&self) {
        let mut watchers = self.watchers.lock().await;
        let count = watchers.len();
        watchers.clear();
        log::info!("[GitBranchWatcher] Stopped all {} watchers", count);
    }
}

/// Resolve the path to the HEAD file, handling worktrees
fn resolve_head_path(git_root: &PathBuf) -> Result<PathBuf, String> {
    let dot_git = git_root.join(".git");

    if dot_git.is_dir() {
        // Normal repository
        Ok(dot_git.join("HEAD"))
    } else if dot_git.is_file() {
        // Worktree: .git is a file containing "gitdir: /path/to/..."
        let content = fs::read_to_string(&dot_git)
            .map_err(|e| format!("Failed to read .git file: {}", e))?;
        let gitdir = content
            .strip_prefix("gitdir: ")
            .ok_or("Invalid .git file format")?
            .trim();
        Ok(PathBuf::from(gitdir).join("HEAD"))
    } else {
        Err(format!(".git not found at: {}", dot_git.display()))
    }
}

/// Read branch name directly from .git/HEAD file
fn read_branch_from_head(head_path: &PathBuf) -> Result<String, String> {
    let content = fs::read_to_string(head_path)
        .map_err(|e| format!("Failed to read HEAD: {}", e))?;
    let content = content.trim();

    if let Some(branch) = content.strip_prefix("ref: refs/heads/") {
        Ok(branch.to_string())
    } else {
        // Detached HEAD — return short hash
        Ok(content.chars().take(7).collect())
    }
}

// --- Tauri Commands ---

#[tauri::command]
pub async fn start_git_branch_watcher(
    app: AppHandle,
    manager: tauri::State<'_, GitBranchWatcherManager>,
    project_path: String,
) -> Result<(), String> {
    manager.start_watching(app, project_path).await
}

#[tauri::command]
pub async fn stop_git_branch_watcher(
    manager: tauri::State<'_, GitBranchWatcherManager>,
    project_path: String,
) -> Result<(), String> {
    manager.stop_watching(&project_path).await;
    Ok(())
}

#[tauri::command]
pub async fn stop_all_git_branch_watchers(
    manager: tauri::State<'_, GitBranchWatcherManager>,
) -> Result<(), String> {
    manager.stop_all().await;
    Ok(())
}
