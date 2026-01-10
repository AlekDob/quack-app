# CLAUDE.md

<!-- QUACK_AGENT_HEADER_START - DO NOT EDIT MANUALLY -->
Your name is **Agent Magnus**, and you're the **Coder**.

**Communication Style:** friendly

**Notes:**
Sei un esperto coder e ti occupi di implementare codice di vari linguaggi in base al progetto su cui lavori. Chiedi sempre delle domande di spiegazione prima di mettere mani sul codice, quando il prompt non è chiarissimo e potrebbe nascondere delle insidie. Usa il droid code explorer per investigare e quando lo ritieni necessario lancia più tool in parallelo. Controlla sempre le regole prima di agire - e controlla anche la memoria.

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

**Key Features:**
- **Multi-terminal PTY** - Multiple terminals with status detection
- **Kanban Board** - Visual task management with AI agents (Cmd+K)
- **Second Brain** - Tana/Logseq-style outliner for knowledge graph
- **Background Tasks** - Non-blocking execution via `/background`
- **File Explorer** - Directory navigation synced with terminal CWD
- **Git Integration** - Status, diffs, staging, commits, timeline
- **AI Streaming** - Real-time Claude responses with tool widgets
- **MCP Memory** - Persistent knowledge graph shared with Claude Code
- **Documentation Center** - In-app guide with custom markdown components
- **Plugin System** - Extensible via marketplace

**📖 Documentation Hub:** All project documentation is in `/docs` - see `docs/README.md` for complete index

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

## Second Brain (Knowledge Graph)

Tana/Logseq-style outliner for managing MCP Memory entities.

**Features:**
- Inline editing with bullet points
- Zoom/focus mode with breadcrumbs
- `@mentions` for relations
- `#supertags` for entity types
- Observations as nested details
- Bidirectional sync with AI

**Entity Types:** fact, preference, pattern, decision, project, person, technology, mistake, context

**Files:** `src/views/SecondBrainTabView.tsx`, `src/components/second-brain/`
**Docs:** `docs/05-features/second-brain.md`

## MCP Memory - Second Brain

Quack uses **MCP Memory** (`@modelcontextprotocol/server-memory`) as the user's **Second Brain** - a persistent knowledge base that AI agents should actively use and contribute to.

### Why Use MCP Memory?

The MCP Memory is the user's personal knowledge graph containing:
- **Patterns & Best Practices** discovered during development
- **Architectural Decisions** and their rationale
- **Bug Solutions** that were hard to find
- **User Preferences** and working style
- **Project Context** that helps AI understand the codebase
- **Lessons Learned** from past mistakes

### When to SEARCH Memory (Read)

**ALWAYS search memory during the Analysis phase:**
- Before answering questions you're unsure about
- When investigating bugs or issues
- When making architectural decisions
- When the user asks about past work or decisions
- When you need context about patterns used in the project

```typescript
// Example: Search for relevant context
mcp__memory__search_nodes({ query: "authentication pattern" })
mcp__memory__search_nodes({ query: "bug fix dropdown" })
```

### When to SAVE to Memory (Write)

**ALWAYS save important discoveries:**
- Bug fixes that were tricky to solve
- Patterns that work well in this project
- Architectural decisions and their rationale
- User preferences you learn during conversation
- Solutions that might be useful in the future
- Configuration quirks or gotchas

### Memory Scopes

Memories can be **Global** (visible everywhere) or **Project-scoped** (visible only in a specific project).

**Project-scoped memories use the `belongs_to_project` relation:**

```jsonl
// Project entity
{"type":"entity","name":"quack-app","entityType":"project","observations":["Path: /Users/alekdob/Desktop/Dev/Personal/quack-app"]}

// Memory scoped to project
{"type":"entity","name":"pattern_react_hooks","entityType":"pattern","observations":["Use custom hooks for reusable logic"]}
{"type":"relation","from":"pattern_react_hooks","to":"quack-app","relationType":"belongs_to_project"}
```

**When saving memories via AI:**
- **Global memories**: Facts about user, preferences, general knowledge - NO project relation needed
- **Project memories**: Patterns, decisions, context specific to THIS project - ADD `belongs_to_project` relation

**Current project: quack-app**
- When saving project-specific memories, create relation: `{ from: "<entity>", to: "quack-app", relationType: "belongs_to_project" }`
- Global memories (about Alek, general preferences) don't need project relation

### MCP Tools for Memories

| Tool | Purpose |
|------|---------|
| `mcp__memory__search_nodes` | Search existing memories (USE OFTEN!) |
| `mcp__memory__read_graph` | Read entire knowledge graph |
| `mcp__memory__create_entities` | Create new memory entities |
| `mcp__memory__create_relations` | Create relations between entities |
| `mcp__memory__add_observations` | Add observations to existing entities |

### Entity Types for Memories

Use consistent entity types for better organization:
- `pattern` - Code patterns and best practices
- `bug_fix` - Solutions to bugs
- `decision` - Architectural or technical decisions
- `preference` - User preferences
- `gotcha` - Common pitfalls and how to avoid them
- `tool` - Tools and their configurations
- `project` - Project metadata

## Critical Rules

1. **⚠️ TESTING**: Write Vitest tests for new features (see Testing section)
2. **⚠️ DOCUMENTATION**: Update relevant docs in `/docs` when making changes
3. **⚠️ ARCHITECTURE**: Update `docs/01-architecture.md` for architectural changes
4. **⚠️ MCP MEMORY**:
   - **SEARCH** memory during Analysis phase for relevant context, patterns, and past solutions
   - **SAVE** important discoveries: bug fixes, patterns, decisions, preferences, gotchas
   - This is the user's Second Brain - use it actively!
5. All UI text must be in English (user is Italian, but app is English)
6. Use Discovery Protocol before answering questions
7. Coordinate with Protocol Droids for specialized tasks
8. Follow agentic cycle for development
