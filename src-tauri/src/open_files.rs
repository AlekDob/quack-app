use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

fn arg_to_path(arg: &str) -> Option<PathBuf> {
    if arg.starts_with('-') {
        return None;
    }
    if let Some(rest) = arg.strip_prefix("file://") {
        return Some(PathBuf::from(rest));
    }
    if arg.starts_with("http://") || arg.starts_with("https://") {
        return None;
    }
    Some(PathBuf::from(arg))
}

#[cfg(any(windows, target_os = "linux"))]
pub fn startup_file_args() -> Vec<PathBuf> {
    std::env::args()
        .skip(1)
        .filter_map(|a| arg_to_path(&a))
        .collect()
}

pub fn emit_open_files(app: &AppHandle, files: Vec<PathBuf>) {
    let paths: Vec<String> = files
        .into_iter()
        .filter_map(|p| p.to_str().map(|s| s.to_string()))
        .collect();
    if paths.is_empty() {
        return;
    }
    let _ = app.emit("app:open-files", paths);
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_focus();
    }
}

#[cfg_attr(debug_assertions, allow(dead_code))]
pub fn handle_cli_args(app: &AppHandle, args: &[String]) {
    let files: Vec<PathBuf> = args.iter().skip(1).filter_map(|a| arg_to_path(a)).collect();
    if !files.is_empty() {
        emit_open_files(app, files);
    }
}
