use notify::RecursiveMode;
use notify_debouncer_mini::{new_debouncer, DebounceEventResult, Debouncer};
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

type RecommendedDebouncer = Debouncer<notify::RecommendedWatcher>;

#[derive(Default)]
pub struct WatcherState {
    pub watchers: Arc<Mutex<HashMap<String, RecommendedDebouncer>>>,
}

#[derive(Serialize, Clone)]
pub struct FsEvent {
    pub ws_id: String,
    pub dirs: Vec<String>,
}

/// Path segments that flood fseventsd + git refresh when watched recursively.
/// Matching any component drops the event (agent builds, deps, git objects).
fn ignored_segment(name: &str) -> bool {
    // Prefix/suffix build-output patterns: exact-match missed real-world dirs
    // like `build-mac` / `build-e2e` (Xcode) and `*.noindex` compile caches,
    // so a 7k-file build tree kept emitting events → git/tree/works refresh
    // storm on switch-in. Keep these conservative to avoid hiding source dirs.
    if name.starts_with("build-") || name.ends_with(".noindex") {
        return true;
    }
    matches!(
        name,
        ".git"
            | "node_modules"
            | "target"
            | "dist"
            | "build"
            | "DerivedData"
            | ".build"
            | ".next"
            | ".nuxt"
            | ".turbo"
            | ".cache"
            | "coverage"
            | "graphify-out"
            | "__pycache__"
            | ".venv"
            | "venv"
            | ".pnpm-store"
            | "Pods"
            | ".parcel-cache"
            | ".svelte-kit"
    )
}

fn path_ignored(path: &Path) -> bool {
    path.components().any(|c| {
        c.as_os_str()
            .to_str()
            .map(ignored_segment)
            .unwrap_or(false)
    })
}

#[tauri::command]
pub fn fs_watch_start(
    app: AppHandle,
    state: tauri::State<'_, WatcherState>,
    ws_id: String,
    root: String,
) -> Result<(), String> {
    {
        let watchers = state.watchers.lock();
        if watchers.contains_key(&ws_id) {
            return Ok(());
        }
    }

    let app_clone = app.clone();
    let ws_id_clone = ws_id.clone();

    let mut debouncer = new_debouncer(
        Duration::from_millis(200),
        move |res: DebounceEventResult| {
            if let Ok(events) = res {
                let mut dirs: HashSet<String> = HashSet::new();
                for ev in events {
                    let path = ev.path;
                    if path_ignored(&path) {
                        continue;
                    }
                    let target = if path.is_dir() {
                        Some(path.clone())
                    } else {
                        path.parent().map(|p| p.to_path_buf())
                    };
                    if let Some(t) = target {
                        if path_ignored(&t) {
                            continue;
                        }
                        dirs.insert(t.to_string_lossy().into_owned());
                    }
                }
                if !dirs.is_empty() {
                    let _ = app_clone.emit(
                        "fs:event",
                        FsEvent {
                            ws_id: ws_id_clone.clone(),
                            dirs: dirs.into_iter().collect(),
                        },
                    );
                }
            }
        },
    )
    .map_err(|e| e.to_string())?;

    debouncer
        .watcher()
        .watch(Path::new(&root), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    state.watchers.lock().insert(ws_id, debouncer);
    Ok(())
}

#[tauri::command]
pub fn fs_watch_stop(state: tauri::State<'_, WatcherState>, ws_id: String) -> Result<(), String> {
    state.watchers.lock().remove(&ws_id);
    Ok(())
}
