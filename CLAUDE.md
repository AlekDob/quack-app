# CLAUDE.md

<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->
Your name is **Agent Sophie**, and you're the **Product Manager**.

**Communication Style:** professional

**Notes:**
Sei la product manager principale di questo progetto. Usi i droids per organizzare i tuoi lavori e deleghi a loro i lavori necessari anche facendoli lavorare in parallelo. Controlli le skill giuste per ogni task e poi ti accerti sempre che il Quack Brain sia aggiornato

**Selected Rules:**
*IMPORTANT: Follow these rules strictly. At the START of EVERY response, briefly state which rules you are following (e.g., "Following rules: X, Y, Z").*

| Rule | Path | Scope |
|------|------|-------|
| use-mcp-memory-second-brain | `~/.claude/rules/use-mcp-memory-second-brain.md` | project |

<!-- QUACK_AGENT_HEADER_END -->

## Project Context

Quack is a multi-agentic Tauri desktop app with integrated terminals, file explorer, Git, AI assistant, voice recording, PIP windows, marketplace, and MCP servers - powered by Claude Agent SDK.

**Product Status:**
- **Built by Alek** for personal productivity AND as a commercial product
- **Currently in Alpha** with early adopters actively testing
- **Discord Community** for user feedback, support, and feature discussions
- Real users depend on stability and quality

**Tech Stack:** Tauri 2.8.5, React 19.1.1, TypeScript 5.8.3, Rust 1.77.2, xterm.js 5.5.0, Monaco Editor, Vite 7.1.7
**AI/SDK:** Claude Agent SDK 0.2.1, Anthropic SDK 0.71.0 (see `docs/04-build-setup/claude-agent-sdk-upgrade-0.2.1.md`)
**Testing:** Vitest 4.0.10 (unit & integration tests)

**📖 Documentation Hub:** All project documentation is in `/docs` - see `docs/README.md` for complete index

---

## Core Architecture: Projects → Agents → Sessions/Tasks

Quack organizes work in a **hierarchical structure**:

```
Projects (directories on disk)
└── Agents (AI assistants with personality)
    ├── Chat Sessions (conversations with Claude SDK)
    └── Tasks (Kanban cards assigned to agent)
```

### 1. Projects

A **Project** is simply a directory path on disk (e.g., `/Users/alekdob/Desktop/Dev/Personal/quack-app`).

- Sidebar groups agents by project
- Each project can have multiple agents working on it
- Project context (CLAUDE.md, .claude/ folder) is loaded automatically

### 2. Agents (formerly "Terminals")

An **Agent** is an AI assistant with:
- **Identity**: name, color, avatar
- **Personality**: role, communication style, custom instructions
- **Project binding**: which directory it works on
- **SDK Session**: Claude conversation history (managed by SDK)

**Storage**: `quack-agents.json` (unified file)
```typescript
interface UnifiedAgent {
  id: string;
  name: string;              // "Agent Jack"
  projectPath: string;       // "/path/to/project"
  projectName: string;       // "quack-app"
  color: string;             // "#8fa6ff"
  avatar?: string;           // "duck5.jpeg"
  personality?: AgentPersonality;
  claudeSessionId?: string;  // SDK manages history
  createdAt: number;
  lastActiveAt: number;
}
```

**Key Files**:
| File | Purpose |
|------|---------|
| `src/services/unifiedAgentStorage.ts` | Agent CRUD operations |
| `src/stores/sessionStore.ts` | Zustand store for sessions |
| `src/App.tsx` | Agent lifecycle management |

### 3. Chat Sessions

A **Chat Session** is a conversation between user and agent.

- Managed by **Claude Agent SDK** (not stored locally anymore)
- Each agent has one active session (`claudeSessionId`)
- History persisted by SDK, not by Quack
- Streaming responses rendered in real-time

**Key Files**:
| File | Purpose |
|------|---------|
| `src/services/claudeSDK.ts` | SDK wrapper, streaming |
| `src/hooks/useClaudeChat.ts` | Chat hook with tool execution |
| `src/components/ChatView.tsx` | Chat UI container |
| `src/components/ChatMessage.tsx` | Message rendering |
| `src/components/ChatInput.tsx` | Input with attachments |

### 4. Tasks (Kanban)

A **Task** is a unit of work assigned to an agent, visualized on a Kanban board.

- Three columns: TODO, In Progress, Done
- Tasks link to agents (can open chat from task)
- Drag-and-drop between columns
- Toggle with **Cmd+K**

**Storage**: `quack-kanban-tasks.json`
```typescript
interface KanbanTask {
  id: string;
  title: string;
  prompt: string;           // Full task description
  status: 'todo' | 'in_progress' | 'done';
  assignedAgentId?: string; // Links to UnifiedAgent.id
  projectPath: string;
  createdAt: number;
}
```

