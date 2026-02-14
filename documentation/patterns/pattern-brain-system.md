---
type: pattern
created: 2026-02-13
last_verified: 2026-02-14
tags: [brain, knowledge-store, documentation, tauri]
---

# Pattern: Brain System

## Overview

The Quack Brain is a two-level file-based knowledge store with a visual UI. No database, pure markdown with YAML frontmatter.

## Architecture

### Two-Level Store

| Level | Path | Purpose | Scope |
|-------|------|---------|-------|
| **Project** | `{project}/documentation/` | Project-specific knowledge | Git-tracked, per-project |
| **Global** | `~/.quack/brain/` | Cross-project patterns | Personal, shared |

### Project documentation/ Structure

```
documentation/
  map.md              # Architecture entry point (type: map)
  decisions/          # Why we chose X (type: decision)
  bugs/               # Root cause + fix (type: bug_fix)
  patterns/           # Reusable solutions (type: pattern)
  gotchas/            # Non-obvious pitfalls (type: gotcha)
  diary/              # Daily log, max 30 lines (type: diary)
  inbox/              # Quick captures, triage later
```

### Global brain/ Structure

```
~/.quack/brain/
  patterns/           # Cross-project patterns
  preferences/        # Personal preferences (type: preference)
  people/             # People notes (type: person)
  tools/              # Tool-specific knowledge (type: tool)
  diary/              # Global diary
```

## File Format

Every entry uses YAML frontmatter + markdown body:

```markdown
---
type: bug_fix
created: 2026-02-13
last_verified: 2026-02-13
tags: [react, hooks]
---
# Title
Content...
```

- Files without `type` in frontmatter get it inferred from folder path (`/bugs/` -> `bug_fix`)
- `last_verified` tracks when content was last confirmed accurate. Entries older than 3 months or referencing specific line numbers should be re-verified or removed.

## Visual Brain Window

Separate Tauri webview window (`brain_window.rs`) with dark theme.

### Components

| Component | File | Purpose |
|-----------|------|---------|
| BrainApp | BrainApp.tsx | Main shell, scope management, counts |
| BrainSidebar | BrainSidebar.tsx | Navigation, scope toggle, path display |
| BrainTimeline | BrainTimeline.tsx | Activity feed from diary + JSONL |
| BrainKnowledge | BrainKnowledge.tsx | Browse entries by category |
| BrainGraph | BrainGraph.tsx | Force-directed knowledge graph |
| BrainEditor | BrainEditor.tsx | Inline markdown viewer/editor |
| BrainEntryCard | BrainEntryCard.tsx | Entry card in knowledge grid |

### Sidebar Pinned Items

- **Map** — opens `map.md` (architecture entry point), shown when file exists
- **CLAUDE.md** — opens project's `CLAUDE.md`, shown in Project scope only

### Scope Toggle

Two modes: **Project** (documentation/) and **Global** (~/.quack/brain/). Switching scope reloads all counts and clears the editor.

### Knowledge Graph

Nodes = brain entries, colored by type. Connections = shared tags (weight = number of shared tags). Tags used by >20 nodes are skipped to prevent mega-clusters.

Physics: charge strength -120, distance max 400, link distance varies by weight.

## Service Layer

`brainFileService.ts` handles all CRUD:

- `listBrainEntries(opts)` — recursive `.md` scan with optional type filter
- `readBrainEntry(path)` — parse frontmatter + content
- `saveBrainEntry(entry)` — write with frontmatter
- `inferTypeFromPath(path)` — fallback type detection from folder name
- `getProjectDocPath(root)` / `getBrainRootPath()` — resolve paths

## CLAUDE.md Connection (Access Chain)

The Brain connects to agents via a 3-level access chain:

| Level | What | When loaded | Purpose |
|-------|------|-------------|---------|
| **CLAUDE.md** Knowledge Base section | Links to map.md, critical gotchas, patterns | Every session (auto-loaded) | Routing layer — agents see paths and can `Read` directly |
| **Rule** `use-quack-brain.md` | Access chain + search/save rules | Every session (auto-loaded) | Tells agents WHEN to search and WHEN to save |
| **Skill** `quack-brain/SKILL.md` | Full format specs, save criteria, diary format | On-demand (skill invocation) | Tells agents HOW to read/write brain entries |

The CLAUDE.md Knowledge Base section is placed **outside** the auto-injected agent header, so it persists across agent changes.

### What CLAUDE.md links to
- `documentation/map.md` — architecture entry point
- Critical gotchas by name (token tracking, Tauri commands, MCP timeouts, LocalStorage)
- `documentation/patterns/` folder reference
- Full knowledge store paths + skill reference

## Agent Configuration

- **Skill**: `~/.claude/skills/quack-brain/SKILL.md` (~90 lines)
- **Rule**: `~/.claude/rules/use-quack-brain.md` (~19 lines, includes Access Chain)
- **Agent**: deleted (was redundant with skill)

The skill instructs agents to: check CLAUDE.md references first, then search project `documentation/`, then global brain. Save only genuine discoveries that pass 4 criteria (genuine, useful in 6 months, verified, clear trigger). When saving a critical gotcha or pattern, link it in CLAUDE.md's Knowledge Base section.

## Window Configuration (Tauri)

- `TitleBarStyle::Overlay` for transparent title bar on macOS
- Empty native title, "Quack Brain" rendered as HTML in sidebar
- `data-tauri-drag-region` on sidebar and top drag bar for window dragging
- Opened via `open_brain_window` Rust command with optional `project_path` parameter
