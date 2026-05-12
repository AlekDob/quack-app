---
type: feature
project: quack-app
slug: ask-tool
created: 2026-05-12
last_verified: 2026-05-12
tags: [sdk, ask-user-question, hooks, daemon, frontend, widget, claude-agent-sdk]
---

# 064 — Ask Tool (AskUserQuestion)

Interactive multiple-choice prompt the model can use to disambiguate a request. Built on top of the SDK's `AskUserQuestion` tool plus Quack-specific routing through the daemon (PreToolUse + PostToolUse hooks) and a dedicated React widget.

## Status

| Field | Value |
|---|---|
| State | working (SDK 0.2.138 verified) |
| Owner | Alek |
| Brain refs | `bugs/fix-askuserquestion-sdk-0.2.138-pretool-posttool-hook.md` (current fix), `bugs/fix-askuserquestion-native-cli-strips-answers.md` (historical, superseded), `bugs/fix-ask-user-question-stream-event-not-emitted.md` (canUseTool bypass mode), `bugs/fix-askuserquestion-native-cli-strips-answers.md` (predecessor) |
| SDK version | `@anthropic-ai/claude-agent-sdk@0.2.138` |

## Files

| File | Role |
|---|---|
| `src/components/AskUserQuestionWidget.tsx` | React widget rendered inline in the chat. Single + multi-select + "Other" custom answer. |
| `src/components/AskUserQuestionWidget.css` | Styling. |
| `src/components/StreamMessage.tsx` (~L594) | Mounts `MemoizedAskUserQuestionWidget` for each `AskUserQuestion` tool_use. Wires `onSubmit → onUserQuestionAnswer(toolUseId, answers, sessionId)`. |
| `src/App.tsx` | Holds `pendingUserQuestions: Map<requestId, {agentId, sessionKey, questions}>`. Listens for `ask-user-question` Tauri event, populates the map, surfaces toast + native notification. `answerUserQuestionForAgent` resolves the right `requestId` and forwards to `answer_user_question` Rust command. |
| `src/hooks/useClaudeChat.ts` | `answerUserQuestion` thin wrapper; updates `answeredQuestions` + `pendingQuestionIds` UI state. |
| `src/services/claudeSDK.ts` | `answerUserQuestionViaStdin(processKey, requestId, answers)` — invokes Tauri command with retry/timeout. |
| `src-tauri/src/claude_cli.rs` | `answer_user_question` Tauri command — JSON-serializes the response and writes it to daemon stdin. |
| `src-tauri/node-sdk/stream-daemon.js` | Daemon entry. PreToolUse + PostToolUse hooks for `AskUserQuestion`, `pendingAskAnswers` map, frontend round-trip via `requestFromFrontend`. |

## Flow

| # | Component | Action |
|---|---|---|
| 1 | model | Calls `AskUserQuestion` tool with `{ questions: [...] }`. |
| 2 | daemon `PreToolUse` hook | Calls `requestFromFrontend(queryId, 'ask_user_question', { questions })`. Emits Tauri event `ask-user-question` to frontend with `requestId`. |
| 3 | App.tsx listener | Stores `requestId → {agentId, sessionKey, questions}` in `pendingUserQuestions`. Mounts widget with toast + native notification. |
| 4 | user | Selects radio / checkbox(es) / "Other" custom text → submit. |
| 5 | widget | Builds `AskUserQuestionAnswers` (`Record<header, string \| string[]>`). Calls `onUserQuestionAnswer(toolUseId, answers, sessionId)`. |
| 6 | App.tsx | Resolves `requestId` from `pendingUserQuestions` (matching agentId + sessionKey) → calls `answerUserQuestionViaStdin`. |
| 7 | Rust | Writes `{ type: 'response', requestId, answers }` to daemon stdin. |
| 8 | daemon `handleResponse` | Resolves the pending promise → `requestFromFrontend` returns to PreToolUse hook. |
| 9 | daemon PreToolUse | Stages answers in `pendingAskAnswers: Map<toolUseId, answers>`. Returns `{hookSpecificOutput: {permissionDecision: 'allow'}}`. |
| 10 | daemon `canUseTool` | Called for `AskUserQuestion` despite PreToolUse allow (because tool has `requiresUserInteraction=true`). Bypasses with `{behavior: 'allow', updatedInput: input}` — must NOT re-prompt frontend (would hang). |
| 11 | tool | Executes natively, returns `{questions, answers: {}}` (empty — `answers` field stripped by native binary IPC). |
| 12 | daemon `PostToolUse` hook | Pulls answers from `pendingAskAnswers`, deletes the entry, returns `{hookSpecificOutput: {hookEventName: 'PostToolUse', additionalContext: <markdown>}}`. |
| 13 | model | Sees the empty tool result + appended `additionalContext` markdown listing user's selections. Replies based on those. |

