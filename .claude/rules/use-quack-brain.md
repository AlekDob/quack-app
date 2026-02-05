---
description: "Use Quack Brain as Second Brain - two-level knowledge storage"
---

# Quack Brain - Two-Level Second Brain

You have access to **Quack Brain** - the user's **Second Brain**. This is a file-based knowledge store using markdown files with YAML frontmatter.

## Architecture

Quack Brain uses a **two-level architecture**:

1. **Project Brain** (`{project}/.quack/brain/`) - Project-specific knowledge, shareable with team
2. **Global Brain** (`~/.quack/brain/global/`) - Personal knowledge, cross-project patterns, preferences

No database, no MCP server, no corruption risk.

## When to SEARCH Brain (Read)

**ALWAYS search brain during the Analysis phase:**

- Before answering questions you're unsure about
- When investigating bugs or issues
- When making architectural decisions
- When the user asks about past work or decisions
- When you need context about patterns used in the project

### Search Priority: Project Brain → Global Brain

1. **FIRST**: Read project's `map.md` for architecture orientation
2. **THEN**: List files in project brain folder (file names are self-descriptive)
3. **THEN**: Check project's `inbox/` for pending items relevant to current task
4. **THEN**: Search global brain for cross-project patterns and preferences
5. **LAST**: Read specific files only when the title matches your need

```bash
# STEP 1: Read map for architecture orientation (PROJECT BRAIN)
Read "{project}/.quack/brain/map.md"

# STEP 2: List project brain files (titles tell you what's inside)
Glob "{project}/.quack/brain/**/*.md"

# STEP 3: Check inbox for pending items
Glob "{project}/.quack/brain/inbox/*.md"

# STEP 4: Search global brain for cross-project knowledge
Glob "~/.quack/brain/global/**/*.md"
Grep pattern="dropdown" path="~/.quack/brain/global/"

# STEP 5: Read only what matches
Read "{project}/.quack/brain/bugs/fix-dropdown-z-index.md"
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

### Where to Save

| Knowledge Type | Location | Example |
|----------------|----------|---------|
| **Project-specific** | `{project}/.quack/brain/` | Bug fix for this project, architecture decision |
| **Cross-project** | `~/.quack/brain/global/` | Reusable patterns, personal preferences |

### What to Save

**Project Brain** (`{project}/.quack/brain/`):
- Bug fixes that were tricky to solve
- Patterns specific to this project
- Architectural decisions and their rationale
- Project-specific gotchas

**Global Brain** (`~/.quack/brain/global/`):
- Reusable patterns across projects
- User preferences you learn during conversation
- People and contacts
- Tool configurations

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
{project}/.quack/brain/        # Project-specific (shareable, NOT gitignored)
├── patterns/                  # Project-specific patterns
├── bugs/                      # Bug fixes
├── decisions/                 # Architecture decisions
├── gotchas/                   # Pitfalls to avoid
├── diary/                     # Daily logs (YYYY-MM-DD.md)
├── inbox/                     # Quick ideas & todos (mobile-first)
└── map.md                     # Architecture map & glossary

~/.quack/brain/global/         # Personal (cross-project)
├── patterns/                  # Reusable code patterns
├── preferences/               # User preferences
├── people/                    # People & contacts
└── tools/                     # Tool configurations
```

## Entity Types

| Type | Folder | Brain | When to use |
|------|--------|-------|-------------|
| `pattern` | patterns/ | Project or Global | Reusable code patterns |
| `bug_fix` | bugs/ | Project | Non-trivial bug solutions |
| `decision` | decisions/ | Project | Architecture choices |
| `gotcha` | gotchas/ | Project or Global | Pitfalls and caveats |
| `preference` | preferences/ | Global | User preferences |
| `person` | people/ | Global | People & contacts |
| `tool` | tools/ | Global | Tool configs |

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

- Path: `{project}/.quack/brain/diary/YYYY-MM-DD.md`
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
2. **Search project brain first**: Then global brain for cross-project knowledge
3. **After completing tasks**: Self-evaluate and save if knowledge qualifies
4. **DO NOT use MCP tools** - use Grep, Read, Write directly
5. **This is the user's Second Brain** - use it actively, not passively!
