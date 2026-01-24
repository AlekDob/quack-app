---
description: "Use Quack Brain as Second Brain - file-based knowledge storage in ~/.quack/brain/"
---
# Quack Brain - Second Brain

You have access to **Quack Brain** - the user's **Second Brain**. This is a file-based knowledge store using markdown files with YAML frontmatter.

## Brain Path Discovery

The brain path is configurable. **ALWAYS read `~/.quack/brain-path` first** to discover the actual location. If the file doesn't exist, fall back to `~/.quack/brain/`.

## Architecture

Quack Brain uses a **file-first** approach:
- **Markdown files** organized by type and project
- **Claude Skill** (`quack-brain`) for AI access patterns
- **Auto-learn**: LLM self-evaluation (Claudeception-style, language-agnostic)

No database, no MCP server, no corruption risk.

## When to SEARCH Brain (Read)

**ALWAYS search brain during the Analysis phase:**

- Before answering questions you're unsure about
- When investigating bugs or issues
- When making architectural decisions
- When the user asks about past work or decisions
- When you need context about patterns used in the project

### Search Priority Order

1. **FIRST**: Read `map.md` if you need to locate components or understand architecture
2. **THEN**: List files in the current project's brain folder (file names are self-descriptive)
3. **THEN**: Check `inbox/` for pending items relevant to current task
4. **THEN**: Only if nothing relevant, search globally across `~/.quack/brain/`
5. **LAST**: Read specific files only when the title matches your need.

```bash
# STEP 1: Read map for architecture orientation
Read "~/.quack/brain/projects/quack-app/map.md"

# STEP 2: List project files (titles tell you what's inside)
Glob "~/.quack/brain/projects/quack-app/**/*.md"

# STEP 3: Check inbox for pending items
Glob "~/.quack/brain/projects/quack-app/inbox/*.md"

# STEP 4: Only if needed, search globally
Grep pattern="dropdown" path="~/.quack/brain/"

# STEP 5: Read only what matches
Read file_path="~/.quack/brain/projects/quack-app/bugs/fix-dropdown-z-index.md"
```

### Inbox (Mobile-First Ideas)

The `inbox/` folder captures quick ideas from mobile (Obsidian Sync). Rules:
- Check inbox when starting work — process relevant items
- Minimal frontmatter: only `type: inbox` and `created`
- After processing: delete or promote to proper folder
- Do NOT auto-process all items — only those relevant to current context

### Map (Architecture Glossary)

`map.md` is a single navigation file per project. Rules:
- Read map FIRST before grepping the codebase
- Keep updated when significant components are added/moved
- Tables preferred: Component | Path | Purpose
- One file per project, concise and scannable

## When to SAVE to Brain (Write)

**ALWAYS save important discoveries:**

- Bug fixes that were tricky to solve
- Patterns that work well in this project
- Architectural decisions and their rationale
- User preferences you learn during conversation
- Solutions that might be useful in the future
- Configuration quirks or gotchas

## File Format

Each brain entry is a markdown file with YAML frontmatter:

```markdown
---
type: pattern
project: quack-app
created: 2025-01-23
tags: [react, hooks, performance]
---

# Pattern: Memoize expensive list operations

Use useMemo for filtered/sorted lists to avoid re-computation on every render...
```

## Directory Structure

```
~/.quack/brain/
├── global/
│   ├── patterns/     # Cross-project patterns
│   ├── preferences/  # User preferences
│   ├── people/       # People & contacts
│   └── tools/        # Tool configurations
└── projects/
    └── {project-name}/
        ├── patterns/   # Project-specific patterns
        ├── bugs/       # Bug fixes
        ├── decisions/  # Architecture decisions
        ├── gotchas/    # Pitfalls to avoid
        ├── diary/      # Daily logs (YYYY-MM-DD.md)
        ├── inbox/      # Quick ideas & todos (mobile-first via Obsidian Sync)
        └── map.md      # Architecture map & glossary
```

## Entity Types

| Type | Folder | When to use |
|------|--------|-------------|
| `pattern` | patterns/ | Reusable code patterns |
| `bug_fix` | bugs/ | Non-trivial bug solutions |
| `decision` | decisions/ | Architecture choices |
| `gotcha` | gotchas/ | Pitfalls and caveats |
| `preference` | preferences/ | User preferences |
| `person` | people/ | People & contacts |
| `tool` | tools/ | Tool configs |

## Naming Convention

File names MUST be **explicit and self-descriptive**. Someone should understand the content from the title alone, without opening the file.

**Good** (tells you what's inside):
- `fix-white-screen-after-standby.md`
- `pattern-error-boundary-per-provider.md`
- `decision-file-based-brain-over-sqlite.md`
- `gotcha-tauri-shell-plugin-limitations.md`

**Bad** (vague, requires reading):
- `bug-fix-1.md`, `pattern-react.md`, `note.md`

## Diary Rules

- Path: `diary/YYYY-MM-DD.md`
- **NO tags in diary frontmatter** — diary is temporal, not categorical
- Use only `type: diary`, `project`, `date` in frontmatter
- Tags belong only on knowledge files (bugs, patterns, decisions, gotchas)

## Auto-Evaluation (Claudeception-style)

After completing any significant task, evaluate whether you produced knowledge worth saving:

1. Was this a genuine discovery? (not a docs lookup)
2. Would it help someone in 6 months hitting the same problem?
3. Is the solution verified to work?
4. Does it have clear trigger conditions?

If ALL four are true → save it using Write. If any is false → don't save.

Write in the same language the user communicates in.

## Critical Behavior

1. **During Analysis**: Search brain files for relevant context BEFORE starting work
2. **Search project folder first**: List file names before grepping everywhere
3. **After completing tasks**: Self-evaluate and save if knowledge qualifies
4. **DO NOT use MCP tools** - use Grep, Read, Write directly on `~/.quack/brain/`
5. **This is the user's Second Brain** - use it actively, not passively!