## Schema

| Layer | Shape |
|---|---|
| Widget input (props) | `questions: AskUserQuestion[]`, `toolUseId: string`, `onSubmit: (toolUseId, answers) => void` |
| Widget output | `AskUserQuestionAnswers = { [header: string]: string \| string[] }` |
| Tauri command | `answer_user_question(agent_id, request_id, answers: serde_json::Value)` |
| Daemon stdin | `{ type: 'response', requestId: string, answers: object }` |
| `additionalContext` markdown | `User answered the following questions:\n- <header>: <value or comma-joined list>\n...` |

## Modes

| Mode | Behavior |
|---|---|
| single-select (radio) | One option, one string value. |
| multiSelect (checkbox) | Multiple options, value is `string[]`. PostToolUse joins with `", "` for the model. |
| "Other" custom | Free text. Sent as `Other: <text>` (with prefix). |
| disabled (already answered) | Widget renders read-only with green "Answered" badge. |

## Constraints

| # | Constraint |
|---|---|
| 1 | 1–4 questions per AskUserQuestion call (SDK schema enforced). |
| 2 | 2–4 options per question (SDK schema enforced). |
| 3 | `header` string max 12 chars (SDK schema enforced). |
| 4 | NOT available in subagents spawned via the Agent tool (SDK limitation, see official docs). |
| 5 | `AskUserQuestion` MUST stay in the `claude_code` preset tools list — required for the model to access the tool. Removing it from `allowedTools` is harmless (auto-approve doesn't apply due to `requiresUserInteraction`). |

## Diagnostic logging

`~/.quack/daemon-diag.log` traces every AskUserQuestion. Filter:

```bash
grep -E 'PreToolUse|PostToolUse|staged|appending|canUseTool AskUser|RESPONSE on stdin' ~/.quack/daemon-diag.log
```

Expected sequence on a successful round-trip:

```
PreToolUse AskUserQuestion fired for query=… toolUseId=toolu_…
RESPONSE on stdin: requestId=…
✅ RESOLVED requestId=…
PreToolUse staged answers for toolUseId=toolu_…: {…}
canUseTool AskUserQuestion bypassed (PreToolUse hook handled it) for query=…
PostToolUse AskUserQuestion appending context for toolUseId=toolu_…: {…}
```

## Known regressions

| Date | SDK version | Symptom | Resolution |
|---|---|---|---|
| 2026-05-04 | 0.2.111 | Native CLI binary IPC stripped `updatedInput.answers` | Force bundled `cli.js` by removing `pathToClaudeCodeExecutable`. |
| 2026-05-11 | 0.2.138 (after upgrade) | All AskUserQuestion answers empty (radio + multi + Other) | Workaround above. Bundled `cli.js` no longer exists since 0.2.113. |

## Sources

- Brain `bugs/fix-askuserquestion-sdk-0.2.138-pretool-posttool-hook.md` — current fix, full root-cause analysis
- Brain `bugs/fix-askuserquestion-native-cli-strips-answers.md` — historical context (superseded)
- [SDK CHANGELOG 0.2.113](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md) — change to native binary
- [Handle approvals and user input — official docs](https://code.claude.com/docs/en/agent-sdk/user-input)
- [Hooks — official docs](https://code.claude.com/docs/en/agent-sdk/hooks) — PreToolUse / PostToolUse / `additionalContext`
