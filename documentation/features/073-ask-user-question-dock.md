---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-13
last_verified: 2026-07-16
related: [015-claude-permission-mode.md, 004-subagent-mentions.md, 022-chat-composer.md, 068-quack-plan-harness.md, 039-composer-queue.md]
tags: [claude-code, ask-user-question, composer-dock, interactive, cursor-style, permission-hook, askQuestionStore, system-prompt, orchestrator, subagent, tool-search]
---

## AskUserQuestion Dock (interactive question card)

**Purpose:** When Claude Code calls `AskUserQuestion` in the **parent (orchestrator) chat**, render a **Cursor-style**
interactive card docked above the composer — radio/checkbox options the user
clicks to answer. The CLI's native question UI does not exist under `-p`, so
Quack denies the hook call (redirect) and answers via the next user message.

**Stack:** React 19 + TS strict, module-level pub/sub store (pattern:
`aiTaskStore.ts`).

### Who can surface the dock

| Caller | Same chat as composer? | `.ai-ask-dock` |
|---|---|---|
| Orchestrator (Jack / any preset on CC) | yes | ✅ |
| Preset switch (Milo, Nora, Vera, Lia, custom) | yes — presets are not subagents | ✅ |
| Subagent sidechain (`Agent`/`Task`, `parent_tool_use_id`) | no — inner steps hidden from parent stream | ❌ |

**Subagent contract:** sidechain runs must return "needs user input: …" in their **final report**; the orchestrator then calls `AskUserQuestion` here. See [004-subagent-mentions.md](004-subagent-mentions.md).

### Files

| Type | Path | Role |
|---|---|---|
| Card UI | `src/components/chatToolRender.tsx` | `AskQuestionCard`, `parseAskQuestions`, `coerceToolArgs`, `mergeAskQuestionArgs`, `isAskUserQuestionTool` |
| Host | `src/components/AIChatPanel.tsx` | `pendingAskCall` / `dockedAskCall`, `answerQuestion`, `.ai-ask-dock` mount; CC system inject + `@` delegation hint |
| Hook cache | `src/askQuestionStore.ts` | `publishAskInput`, `getAskInput`, `clearAskInput`, `subscribeAskInput` |
| Permission | `src/components/ClaudePermissionOverlay.tsx` | Publishes `tool_input` on `AskUserQuestion` before deny-redirect |
| System prompt | `src/brainPrompt.ts` | `quackClaudeCodeEditorPrompt()` — orchestrator vs subagent rules |
| Styles | `src/App.css` | `.ai-ask-dock`, `.ai-ask-card`, `.ai-ask-option`, `.ai-ask-reply-btn` |
| Stream filter | `src/providers/claudeCode.ts` | Hides `parent_tool_use_id` records from main transcript |

### Data flow (orchestrator)

| Step | What happens |
|---|---|
| 1 | CC streams `tool_use` `AskUserQuestion` → assistant message gets `tool_calls[]` entry |
| 2 | PreToolUse hook POSTs full `tool_input` → `claude:permission-request` |
| 3 | Overlay: `publishAskInput(session_id, tool_input)` then **deny** with redirect reason (model waits; no repeat in text) |
| 4 | Turn ends (`streaming === null`, `runningTools === false`) |
| 5 | `pendingAskCall` = last assistant message's last `AskUserQuestion` call (not dismissed) |
| 6 | `dockedAskCall` = merge `call.function.arguments` + `getAskInput(claudeSessionId)` |
| 7 | `AskQuestionCard` renders options; click → `answerQuestion(text)` → `sendUserText` resumes session |
| 8 | Answer or dismiss → `clearAskInput(claudeSessionId)` |

### Subagent → orchestrator flow (2026-07-14)

```
Subagent (sidechain)                    Orchestrator (this chat)
─────────────────────                   ─────────────────────────
Read/Grep/… (hidden)                    
…                                       
Report: "Need user input: A|B|C"  ──►   AskUserQuestion({ options })
                                        .ai-ask-dock shows card
User clicks B                     ──►   sendUserText("…: B")
                                        re-delegate or continue
```

### System prompt (2026-07-14)

After the 2026-07-13 UI fix, models still skipped `AskUserQuestion` (inferred CC `-p` / Quack Plan harness limitations). Fix: explicit inject every CC turn.

| Source | When | Content |
|---|---|---|
| `quackClaudeCodeEditorPrompt()` | Every Claude Code turn in `AIChatPanel` `sysParts` | AskUserQuestion + ExitPlanMode for orchestrator; subagent handoff rule |
| `@` delegation inject | `attachedAgents.length > 0` on send | Subagents cannot surface dock — orchestrator must `AskUserQuestion` |
| `bundledSkills/quack-works.md` v11 | Skill `/quack-works` | Quack Plan table row for clarifying choices |

`jackSystemPrompt()` stays Jack-specific (Works gate, persona) — **does not** duplicate CC tool rules.

### Dual-source args (why both)

| Source | When reliable | Gotcha |
|---|---|---|
| `tool_call.function.arguments` | Stream `content_block_stop` + `assistant` repair | Often `{}` or partial JSON at commit time |
| `askQuestionStore` (hook `tool_input`) | Always complete at PreToolUse | Keyed by CC `session_id`; cleared on answer/dismiss |

