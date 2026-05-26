---
type: pattern
project: quack-app
created: 2026-05-26
last_verified: 2026-05-26
tags: [project-ops, plan-mode, hooks, bootstrap, side-panel, workstream, spec-system]
---

# Pattern: Project-Ops as Quack's Native Spec System

## Trigger

Use this pattern when:
- Adding a new "skill-backed" surface to Quack that should feel native (auto-installed, visible in side panel, integrated with Plan Mode)
- Wiring a Tauri command that must run idempotently on every project open
- Surfacing YAML-frontmatter `.md` collections in the accordion (e.g. workstreams, decisions, plans)
- Preventing the Claude Code "silent hook drop on JSON parse error" failure mode

## Solution

Four layers, each owned by a different runtime:

### 1. Skill as source of truth
The `project-ops` skill (`~/.claude/skills/project-ops/`) owns the templates, the Python `build-workstream-index.py` script, the YAML schema, and the bootstrap shell script. Quack never duplicates this — it shells out.

### 2. Side-panel surface (React)
- Custom hook (`src/hooks/useWorkstreams.ts`) lists `documentation/<collection>/NN-*.md`, reads each file, parses YAML frontmatter with a minimal in-house parser (no `yaml` dep).
- Two panels: a grouped browser (by `focus` enum) + a filtered snapshot (`focus:current` only).
- Both use `list_directory` + `read_file_content` Tauri commands already available.
- Slot wiring: edit `sectionIds`, `CATEGORY_COLORS`, the `icons` map, and add `<AccordionSection>` blocks in `SidePanelAccordion.tsx`. Remove obsolete slots in the same pass.

### 3. Plan Mode injection (Node SDK daemon)
- In `src-tauri/node-sdk/stream-daemon.js`, `systemPrompt.append` is built as a chain of conditional `+` expressions: `... + (debugMode ? (...) : '') + (chatMode ? (...) : '') + (permissionMode === 'plan' ? '<protocol>' : '') + (teamContext ? buildTeamPromptAugmentation(...) : '')`.
- Append the protocol as a template literal. Keep it terse — every byte counts against the prompt cache.
- Reference the skill by name ("use the `project-ops` skill"). Do NOT inline its content — the skill loader will pull it.

### 4. Bootstrap + validation (Rust + frontend)
- Tauri command `bootstrap_project_ops(project_root)` shells out to `~/.claude/skills/<skill>/scripts/setup-pm-docs.sh`. Returns `{installed, already_present, reason, output}`. **Idempotent by design** — the script itself must be safe to re-run.
- Frontend calls it in `loadDirectory` after `setExplorerRoot`, with `.catch(() => {})` — never blocks UI, never surfaces failures.
- Companion command `validate_claude_settings_json(project_root)` parses `.claude/settings.json` with `serde_json` and returns `(bool, error_message)`. Used by HooksPanel to surface a red banner if Claude Code would silently drop hooks.

## Why these choices

- **Idempotent silent bootstrap > opt-in CLI**: new Quack users get the feature without reading docs. Power users can still re-run `setup-pm-docs.sh` manually.
- **Skill stays the source of truth**: when the skill upgrades (new template, new schema field), Quack picks it up for free on next project open. No version sync needed.
- **In-house frontmatter parser**: avoids pulling `yaml` (~50KB gzipped) for ~20 lines of key/value parsing. Trade-off: cannot handle nested YAML, multi-line strings beyond `|` block scalar, or anchors. Acceptable for project-ops scope.
- **Plan Mode injection in daemon, not in CLAUDE.md**: CLAUDE.md is static and shared across all modes; the injection is mode-conditional and lives where it can read `permissionMode`.
- **Validation banner > auto-fix**: parsing JSON is safe, mutating it on the user's behalf is not. Surface the error, let the user fix it.

## Pitfalls

- **Plan Mode injection breaks prompt cache** if put in the wrong branch. Keep it inside the existing conditional chain after `debugMode` and `chatMode`, before `teamContext`. The cache is keyed on the whole `systemPrompt.append`; mode-conditional content is acceptable because each mode gets its own cache entry.
- **`setup-pm-docs.sh` does NOT add PostToolUse to existing `settings.json`**. If the user already has hooks (Brain hooks, etc.), the PostToolUse for `build-workstream-index.py` must be merged manually or via a dedicated Rust command. Don't rely on the skill's bash script for the JSON merge.
- **`is_dir` not `is_directory`** in `DirectoryEntry` (`src/types.ts`). Easy typo to make.
- **Skill missing**: `~/.claude/skills/project-ops/` might not exist (user hasn't installed it from Marketplace). The bootstrap command must return gracefully with `installed: false, reason: "..."` — never throw.
- **JSON-escape silent drop**: a single unescaped `"` or `\` in a hook `command` string makes Claude Code drop the entire hook block on session start, with no UI feedback. The validation banner is the only way to catch this for end users. Always run `jq . .claude/settings.json` after any programmatic write.

## Related

- Skill: `~/.claude/skills/project-ops/`
- Feature: `documentation/features/072-project-ops-native-integration.md`
- Workstream: `documentation/workstreams/03-project-ops-native.md`
- Companion side-panel feature: `documentation/features/035-side-panel-accordion.md`
- Permission modes: `documentation/patterns/pattern-permission-modes.md`
