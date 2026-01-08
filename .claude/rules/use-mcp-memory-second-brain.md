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
mcp__brain__brain_search({ query: "authentication pattern" })
mcp__brain__brain_search({ query: "bug fix dropdown" })
mcp__brain__brain_search({ query: "user preference" })
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
mcp__brain__brain_create_entity({
  name: "pattern_react_error_boundary",
  entityType: "pattern",
  observations: ["Wrap providers individually with ErrorBoundary for graceful degradation"],
  projectId: "quack-app" // Optional: scope to project
})

// Add observation to existing entity
mcp__brain__brain_add_observation({
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
| `mcp__brain__brain_search` | Full-text search across entities and observations |
| `mcp__brain__brain_get_graph` | Read entire knowledge graph |
| `mcp__brain__brain_create_entity` | Create new brain entity |
| `mcp__brain__brain_add_observation` | Add observation to existing entity |
| `mcp__brain__brain_create_relation` | Create relations between entities |
| `mcp__brain__brain_list_entities` | List entities with optional filters |
| `mcp__brain__brain_get_backlinks` | Get entities that link TO a given entity via [[WikiLinks]] |
| `mcp__brain__brain_get_wikilinks` | Get all [[WikiLinks]] FROM a given entity |

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
mcp__brain__brain_get_backlinks({ entityName: "React Hooks" })

// Get all outgoing links from an entity
mcp__brain__brain_get_wikilinks({ entityName: "pattern_error_handling" })
```

## Critical Behavior

1. **During Analysis**: Search brain for relevant context BEFORE starting work
2. **After completing tasks**: Save important discoveries to brain
3. **Date observations**: Prefix with `[YYYY-MM-DD]` for temporal context
4. **This is the user's Second Brain** - use it actively, not passively!
