---
description: "Use Quack Brain as Second Brain - search before answering, save important discoveries, synced with Obsidian"
---
# Quack Brain - Second Brain

You have access to **Quack Brain** - the user's **Second Brain**. This is a persistent knowledge graph synchronized with Obsidian vault that you should actively use and contribute to.

## Architecture

Quack Brain uses a **bidirectional sync** system:
- **SQLite Database** - Primary storage in Quack app (fast queries, relations, embeddings)
- **Obsidian Vault** - Markdown files for human editing and cross-device sync
- **MCP Server** - Exposes brain data to Claude Code and other AI agents

## When to SEARCH Brain (Read)

**USE `smart_search` - The AI-Driven Approach:**

Unlike automatic keyword extraction (which fails with multilingual content), **YOU decide WHEN and WHAT to search**. Use natural language queries that describe what you need.

**ALWAYS search brain during the Analysis phase:**

- Before answering questions you're unsure about
- When investigating bugs or issues
- When making architectural decisions
- When the user asks about past work or decisions
- When you need context about patterns used in the project

```typescript
// ✅ CORRECT: Use smart_search with natural language queries
mcp__brain__smart_search({
  query: "authentication patterns and security decisions",
  context: "investigating auth flow for new feature"
})

mcp__brain__smart_search({
  query: "dropdown bugs and fixes",
  context: "user reported dropdown issue"
})

mcp__brain__smart_search({
  query: "user coding preferences and style",
  context: "need to follow user's preferred patterns"
})

// ❌ AVOID: Don't use basic search with single keywords
// mcp__brain__search({ query: "auth" }) // Too vague!
```

**Why `smart_search` is better:**
- Works with ANY language (Italian, English, mixed)
- Prefix matching: "auth" finds "authentication", "authorize", etc.
- You formulate semantic queries, not keyword lists
- Include context to help with debugging

## When to SAVE to Brain (Write)

**ALWAYS save important discoveries:**

- Bug fixes that were tricky to solve
- Patterns that work well in this project
- Architectural decisions and their rationale
- User preferences you learn during conversation
- Solutions that might be useful in the future
- Configuration quirks or gotchas
- Lessons learned from mistakes

```typescript
// Create new entity
mcp__brain__create_entity({
  name: "pattern_react_error_boundary",
  entityType: "pattern",
  observations: ["Wrap providers individually with ErrorBoundary for graceful degradation"],
  projectId: "quack-app" // Optional: scope to project
})

// Add observation to existing entity
mcp__brain__add_observation({
  entityName: "pattern_react_error_boundary",
  content: "[2025-01-07] Added global unhandledrejection handler for Promise errors"
})
```

## Memory Scopes

- **Global memories**: Facts about user, preferences, general knowledge - NO projectId needed
- **Project memories**: Patterns, decisions, context specific to a project - ADD `projectId` parameter

## MCP Tools Available

| Tool | Purpose |
|------|---------|
| `mcp__brain__smart_search` | **PRIMARY** - AI-driven semantic search with natural language queries |
| `mcp__brain__search` | Basic FTS5 search (use smart_search instead) |
| `mcp__brain__get_graph` | Read entire knowledge graph |
| `mcp__brain__create_entity` | Create new brain entity |
| `mcp__brain__add_observation` | Add observation to existing entity |
| `mcp__brain__create_relation` | Create relations between entities |
| `mcp__brain__list_entities` | List entities with optional filters |
| `mcp__brain__get_backlinks` | Get entities that link TO a given entity via [[WikiLinks]] |
| `mcp__brain__get_wikilinks` | Get all [[WikiLinks]] FROM a given entity |
| `mcp__brain__read_canvas` | Read Obsidian canvas files (.canvas) with nodes and edges |
| `mcp__brain__create_canvas` | Create new canvas diagrams with text/file nodes and connections |
| `mcp__brain__update_canvas` | Update existing canvas (add/remove/modify nodes and edges) |

## Entity Types (Tags)

Each note has **exactly ONE tag** that determines its folder location:

