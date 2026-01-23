# Second Brain - File-based Knowledge Store

## Overview

Quack's Second Brain is a **file-first** knowledge system that stores discoveries, patterns, and decisions as markdown files in `~/.quack/brain/`.

No database, no MCP server - just markdown files with YAML frontmatter that can be browsed in Finder or Obsidian.

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  AI Chat Hook   │────>│ brainFileService  │────>│  ~/.quack/brain/ │
│  (auto-learn)   │     │    (Tauri fs)     │     │  (markdown files)│
└─────────────────┘     └──────────────────┘     └─────────────────┘
                                                         │
┌─────────────────┐                                      │
│  Claude Skill   │──── reads/writes directly ──────────┘
│  (quack-brain)  │
└─────────────────┘
```

### Three Layers

1. **Storage**: Markdown files in `~/.quack/brain/` with YAML frontmatter
2. **AI Access**: Claude skill (`.claude/skills/quack-brain/skill.md`) teaches Claude how to read/write brain files
3. **Auto-learn**: Post-session hook in `useClaudeChat.ts` evaluates AI responses for knowledge worth saving

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
        └── diary/      # Daily logs (YYYY-MM-DD.md)
```

## File Format

Each entry is a markdown file with YAML frontmatter:

```markdown
---
type: bug_fix
project: quack-app
created: 2025-01-15
tags: [react, hooks, state]
---

# Fixed: useEffect infinite loop with dependency array

The issue was caused by creating new object references on every render...
```

## Key Files

| File | Purpose |
|------|---------|
| `src/services/brainFileService.ts` | Read/write/list brain files via Tauri commands |
| `.claude/skills/quack-brain/skill.md` | Skill that teaches Claude how to access brain |
| `src/components/settings/categories/SecondBrainSettings.tsx` | Settings panel |
| `src/components/TerminalSidebar.tsx` | "Open Brain" button |

## Auto-learn System

The `evaluateAndSaveKnowledge()` function in `brainFileService.ts` detects knowledge patterns in AI responses:

- **Bug fixes**: Responses containing fix/resolved/root cause language
- **Patterns**: Responses describing best practices or techniques
- **Gotchas**: Responses warning about pitfalls
- **Decisions**: Responses discussing architecture choices

Only responses >200 chars with code blocks or substantial explanation trigger auto-save.

## UI Integration

- **Settings**: Second Brain section shows path and "Reveal"/"Open in Obsidian" buttons
- **Sidebar**: Purple brain button opens the brain folder in Finder
- **No in-app editor**: Brain files are edited in Obsidian or any markdown editor
