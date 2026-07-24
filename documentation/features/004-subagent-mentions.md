---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-06-28
last_verified: 2026-07-24

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
| Prompt | `src/brainPrompt.ts` | `quackClaudeCodeEditorPrompt()` — subagent cannot surface AskUserQuestion |
| Component | `src/components/MentionSuggestions.tsx` | `@` popover UI (agent + file rows, path preview) — see **`041-mention-file-preview.md`** |
| Component | `src/components/MentionPathPreview.tsx` | Side tree for highlighted file row (041) |
| Component | `src/components/AIChatPanel.tsx` | `agents`/`attachedAgents` state, agent-load effect (CC-only), `@` match logic + `acceptMention`, delegation injection, reset, chips; `SubagentOpen.Provider` + `openSubagentTab`; `.ai-mention-open` overflow toggle |
| Render | `src/components/chatToolRender.tsx` | `SubagentOpen` context, `subagentTypeOf()`, `isSubagentDispatch()`, Task/Agent→duck-avatar chip (clickable + model label); `CompactBlocks` mounts chip outside `ActionBatchSummary` |
| Util | `src/streamModelLabel.ts` | Cursor-style short labels (`Haiku 4.5`) for chip + header |
| Component | `src/components/SubagentTranscriptView.tsx` | read-only transcript viewer (portaled in editor/drawer, **inline** in agent mode when pref = tab), reuses `TranscriptTurnRows` + `ToolCallRow`; header shows model |
| Render | `src/components/TranscriptTurnRows.tsx` | shared read-only turn markup (`.ai-msg`, `.ai-tcalls`, `UserTurnBar` shell) |
| Host | `src/components/WorkspaceShell.tsx` | walks panes for `sub:` keys, portals one viewer each |
| Agent host | `src/components/AgentModeShell.tsx` | Tab pref: inline `SubagentTranscriptView` in `.agent-main-review`. Drawer pref: `EditorTabDrawer` + `TabContentHost` overlay |
| Store | `src/store.ts` | `subagent` tab kind (`subKey`/`parseKey`), `openSubagent()` → `openSingletonSurface`, `focusedAgentSidePanelKey` (skips drawer-only `sub:`), `collectSubagentTabs`, `focusedSubagentKey` |
| Backend | `src-tauri/src/claude_code.rs` | `claude_code_load_subagent`, `parse_session_jsonl` (shared) |
| IPC | `src/ipc.ts` | `claudeCode.loadSubagent`, `LoadedSubagent` |
| Assets | `public/images/ducks/duck1..35.jpeg` | duck avatars |
| Prefs | `src/surfaceViewPrefs.ts` | `SurfaceViewId` includes `subagent`; default **drawer** — see **`063-surface-view-prefs.md`** |
| Styles | `src/App.css` | `.ai-mention-*`, `.ai-agent-chip*`, `.ai-tcall-subagent`, `.subagent-view*`, `.tab-sub-avatar`, `.editor-tab-drawer-sub-avatar` |

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
   **Model label (Cursor-style):** muted text next to the type (`Haiku 4.5`) via
   `streamModelLabel` — sourced from live sidechain peek (`subagent_model` stream event) or
   rare `arguments.model`, persisted on `ToolCall.model`.
2. Click → `SubagentOpen` context → `openSubagentTab(call.id, agentType)` → `store.openSubagent`,
   which opens a self-contained `sub:<ccSessionId>|<toolUseId>|<agentType>` tab or drawer per Settings → Views → **Subagent transcripts**.
3. **Editor layout:** `WorkspaceShell` portals `SubagentTranscriptView` into the editor pane container or `EditorTabDrawer`.
4. **Agent Mode:** when pref = tab, `AgentModeShell` reads the focused `sub:` key via `focusedAgentSidePanelKey`
   and renders `SubagentTranscriptView` **inline** in `.agent-main-review` (50/50 beside chat). When pref = drawer,
   `AgentModeShell` mounts the same overlay drawer host as `WorkspaceShell`.
5. `SubagentTranscriptView` calls `claude_code_load_subagent(cwd, ccSessionId, toolUseId)` — returns
   `model` (first non-synthetic `message.model` on the sidechain jsonl) and shows it in the header.
6. **On-disk linkage:** Claude Code writes each subagent to
   `~/.claude/projects/<enc-cwd>/<session>/subagents/agent-<id>.jsonl` with a sibling
   `agent-<id>.meta.json` = `{agentType, description, toolUseId}`. The command finds the meta whose
   `toolUseId` matches the Task call id, then parses the sibling jsonl (reuses `parse_session_jsonl`).
