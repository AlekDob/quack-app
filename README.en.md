# Quack

Desktop multi-session terminal with file explorer and Git integration, built with React + TypeScript (Vite) and Tauri 2 (Rust).

## Contents
- Overview
- Features
- Architecture
- Requirements
- Quick start (Dev)
- Build & distribution
- Technical details (Tauri, events, security)
- External HTTP hook (terminal status)
- Git integration
- Limitations & roadmap
- Troubleshooting

---

## Overview
Quack provides an integrated multi-session terminal, a file explorer, and a Git panel in a single desktop window.

Main stack:
- Frontend: React 19 + Vite 7 + TypeScript 5.8, xterm.js
- Desktop: Tauri 2 (Rust) with Dialog and Notification plugins
- Local backend: Tauri commands for PTY, filesystem and Git; small HTTP server (Axum) for external events

Key folders:
- `src/`: React UI (TerminalSidebar, TerminalView, FileExplorer, GitPanel)
- `src-tauri/`: Tauri backend (Rust): PTY (`terminal.rs`), FS (`fs.rs`), Git (`git.rs`), bootstrap (`lib.rs`)

## Features
- Multiple terminals with status (busy/idle), custom colors, focus management
- Idle detection based on output and prompt heuristic
- Desktop notifications when a job completes (permission required)
- File explorer with navigation, refresh and file preview (5MB limit)
- Git panel: status, diff (worktree/staged), stage/unstage, commit, commit timeline
- Local HTTP hook to update external terminal status (busy/idle)

## Architecture
- Tauri → UI events
  - `terminal-data`: PTY output stream to React
  - `terminal-exit`: process termination notice
- Tauri commands:
  - Terminal: `create_terminal`, `list_terminals`, `write_to_terminal`, `resize_terminal`, `close_terminal`, `set_terminal_color`
  - Filesystem: `list_directory`, `get_home_directory`, `read_file_content`
  - Git: `git_status_summary`, `git_diff`, `git_stage`, `git_unstage`, `git_commit`, `git_commit_history`
- Internal HTTP server: Axum on `127.0.0.1:6768` (see Hook) emitting `external-terminal-status` to the UI

## Requirements
- Node.js 18+ and npm
- Rust + Cargo
- Tauri 2 prerequisites for your OS
- Git installed and in PATH

## Quick start (Dev)
```bash
npm install
npm run tauri:dev
# or npm run dev (frontend only, limited)
```

## Build & distribution
Configured in `src-tauri/tauri.conf.json`:
- `beforeDevCommand`: `npm run dev`
- `frontendDist`: `../dist`
- Bundling for multiple targets with icons

Build:
```bash
npm run tauri:build
```

## External HTTP hook
Endpoint: `POST http://127.0.0.1:6768/terminal/status`

Body:
```json
{ "id": "<optional>", "label": "<optional>", "status": "busy|idle", "notify": true }
```

## Git integration
- Status (branch/upstream/ahead/behind) + entries
- Diff for worktree/staged; fallback `--no-index` for untracked
- Stage/unstage and commit; commit history timeline

Note: current implementation resolves the Git root from the app `current_dir`. Run the app within the repo you want to inspect.

## Limitations & roadmap
- Git root tied to process `current_dir`
- Preview limited to 5MB
- Roadmap: branch graph, GitHub auth + push, branch management

## Troubleshooting
- “Start the desktop app…”: use `npm run tauri:dev`
- No notifications: grant OS permission
- Git: “Cannot find .git” → launch inside a repo
