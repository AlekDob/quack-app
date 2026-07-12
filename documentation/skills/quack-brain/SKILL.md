---
name: quack-brain
description: Quack Brain + Works — search documentation/features, manage tickets in .codetta/works/, save discoveries. Use for project context, feature docs, work items W-NNN, and Pinky knowledge search.
---

# Quack Brain + Works

Pre-installed Quack PM skill. Combines the **knowledge brain** (`documentation/`) with the **Works ticket layer** (`.codetta/works/`). Feature modules in Works map 1:1 to `documentation/features/*.md`.

## Knowledge (search before acting)

Access chain: `CLAUDE.md` → `documentation/features/` → `documentation/{decisions,bugs,gotchas,diary}/` → global `~/.quack/brain/` (or Pinky `brain.db` when extension installed).

| Path | Role |
|---|---|
| `documentation/features/NNN-slug.md` | Durable feature map — **also a Works module** |
| `documentation/decisions/` | Architectural rationales |
| `documentation/diary/` | Changelog entries |
| `.codetta/works/snapshot.json` | Work tickets (W-001…) linked to feature modules |

When Pinky Brain is installed (Quack Store → `pinky-brain`), use `pinky search` / Brain tab for hybrid BM25+vector search. Otherwise read feature docs and `map.md` directly.

## Works tickets (programming & management)

Each workspace keeps tickets in `.codetta/works/`:

| File | Role |
|---|---|
| `snapshot.json` | Modules (from feature docs), labels, work items, view prefs |
| `events.jsonl` | Append-only audit log |

### Module ↔ feature doc mapping

- Filename `054-works-layer.md` → module id `feat:054-works-layer`, title from H1
- Work items reference `moduleId`; context inject includes `documentation/features/…` path
- Create work for a feature: set `featureSlug: "054-works-layer"` or pick module in Works UI

### Agent workflow

1. **Orient** — read `documentation/features/NNN-*.md` for the area you're changing
2. **Ticket** — find or create work `W-NNN` in `snapshot.json` under the matching feature module
3. **Link** — attach chat via `linkedChatIds` or `@W-001` mention; context inject prepends work block on send
4. **Execute** — implement; update description blocks + status (`todo` → `in_progress` → `done`)
5. **Save** — append diary entry; use Pinky `save` / BrainSaveChip for durable gotchas

### Work item fields

`shortId`, `title`, `status`, `priority`, `descriptionBlocks`, `linkedChatIds`, optional `planeIssueId`. Types in `src/works.ts`.

### Plan mode

Entering Plan auto-creates a draft work (module `054-works-layer`). Approving copies plan into description and sets `in_progress`.

## Writing discoveries

After non-trivial work, save knowledge:

| Type | Folder |
|---|---|
| Feature behavior | Update matching `documentation/features/NNN-*.md` |
| Decision | `documentation/decisions/` |
| Gotcha / bug | `documentation/bugs/` or `gotchas/` |
| Daily log | `documentation/diary/YYYY-MM-DD.md` |

YAML frontmatter + markdown body. Set `last_verified` when confirming accuracy.

## UI surfaces

- **Quack Brain** tab — Knowledge search (Pinky segment when installed)
- **Works** tab — list / kanban / timeline; modules rail = feature docs
- **Composer** — Work pill, `@W-001`, context inject toggle
- **Agent Hub** — `W-NNN` badge on linked sessions

## Related skills

- `/quack-works` — ticket CRUD details, Plane sync, composer actions
- Pinky CLI — `pinky search`, `pinky save`, `pinky reindex documentation`