7. Rendered read-only: delegation prompt as a "user" bubble, subagent steps via `ToolCallRow`. **No composer.**

### Model on chip + header (2026-07-24)

Cursor-style billed-model label next to the subagent type — **not** the stable
picker aliases of [`071-honest-model-labels.md`](071-honest-model-labels.md).

**Why peek:** Agent/Task `tool_input` almost never includes `model` (0 hits in
local transcripts). Ground truth is sidechain `assistant.message.model`.

#### Data flow

```
CC sidechain NDJSON (parent_tool_use_id set)
  → claudeCode.ts peek once per parent id
  → ChatStreamEvent { kind: "subagent_model"; toolUseId; model }
  → AIChatPanel stamps ToolCall.model
  → ToolCallRow → streamModelLabel → .ai-tcall-model

Disk: agent-*.jsonl
  → peek_jsonl_model (first non-<synthetic> message.model)
  → LoadedSubagent.model
  → SubagentTranscriptView → .subagent-view-model
```

#### Surfaces

| Surface | CSS / markup | Label source |
|---|---|---|
| Main stream chip | `.ai-tcall-model` after `.ai-tcall-name` | `call.model` \|\| `arguments.model` |
| Transcript header | `.subagent-view-model` next to agent type | `LoadedSubagent.model` |

#### Key functions / types

| Symbol | Where | Role |
|---|---|---|
| `streamModelLabel(raw) → string \| null` | `src/streamModelLabel.ts` | `claude-haiku-4-5-…` → `Haiku 4.5`; bare `haiku` → `Haiku`; skips `<synthetic>` |
| `ToolCall.model?` | `src/ai.ts` | Persisted on the parent Agent/Task call |
| `ChatStreamEvent.subagent_model` | `src/ai.ts` | Live one-shot enrichment |
| `peek_jsonl_model(path) → Option<String>` | `src-tauri/src/claude_code.rs` | Disk scan for transcript header |
| `LoadedSubagent.model` | Rust + `src/ipc.ts` | Optional billed id on load |

#### Files (model-label slice)

| Type | Path | Purpose |
|---|---|---|
| Util | `src/streamModelLabel.ts` | Cursor-style short labels |
| Test | `src/streamModelLabel.test.ts` | Vitest for dated ids / aliases / synthetic |
| Type | `src/ai.ts` | `ToolCall.model`, `subagent_model` event |
| Provider | `src/providers/claudeCode.ts` | Sidechain peek + rare `arguments.model` stamp |
| Component | `src/components/AIChatPanel.tsx` | Handles `subagent_model` → mutates live `ToolCall` |
| Render | `src/components/chatToolRender.tsx` | Chip `.ai-tcall-model` |
| Component | `src/components/SubagentTranscriptView.tsx` | Header model |
| Backend | `src-tauri/src/claude_code.rs` | `LoadedSubagent.model`, `peek_jsonl_model` |
| IPC | `src/ipc.ts` | TS `LoadedSubagent.model` |
| Style | `src/App.css` | `.ai-tcall-model`, `.subagent-view-model` |

#### Gotchas

- Do **not** infer model from `subagent_type` (Explore is often Haiku, sometimes Opus/Sonnet).
- Nested sidechain content stays filtered; only `message.model` is peeked once.
- Old chats without `ToolCall.model` show no chip label until a new run (header still works via disk).
- Picker / composer keep `071` aliases (`Haiku`, not `Haiku 4.5`).

### Compact stream contract (082 — restored 2026-07-20)

All chat surfaces walk tools via `CompactBlocks` → `ActionBatchSummary`. Checklist
tools (`TaskCreate` / `TodoWrite` / `AskUserQuestion`) stay **out of the stream**.
**Subagent dispatch does not:**

| Tool name | Stream UI |
|---|---|
| `Agent` / `Task` | Duck-avatar `ToolCallRow` (this feature) — click opens drawer/tab |
| Read / Grep / Bash / Edit… | Cursor batch summary (`082`) |

`isSubagentDispatch(name)` gates the branch. On match, `CompactBlocks` **flushes**
the current batch then mounts the chip so two parallel Explores become two chips,
never `"Ran 2 actions"` / generic `<> Subagent`.

Vitest: `src/components/chatToolRender.test.ts`.