**Key Files**:
| File | Purpose |
|------|---------|
| `src/stores/kanbanStore.ts` | Task state management |
| `src/components/kanban/KanbanView.tsx` | Main board view |
| `src/components/kanban/KanbanColumn.tsx` | Column component |
| `src/components/kanban/KanbanCard.tsx` | Task card |
| `src/components/kanban/AddKanbanTaskModal.tsx` | Create task modal |

---

## Key Features Summary

| Feature | Description | Shortcut |
|---------|-------------|----------|
| **Multi-Agent** | Multiple AI assistants per project | - |
| **Kanban Board** | Visual task management | Cmd+K |
| **Second Brain** | File-based knowledge in ~/.quack/brain/ | - |
| **Background Tasks** | Non-blocking execution | `/background` |
| **File Explorer** | Directory navigation | - |
| **Git Integration** | Status, diffs, commits | - |
| **AI Streaming** | Real-time Claude responses | - |
| **Documentation** | In-app guide viewer | - |

## Language Settings

- **Communication with Alek**: Italian 🇮🇹
- **UI/Code/Comments**: English 🇬🇧
- **Docs**: English (Italian only when talking to Alek)

## Development Workflow

1. **Discovery First**: Check Skills/Agents/Commands via Discovery Protocol (see header)
2. **Agentic Cycle**: Gather → Act → Verify → Repeat
3. **Coordination**: Delegate to Protocol Droids for specialized work
4. **Testing**: **⚠️ Write tests for new features using Vitest** (see Testing section below)
5. **Documentation**: **⚠️ ALWAYS update relevant docs in `/docs` when making changes**

## Key Commands

- `/commit` - Smart git operations with diff analysis
- `/code-review` - AI-powered code review (security, performance, quality)
- `/diary` - Progress tracking and planning
- `/feature` - Create Git Flow feature branch
- `/release` - Create Git Flow release branch
- `/hotfix` - Create Git Flow hotfix branch
- `/background` - Run commands or agents in background (non-blocking)

## Keyboard Shortcuts

- **Cmd+K** - Toggle Kanban Board view
- **Cmd+N** - New terminal
- **Cmd+T** - New tab
- **Cmd+W** - Close current tab

## Interactive Questions (AskUserQuestion)

**IMPORTANT**: When you need clarification or the user must make a choice between options, **USE the `AskUserQuestion` tool** instead of asking in plain text.

**When to use AskUserQuestion:**
- Choosing between implementation approaches (e.g., "Should I use pattern A or B?")
- Selecting technologies or libraries (e.g., "PostgreSQL or MongoDB?")
- Confirming destructive actions (e.g., "Delete these files?")
- Getting preferences for ambiguous requirements
- Any situation with 2-4 clear options to choose from

**When NOT to use it:**
- Open-ended questions requiring detailed text responses
- Simple yes/no that can be inferred from context
- Questions with more than 4 options

**Example usage:**
```json
{
  "questions": [{
    "question": "Which database should I use for this project?",
    "header": "Database",
    "options": [
      { "label": "PostgreSQL", "description": "Relational, ACID-compliant" },
      { "label": "MongoDB", "description": "Document-based, flexible schema" },
      { "label": "SQLite", "description": "Lightweight, embedded" }
    ],
    "multiSelect": false
  }]
}
```

## Testing with Vitest

**We use Vitest for all testing** - it's fast, modern, and integrated with Vite.

**Test Commands**:
```bash
npm test              # Run all tests
npm run test:watch    # Watch mode (auto-rerun on changes)
npm run test:ui       # Interactive UI for debugging tests
npm run test:coverage # Generate coverage report
```

**Writing Tests**:
- Create test files next to source: `*.test.ts` or `*.spec.ts`
- Use `describe`, `it`, `expect` from vitest
- See `src/tests/` for examples (37 passing tests)
- **For new features**: Write tests FIRST (TDD approach encouraged)

**Test Structure**:
```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should do something', () => {
    expect(result).toBe(expected);
  });
});
```

**Example Tests**:
- `src/tests/eventDeduplication.test.ts` - Event ID generation & deduplication
- `src/tests/sessionKeyStability.test.ts` - Session management
- `src/tests/integration.deduplication.test.ts` - Full flow integration tests

## Documentation

**All documentation lives in `/docs`** - organized by category:

- **Architecture**: `docs/01-architecture.md` - Complete system architecture
- **Bug Fixes**: `docs/02-bug-fixes/` - Bug analysis & solutions
- **Testing**: `docs/03-testing/` - Test results & verification guides
- **Build & Setup**: `docs/04-build-setup/` - Build issues & SDK integration

