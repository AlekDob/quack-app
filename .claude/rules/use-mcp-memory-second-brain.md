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

**ALWAYS search brain during the Analysis phase:**

- Before answering questions you're unsure about
- When investigating bugs or issues
- When making architectural decisions
- When the user asks about past work or decisions
- When you need context about patterns used in the project

```typescript
// Search examples
mcp__quack-brain__search({ query: "authentication pattern" })
mcp__quack-brain__search({ query: "bug fix dropdown" })
mcp__quack-brain__search({ query: "user preference" })
```

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
mcp__quack-brain__create_entity({
  name: "pattern_react_error_boundary",
  entityType: "pattern",
  observations: ["Wrap providers individually with ErrorBoundary for graceful degradation"],
  projectId: "quack-app" // Optional: scope to project
})

// Add observation to existing entity
mcp__quack-brain__add_observation({
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
| `mcp__quack-brain__search` | Full-text search across entities and observations |
| `mcp__quack-brain__get_graph` | Read entire knowledge graph |
| `mcp__quack-brain__create_entity` | Create new brain entity |
| `mcp__quack-brain__add_observation` | Add observation to existing entity |
| `mcp__quack-brain__create_relation` | Create relations between entities |
| `mcp__quack-brain__list_entities` | List entities with optional filters |
| `mcp__quack-brain__get_backlinks` | Get entities that link TO a given entity via [[WikiLinks]] |
| `mcp__quack-brain__get_wikilinks` | Get all [[WikiLinks]] FROM a given entity |
| `mcp__quack-brain__read_canvas` | Read Obsidian canvas files (.canvas) with nodes and edges |
| `mcp__quack-brain__create_canvas` | Create new canvas diagrams with text/file nodes and connections |
| `mcp__quack-brain__update_canvas` | Update existing canvas (add/remove/modify nodes and edges) |

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

Every note automatically links to its creation day's diary via `[[YYYY-MM-DD]]` WikiLink. When creating entities, the diary is auto-updated with the new note.

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
mcp__quack-brain__get_backlinks({ entityName: "React Hooks" })

// Get all outgoing links from an entity
mcp__quack-brain__get_wikilinks({ entityName: "pattern_error_handling" })
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
- **file**: Embedded markdown files from the vault

### Creating Canvas Diagrams

```typescript
// Create a flowchart
mcp__quack-brain__create_canvas({
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
mcp__quack-brain__read_canvas({
  canvasPath: "/path/to/vault/QuackBrain/projects/quack-app/diagram.canvas"
})

// Update canvas - add a new node with connection
mcp__quack-brain__update_canvas({
  canvasPath: "/path/to/canvas.canvas",
  addNodes: [
    { id: "n4", type: "text", x: 150, y: 300, text: "Database", color: "orange" }
  ],
  addEdges: [
    { fromNode: "n3", toNode: "n4", fromSide: "bottom", toSide: "top" }
  ]
})
```

### Canvas File Location

- **Project canvases**: `QuackBrain/projects/{project-id}/*.canvas`
- **Global canvases**: `QuackBrain/global/canvases/*.canvas`

## Critical Behavior

1. **During Analysis**: Search brain for relevant context BEFORE starting work
2. **After completing tasks**: Save important discoveries to brain
3. **Date observations**: Prefix with `[YYYY-MM-DD]` for temporal context
4. **Create diagrams**: Use canvas tools to visualize architecture and flows
5. **This is the user's Second Brain** - use it actively, not passively!
