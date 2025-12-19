---
description: "MANDATORY: Read memory at session start, update at session end"
alwaysApply: true
---

# MCP Memory - Second Brain Protocol

You have access to **MCP Memory** - the user's **Second Brain**. This is a persistent knowledge graph that you MUST actively use.

## MANDATORY: Session Start Protocol

**BEFORE doing ANY work, you MUST:**

1. Call `mcp__memory__read_graph()` to load the full knowledge graph
2. Review entities related to the current project (look for `belongs_to_project` relations)
3. Check for recent diary entries (entity type: `diary`)
4. ONLY THEN proceed with the user's request

**This is NOT optional.** The memory contains critical context that will save time and prevent mistakes.

## MANDATORY: Session End Protocol

**After completing significant work, you MUST:**

1. Update the session diary with `[YYYY-MM-DD]` prefixed observations
2. Save any new patterns, bug fixes, or decisions as entities
3. Link project-specific entities with `belongs_to_project` relation

## When to SEARCH Memory

- Before answering questions you're unsure about
- When investigating bugs or issues
- When making architectural decisions
- When you need context about patterns used in the project
- **BEFORE doing grep/file searches** - the answer might already be in memory!

## When to SAVE to Memory

- Bug fixes that were tricky to solve
- Patterns that work well in this project
- Architectural decisions and their rationale
- User preferences you learn during conversation
- Solutions that might be useful in the future
- Configuration quirks or gotchas

## Memory Scopes

- **Global memories**: Facts about user, preferences - NO project relation needed
- **Project memories**: Patterns, decisions, context - ADD `belongs_to_project` relation

## Entity Types

Use consistent entity types:
- `diary` - Session summaries and daily work logs
- `pattern` - Code patterns and best practices
- `bug_fix` - Solutions to bugs
- `decision` - Architectural or technical decisions
- `preference` - User preferences
- `gotcha` - Common pitfalls and how to avoid them
- `project` - Project metadata

## MCP Tools

| Tool | Purpose |
|------|---------|
| `mcp__memory__read_graph` | **USE FIRST** - Load full knowledge graph |
| `mcp__memory__search_nodes` | Search for specific topics |
| `mcp__memory__create_entities` | Create new memory entities |
| `mcp__memory__add_observations` | Add to existing entities |
| `mcp__memory__create_relations` | Link entities together |

## Observation Format

Always prefix observations with **today's actual date** in format `[YYYY-MM-DD]`:

**IMPORTANT**: Use the CURRENT date from your system context, NOT a date from your training data.
If unsure, check the current date before adding observations.

Example format:
```
"[YYYY-MM-DD] Implemented feature X, fixed bug Y, decided to use pattern Z"
```

**Common mistake to avoid**: Do NOT use 2024 dates in 2025! Always verify the current year.
