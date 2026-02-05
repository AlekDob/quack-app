---
type: pattern
project: quack-app
created: 2026-01-08
migrated: true
---

# Quack Architecture Overview

Quack is a multi-agentic Tauri desktop app for AI-powered development

Tech Stack: Tauri 2.9, React 19, TypeScript 5.8, Rust 1.77.2, xterm.js 5.5, Monaco Editor

AI Integration: Claude Agent SDK 0.2.1, Anthropic SDK 0.71.0

Main directories: /src (frontend), /src-tauri/src (backend), /src-tauri/node-sdk (MCP servers), /docs (documentation)

Key features: Multi-terminal PTY, AI Chat Streaming, Kanban Board, Second Brain, File Explorer, Git Integration

Architecture patterns: Context API + Zustand stores, MCP tools for AI operations, Error Boundaries

## Introduzione

Quack e un'applicazione desktop multi-agentica pensata per sviluppatori che vogliono integrare l'AI nel loro workflow quotidiano. Non e un semplice wrapper per Claude - e un ambiente di sviluppo completo con terminali, file explorer, git integration, e un sistema di knowledge management chiamato "Second Brain".

## Perche Tauri?

Abbiamo scelto Tauri invece di Electron per diverse ragioni:
- **Bundle size**: ~15MB vs ~150MB di Electron
- **Performance**: Rust backend nativo, non Node.js
- **Sicurezza**: Sandbox nativo del sistema operativo
- **Memoria**: Consumo RAM significativamente inferiore

## I Tre Pilastri dell'Architettura

1. **Frontend React** (`/src`) - L'interfaccia utente con 268 componenti organizzati per feature
2. **Backend Rust** (`/src-tauri/src`) - 45 moduli che gestiscono PTY, file system, git, e MCP
3. **MCP Layer** (`/src-tauri/node-sdk`) - 5 server Node.js che espongono tools all'AI

## Come Comunicano

```
React (Frontend) <--IPC--> Tauri (Rust) <--stdio--> MCP Servers (Node.js)
                                              |
                                              v
                                    Claude Agent SDK
```

Il frontend chiama comandi Tauri via `invoke()`. Tauri gestisce i processi MCP e comunica con loro via stdio. I tool MCP sono poi disponibili a Claude durante le conversazioni.

[2026-01-11] Complete architecture analysis completed by Agent Laura

## Comprehensive Codebase Metrics

**Frontend (React + TypeScript):**
- 268+ TSX components organized by feature
- 62 custom hooks in /src/hooks/
- 13 Zustand stores in /src/stores/ for global state
- Main entry: App.tsx (6528 LOC - tab system, sidebar, panels)
- Key libraries: React 19.1.1, Vite 6.4.1, xterm.js 5.5, Monaco 0.55, TailwindCSS 3.4

**Backend (Rust + Tauri):**
- 45 Rust modules in /src-tauri/src/
- Tauri 2.9, Rust 1.77.2
- Core modules: terminal.rs (PTY), fs.rs (file system), git.rs (Git ops), mcp.rs (MCP process management)
- Brain system: brain/mod.rs, brain/db.rs (SQLite), brain/watcher.rs (file sync)
- Optimized release profile: LTO enabled, stripped symbols, opt-level "z"

**MCP Layer (Node.js):**
- 5 MCP servers in /src-tauri/node-sdk/ (TypeScript)
- brain.ts - Knowledge graph (SQLite + Obsidian sync)
- kanban-tools.ts - Task management with AI agents
- semantic-search.ts - Code semantic search with embeddings
- ide-tools.ts - VS Code/Cursor/Windsurf integration
- linear-server.ts - Linear issue tracking

**AI Integration:**
- Claude Agent SDK 0.2.1 (@anthropic-ai/claude-agent-sdk)
- Anthropic SDK 0.71.0 (@anthropic-ai/sdk)
- Agent personalities system with 13+ agents
- Slash commands framework
- Skills and droids (subagents)
- Background task execution

**State Management Architecture:**
- Zustand stores (13): uiStore, settingsStore, kanbanStore, etc.
- Context API for shared state (GitContext, TerminalContext, FileSystemContext)
- Persistent state via @tauri-apps/plugin-store
- Session recovery with backup system

**Testing Infrastructure:**
- Vitest 4.0.10 for unit and integration tests
- 37 passing tests documented in /docs/03-testing/
- Test coverage for: event deduplication, session stability, integration flows
- Commands: npm test, npm run test:watch, npm run test:ui

**Visual Architecture Diagram:**
Created Obsidian Canvas at:
`/Users/alekdob/Desktop/Dev/brain/QuackBrain/projects/quack-app/quack-architecture-overview.canvas`

Canvas shows:
- 4 architectural layers (Frontend, Backend, AI, Data)
- 6 core features (Terminal, Kanban, Second Brain, Git, AI Chat, Docs)
- Data flow from User → React → Tauri IPC → Rust → MCP → Claude SDK → Anthropic API
- Color-coded by domain (cyan=frontend, purple=backend, green=AI, orange=data, yellow=features)
