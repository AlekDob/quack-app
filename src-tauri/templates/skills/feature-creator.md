---
name: feature-creator
version: 1.0.0
description: Create and manage feature documentation with auto-numbered naming (NNN-slug.md). Tables/lists only, no prose. Works for any language/framework.
context: fork
keywords: [feature, documentation, feature-doc, feature-map]
builtin: true
---

# Feature Creator

Generate AI-agent-optimized feature documentation with **strict naming conventions** and auto-incremented numbering. Output is tables/lists only — no prose.

## Trigger

Use this skill when:
- User asks to document a feature
- User says "feature-doc", "feature-creator", "doc feature", or "document this feature"
- User wants a structured, token-efficient summary of any feature
- User creates a new feature doc in `documentation/features/`

## Arguments

- **Feature name** (required): the feature to document
- **scope:dir** (optional): comma-separated directories to search (auto-detected from project structure if omitted)
- **skip:section** (optional): sections to omit (files|dataflow|functions|state|deps|config|i18n)

## Examples

- `feature-creator auth`
- `feature-creator payments scope:src/payments,lib/payments`
- `feature-creator search skip:i18n,config`

---

## File Naming Convention (MANDATORY)

All feature docs MUST follow this format:

```
documentation/features/{NNN}-{slug}.md
```

Where:
- `{NNN}` = zero-padded 3-digit sequential number (e.g., `001`, `024`, `127`)
- `{slug}` = kebab-case feature name (e.g., `auth-flow`, `feature-map-whiteboard`)

### Auto-Increment Workflow

Before creating a new feature doc:

1. **List existing files** in `documentation/features/`
2. **Extract the highest number** from files matching pattern `^\d{3}-`
3. **Assign next number** = highest + 1
4. **Format filename**: `{next_number:03d}-{slug}.md`

Example: if highest is `026-feature-map-whiteboard.md`, next file is `027-{new-slug}.md`.

### Migration of Legacy Files

If files exist WITHOUT a numeric prefix (e.g., `permission-modes.md`):

1. Find all files NOT matching `^\d{3}-` pattern
2. For each, assign the next available number
3. Rename: `permission-modes.md` → `{NNN}-permission-modes.md`
4. Log each rename for the user
5. Do this BEFORE creating any new feature doc

Files with `_CURRENT_STATE` suffix should be renamed too:
`ide-context-injection_CURRENT_STATE.md` → `{NNN}-ide-context-injection.md` (drop the suffix)

---

## Conventions — Language/Framework Agnostic

### File Type Mapping

Map every file to one of these **canonical types**. Use the first match:

| Canonical Type | What it covers |
|----------------|---------------|
| Route/Page | HTTP route handler, page component, controller action, API endpoint |
| Component | UI component, partial, template, widget, helper view |
| Service | Business logic class/module, use-case, interactor, composable, hook |
| Model/Type | Data model, schema, type definition, interface, DTO, entity |
| Store/State | State container, reducer, Pinia store, Redux slice, context provider |
| Repository/API | Data access layer, API client, ORM query, external service adapter |
| Middleware | Request/response middleware, guard, interceptor, pipe, filter |
| Config | Config file, env schema, feature flag, constant |
| Migration | DB migration, seed file |
| Test | Unit/integration/e2e test |
| Util | Utility, helper function, shared constant |

If a file doesn't fit, use its role as the type (e.g., "Worker", "Cron", "Script").

### Function Signature Convention

Normalize signatures to a **language-neutral** shorthand:

```
functionName(param: Type, param: Type) → ReturnType
```

- Omit `self`/`this`/`cls` receiver params
- Use `→` not `->` or `=>`
- Use `void` when function returns nothing meaningful
- For overloaded methods, show the most common signature only

### Data Flow Notation

Use this arrow chain for all stacks:

```
[Source] → [Transform/Handler] → [Destination]
```

### State Notation

```
- `name`: Type — purpose (scope)
```

Where scope = `global`, `route`, `component`, `session`, or `request`.

---

## Workflow

### 1. Migrate Legacy Files (if needed)

Check `documentation/features/` for files without numeric prefix. If found, migrate them first (see "Migration of Legacy Files" above).

### 2. Detect Project Stack

Before searching, identify the stack from project root files:

| Indicator | Stack |
|-----------|-------|
| `package.json` + `nuxt.config` | Nuxt |
| `package.json` + `next.config` | Next.js |
| `package.json` + `vite.config` or `vue.config` | Vue (Vite/CLI) |
| `package.json` + `src/App.tsx` or `react` dep | React |
| `Gemfile` + `config/routes.rb` | Rails |
| `go.mod` | Go |
| `requirements.txt` or `pyproject.toml` | Python |
| `*.csproj` or `*.sln` | .NET |
| `Cargo.toml` | Rust |
| `Cargo.toml` + `tauri.conf.json` | Tauri (Rust + Web) |

### 3. Discover Feature Files

Search for all files related to the feature using stack-appropriate patterns:

- **Name matching**: grep/glob for the feature name in filenames and directories
- **Content matching**: grep for feature-specific identifiers (class names, route paths, DB table names)
- **Dependency tracing**: follow imports/requires from entry points

### 4. Analyze Each File

For every discovered file:
- Read it to understand its exports and purpose
- Classify it using the canonical type table
- Identify key functions, state, and dependencies
- Note data flow connections between files

### 5. Generate Documentation

Use this exact output format. **Omit empty sections.**

```markdown
---
type: feature-doc
project: [project-name]
stack: [detected stack]
created: [TODAY'S DATE]
last_verified: [TODAY'S DATE]
tags: [feature-name, relevant-tags]
---

## [Feature Name]
**Purpose:** [1 sentence]
**Stack:** [framework/language]

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|

### Data Flow
[Source] → [Transform] → [Destination]

### Key Functions
- `name(params) → Return` — purpose

### State
- `name`: Type — purpose (scope)

### External Dependencies
- Service: endpoint or purpose

### Config
- `KEY`: purpose (default)

### i18n Keys
- `key.path` — label
```

### 6. Save Documentation

- Save to `documentation/features/{NNN}-{slug}.md`
- Create directory if needed
- **Always use auto-incremented number** (see naming convention above)
- After saving, update the project's CLAUDE.md if it has a Knowledge Base section that tracks feature docs

---

## Rules

- **ALWAYS number files** — no exceptions. Every feature doc MUST have a `{NNN}-` prefix.
- **No prose** — tables and lists only
- **Omit empty sections** entirely
- **Use relative paths** from project root
- **Max 1 sentence** per item
- **Canonical types only** — don't invent new file types outside the table
- **Normalize signatures** — use the `name(p: T) → R` convention regardless of source language
- **Include YAML frontmatter** for Quack Brain compatibility
- **Same output regardless of stack** — a React feature doc and a Rails feature doc should be structurally identical
- **Migrate first** — if legacy unnumbered files exist, migrate them before creating new docs
