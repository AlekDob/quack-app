---
type: map
project: quack-app
updated: 2026-02-24
---

# Quack - Architecture Map

> This file is the entry point for any agent working on quack-app.
> Read this first, then dive into specific sections as needed.

## Core Services

| Service | Path | Purpose |
|---------|------|---------|
| Brain File Service | src/services/brainFileService.ts | Two-level knowledge store CRUD |
| Activity Log Service | src/services/activityLogService.ts | JSONL activity event log |
| Claude SDK | src-tauri/node-sdk/stream-daemon.js | AI streaming via persistent daemon |
| Unified Agent Storage | src/services/unifiedAgentStorage.ts | Agent + session persistence |
| Automation Storage | src/services/automationStorage.ts | Cron job persistence |
| Cron Utils | src/services/cronUtils.ts | Cron expression parsing + next-run calc |

## Key Stores (Zustand)

| Store | Path | Purpose |
|-------|------|---------|
| Settings | src/stores/settingsStore.ts | App preferences |
| Session | src/stores/sessionStore.ts | Active agent sessions |
| Kanban | src/stores/kanbanStore.ts | Task board state |
| Automation | src/stores/automationStore.ts | Scheduled job state |
| Popout Window | src/stores/popoutWindowStore.ts | Tab popout windows |
| UI | src/stores/uiStore.ts | Sidebar, panels, theme |

## Feature Directories

| Feature | Path | Key Files |
|---------|------|-----------|
| Chat | src/components/Chat* | ChatView, ChatInput, ChatMessage |
| Kanban | src/components/kanban/ | KanbanView, KanbanCard |
| Brain | src/components/brain/ | BrainApp, Timeline, Knowledge, Graph |
| Settings | src/components/settings/ | SettingsDrawer + categories/ |
| Terminal | src/components/Terminal* | TerminalComponent, TerminalSidebar |
| Automation | src/components/automation/ | AutomationView, AutomationJobCard, AutomationJobForm |

## Backend (Rust)

| Module | Path | Purpose |
|--------|------|---------|
| Brain Window | src-tauri/src/brain_window.rs | Open brain webview window |
| Browser | src-tauri/src/browser.rs | Browser window + OAuth |
| Terminal | src-tauri/src/terminal.rs | PTY process management |
| File System | src-tauri/src/fs.rs | File I/O commands |
| Git | src-tauri/src/git.rs | Git operations |
| Claude CLI | src-tauri/src/claude_cli.rs | SDK process + event parsing |
| Automation | src-tauri/src/automation.rs | Cron scheduler + tick events |

## Entry Points

| Entry | Path | Purpose |
|-------|------|---------|
| Main | src/main.tsx + index.html | Primary app window |
| Brain | src/brain-main.tsx + brain.html | Brain webview window |
| Browser | src/browser-main.tsx + browser.html | Browser webview window |
| Tab Popout | src/tab-popout-entry.tsx | Popped-out tab windows |

## Human Guides (documentation/guide/)

Feature-oriented guides written for humans (Italian). Each feature has its own folder.

| Guide | Path | Pages |
|-------|------|-------|
| Brain | guide/brain/ | [Overview](guide/brain/overview.md), [Access Chain](guide/brain/access-chain.md), [Entry Types](guide/brain/entry-types.md), [Brain UI](guide/brain/brain-ui.md), [Writing Entries](guide/brain/writing-entries.md) |
| Memory | guide/memory/ | [Overview](guide/memory/overview.md) |

## Knowledge Store (documentation/)

Two-level brain architecture:

| Level | Path | Content |
|-------|------|---------|
| **Project** | `{project}/documentation/` | Project-specific knowledge, git-tracked |
| **Global** | `~/.quack/brain/` | Cross-project patterns, personal |

### Project documentation/ structure

| Folder | Purpose | Example |
|--------|---------|---------|
| decisions/ | Architecture decisions, why we chose X | decision-remove-monaco-use-codemirror.md |
| bugs/ | Root cause analyses with fix patterns | fix-stamina-messages-zero-modelusage-fallback.md |
| patterns/ | Reusable architecture patterns | pattern-agent-teams-visual-feedback.md |
| gotchas/ | Non-obvious pitfalls to remember | gotcha-tauri-execute-command-parsing.md |
| diary/ | Slim daily log (max 30 lines/day) | 2026-02-13.md |
| guide/ | Human-friendly feature guides (Italian) | guide/brain/overview.md |
| inbox/ | Quick captures, triage later | |

### File format
```yaml
---
type: decision | bug | pattern | gotcha | diary
created: YYYY-MM-DD
tags: [tag1, tag2]
---
# Title
Content...
```

## Conventions

- Absolute imports via relative paths (no @/ alias configured)
- Stores use Zustand with devtools middleware
- Services are singleton modules
- English UI, English code
- TypeScript strict, < 300 lines/file, < 20 lines/fn
