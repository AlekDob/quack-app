---
type: pattern
created: 2026-01-08
---

# Quack Architecture Overview

Quack is a multi-agentic Tauri desktop app for AI-powered development.

Tech Stack: Tauri 2.9, React 19, TypeScript 5.8, Rust 1.77.2, xterm.js 5.5, Monaco Editor

AI Integration: Claude Agent SDK, Anthropic SDK

## I Tre Pilastri dell'Architettura

1. **Frontend React** (`/src`) -- 268 components organized by feature
2. **Backend Rust** (`/src-tauri/src`) -- 45 modules (PTY, file system, git, MCP)
3. **MCP Layer** (`/src-tauri/node-sdk`) -- 5 Node.js servers exposing tools to AI

## Come Comunicano

```
React (Frontend) <--IPC--> Tauri (Rust) <--stdio--> MCP Servers (Node.js)
                                              |
                                              v
                                    Claude Agent SDK
```

## Codebase Metrics

**Frontend**: 268+ TSX components, 62 custom hooks, 17 Zustand stores, 34 services

**Backend**: 45 Rust modules. Core: terminal.rs (PTY), fs.rs, git.rs, mcp.rs, claude_cli.rs

**MCP Layer**: 5 servers -- brain, kanban-tools, semantic-search, ide-tools, memory-prompt-hook

**State Management**: Zustand stores (persistent) + Context API (transient UI state)

**Testing**: Vitest, 37+ passing tests

## Perche Tauri?

- Bundle size: ~15MB vs ~150MB (Electron)
- Performance: Rust backend nativo
- Sicurezza: Sandbox nativo del sistema operativo
- Memoria: Consumo RAM inferiore
