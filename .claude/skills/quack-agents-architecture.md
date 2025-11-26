# Quack Architecture Overview

**High-level skill for understanding Quack's architecture and core systems**

## What is Quack?

Quack is a **multi-agentic desktop application** built with Tauri 2.x that combines:
- Multiple terminal instances with PTY support
- AI assistant powered by Claude Agent SDK
- File explorer, Git integration, and code editing
- Voice recording, PIP windows, and Telegram integration
- Marketplace and plugin system
- MCP (Model Context Protocol) server support

**Tech Stack**: Tauri 2.8.5, React 19, TypeScript 5.8, Rust 1.77, Vite 7, xterm.js 5.5, Zustand 5

---

## Core Architecture

### Frontend (React + TypeScript)

```
src/
├── App.tsx              # Main orchestrator (3000+ lines)
├── components/          # 100+ React components
├── hooks/               # Custom React hooks
├── stores/              # Zustand state management
├── services/            # Business logic services
├── views/               # Tab view components
└── types/               # TypeScript interfaces
```

### Backend (Rust + Tauri)

```
src-tauri/src/
├── lib.rs               # Tauri app setup, plugins, HTTP hooks
├── terminal.rs          # PTY management (portable-pty)
├── git.rs               # Git operations via CLI
├── fs.rs                # File system access
├── ai.rs                # AI-related commands
├── claude_auth.rs       # Claude OAuth authentication
├── mcp.rs               # MCP server integration
├── telegram_bot.rs      # Telegram bot integration
├── license.rs           # License management
└── [30+ more modules]
```

### State Management (Zustand)

Quack uses **Zustand stores** for granular state management:

| Store | Purpose |
|-------|---------|
| `terminalStore` | Project terminals, activeProjectTerminalId |
| `chatStore` | AI chat sessions, messages, streaming state |
| `fileSystemStore` | File explorer state, current directory |
| `gitStore` | Git status, diffs, staging area |
| `uiStore` | UI state, modals, drawers, tabs, showTerminalWindow |
| `settingsStore` | User preferences, configurations |

---

## Key Concept: Agents vs Terminals

**IMPORTANT ARCHITECTURAL CHANGE (Jan 2025):**

```
Agents (sidebar) = AI chat instances using Claude SDK
Terminals (TerminalWindow) = Project-scoped CLI terminals
```

**Agents**:
- Located in left sidebar
- AI-powered chat using Claude Agent SDK
- Each agent has: id, name, color, avatar, personality
- Clicking an agent shows its chat history

**Terminals**:
- Located in dedicated TerminalWindow (separate window)
- Project-scoped (not agent-scoped)
- Grouped by project path in sidebar
- Multiple terminals per project
- Each terminal has: id, name, projectPath, color, status

---

## Main Systems

### 1. Terminal System (Refactored Jan 2025)

- **Type**: `ProjectTerminal` (was `AgentTerminal`)
- **Scope**: Project-based (via `projectPath`)
- **Frontend**: xterm.js with FitAddon, WebLinksAddon
- **Backend**: Rust PTY management via `portable-pty`
- **Component**: `XTermInstance` (reusable component)
- **Window**: `TerminalWindow` with sidebar panel
- **Features**:
  - Multiple terminals per project
  - Smart auto-scroll (disables when user scrolls up)
  - Status detection (busy/idle)
  - Custom colors and backgrounds
  - Survives agent switches

### 2. AI Chat System (Claude Agent SDK)

- **SDK**: `@anthropic-ai/claude-agent-sdk` v0.1.14
- **Hook**: `useClaudeChat.ts` manages streaming and sessions
- **Features**:
  - Real-time message streaming
  - Tool execution (Read, Write, Edit, Bash, etc.)
  - Permission modes: plan, act, bypass
  - Session persistence and resume
  - Cost/usage tracking
  - Event deduplication

### 3. File System

- **Explorer**: Tree view synchronized with terminal CWD
- **Preview**: Monaco/CodeMirror editor for file viewing
- **Backend**: Rust commands for secure file access (5MB limit)

### 4. Git Integration

- **Panel**: Status, diffs, staging, commits, timeline
- **Backend**: Git CLI operations via Rust
- **Features**: Branch management, conflict resolution, history

### 5. Tab System

Multi-tab interface supporting:
- `chat` - AI chat view
- `terminal` - Terminal view
- `code` - Code editor
- `browser` - Internal browser
- `docs` - Documentation viewer
- `settings` - Settings panel

### 6. Marketplace & Plugins

- **Marketplace**: Download skills, agents, commands
- **Plugins**: Extensible plugin architecture
- **Skills**: `.claude/skills/` directory
- **Commands**: `.claude/commands/` directory
- **Agents**: `.claude/agents/` directory

### 7. MCP Integration

Model Context Protocol servers for extended capabilities:
- Supabase integration
- PostgreSQL/MySQL databases
- Playwright for browser automation
- Custom MCP servers via `.claude/mcps/`

### 8. Telegram Integration

- Remote control via Telegram bot
- Voice message transcription
- Command execution

---

## HTTP Hooks Integration

External tools can notify Quack via local HTTP endpoint:

```bash
curl http://127.0.0.1:6768/terminal/status \
  -H 'Content-Type: application/json' \
  -d '{"id":"Claude Code", "status":"busy"}'
```

Used for:
- Claude Code session state
- Factory.ai integration
- Custom external tools

---

## Development Commands

```bash
# Frontend
npm run dev          # Vite dev server
npm run build        # Production build
npm test             # Run Vitest tests

# Tauri
npm run tauri:dev    # Full dev with hot reload
npm run tauri:build  # Production desktop build

# Rust
cd src-tauri && cargo check
cd src-tauri && cargo clippy
```

---

## Testing

- **Framework**: Vitest 4.x
- **Tests**: 37+ passing tests
- **Coverage**: Event deduplication, session management, integration tests
- **Location**: `src/tests/` and `*.test.ts` colocated files

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

---

## Best Practices

1. **Terminal = Agent**: When working with sidebar agents, use `activeTerminal` state
2. **Zustand stores**: Use appropriate store for domain-specific state
3. **Tauri commands**: Backend operations go through `invoke()`
4. **Testing**: Write Vitest tests for new features
5. **Documentation**: Update `/docs` for significant changes

---

## Quick Reference

| Need | Solution |
|------|----------|
| Project terminals | `useTerminalStore().projectTerminals` |
| Active project terminal | `useTerminalStore().getActiveProjectTerminal()` |
| Terminals by project | `useTerminalStore().getProjectTerminalsByPath(path)` |
| Chat messages | `useChatStore().messages` |
| File explorer | `useFileSystemStore()` |
| Git status | `useGitStore().status` |
| Open terminal window | `useUIStore().toggleWindow('showTerminalWindow')` |
| UI modals | `useUIStore()` |
| Settings | `useSettingsStore()` |
| Send AI message | `useClaudeChat()` hook |

---

*This skill provides a high-level overview of Quack's architecture. For detailed implementation, see the specific component and module files.*
