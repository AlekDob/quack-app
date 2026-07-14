---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-14

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
| Component | `src/components/MentionSuggestions.tsx` | `@` popover UI (agent + file rows, path preview) — see **`041-mention-file-preview.md`** |
| Component | `src/components/MentionPathPreview.tsx` | Side tree for highlighted file row (041) |
| Component | `src/components/AIChatPanel.tsx` | `agents`/`attachedAgents` state, agent-load effect (CC-only), `@` match logic + `acceptMention`, delegation injection, reset, chips; `SubagentOpen.Provider` + `openSubagentTab`; `.ai-mention-open` overflow toggle |
| Render | `src/components/chatToolRender.tsx` | `SubagentOpen` context, `subagentTypeOf()`, Task→duck-avatar chip (clickable) |
| Component | `src/components/SubagentTranscriptView.tsx` | read-only transcript viewer (portaled in editor/drawer, **inline** in agent mode when pref = tab), reuses `TranscriptTurnRows` + `ToolCallRow` |
| Render | `src/components/TranscriptTurnRows.tsx` | shared read-only turn markup (`.ai-msg`, `.ai-tcalls`, `UserTurnBar` shell) |
| Host | `src/components/WorkspaceShell.tsx` | walks panes for `sub:` keys, portals one viewer each |
| Agent host | `src/components/AgentModeShell.tsx` | 50/50 split: mounts `SubagentTranscriptView` inline when focused tab is `sub:` |
| Store | `src/store.ts` | `subagent` tab kind (`subKey`/`parseKey`), `openSubagent()`, `collectSubagentTabs`, `focusedSubagentKey`, `focusedAgentSidePanelKey` |
| Backend | `src-tauri/src/claude_code.rs` | `claude_code_load_subagent`, `parse_session_jsonl` (shared) |
| IPC | `src/ipc.ts` | `claudeCode.loadSubagent`, `LoadedSubagent` |
| Assets | `public/images/ducks/duck1..35.jpeg` | duck avatars |
| Styles | `src/App.css` | `.ai-mention-*`, `.ai-agent-chip*`, `.ai-tcall-subagent`, `.subagent-view*`, `.tab-sub-avatar` |

### Flow — mention & delegate
1. `agents` loads when the provider is Claude Code (`selectedIsCC`) — project + global.
2. Typing `@` opens **`MentionSuggestions`** (041): **agents first** (≤4, avatar + description), then **files** (≤8 total — basename + parent dir; side path tree when a file row is active).
3. Accepting an agent tracks it in `attachedAgents` and shows a **composer chip**
   (duck avatar, inside `.ai-input-row`) — no `@name` token in the textarea (072).
4. On send (`sendUserText`), if `attachedAgents` is non-empty a directive is pushed into
   `ccTurnContext`: *"Delegate this task to the following subagent(s)… use your Task tool…"*.
5. `attachedAgents` resets after the turn goes out (alongside `attachedFiles`).

### Flow — subagent chip → read-only transcript tab
1. The subagent tool-call renders as a **duck-avatar chip** (`chatToolRender` ToolCallRow special-case),
   avatar from `duckAvatarFor(subagent_type)`. **The tool is named `Agent` in current Claude Code**
   (older versions / other providers use `Task`) — the chip matches BOTH names.
2. Click → `SubagentOpen` context → `openSubagentTab(call.id, agentType)` → `store.openSubagent`,
   which opens a self-contained `sub:<ccSessionId>|<toolUseId>|<agentType>` tab or drawer per Settings → Views → **Subagent transcripts**.
3. **Editor layout:** `WorkspaceShell` portals `SubagentTranscriptView` into the editor pane container or `EditorTabDrawer`.
4. **Agent Mode:** when pref = tab, `AgentModeShell` reads the focused `sub:` key via `focusedAgentSidePanelKey`
   and renders `SubagentTranscriptView` **inline** in `.agent-main-review` (50/50 beside chat). When pref = drawer,
   `AgentModeShell` mounts the same overlay drawer host as `WorkspaceShell`.
5. `SubagentTranscriptView` calls `claude_code_load_subagent(cwd, ccSessionId, toolUseId)`.
6. **On-disk linkage:** Claude Code writes each subagent to
   `~/.claude/projects/<enc-cwd>/<session>/subagents/agent-<id>.jsonl` with a sibling
   `agent-<id>.meta.json` = `{agentType, description, toolUseId}`. The command finds the meta whose
   `toolUseId` matches the Task call id, then parses the sibling jsonl (reuses `parse_session_jsonl`).
7. Rendered read-only: delegation prompt as a "user" bubble, subagent steps via `ToolCallRow`. **No composer.**

### Agent Mode gotcha (fixed)
Previously `openSubagent` added a tab to `layout.editorRoot` but Agent Mode **does not mount**
`WorkspaceShell` — the tab existed in state with no visible surface. Agent Mode now watches
`focusedAgentSidePanelKey` and renders the transcript inline, same split chrome as compose review.

### Inner steps hidden from the main stream
The subagent's own tool calls (its Read/Glob/Grep/…) arrive in the live stream as records tagged
with `parent_tool_use_id` (and aren't persisted to the main session jsonl — they go to the subagent
file). `providers/claudeCode.ts` skips emitting any `assistant`/`user` record where
`parent_tool_use_id` (or `parentToolUseID`) is set, so the main transcript shows **only** the
Agent chip + its final report. The full inner work lives in the read-only transcript tab.

### Plan mode — sidechain permission auto-allow (2026-07-14)
When Jack is in CC **Plan** mode and delegates via `Task`/`Agent`, the subagent's inner tool calls
still hit the PreToolUse hook. The hook JSON carries `parent_tool_use_id` (same id as the stream
filter above). `claude_perm.rs` forwards it on `claude:permission-request`; `ClaudePermissionOverlay`
auto-allows sidechain reads/explore in Plan without permission cards. File writes and non-read-only
Bash from subagents still card. See [015-claude-permission-mode.md](015-claude-permission-mode.md).

### Gotchas
- **Tool name is `Agent`, not `Task`:** current Claude Code emits the subagent dispatch tool as
  `Agent` (input `{description, prompt, subagent_type}`). The chip special-case matches `Agent` AND
  `Task`; `friendlyToolName` maps both to "Subagent". Matching only `Task` left the generic "• Agent"
  row (the original bug).
- **CC-only:** `agents` is empty for non-CC providers; `attachedAgents` and subagent chips never appear elsewhere.
- **Timing:** the subagent jsonl/meta land on disk only when the run **finishes** — clicking the chip
  mid-run shows "transcript isn't ready". `claudeSessionId` must also be captured (the `session` stream event).
- **Ephemeral tabs:** `sub:` keys have no store record and return `false` in the load-time `clean()` filter,
  so they don't survive an app restart (by design — read-only viewers).
- **Avatar consistency:** chip, tab icon, and view header all derive the duck from the SAME
  `subagent_type` string via `duckAvatarFor`, so they always match (and match the @-mention popover).
- **Compact (agent) mode** renders Task/Agent chips in the stream (single-tool runs as
  standalone `.ai-tcall-subagent`; multi-tool runs inside `.ai-iarow`). Click opens the side panel.
- **Composer chips:** delegated agents show as pills inside the input row (072), not `@name` text.
