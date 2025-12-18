---
description: "Use MCP Memory as Second Brain - search before answering, save important discoveries"
alwaysApply: true
---

# MCP Memory - Second Brain

You have access to **MCP Memory** (`@modelcontextprotocol/server-memory`) - the user's **Second Brain**. This is a persistent knowledge graph that you should actively use and contribute to.

## When to SEARCH Memory (Read)

**ALWAYS search memory during the Analysis phase:**

- Before answering questions you're unsure about
- When investigating bugs or issues
- When making architectural decisions
- When the user asks about past work or decisions
- When you need context about patterns used in the project

```
// Search examples
mcp__memory__search_nodes({ query: "authentication pattern" })
mcp__memory__search_nodes({ query: "bug fix dropdown" })
mcp__memory__search_nodes({ query: "user preference" })
```

## When to SAVE to Memory (Write)

**ALWAYS save important discoveries:**

- Bug fixes that were tricky to solve
- Patterns that work well in this project
- Architectural decisions and their rationale
- User preferences you learn during conversation
- Solutions that might be useful in the future
- Configuration quirks or gotchas
- Lessons learned from mistakes

## Memory Scopes

- **Global memories**: Facts about user, preferences, general knowledge - NO project relation needed
- **Project memories**: Patterns, decisions, context specific to a project - ADD `belongs_to_project` relation

## MCP Tools Available

| Tool | Purpose |
|------|---------|
| `mcp__memory__search_nodes` | Search existing memories (USE OFTEN!) |
| `mcp__memory__read_graph` | Read entire knowledge graph |
| `mcp__memory__create_entities` | Create new memory entities |
| `mcp__memory__create_relations` | Create relations between entities |
| `mcp__memory__add_observations` | Add observations to existing entities |

## Entity Types

Use consistent entity types:
- `pattern` - Code patterns and best practices
- `bug_fix` - Solutions to bugs
- `decision` - Architectural or technical decisions
- `preference` - User preferences
- `gotcha` - Common pitfalls and how to avoid them
- `tool` - Tools and their configurations
- `project` - Project metadata

## Critical Behavior

1. **During Analysis**: Search memory for relevant context BEFORE starting work
2. **After completing tasks**: Save important discoveries to memory
3. **This is the user's Second Brain** - use it actively, not passively!