| Tag | Folder | Description |
|-----|--------|-------------|
| `component` | `components/` | UI components (React, Vue, etc.) |
| `function` | `functions/` | Functions and methods |
| `api` | `api/` | API endpoints, MCP tools |
| `pattern` | `patterns/` | Architectural patterns, best practices |
| `bug` | `bugs/` | Bug fixes and solutions |
| `decision` | `decisions/` | Architectural Decision Records (ADRs) |
| `task` | `tasks/` | Completed tasks |
| `config` | `config/` | Configuration notes |
| `idea` | `ideas/` | Ideas to explore |
| `todo` | `todos/` | Work in progress |
| `human` | `global/humans/` | People and contacts (ALWAYS global) |
| `note` | `notes/` | Generic notes |
| `glossary` | root | Human→Technical term mapping |
| `diary` | `diary/` | Daily logs (ALWAYS global) |

**Note**: `human` and `diary` tags are ALWAYS placed in global folders regardless of project scope.

## Relation Types

Available relation types for linking entities:
- `belongs_to_project` - Scope entity to a project
- `relates_to` - General relationship
- `depends_on` - Dependency relationship
- `created_by` - Authorship
- `uses` - Usage relationship
- `documented_in` - Documentation reference

## Obsidian Sync & Vault Structure

Entities are automatically synced to Obsidian as markdown files:
- **Location**: `{vault_path}/QuackBrain/` subfolder
- **Format**: YAML frontmatter + markdown body
- **Bidirectional**: Edit in Obsidian or Quack, changes sync both ways
- **Conflict Resolution**: Configurable policy (ask, brain_wins, obsidian_wins)

### Vault Folder Structure

```
QuackBrain/
├── diary/                    # Daily notes (#diary)
│   └── 2026-01-08.md
├── global/                   # Notes without project scope
│   ├── patterns/
│   ├── humans/
│   ├── ideas/
│   └── glossary.md
└── projects/                 # Project-scoped notes
    └── {project-name}/
        ├── components/
        ├── functions/
        ├── api/
        ├── patterns/
        ├── bugs/
        ├── decisions/
        ├── tasks/
        └── glossary.md
```

### Daily Diary Integration

Every note links to its creation day via `[[YYYY-MM-DD]]` WikiLink in frontmatter. However, **only temporal notes are added to the diary**:

**Temporal notes (appear in diary):**
- `bug` / `bug_fix` - Bug fixes and resolutions
- `task` - Completed tasks
- `decision` - Decisions made
- `todo` - Completed todos
- `gotcha` - Discovered pitfalls
- `event` - Events that happened

**Structural notes (NOT in diary):**
- `pattern`, `component`, `function`, `api` - Code documentation
- `idea`, `config`, `note` - Reference material
- `human`, `preference`, `fact` - Static knowledge

This keeps the diary clean and focused on "what happened today" rather than cluttering it with every note created.

### Diary Entry Format

**CRITICAL: When adding entries to the daily diary, follow these rules:**

1. **NO headings** - Do not use `#`, `##`, etc. in diary entries
2. **Use blockquotes** - Start each entry with `>` for visual separation
3. **NO tags** - Do not add `#tag` inline in diary content
4. **WikiLinks only** - Link to detailed notes with `[[note-name]]`
5. **Keep it brief** - One paragraph per entry, focus on what happened

**Correct diary entry format:**
```markdown
> Fixed critical bug where app became white after macOS standby. Enhanced `useSystemWakeHandler` with pageshow/pagehide events and CSS repaint forcing. See [[bug-white-screen-after-macos-standby]] for details.
```

**WRONG format (avoid):**
```markdown
## Bug Fix: White Screen  ← NO headings!
#bug #quack-app           ← NO tags!

Fixed the bug...
```

**Multiple entries in same day:**
```markdown
> Morning: Resolved authentication issue. See [[bug-auth-token-expired]].

> Afternoon: Implemented new feature for terminal tabs. See [[task-terminal-tabs]].
```

### WikiLinks

Use `[[NoteName]]` syntax to create relations between notes. These are tracked and visible in Obsidian's Graph View.

**WikiLinks are automatically extracted and stored:**
- When creating an entity with observations containing `[[links]]`
- When adding observations to existing entities
- When importing markdown files from Obsidian vault