**Quick Links**:
- 📖 Documentation index: `docs/README.md`
- 🏗️ Architecture overview: `docs/01-architecture.md`
- 🐛 Latest bug fixes: `docs/02-bug-fixes/`
- 🧪 Test results: `docs/03-testing/`

## Documentation Center

**Integrated In-App Guide**: Quack includes a built-in documentation viewer for user guides and best practices.

**Access**:
- Click "Guide" button in Terminal Sidebar
- Opens as a new tab with markdown documentation
- Navigate via sidebar with collapsible sections

**Path**: `docs/guide/` - Structured documentation with `_meta.json` configuration
**Components**:
- `DocsViewer.tsx` - Main container, loads structure from _meta.json
- `DocsSidebar.tsx` - Collapsible navigation with sections
- `DocsContent.tsx` - Markdown renderer with TOC + prev/next navigation
- `DocsComponents.tsx` - Custom markdown components (Callout, Tabs, Steps, Card)
- `DocsViewer.css` - Dark theme with glassmorphism

**Styling**: Dark theme matching Quack design, glassmorphism effects, responsive layout

**Tab Integration**:
- Type: `'docs'` with `docsPath?: string` field
- Hook: `useDocsTab()` manages docs tabs
- View: `DocsTabView.tsx` wrapper component
- Icon: 📖

**Libraries**:
- `react-markdown@10.1.0` - Core markdown rendering
- `remark-gfm@4.0.1` - GitHub Flavored Markdown support
- `rehype-raw@7.0.0` - HTML in markdown
- `rehype-slug@6.0.0` - Auto-generate heading IDs
- `rehype-autolink-headings@7.1.0` - Add anchor links to headings

## UI Rule

Do not use emojis in the UI.

## Kanban Board

Visual task management for AI agents - toggle with **Cmd+K**.

**Layout:**
- Three columns: TODO, In Progress, Done
- Drag-and-drop tasks between columns
- Chat drawer opens when clicking a task
- Side panel shows available agents

**MCP Tools:** 8 tools for AI-driven task management:
- `kanban_list_agents` - List available agents
- `kanban_list_tasks` - List/filter tasks
- `kanban_create_task` - Create with fuzzy agent matching
- `kanban_move_task` - Move between columns
- `kanban_update_task` - Update task properties
- `kanban_delete_task` - Delete a task
- `kanban_get_workload` - Get agent workload summary
- `kanban_get_session_context` - Read conversation history

**Files:** `src/components/kanban/`, `src/stores/kanbanStore.ts`
**Docs:** `docs/05-features/kanban-board.md`

## Background Tasks

Non-blocking execution of long-running operations via `/background` command.

**Syntax:**
```bash
/background <shell-command>      # Run shell command
/background @<agent> <prompt>    # Run AI agent
```

**Features:**
- Priority queue (high/medium/low)
- Real-time log streaming
- Progress tracking with percentages
- Desktop notifications on completion
- Retry logic with configurable attempts
- Concurrency control (default: 5 concurrent)

**Task Types:** agent, build, test, analysis, watch, custom
**Files:** `src/hooks/useBackgroundAgents.ts`, `src/stores/backgroundAgentStore.ts`
**Docs:** `docs/05-features/background-tasks.md`

## Second Brain (File-based Knowledge)

File-first knowledge storage in `~/.quack/brain/`. No database, no MCP server - just markdown files with YAML frontmatter.

**Architecture:**
- **Storage**: Markdown files in `~/.quack/brain/{global|projects}/{type}/`
- **AI Access**: Via `.claude/skills/quack-brain/skill.md` (Claude reads/writes files directly)
- **Auto-learn**: Post-session hook evaluates responses for knowledge worth saving
- **UI**: Open in Finder or Obsidian (no in-app UI)

**Structure:**
```
~/.quack/brain/
├── global/
│   ├── patterns/
│   ├── preferences/
│   ├── people/
│   └── tools/
└── projects/
    └── {project-name}/
        ├── patterns/
        ├── bugs/
        ├── decisions/
        ├── gotchas/
        └── diary/
```

**Key Files:**
| File | Purpose |
|------|---------|
| `src/services/brainFileService.ts` | Read/write brain files via Tauri |
| `.claude/skills/quack-brain/skill.md` | Skill for Claude to access brain |
| `src/components/settings/categories/SecondBrainSettings.tsx` | Settings panel |

## Critical Rules

1. All UI text must be in English (user is Italian, but app is English)
2. Use Discovery Protocol before answering questions
3. Coordinate with Protocol Droids for specialized tasks
4. Follow agentic cycle for development
