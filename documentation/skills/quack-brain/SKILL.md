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
| `.codetta/works/snapshot.json` | Work index (metadata) — bodies live in `items/W-NNN.md` |

When Pinky Brain is installed (Quack Store → `pinky-brain`), use `pinky search` / Brain tab for hybrid BM25+vector search. Otherwise read feature docs and `map.md` directly.

## Works tickets (programming & management)

Each workspace keeps tickets in `.codetta/works/`:

| File | Role |
|---|---|
| `snapshot.json` | Index — modules, labels, item metadata, view prefs |
| `items/W-NNN.md` | One markdown file per ticket (frontmatter + body) |
| `events.jsonl` | Append-only audit log |

### Module ↔ feature doc mapping

- Filename `054-works-layer.md` → module id `feat:054-works-layer`, title from H1
- Work items reference `moduleId`; context inject includes `documentation/features/…` path
- Create work for a feature: set `featureSlug: "054-works-layer"` or pick module in Works UI

### Agent workflow

1. **Orient** — read `documentation/features/NNN-*.md` for the area you're changing
2. **Ticket** — find or create `W-NNN` in `.codetta/works/items/W-NNN.md` under the matching feature module
3. **Link** — add chat to `linkedChats` in frontmatter or `@W-001` mention; context inject prepends work block on send
4. **Execute** — implement; update work `.md` body + frontmatter `status` (`todo` → `in_progress` → `done`)
5. **Save** — append diary entry; use Pinky `save` / BrainSaveChip for durable gotchas

### Work item fields

`shortId`, `title`, `status`, `priority`, markdown **body** in `items/W-NNN.md`; comments in index. Types in `src/works.ts`, I/O in `src/workItemMd.ts`.

### Plan mode

Entering Plan auto-creates a draft work (module `054-works-layer`). Approving copies plan into the work `.md` body and sets `in_progress`.

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