### Agent Mode gotcha (fixed)
Previously `openSubagent` added a tab to `layout.editorRoot` but Agent Mode **does not mount**
`WorkspaceShell` — the tab existed in state with no visible surface. Agent Mode now watches
`focusedAgentSidePanelKey` and renders the transcript inline (tab pref), same split chrome as compose review.
**2026-07-14:** drawer pref mounts `EditorTabDrawer` inside `AgentModeShell` so the overlay works without `WorkspaceShell`.

### Transcript rendering — shared chat markup (2026-07-14)
Before this change, `SubagentTranscriptView` used bespoke `.subagent-msg-*` classes (smaller type, left border on assistant turns, custom user bubble). That diverged from the main chat stream spacing and tool pills.

**DRY fix:** `TranscriptTurnRows.tsx` renders loaded jsonl turns with the **same DOM** as `AIChatPanel`:

| Turn | Markup |
|---|---|
| User (delegation prompt) | `.ai-turn` → `.ai-msg-user` → `.ai-user-bar.is-expanded` → `MarkdownPreview` |
| Assistant | `.ai-msg-assistant` → `.ai-msg-role` (duck avatar + name) → `.ai-tcalls` → `ToolCallRow` → `.ai-msg-body` |

`SubagentTranscriptView` wraps the list in `.ai-panel.compact` + `.ai-messages` so gutters, gap, and tool-row rhythm match compact agent chat. Header (avatar, agent type, description, close) stays in `.subagent-view-header` above the stream.

**Verify:** Settings → Views → Subagent transcripts → Side drawer; click an Explore chip; confirm Read/Bash pills match the parent chat and user delegation uses the inset user-bar card.

### Inner steps hidden from the main stream
The subagent's own tool calls (its Read/Glob/Grep/…) arrive in the live stream as records tagged
with `parent_tool_use_id` (and aren't persisted to the main session jsonl — they go to the subagent
file). `providers/claudeCode.ts` skips emitting any `assistant`/`user` record where
`parent_tool_use_id` (or `parentToolUseID`) is set, so the main transcript shows **only** the
Agent chip + its final report. The full inner work lives in the read-only transcript tab.
**Exception:** the first sidechain `assistant.message.model` is peeked once as `subagent_model`
so the chip can show which model the run is using.

### Plan mode — sidechain permission auto-allow (2026-07-14)
When Jack is in CC **Plan** mode and delegates via `Task`/`Agent`, the subagent's inner tool calls
still hit the PreToolUse hook. The hook JSON carries `parent_tool_use_id` (same id as the stream
filter above). `claude_perm.rs` forwards it on `claude:permission-request`; `ClaudePermissionOverlay`
auto-allows sidechain reads/explore in Plan without permission cards. File writes and non-read-only
Bash from subagents still card. See [015-claude-permission-mode.md](015-claude-permission-mode.md).

### AskUserQuestion — orchestrator only (2026-07-14)
Subagents run in an isolated sidechain. Their inner tool calls (including `AskUserQuestion`) are
filtered out of the parent stream (`claudeCode.ts` + `parent_tool_use_id`) and **do not** mount
`.ai-ask-dock` on the main composer ([073](073-ask-user-question-dock.md)).

**Contract:**
1. Subagent hits ambiguity → states the question + options in its **final report** to the orchestrator.
2. Orchestrator (Jack / parent chat) calls `AskUserQuestion` — user sees clickable options.
3. User answer resumes the orchestrator; orchestrator can re-delegate with the choice.

Delegation inject in `AIChatPanel` and `quackClaudeCodeEditorPrompt()` encode this rule on every
`@`-mention send and every CC turn.

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
- **Compact stream (082):** `CompactBlocks` must special-case `Task`/`Agent` via
  `isSubagentDispatch` — flush the batch and render `ToolCallRow`. Otherwise they
  fall into `other` → `"Ran N actions"` / generic `<> Subagent` with no avatar
  and no drawer click (regression fixed 2026-07-20).
- **Compact (agent) mode** renders Task/Agent chips in the stream (standalone
  `.ai-tcall-subagent`). Click opens the side panel / drawer per prefs.
- **View pref:** Settings → Views → **Subagent transcripts** (`lcp.surfaceView.subagent`). Default drawer; Editor tab restores pre-2026-07-14 inline split in Agent Mode. Manual override: drag any `sub:` tab to the drawer edge anytime (`063`).
