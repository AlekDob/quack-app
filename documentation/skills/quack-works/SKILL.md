---
name: quack-works
description: Manage Quack Works tickets — one .md file per work item in .codetta/works/items/, modules from documentation/features, link sessions, sync to Plane.
---

# Quack Works

Use this skill when the user asks about work items, tickets, kanban, plan approval, feature modules, or cross-session project context in Quack desktop.

Pair with `/quack-brain` for the full PM loop (read feature doc → ticket → implement → save).

## Modules = feature docs

Works modules are **synced from** `{workspace}/documentation/features/*.md`:

| Filename | Module id | Example |
|---|---|---|
| `054-works-layer.md` | `feat:054-works-layer` | Title from `# 054 — Works layer` H1 |
| `049-markdown-renderer.md` | `feat:049-markdown-renderer` | Title from first `#` or `##` heading |

Re-sync happens on Works tab open (`refreshWorksModules`). Legacy generic modules (Bug, Feature…) appear only when no feature docs exist.

## Storage (local-first)

| Path | Role |
|---|---|
| `{workspace}/.codetta/works/snapshot.json` | Index — modules, labels, item metadata, view prefs (`version: 2`) |
| `{workspace}/.codetta/works/items/W-NNN.md` | **Work item body + frontmatter** (agent source of truth) |
| `{workspace}/.codetta/works/events.jsonl` | Append-only audit log |

Each work file has YAML frontmatter (`id`, `shortId`, `status`, `priority`, `module: feat:…`, `linkedChats`, …) and a markdown body with `# title`.

## Agent workflow

1. **Find** — glob `.codetta/works/items/*.md` or read `snapshot.json` for `shortId` / status / module.
2. **Read** the work file — `Read .codetta/works/items/W-042.md`.
3. **Read** linked `documentation/features/{slug}.md` for module context before editing code.
4. **Edit** — `Write` / `Edit` the work `.md` (update status in frontmatter, body for plan/acceptance).
5. **Create** — write a new `items/W-NNN.md` (copy frontmatter shape from an existing file); Quack imports on hydrate/watch.
6. **Link session** — add chat id to `linkedChats` in frontmatter, or user `@W-001` in composer.
7. **Plan mode** — draft work on Plan enter; approve → `in_progress` + plan text written to body.
8. **Context inject** — linked chats prepend `[Quack Work — W-00N …]` with **work file path** on send.

**Do not** hand-edit `snapshot.json` for body text — use the `.md` file.

## Plane sync (optional, team)

Configure in Works → **Plane** panel (base URL, workspace slug, project ID, API token). Push creates/updates issues via Plane REST API.

## UI surfaces

- **Works tab** — left **Views** rail (All / status filters / Modules); main area = **catalog list** (Brain-style rows), kanban, timeline, or **feature catalog**
- **List view** — `WorksItemsList`: search bar, `.brain-hit-row` rows with status/priority/module subtitle (same pattern as Modules)
- **Modules view** — Brain-style search + animated feature rows; click → feature doc drawer
- **Work drawer** — Notion block editor for description; module select; **Create** / **Cancel** footer in draft mode; properties grid; comments; Plane sync
- **Feature doc drawer** — markdown preview of `documentation/features/*.md`; nested inside side drawer when Works is drawer-hosted; edit icon opens file and closes drawer
- **Composer** — Work pill in meta row
- **Agent Hub** — `W-00N` badge on linked sessions
- **@mention** — `@W-001` links the chat to that work item

**Create flow:** UI uses `openWorkCreateDrawer` — nothing hits disk until user clicks **Create**. Agents creating tickets should write `items/W-NNN.md` directly (auto-import on watch).

## Types reference

See `src/works.ts`, `src/workItemMd.ts`, `src/worksItemFiles.ts`, `src/worksCache.ts`, `src/worksFeatureModules.ts`.
