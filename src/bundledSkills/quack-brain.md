---
name: quack-brain
description: Quack knowledge brain — search documentation/features before acting, read CLAUDE.md and decisions, save discoveries to diary/gotchas, Pinky hybrid search. Use when orienting on a codebase, finding feature docs, saving hard-won gotchas, or after /quack-works implementation — not for creating tickets (use /quack-works).
quack-bundled-version: 6
---

# Quack Brain

Knowledge layer for Quack desktop. **Works PM** (feature docs, modules, stories, tickets) lives in `/quack-works` — use this skill to **search**, **orient**, and **persist discoveries**.

## When to use

- Search before broad Explore/Grep
- Read `documentation/features/`, decisions, diary
- Save gotchas, append diary after work
- Pinky Brain installed → hybrid BM25+vector search
- User finished implementing tickets from `/quack-works`

## Access chain

`CLAUDE.md` → `documentation/features/` → `documentation/{decisions,bugs,gotchas,diary}/` → `~/.quack/brain/` or Pinky `brain.db`

| Path | Role |
|---|---|
| `documentation/features/NNN-slug.md` | Feature map — also a Works module (`feat:{slug}`) |
| `documentation/decisions/` | Architectural rationales |
| `documentation/diary/YYYY-MM-DD.md` | Daily changelog |
| `works/` | Tickets — manage via `/quack-works` |

## Search

- **Pinky** (Quack Store → `pinky-brain`): Brain tab, `pinky search`, MCP `pinky-mcp`
- **No Pinky**: read feature docs + `map.md` directly; prefer `Read documentation/features/…` before repo-wide grep

Pre-turn inject may prepend top hits; thin results → read the `.md` file.

## Save discoveries

After non-trivial work (usually post-`/quack-works` implement):

| Type | Where |
|---|---|
| Component behavior | Update `documentation/features/NNN-*.md`, bump `last_verified` |
| Decision | `documentation/decisions/` |
| Gotcha / bug | `documentation/bugs/` or `gotchas/` |
| Daily log | `documentation/diary/YYYY-MM-DD.md` |

Pinky: `pinky save` or BrainSaveChip in chat (`[Brain save]…[/Brain save]` block).

YAML frontmatter + markdown body on new files.

## UI

- **Brain** tab — Knowledge search (Pinky segment when installed)
- **BrainTurnChip** / **BrainSaveChip** in chat
- Composer context inject from linked work items (see `/quack-works`)

## PM loop position

```
/quack-works  →  feature doc + module + story/tickets
implement
/quack-brain  →  search, diary, save gotchas  ← this skill
```

## Related

- `/quack-works` — feature docs, modules, stories S-NNN, tickets W-NNN, cycles, Plane
