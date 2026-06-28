---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-06-28
tags: [subagents, agents, mention, composer, claude-code, task-tool, ai-chat, ducks, avatars, transcript, jsonl, read-only-tab]
---

## Subagent @-Mentions + Transcript Tab

**Purpose:** Let the user delegate a chat turn to a Claude Code **subagent** by
typing `@` in the composer — the same affordance that already attaches files.
Each subagent gets a **duck avatar** (Quack identity). On send, the turn is
delegated via Claude Code's native **Task** tool.
**Stack:** React 19, TypeScript strict, Tauri `list_dir`/`read_file` IPC.

### Why this is a Quack convention (not native Claude Code)
Claude Code has **no native `@agent` syntax** — `@` is for files; subagents are
picked by the model via the `Task` tool, or defined in `.claude/agents/`. Quack
adds the `@`-pick UX and, on send, injects a **delegation directive** into the
per-turn context so the CLI dispatches the chosen subagent(s). Works only with
the **Claude Code** provider (the direct Anthropic/OpenAI/Ollama providers are
stateless and have no `Task` tool).

### Where subagents come from
| Source | Path | Precedence |
|---|---|---|
| Project | `<workspace>/.claude/agents/*.md` | wins name collisions |
| User-global | `~/.claude/agents/*.md` | fallback |

Each agent is a markdown file with YAML frontmatter (`name`, `description`,
optional `avatar`). Frontmatter is read with a minimal scalar parser (no YAML
dependency).

### Avatar assignment
- `avatar:` frontmatter field wins — accepts `duck12`, a bare `12`, or a full `/path`.
- Otherwise a **deterministic hash** of the agent name → `public/images/ducks/duckN.jpeg`
  (35 ducks shipped, copied from `quack-app/.../new-avatars/`). Stable across sessions.

### Files
| Type | Path | Purpose |
|---|---|---|
| Module | `src/subagents.ts` | `loadSubagents(root, homeDir)`, `duckAvatarFor(name, explicit?)`, `SubagentDef` |
| Component | `src/components/AIChatPanel.tsx` | `agents`/`attachedAgents` state, agent-load effect (CC-only), `@` popover (tagged union agent\|file), delegation injection, reset, chips; `SubagentOpen.Provider` + `openSubagentTab` |
| Render | `src/components/chatToolRender.tsx` | `SubagentOpen` context, `subagentTypeOf()`, Task→duck-avatar chip (clickable) |
| Component | `src/components/SubagentTranscriptView.tsx` | read-only transcript viewer (portaled), reuses `ToolCallRow` + `MarkdownPreview` |
| Host | `src/components/WorkspaceShell.tsx` | walks panes for `sub:` keys, portals one viewer each |
| Store | `src/store.ts` | `subagent` tab kind (`subKey`/`parseKey`), `openSubagent()` action |
| Backend | `src-tauri/src/claude_code.rs` | `claude_code_load_subagent`, `parse_session_jsonl` (shared) |
| IPC | `src/ipc.ts` | `claudeCode.loadSubagent`, `LoadedSubagent` |
| Assets | `public/images/ducks/duck1..35.jpeg` | duck avatars |
| Styles | `src/App.css` | `.ai-mention-avatar`, `.ai-agent-chip*`, `.ai-tcall-subagent`, `.subagent-view*`, `.tab-sub-avatar` |

### Flow — mention & delegate
1. `agents` loads when the provider is Claude Code (`selectedIsCC`) — project + global.
2. Typing `@` opens the popover: **agents first** (≤4, with avatar), then files (up to 8 total).
3. Accepting an agent inserts `@name` and tracks it in `attachedAgents` (chips shown above composer).
4. On send (`sendUserText`), if `attachedAgents` is non-empty a directive is pushed into
   `ccTurnContext`: *"Delegate this task to the following subagent(s)… use your Task tool…"*.
5. `attachedAgents` resets after the turn goes out (alongside `attachedFiles`).

### Flow — subagent chip → read-only transcript tab
1. A `Task` tool-call renders as a **duck-avatar chip** (`chatToolRender` ToolCallRow special-case),
   avatar from `duckAvatarFor(subagent_type)`.
2. Click → `SubagentOpen` context → `openSubagentTab(call.id, agentType)` → `store.openSubagent`,
   which opens a self-contained `sub:<ccSessionId>|<toolUseId>|<agentType>` tab.
3. `SubagentTranscriptView` calls `claude_code_load_subagent(cwd, ccSessionId, toolUseId)`.
4. **On-disk linkage:** Claude Code writes each subagent to
   `~/.claude/projects/<enc-cwd>/<session>/subagents/agent-<id>.jsonl` with a sibling
   `agent-<id>.meta.json` = `{agentType, description, toolUseId}`. The command finds the meta whose
   `toolUseId` matches the Task call id, then parses the sibling jsonl (reuses `parse_session_jsonl`).
5. Rendered read-only: delegation prompt as a "user" bubble, subagent steps via `ToolCallRow`. **No composer.**

### Gotchas
- **CC-only:** `agents` is empty for non-CC providers; `attachedAgents` and Task chips never appear elsewhere.
- **Timing:** the subagent jsonl/meta land on disk only when the run **finishes** — clicking the chip
  mid-run shows "transcript isn't ready". `claudeSessionId` must also be captured (the `session` stream event).
- **Ephemeral tabs:** `sub:` keys have no store record and return `false` in the load-time `clean()` filter,
  so they don't survive an app restart (by design — read-only viewers).
- **Avatar consistency:** chip, tab icon, and view header all derive the duck from the SAME
  `subagent_type` string via `duckAvatarFor`, so they always match (and match the @-mention popover).
- **Compact (agent) mode** omits Task chips entirely (the sidebar owns them) — this feature lives in the docked chat.