`mergeAskQuestionArgs(callArgs, hookArgs)` prefers whichever parses to ≥1 question
via `parseAskQuestions`.

### Tool name matching

`isAskUserQuestionTool(name)` — case/underscore insensitive:

| Accepted |
|---|
| `AskUserQuestion`, `askUserQuestion`, `ask_user_question` |

### Parse schema (`parseAskQuestions`)

| Field | Aliases | Required |
|---|---|---|
| Question text | `question`, `text`, `title`, `prompt` | yes |
| Options | array of strings or `{ label, description? }` | yes, ≥1 |
| Option label | `label`, `name`, `value`, `text` | per option |
| Header | `header` | no |
| Multi-select | `multiSelect: true` | no (default false) |

`coerceToolArgs` unwraps: JSON string, `{ input }`, `{ tool_input }`.

### UI behaviour (`AskQuestionCard`)

| Case | UX |
|---|---|
| Single question, single-select | Click option → answer sent immediately |
| Multi-select or multi-question | Collect picks → **Send answer(s)** |
| Multi-question tabs | Underline tabs; auto-advance after radio pick |
| **Other…** | Focus composer — free-form reply |
| **Esc** / ✕ | `onDismiss` — hide card; user can still type below |
| Parse failure | Dock hidden — user answers in composer; transcript keeps compact "Question" row |
| Sent | `.ai-ask-card-sent` — dimmed, "Answer sent." |

Answers format (user message text):

```
{header or question}: {chosen labels}
```

Multi-question: one line per question, newline-separated.

### Transcript vs dock

| Surface | Render |
|---|---|
| `.ai-ask-dock` (above composer) | Full interactive `AskQuestionCard` while pending |
| `.ai-composer-shell.has-ask` | Question card **replaces** composer body; one bordered pill |
| Other… | Reveals composer (`ask-freeform`) for a custom typed answer |
| `ToolCallRow` in stream | Compact one-liner: `Question` + summary (no duplicate option list) |
| `CompactBlocks` / action strip | **Skipped** — same as `TodoWrite` / task tools |

### Visual (Cursor-style, 2026-07-13)

- Neutral chrome: hairline `--border`, `--bg` card, no orange left accent bar
- Options: transparent rows, `--bg-hi` on hover/picked
- Radio/checkbox indicators: monochrome `--fg` (not accent)
- Send: `--primary-bg` monochrome pill
- Dock: `.ai-ask-dock` between status/todos and composer shell

### Integration

| Feature | Link |
|---|---|
| Permission deny-redirect | `015-claude-permission-mode.md` |
| Queue while busy | `039-composer-queue.md` — `answerQuestion` enqueues if streaming |
| Agent hub needs-input | `009-agent-hub.md` — 600ms grace; redirect settles before flash |
| Composer dock family | `022-chat-composer.md` § Ask question dock |
| Subagent delegation | `004-subagent-mentions.md` § AskUserQuestion — orchestrator only |
| Quack Plan + ExitPlanMode | `068-quack-plan-harness.md` |

### Gotchas

- **Stuck spinner (fixed 2026-07-13):** parsing only stream args → empty `questions[]`
  → old placeholder showed perpetual `Question ⟳`. Fix: hook cache + lenient parse.
- **Useless fallback dock (fixed 2026-07-16):** when parse still failed, a "Reply in
  message box" card duplicated the composer while models pasted options in prose.
  Fix: hide `.ai-ask-dock` unless `hasParsedAskQuestions`; lenient parse also accepts
  root-level single question + JSON-string `questions`.
- **Plain-text fallback (fixed 2026-07-14):** models said tools "unavailable in this harness"
  and pasted options in prose. Fix: `quackClaudeCodeEditorPrompt()` + delegation inject.
- **Deferred ToolSearch miss (fixed 2026-07-16):** CC ≥2.1.72 defers `AskUserQuestion` /
  `ExitPlanMode` behind `ToolSearch`. `select:ExitPlanMode` often returns "No matching
  deferred tools" (upstream #45294 / #49843) → Jack pastes the plan as markdown and never
  hits Quack's ask dock / Build card. Fix: Quack spawn sets `ENABLE_TOOL_SEARCH=false` in
  `apply_clean_env` (`claude_code.rs`) so both schemas load eagerly; prompt also forbids
  ToolSearch for these two tools.
- **Dismiss is per call id:** `dismissedAskId` — dismissing Q1 does not block Q2.
- **Hook deny is required:** allowing `AskUserQuestion` headless fails opaquely under `-p`.
  Deny reason tells the model Quack is showing clickable options (not "ask in plain text").
- **Not in subagents:** CC sidechain runs (`parent_tool_use_id`) are hidden from the main stream —
  `pendingAskCall` only watches this chat's last assistant turn. A subagent's `AskUserQuestion`
  never surfaces `.ai-ask-dock`. **Pattern:** subagent returns "needs user input: …" in its final
  report → orchestrator calls `AskUserQuestion` in the parent chat.
- **Agent mode:** redirect still runs; interactive card is the answer path regardless of `bypassPermissions`.
- **Presets ≠ subagents:** Milo/Nora/Lia share the orchestrator chat — they call `AskUserQuestion` directly.
