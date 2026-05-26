---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18) + Node SDK daemon
created: 2026-05-26
last_verified: 2026-05-26
tags: [project-ops, workstreams, plan-mode, hooks, bootstrap, side-panel, spec-system]
---

## Project-Ops Native Integration
**Purpose:** Treat the `project-ops` skill as Quack's default spec system. Surface `documentation/workstreams/` in the side panel (two new tabs), force Plan Mode to scaffold/update a workstream as the spec, install the PostToolUse hook on every project open, and validate `.claude/settings.json` to prevent silent hook drops.
**Stack:** React 18 (UI panels + bootstrap call), Rust/Tauri (commands), Node SDK daemon (system prompt injection), Python (auto-installed by skill)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Hook | `src/hooks/useWorkstreams.ts` | Lists `documentation/workstreams/NN-*.md`, parses YAML frontmatter, returns typed `Workstream[]` |
| Component | `src/components/WorkstreamsPanel.tsx` | Workstreams grouped by `focus` (current/active/background/candidate/superseded/completed) |
| Component | `src/components/WorkstreamStatusPanel.tsx` | Snapshot of `focus:current` workstreams + their `status` field |
| Style | `src/components/WorkstreamsPanel.css` | Shared styles for both panels (color via `--focus-color`) |
| Component | `src/components/SidePanelAccordion.tsx` | Wires the two new slots (`workstreams`, `status`) into the accordion; removes `project-context` |
| Component | `src/components/HooksPanel.tsx` | Red banner when `settings.json` JSON-parse fails |
| Daemon | `src-tauri/node-sdk/stream-daemon.js` | System prompt append when `permissionMode === 'plan'` — "PLAN MODE — PROJECT-OPS WORKSTREAM PROTOCOL" |
| Tauri cmd | `src-tauri/src/hooks.rs::bootstrap_project_ops` | Idempotent `bash ~/.claude/skills/project-ops/scripts/setup-pm-docs.sh` runner |
| Tauri cmd | `src-tauri/src/hooks.rs::validate_claude_settings_json` | Returns `(valid, error)` for `.claude/settings.json` parse |
| Wiring | `src-tauri/src/lib.rs` | Registers both new commands in `invoke_handler!` |
| Frontend | `src/App.tsx` (`loadDirectory`) | Calls `bootstrap_project_ops` silently on every project open |
| Config | `.claude/settings.json` | New PostToolUse hook regenerating `INDEX.md` after Edit/Write |

### Data Flow
- Project open → `loadDirectory(path)` → `invoke('bootstrap_project_ops', { projectRoot })` → setup-pm-docs.sh (idempotent)
- Edit/Write any file → PostToolUse hook → `python3 scripts/build-workstream-index.py` → `documentation/workstreams/INDEX.md` refresh
- User opens Workstreams/Status panel → `useWorkstreams(rootPath)` → `list_directory` + `read_file_content` per file → frontmatter parser → grouped render
- User enters Plan Mode → daemon detects `permissionMode === 'plan'` → injects PROJECT-OPS protocol into `systemPrompt.append` → Claude scaffolds a workstream as the spec

### Key Functions
- `useWorkstreams(rootPath: string | null) --> { workstreams, loading, error, refresh }` — fetches + parses frontmatter
- `parseFrontmatter(content: string) --> Record<string, string|string[]>` — minimal YAML head parser (key: value, `[a, b]` arrays)
- `bootstrap_project_ops(project_root: String) --> BootstrapResult` — Rust; returns `{installed, already_present, reason, output}`; reason `"project-ops skill not installed"` if `~/.claude/skills/project-ops/` missing
- `validate_claude_settings_json(project_root: String) --> (bool, String)` — Rust; `(true, "")` when valid or absent, `(false, parse_error)` when corrupted

### Workstream YAML schema (consumed)
| Field | Type | Notes |
|---|---|---|
| `ws` | number | Two-digit workstream id |
| `title` | string | Display title |
| `status` | string | Caps line shown in Status panel |
| `focus` | enum | current / active / background / candidate / superseded / completed |
| `opened` | date | YYYY-MM-DD |
| `updated` | date | YYYY-MM-DD |
| `warning` | string | Optional blocker; rendered amber in panel |
| `brand` / `brands` | string / string[] | Multi-brand attribution (frontmatter tag only) |

### Plan Mode injection (verbatim)
```
## PLAN MODE — PROJECT-OPS WORKSTREAM PROTOCOL
1. Check existing workstreams (read INDEX.md)
2. Scaffold/update workstream file (template from project-ops skill)
3. Plan body lives INSIDE the workstream (Goal, Constraints, Steps, Risks, Done-when)
4. Surface for approval before any source code Edit/Write
```

### Bootstrap behaviour
- **Idempotent**: re-running `setup-pm-docs.sh` is safe; existing files preserved
- **No-op when skill missing**: returns `installed: false, reason: "project-ops skill not installed"`; UI never blocks
- **Detects `already_present`**: when both `documentation/workstreams/` and `scripts/build-workstream-index.py` exist
- **Silent**: `.catch(() => {})` on the frontend — failure never surfaces in UI

### Hook validation (preventive)
| Trigger | Behavior |
|---|---|
| `workingDir` change or hooks reload | Calls `validate_claude_settings_json` |
| Parse OK | No banner |
| Parse fail | Red banner above HooksPanel header with parse error + `jq` repair hint |
| File missing | No banner (nothing to validate) |

### Side panel slots affected
- Removed: `project-context` (slot #6 — ContextPanel with rich text + bookmarks)
- Added: `workstreams` (slot #2, color `#fbbf24` amber)
- Added: `status` (slot #3, color `#84cc16` lime)
- Total sections: 15 → 16 (15 visible, commands still hidden)

### Why
- **Spec discipline**: Plan Mode used to produce ad-hoc planning prose. Now every plan becomes a tracked workstream with YAML metadata, INDEX, and brand scoping.
- **Hook silent-drop prevention**: Claude Code drops the entire hook block on JSON parse error without telling the user. The validation banner makes the failure visible.
- **Zero-config onboarding**: New Quack users get project-ops the moment they open a project — no manual `setup-pm-docs.sh` step.
