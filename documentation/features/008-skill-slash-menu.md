---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-13
tags: [ai-chat, skills, slash-menu, claude-code, composer, claude-skills, discovery]
---

## Skill `/`-Menu

**Purpose:** Surface Claude Code **skills** in the composer's `/` menu — the
same affordance pattern as `@`-mention subagents (see `004`), but for skills.
Each skill row gets a dedicated **command icon** + **violet colour** so it reads
distinct from the built-in slash commands. Picking one invokes the skill.
**Files:** `src/skills.ts` (loader), `src/components/AIChatPanel.tsx` (`parseSlash`,
`slashState`, menu wiring), `src/App.css` (`--skill` token + row styling).

### Where skills come from
Skills are **folders** containing a `SKILL.md` (vs subagents, which are single
`.md` files). Scanned from four roots; project wins name collisions:

| Source | Path |
|---|---|
| Project | `<workspace>/.claude/skills/<name>/SKILL.md` |
| User-global | `~/.claude/skills/<name>/SKILL.md` |
| Repo mirror | `<workspace>/documentation/skills/<name>/SKILL.md` |
| **App-bundled** | `src/bundledSkills/` → `quack-works` (PM + feature docs) and `quack-brain` (search/save) |

`loadSkills(root, home)` (mirrors `loadSubagents`) reads each folder's `SKILL.md`,
takes `name`/`description` from YAML frontmatter (shared `frontmatterField` from
`subagents.ts`), falling back to the folder name and the first prose line
(`firstParagraph`) when a skill has no frontmatter. Description capped at 120 chars.

### Gated to Claude Code only
Loaded in the same effect as subagents, gated on `selectedIsCC` (provider ===
`claude-code`) — the direct Anthropic/OpenAI/Ollama providers have no skill
concept, so the list is cleared for them. One shared `homeDir` resolution,
`Promise.all([loadSubagents, loadSkills])`.

### Menu wiring (`slashMatchesFor`)

The `/` menu merges **local** commands + **cc** passthroughs + **skills**.
Activation uses `parseSlash(input, cursor)` — the slash token can appear
**anywhere** in the composer (after whitespace), not only at column 0.
Example: `also run /refactor on this file`.

`slashState` drives the dropdown; `mentionState` wins when both could apply.
The menu stays available **during an active turn** (follow-up queue mode) —
do not gate on `streaming !== null`.

| kind | dispatch | row style |
|---|---|---|
| `local` | `runSlashCommand` (in-app action / prompt rewrite) | default |
| `cc` | `sendCcCommand` (send `/name` as the prompt) | default |
| `skill` | `sendCcCommand` (same — CLI runs the skill) | `zap` icon + `--skill` orange, name only (no description) |

**Segment-aware edits:** `replaceSlashSegment` / `clearSlashSegment` splice the
active `/…` token only — prefix/suffix text in the composer is preserved when a
command runs or autocompletes.

Dispatch (applies to commands AND skills):
- **Tab** = autocomplete — replaces the active slash segment with `/name ` (preserving trailing text).
- **Enter** = run (`runSlashCommand` for local) / send (`sendCcCommand` for cc + skill).
- **Click** = run/send (unchanged).

`textarea.onSelect` re-parses mention/slash when the caret moves without a keystroke.

Skill rows show the **name only** (no description) — a single inline row with the
`zap` glyph + orange `/name` (`white-space:nowrap`).

### Styling
- `--skill` / `--skill-bg` tokens (Quack **orange**, theme-aware: `#f28c52` dark /
  `#d9722e` light) — the dedicated skill colour. New `zap` (lightning) icon in `Icon.tsx`.
- `.ai-slash-item-skill` → orange name + orange hover/active bg;
  `.ai-slash-skill-ico` → orange `zap` glyph prefix.

### In-stream Skill tool row
When the agent actually runs a skill, the `Skill` tool call appears in the chat
stream (in the read/search `.ai-tcall-wrap` cloud). `toolIconFor("Skill")` → `zap`
and `ToolRowHead` gets `skill` → `.ai-tcall-skill` (orange pill: `--skill-bg` fill,
`--skill` icon+name, orange border) so it carries the same identity as the menu.

### Gotchas / open questions
- **Headless invocation**: skills are sent as `/skill-name` through `claude -p`
  exactly like CC custom commands. Custom commands (`.claude/commands/*.md`)
  definitely expand in print mode; skills are assumed to as well. If a skill
  doesn't fire, the model still sees the `/name` text and may invoke it via the
  Skill tool (auto-trigger on description). **Verify live** with a known skill.
- There can be 100+ user skills — the menu filters as you type and the dropdown
  scrolls (`max-height` on `.ai-slash-suggestions`); skills sort after commands.
- **Browse / edit / create** skills in Agent Customizations → Skills (`036`,
  `SkillsPane`) — fuzzy search on folder name + scope when the list is long.

### Composer skill chip (072)

When the input starts with `/skill-name` matching a loaded skill, an orange
**skill chip** appears inside `.composer-mention-chips` (same row as brain/file
chips). Remove (`×`) strips the prefix. Dispatch on Enter unchanged.
See **`072-composer-mention-chips.md`**.
