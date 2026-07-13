---
type: feature-doc
project: quack-desktop
stack: Tauri (Rust + React 19)
created: 2026-07-13
last_verified: 2026-07-13
tags: [claude-code, ask-user-question, composer-dock, interactive, cursor-style, permission-hook, askQuestionStore]
---

## AskUserQuestion Dock (interactive question card)

**Purpose:** When Claude Code calls `AskUserQuestion`, render a **Cursor-style**
interactive card docked above the composer — radio/checkbox options the user
clicks to answer. The CLI's native question UI does not exist under `-p`, so
Quack denies the hook call (redirect) and answers via the next user message.

**Stack:** React 19 + TS strict, module-level pub/sub store (pattern:
`aiTaskStore.ts`).

### Files

| Type | Path | Role |
|---|---|---|
| Card UI | `src/components/chatToolRender.tsx` | `AskQuestionCard`, `parseAskQuestions`, `coerceToolArgs`, `mergeAskQuestionArgs`, `isAskUserQuestionTool` |
| Host | `src/components/AIChatPanel.tsx` | `pendingAskCall` / `dockedAskCall`, `answerQuestion`, `.ai-ask-dock` mount |
| Hook cache | `src/askQuestionStore.ts` | `publishAskInput`, `getAskInput`, `clearAskInput`, `subscribeAskInput` |
| Permission | `src/components/ClaudePermissionOverlay.tsx` | Publishes `tool_input` on `AskUserQuestion` before deny-redirect |
| Styles | `src/App.css` | `.ai-ask-dock`, `.ai-ask-card`, `.ai-ask-option`, `.ai-ask-reply-btn` |

### Data flow

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
| Parse failure | Fallback card: "Reply in message box" (no infinite spinner) |
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

### Gotchas

- **Stuck spinner (fixed 2026-07-13):** parsing only stream args → empty `questions[]`
  → old placeholder showed perpetual `Question ⟳`. Fix: hook cache + lenient parse +
  fallback "Reply in message box".
- **Dismiss is per call id:** `dismissedAskId` — dismissing Q1 does not block Q2.
- **Hook deny is required:** allowing `AskUserQuestion` headless fails opaquely under `-p`.
- **Not in subagents:** CC contract — inner Task runs don't surface this dock.
- **Agent mode:** redirect still runs; interactive card is the answer path regardless of `bypassPermissions`.
