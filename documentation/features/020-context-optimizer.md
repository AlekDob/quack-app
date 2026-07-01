---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-01
last_verified: 2026-07-01
tags: [usage, context, skills, plugins, subagents, tokens, optimize, tab, quack-v1]
---

## Context Optimizer (skill/plugin context-cost analyzer)

**Purpose:** A second view inside the Usage tab ("Context") that shows how much
system-prompt weight every skill and subagent adds — they're injected (name +
description) into *every* Claude Code session — and **how often each skill was
actually invoked** across all local transcripts. Heavy-but-never-used global
skills are the thing to trim; the view ranks them and lets you dial each one's
context visibility (On / Name only / Hidden) in one click.

**Why it exists:** the user had ~120 global skills in `~/.claude/skills/` loading
into every project (Kyron, Studio Futuro, higgsfield… inside Quack), silently
inflating the context window baseline. This makes that cost visible and fixable.

### Where it lives

| Concern | File |
|---|---|
| Backend scan (skills/agents/plugins) + usage tally + visibility read/write | `src-tauri/src/context_assets.rs` |
| Command registration (`mod`, `generate_handler!`) | `src-tauri/src/lib.rs` |
| Context view (summary, sortable list, per-source visibility toggle) | `src/components/ContextPanel.tsx` |
| Project-skill frontmatter writer (`setFrontmatterScalar`, shared) | `src/frontmatter.ts` |
| Usage shell + `Sessions ⇄ Context` segmented control | `src/components/UsagePanel.tsx` |
| Shared "open .md + reveal in tree" primitive (DRY) | `src/revealInTree.ts` (`openFileAndReveal`) |
| Mount passes workspace root (for project skills) | `src/components/WorkspaceShell.tsx`, `src/components/SidebarStack.tsx` |
| Styles (`.usage-tabs`, `.ctx-*`) | `src/App.css` |

### Backend commands (`context_assets.rs`)

- `claude_context_assets(root)` → `ContextReport`. Scans three sources Claude
  Code reads: user `~/.claude/{skills,agents}`, project `<root>/.claude/...`, and
  enabled plugins under `~/.claude/plugins/cache/<repo>/<plugin>/<latest-ver>/`
  (skills = folders with `SKILL.md`; agents = `.md`, recursed since templates
  nest them under `agents/<team>/`). Each asset carries `est_tokens` (~char/4 of
  name+description), `effective_tokens` (weight after its override), `visibility`,
  `togglable`, `use_count`, `source`, `kind`. Usage is counted by a cheap substring
  pass for `"skill":"<name>"` over every transcript (no per-line JSON parse).
  Visibility for **user** skills is read from `skillOverrides` in
  `~/.claude/settings.json`; for **project** skills from `disable-model-invocation`
  in their SKILL.md frontmatter. 30s cache keyed by `root`; runs on `spawn_blocking`
  (same pattern as `claude_sessions.rs`).
- `claude_set_skill_override(name, value)` — writes `skillOverrides.<name>` in
  `~/.claude/settings.json` (`on` removes the key to keep the file minimal). Parses →
  mutates → pretty-writes, preserving every other setting; invalidates the cache.
  Used for **user** skills (v2.1.196+). Project skills instead get their frontmatter
  edited in TS (`setFrontmatterScalar`).
- `claude_invalidate_context_cache()` — clears the 30s report cache. Called by the
  frontend after a **project**-skill frontmatter edit (a TS write Rust can't observe),
  so the next `claude_context_assets` re-scans fresh.

### Interaction

- **Row = clickable.** Clicking an asset opens its backing `.md` (SKILL.md /
  agent .md) in an editor tab; if the file is inside the project it's also
  **revealed + highlighted in the left file tree**. This is `openFileAndReveal`
  in `revealInTree.ts` — the **same** primitive the whiteboard organigramma now
  uses (DRY: click-to-open + reveal is defined once). Global `~/.claude` assets
  open but don't reveal (no tree row).
- **Kind icon**, not a text badge: `zap` (lightning) = skill — matching the `/`
  slash menu (feature 008) — and `bot` = subagent. The impact **bar** behind each
  row is proportional to `est_tokens` relative to the heaviest asset.
- **Visibility toggle**, routed by source per Anthropic's docs ("one source of truth
  per skill"):
  - **Global (user) skills** → `skillOverrides` in `~/.claude/settings.json`. Full set:
    `On` / `Name only` / `Hidden` (`on` / `name-only` / `user-invocable-only`). `Name
    only` drops the heavy description but keeps it invocable; only skillOverrides can
    express it.
  - **Project skills** → `disable-model-invocation` in the skill's **SKILL.md
    frontmatter** (the versioned source of truth, committed with the repo — the docs'
    recommended path for skills you author). Only `On` / `Hidden` (frontmatter has no
    "name-only"). The frontmatter write is TS (`setFrontmatterScalar`, shared with the
    organigramma), then `claude_invalidate_context_cache` so the re-scan is fresh.
  - We deliberately skip bare `off` (a known Claude Code listing bug). The row's weight
    shows `effective_tokens` and dims (green) when reduced. **UI copy is English.**

### Design notes

1. **Segmented control, not a new tab.** `UsagePanel` became a thin shell holding
   a `Sessions | Context` toggle; the old sessions body is now `SessionsView`. Each
   view mounts its own effects, so the 12s session poll never runs while Context is open.
   The chosen view is persisted in a module-level `viewByWs` map keyed by workspace:
   the tab is portal-mounted only while active, so clicking a skill (which opens its
   `.md` and unmounts the panel) would otherwise snap back to Sessions on return.
2. **skillOverrides, not file moves.** Progressive disclosure means only name +
   description hit the system prompt (the body loads on use). The real lever is
   `skillOverrides` — `name-only` drops the description, `user-invocable-only` hides
   it entirely. This changes what Claude Code injects, cleanly and reversibly. (An
   earlier cut moved folders to `skills-disabled/`; dropped — it was a Quack-side hack.)
3. **Honest metric.** Skills sit in the *cached* system prompt, so they don't cost
   full price per message — the UI says "context weight (~char/4 estimate)", not
   "$/msg". The real lever is context-window baseline + cache-write size.
4. **Usage is the actionable axis.** Default sort = "never used first, heaviest
   among them" → the shortlist to park. `use_count` is real (from transcripts);
   only skills are counted (agent invocation isn't a plain skill call). Caveat:
   auto-loaded skills (not invoked via the `Skill` tool) read as "never used".

### Gotchas

- **Toggle applies to user/project skills only** (`togglable`) — they're keyed by a
  bare name in `skillOverrides`. Plugin skills / agents show weight but no toggle.
- **Plugin versions:** only the lexically-greatest cached version per plugin is
  counted (avoids double-counting `1.0.0` + `1.1.0`).
- **Token estimate is char/4**, not a real tokenizer — good for ranking/magnitude,
  labelled `~` everywhere. Don't treat it as exact.
- Plugins can't be toggled from here (that's `/plugin`, interactive); the view only
  measures them and points the user at `/plugin`.
- `settings.json` write assumes plain JSON (no comments) — Claude Code's is. Parse
  failure aborts the write with an error rather than clobbering the file.
