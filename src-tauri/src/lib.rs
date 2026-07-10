mod atomic;
mod dictation;
mod chat_store;
mod claude_code;
mod cursor_code;
mod opencode_sidecar;
mod provider_path;
mod provider_sessions;
mod session_jsonl;
mod claude_mcp;
mod claude_perm;
mod claude_sessions;
mod context_assets;
mod claude_usage;
mod fs_ops;
mod git;
mod pty;
mod search;
mod sftp;
mod sysmon;
mod watcher;
mod workspace;

use claude_code::ClaudeCodeState;
use cursor_code::CursorCodeState;
use opencode_sidecar::OpencodeSidecarState;
use tauri::Manager;
use claude_perm::PermState;
use pty::PtyState;
use watcher::WatcherState;

/// Set the native Dock/taskbar app-icon badge to the count of chats needing
/// attention (0 clears it). Driven by the frontend's AgentHubWatcher so the
/// counter is visible even when the app isn't focused.
#[tauri::command]
fn set_dock_badge(app: tauri::AppHandle, count: u32) {
    use tauri::Manager;
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.set_badge_count(if count == 0 {
            None
        } else {
            Some(count as i64)
        });
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .manage(PtyState::default())
        .manage(WatcherState::default())
        .manage(ClaudeCodeState::default())
        .manage(CursorCodeState::default())
        .manage(OpencodeSidecarState::default())
        .manage(PermState::default())
        .manage(sftp::SftpPoolState::default())
        .manage(sysmon::SysMonState::default())
        .setup(|app| {
            // Start the permission-callback HTTP server early so
            // settings.local.json hooks always have an endpoint to
            // POST to. Best-effort — log + continue if it fails so
            // the app still launches in dangerously-skip-permissions
            // fallback mode.
            let handle = app.handle().clone();
            std::thread::spawn(move || {
                if let Err(e) = claude_perm::start_server(handle) {
                    eprintln!("[claude_perm] failed to start server: {}", e);
                }
            });
            // macOS uses native decorations + titleBarStyle:Overlay (rounded
            // corners + shadow + traffic lights, the modern Mac look). On
            // Windows/Linux that same config would stack a native title bar
            // on top of our custom top bar, so strip decorations there and
            // keep the custom chrome (window controls re-appear via CSS).
            #[cfg(not(target_os = "macos"))]
            {
                use tauri::Manager;
                if let Some(win) = app.get_webview_window("main") {
                    let _ = win.set_decorations(false);
                }
            }
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                window.state::<OpencodeSidecarState>().shutdown();
            }
        })
        .invoke_handler(tauri::generate_handler![
            fs_ops::list_dir,
            fs_ops::read_file,
            fs_ops::write_file,
            fs_ops::rename_path,
            fs_ops::delete_path,
            fs_ops::create_dir,
            fs_ops::path_exists,
            fs_ops::create_file,
            fs_ops::save_image_attachment,
            fs_ops::read_image_data_url,
            pty::pty_spawn,
            pty::pty_write,
            pty::pty_resize,
            pty::pty_kill,
            pty::pty_list_sessions,
            pty::pty_session_exists,
            pty::pty_get_buffer,
            pty::available_shells,
            workspace::workspaces_load,
            workspace::workspaces_save,
            workspace::workspace_state_load,
            workspace::workspace_state_save,
            chat_store::chat_store_load_workspace,
            chat_store::chat_store_save,
            chat_store::chat_store_delete,
            chat_store::chat_store_lookup_link,
            chat_store::chat_store_all_links,
            provider_sessions::provider_list_sessions,
            provider_sessions::provider_load_session,
            watcher::fs_watch_start,
            watcher::fs_watch_stop,
            git::git_is_repo,
            git::git_status,
            git::git_stage,
            git::git_unstage,
            git::git_commit,
            git::git_pull,
            git::git_push,
            git::git_fetch,
            git::git_init,
            search::list_workspace_files,
            search::search_text,
            search::search_regex,
            search::scan_todos,
            search::find_symbols,
            search::read_package_scripts,
            search::read_cargo_tasks,
            search::read_makefile_targets,
            git::git_diff,
            git::git_diff_staged,
            git::git_show,
            git::git_discard,
            git::git_clean,
            git::git_resolve_conflict,
            git::git_branches,
            git::git_checkout_branch,
            git::git_create_branch,
            git::git_delete_branch,
            git::git_log,
            git::git_file_log,
            git::git_show_commit,
            git::git_stash_list,
            git::git_stash_push,
            git::git_stash_pop,
            git::git_stash_apply,
            git::git_stash_drop,
            claude_code::claude_code_check,
            claude_code::claude_code_chat,
            claude_code::claude_code_kill,
            claude_code::claude_code_kill_session,
            claude_code::claude_code_attach,
            claude_code::claude_code_active_sessions,
            claude_code::claude_code_clear_session,
            claude_code::claude_code_list_sessions,
            claude_code::claude_code_load_session,
            claude_code::claude_code_load_subagent,
            claude_code::claude_plugin_cmd,
            cursor_code::cursor_code_check,
            cursor_code::cursor_code_list_models,
            cursor_code::cursor_code_chat,
            cursor_code::cursor_code_kill,
            cursor_code::cursor_code_kill_session,
            opencode_sidecar::opencode_server_check,
            opencode_sidecar::opencode_server_status,
            opencode_sidecar::opencode_server_start,
            opencode_sidecar::opencode_server_restart,
            claude_perm::claude_perm_decide,
            claude_perm::claude_perm_endpoint,
            claude_usage::claude_auth_status,
            claude_usage::claude_usage_limits,
            claude_sessions::claude_usage_sessions,
            claude_sessions::claude_session_export_markdown,
            claude_sessions::claude_session_load_turns,
            context_assets::claude_context_assets,
            context_assets::claude_set_skill_override,
            context_assets::claude_invalidate_context_cache,
            claude_mcp::claude_mcp_list,
            claude_mcp::claude_mcp_add,
            claude_mcp::claude_mcp_add_remote,
            claude_mcp::claude_mcp_remove,
            sftp::sftp_test_connection,
            sftp::sftp_list_dir,
            sftp::sftp_read_file,
            sftp::sftp_write_file,
            sftp::sftp_stat,
            sftp::sftp_download_to_disk,
            sftp::sftp_upload_from_disk,
            sftp::sftp_delete,
            sftp::sftp_mkdir,
            sftp::sftp_upload_dir,
            sftp::sftp_download_dir,
            sftp::sftp_disconnect,
            sftp::sftp_forget_host_key,
            sysmon::process_stats,
            sysmon::process_kill,
            set_dock_badge,
            dictation::dictation_available,
            dictation::dictation_start,
            dictation::dictation_stop,
            dictation::dictation_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
