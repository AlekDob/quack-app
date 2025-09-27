# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TerminalFlow is a Tauri-based desktop application that provides a terminal emulator with integrated file explorer. The app features multiple terminal tabs with customizable colors and a file navigation sidebar.

## Architecture

### Frontend (React + TypeScript)
- **Main App**: `src/App.tsx` – orchestrates terminal management, file explorer, sidebar, and the “Nuovo terminale” modal (name, directory via Finder, color selection)
- **Terminal View**: `src/components/TerminalView.tsx` – manages xterm.js terminals, FitAddon, and Tauri events
- **Terminal Sidebar**: `src/components/TerminalSidebar.tsx` – handles terminal tabs, color badges, and actions
- **File Explorer**: `src/components/FileExplorer.tsx` – directory navigation component
- **New Terminal Modal**: `src/components/NewTerminalModal.tsx` – liquid-style modal with Finder integration and color presets
- **Notifications & Audio**: handled in `src/App.tsx` via `@tauri-apps/plugin-notification` and a WebAudio “quack” sound when terminal sessions become ready
- **Notifications & Audio**: `src/App.tsx` uses `@tauri-apps/plugin-notification` and a WebAudio-based “quack” callback to alert when terminals become idle
- **Types**: `src/types.ts` – TypeScript interfaces for terminal and file system data

### Backend (Rust + Tauri)
- **Core Library**: `src-tauri/src/lib.rs` – Tauri setup, dialog + notification plugin registration, command wiring, local hook HTTP endpoint
- **Core Library**: `src-tauri/src/lib.rs` – Tauri setup, dialog + notification plugins, command wiring
- **Terminal Module**: `src-tauri/src/terminal.rs` – PTY management, color updates, cwd validation
- **Capabilities**: `src-tauri/capabilities/default.json` – grants both `dialog:default` (Finder) and `notification:default` permissions for runtime hooks
- **Capabilities**: `src-tauri/capabilities/default.json` – grants `dialog:default` (Finder) and `notification:default` (desktop push) permissions

### Key Technologies
- **Frontend**: React 19, TypeScript, Vite, xterm.js, WebAudio
- **Backend**: Tauri v2, Rust, portable-pty, `tauri-plugin-dialog`, `tauri-plugin-notification`, `axum`
- **Styling**: CSS with liquid/radix-inspired utility classes
- **Build**: Vite for frontend, Cargo for Rust backend

## Development Commands

### Frontend Development
- `npm run dev` - Start Vite development server (browser only)
- `npm run build` - Build frontend for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

### Tauri Development
- `npm run tauri:dev` - Start Tauri development with hot reload
- `npm run tauri:build` - Build desktop application for distribution
- `npm run tauri` - Run cargo tauri commands directly

### Rust Backend
- `cd src-tauri && cargo check` - Check Rust code compilation
- `cd src-tauri && cargo test` - Run Rust tests
- `cd src-tauri && cargo clippy` - Run Rust linter

## Architecture Notes

### Terminal Management
- Each terminal is backed by a PTY process managed in Rust
- Frontend creates Terminal instances from xterm.js with custom themes
- Terminal data flows through Tauri events (`terminal-data`, `terminal-exit`)
- Terminals are persisted in memory with unique UUIDs

### File System Integration
- File explorer synchronizes with active terminal's current working directory
- Rust backend provides secure file system access through Tauri commands
- Directory navigation updates both explorer and terminal state

### State Management
- React state manages terminal list, active terminal, explorer state, modal inputs (name, cwd, color) and per-terminal status (`busy` / `idle` / attention)
- No external state management library – uses built-in React hooks
- Terminal instances are cached in React refs to prevent recreation
- Idle timers per terminal are tracked via refs to coordinate notifications
- Idle timers (per terminal) are tracked via refs to avoid duplicate notifications

### Event System
- Tauri events handle bidirectional communication between frontend and backend
- Terminal output streams through `terminal-data` events
- Process completion communicated via `terminal-exit` events (forces idle state + notifications)
- Dialog selections rely on `tauri-plugin-dialog::open` with permission scopes defined in capabilities
- External tool hooks communicate over the local HTTP endpoint (`http://127.0.0.1:6768/terminal/status`) exposed in `src-tauri/src/lib.rs`
- Desktop push notifications rely on `tauri-plugin-notification`; ensure `notification:default` capability is present

## Development Notes

- The app requires Tauri environment to function – browser-only mode shows fallback UI
- “Nuovo terminale” modal lets the user name the session, pick a directory via Finder, and choose accent color (preset or color picker)
- Terminal colors are customizable and stored per-terminal instance
- File explorer shows directories and files with appropriate icons/styling
- Terminals automatically resize based on container dimensions using FitAddon
- Sidebar chips show `IN ESECUZIONE` (busy) and `PRONTO` (idle). When a background terminal returns idle it pulses, plays the “quack” tone, and triggers a desktop notification

### Claude Code Hooks Integration
- Hook commands can notify TerminalFlow about session state changes by hitting the local endpoint:
  ```bash
  curl -s http://127.0.0.1:6768/terminal/status \
    -H 'Content-Type: application/json' \
    -d '{"id":"Claude Code", "status":"busy"}'
  ```
- Typical setup:
  - `UserPromptSubmit` hook → send `{ status: "busy" }`
  - `Notification` or `PostToolUse` hook → send `{ status: "idle" }`
- Payload fields:
  - `id`: matches the terminal label in the sidebar
  - `status`: `"busy"` or `"idle"`
  - `notify` (optional, default `true`): set to `false` to suppress notification/sound for that update
- Hooks run concurrently; the endpoint is idempotent—only matching terminals are updated. If no terminal ID matches exactly, the event is ignored.
- Terminal chips indicate `IN ESECUZIONE` (giallo) vs `PRONTO` (verde); when unobserved terminals become idle, they pulse, trigger a desktop notification, and play the duck “quack” sound