**Supported formats:**
- `[[NoteName]]` - Simple link to another note
- `[[NoteName|Display Text]]` - Link with custom display text

**Use backlinks to discover connections:**
```typescript
// Find all notes that mention "React Hooks"
mcp__brain__get_backlinks({ entityName: "React Hooks" })

// Get all outgoing links from an entity
mcp__brain__get_wikilinks({ entityName: "pattern_error_handling" })
```

## Obsidian Canvas Support

The Brain MCP can read and write Obsidian Canvas files (.canvas) for visual diagrams, mind maps, and flowcharts.

### Canvas Colors

Obsidian uses numbers 1-6 for colors. The MCP accepts both number and name:

| Number | Name | Use for |
|--------|------|---------|
| 1 | red | Important, warnings, blockers |
| 2 | orange | Needs attention, questions |
| 3 | yellow | Ideas, notes |
| 4 | green | Done, approved, success |
| 5 | cyan | Info, reference |
| 6 | purple | Special, creative |

### Node Types

- **text**: Text cards with markdown content
- **file**: Embedded vault files (markdown notes, other canvases, local images like .png, .jpg)
- **link**: External URLs (GIF URLs from Giphy, web images, external resources)

### Canvas Location

**Canvas files are ALWAYS created in the project folder** (projectId is required):
- `QuackBrain/projects/{project-name}/*.canvas`

### Creating Canvas Diagrams

```typescript
// Create a flowchart
mcp__brain__create_canvas({
  name: "Architecture Overview",
  projectId: "quack-app",
  nodes: [
    { id: "n1", type: "text", x: 0, y: 0, text: "Frontend\nReact + TypeScript", color: "cyan" },
    { id: "n2", type: "text", x: 300, y: 0, text: "Backend\nTauri + Rust", color: "purple" },
    { id: "n3", type: "text", x: 150, y: 150, text: "MCP Server", color: "green" },
  ],
  edges: [
    { fromNode: "n1", toNode: "n3", fromSide: "bottom", toSide: "top" },
    { fromNode: "n2", toNode: "n3", fromSide: "bottom", toSide: "top" },
  ]
})

// Read existing canvas
mcp__brain__read_canvas({
  canvasPath: "/path/to/vault/QuackBrain/projects/quack-app/diagram.canvas"
})

// Update canvas - add a new node with connection
mcp__brain__update_canvas({
  canvasPath: "/path/to/canvas.canvas",
  addNodes: [
    { id: "n4", type: "text", x: 150, y: 300, text: "Database", color: "orange" }
  ],
  addEdges: [
    { fromNode: "n3", toNode: "n4", fromSide: "bottom", toSide: "top" }
  ]
})

// Canvas with embedded files and GIFs
mcp__brain__create_canvas({
  name: "Project Overview",
  projectId: "quack-app",
  nodes: [
    // Text node
    { id: "title", type: "text", x: 0, y: 0, text: "# Project Overview", color: "green" },
    // Embedded markdown note
    { id: "note1", type: "file", x: 0, y: 100, file: "projects/quack-app/patterns/auth-pattern.md", width: 300, height: 200 },
    // Embedded canvas (canvas-in-canvas)
    { id: "diagram", type: "file", x: 350, y: 100, file: "projects/quack-app/architecture.canvas", width: 400, height: 300 },
    // Embedded local image
    { id: "logo", type: "file", x: 0, y: 350, file: "assets/logo.png", width: 200, height: 200 },
    // External GIF from Giphy
    { id: "gif", type: "link", x: 250, y: 350, url: "https://media.giphy.com/media/.../giphy.gif", width: 200, height: 200 },
  ]
})
```

### Canvas File Location

- **Project canvases**: `QuackBrain/projects/{project-id}/*.canvas` (ALWAYS here, projectId required)

## Critical Behavior

1. **During Analysis**: Search brain for relevant context BEFORE starting work
2. **After completing tasks**: Save important discoveries to brain
3. **Date observations**: Prefix with `[YYYY-MM-DD]` for temporal context
4. **Create diagrams**: Use canvas tools to visualize architecture and flows
5. **This is the user's Second Brain** - use it actively, not passively!
