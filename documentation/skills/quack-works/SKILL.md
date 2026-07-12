---
name: quack-works
description: Manage Quack Works tickets in .codetta/works/ — modules from documentation/features, create/update work items, link sessions, sync to Plane.
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
| `{workspace}/.codetta/works/snapshot.json` | Modules, labels, work items, view prefs |
| `{workspace}/.codetta/works/events.jsonl` | Append-only audit log |

Work items have `shortId` like `W-001`, `moduleId` (feature module), `descriptionBlocks`, `linkedChatIds`, optional `planeIssueId`.

## Agent workflow

1. **Read** `snapshot.json` to list or find work by `shortId` / title / module.
2. **Read** linked `documentation/features/{slug}.md` for module context before editing code.
3. **Create** — prefer `featureSlug: "054-works-layer"` (stable module id `feat:054-works-layer`).
4. **Edit** items by updating `snapshot.json` (schema version `1`) or Works board UI.
5. **Plan mode** — draft work on Plan enter; approve → `in_progress` + plan text in description.
6. **Context inject** — linked chats prepend `[Quack Work — W-00N …]` with feature path on send.

## Plane sync (optional, team)

Configure in Works → **Plane** panel (base URL, workspace slug, project ID, API token). Push creates/updates issues via Plane REST API.

## UI surfaces

- **Works tab** — left **Views** rail (All / status filters / Modules); main area = list, kanban, timeline, or **feature catalog**
- **Modules view** — Brain-style search + animated feature rows; click → feature doc drawer
- **Work drawer** — app-level; properties grid, block description, comments; cloud = Plane sync; file icon = feature doc
- **Feature doc drawer** — markdown preview of `documentation/features/*.md`; edit icon opens file and closes drawer
- **Composer** — Work pill, + Work menu, acceptance meta row
- **Agent Hub** — `W-00N` badge on linked sessions
- **@mention** — `@W-001` links the chat to that work item

## Types reference

See `src/works.ts`, `src/worksFeatureModules.ts`, `src/worksCache.ts` for `WorkItem`, `WorkModule`, `syncFeatureModules`, helpers `moduleByFeatureSlug`, `planTextToBlocks`.
