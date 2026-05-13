---
type: bug_fix
project: quack-app
created: 2026-05-12
last_verified: 2026-05-12
tags: [sdk, ask-user-question, native-cli, hooks, pretooluse, posttooluse, daemon, stream-daemon, regression]
---

# Fix: AskUserQuestion answers stripped after SDK 0.2.111 → 0.2.138 upgrade

## Symptom

After bumping `@anthropic-ai/claude-agent-sdk` from `0.2.111` to `0.2.138` (commit `3d84a9e`, 2026-05-11), every AskUserQuestion in Quack came back as if the user had not replied:

> "Sembra che la risposta sia arrivata vuota — non vedo quale opzione hai selezionato."

Reproducible 100% on radio singolo, multiSelect (checkbox), and "Other" custom answers. Frontend submit OK, daemon stdin OK, `canUseTool` returned `updatedInput.answers` correctly — model still saw `answers: {}`.

## Root cause

SDK `v0.2.113` changelog:

> Changed the SDK to spawn a **native Claude Code binary** (via a per-platform optional dependency) **instead of bundled JavaScript**.

From `0.2.113` onwards, the SDK no longer ships a bundled `cli.js` — it spawns the native binary from `@anthropic-ai/claude-agent-sdk-<platform>-<arch>` (e.g. `claude-agent-sdk-darwin-arm64`). The native binary's IPC layer enforces the input schema declared in `sdk-tools.d.ts` and **strips off-schema fields**.

`AskUserQuestionInput` declares only `questions` (no `answers`), so the trick from the previous fix (`canUseTool` returning `{ behavior: 'allow', updatedInput: { questions, answers: response.answers } }`) silently loses the `answers` field — the tool's `call({questions, answers = {}})` runs with the default empty object and the model sees an empty result.

This is the same class of bug as the resolved 2026-05-04 incident (`fix-askuserquestion-native-cli-strips-answers.md`), but this time the previous workaround (force the bundled `cli.js` by removing `pathToClaudeCodeExecutable`) **does not apply** — the bundled `cli.js` no longer exists in the package.

## Why the obvious fixes did not work

1. **Removing `'AskUserQuestion'` from `allowedTools`**: ineffective. `canUseTool` was already invoked before the fix because `AskUserQuestion` has `requiresUserInteraction = true`, which overrides the allow-list pre-approval (Issue #29547 documents the priority pattern). The auto-approve in step 4 was never short-circuiting AskUserQuestion in the first place.

2. **Rolling back to 0.2.111**: rejected by the user — needs to track upstream.

3. **`pathToClaudeCodeExecutable` pointing at bundled JS**: no JS file to point at. Only `sdk.mjs` (the orchestrator) ships in the package; it always spawns the native binary.

## Fix

Three-step workaround using the SDK's hook system (PreToolUse + PostToolUse), which was added/extended in `v0.2.121` with `updatedToolOutput` (and which provides `additionalContext` on PostToolUse):

```js
// Brain: fix-askuserquestion-sdk-0.2.138-pretool-posttool-hook
const pendingAskAnswers = new Map(); // toolUseId → answers (collected in Pre, consumed in Post)

// 1. PreToolUse hook: open the frontend prompt, collect answers, stage them, auto-allow.
hooks: {
  PreToolUse: [{
    matcher: 'AskUserQuestion',
    hooks: [async (input, toolUseId) => {
      const response = await requestFromFrontend(queryId, 'ask_user_question', {
        questions: input.tool_input.questions,
      });
      pendingAskAnswers.set(toolUseId, response.answers);
      return {
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'allow',
        },
      };
    }],
  }],

  // 3. PostToolUse hook: append staged answers as plain markdown context.
  PostToolUse: [{
    matcher: 'AskUserQuestion',
    hooks: [async (input, toolUseId) => {
      const answers = pendingAskAnswers.get(toolUseId);
      if (!answers) return {};
      pendingAskAnswers.delete(toolUseId);
      const lines = ['User answered the following questions:'];
      for (const [header, value] of Object.entries(answers)) {
        const display = Array.isArray(value) ? value.join(', ') : String(value);
        lines.push(`- ${header}: ${display}`);
      }
      return {
        hookSpecificOutput: {
          hookEventName: 'PostToolUse',
          additionalContext: lines.join('\n'),
        },
      };
    }],
  }],
},

// 2. canUseTool for AskUserQuestion: bypass — PreToolUse hook already prompted.
// `requiresUserInteraction=true` forces canUseTool to be invoked even after PreToolUse
// auto-allow. If we re-call requestFromFrontend here the daemon hangs (frontend won't
// show a second widget for an already-answered question). Just allow with original input.
canUseTool: async (toolName, input) => {
  if (toolName === 'AskUserQuestion') {
    return { behavior: 'allow', updatedInput: input };
  }
  // ... other tools
},
```

### Why `additionalContext` (not `updatedToolOutput`)

Initial attempt used `updatedToolOutput: JSON.stringify({ questions, answers })` — verified in diag log that the hook fired and the value was set, but the model still saw empty. Suspected cause: native binary validates `updatedToolOutput` against `AskUserQuestionOutput` schema (which has `answers: Record<string, string>`) and drops the field again, OR serializes the JSON string into something the model can't parse as the structured output.

`additionalContext` *appends* to the tool's (empty) output as plain text — no schema validation, no structured-output round-trip. Renders as a markdown list. Robust and human-readable.

## Why canUseTool can't be removed entirely

Even with PreToolUse handling AskUserQuestion, the SDK still calls `canUseTool` for it (`requiresUserInteraction` semantics). If `canUseTool` re-prompts the frontend, the user has already answered — no second widget appears, `requestFromFrontend` never resolves, daemon hangs in loading. The bypass returning `{ behavior: 'allow', updatedInput: input }` is mandatory.

## Files changed

- `src-tauri/node-sdk/stream-daemon.js` — added `pendingAskAnswers` map, PreToolUse + PostToolUse hooks for AskUserQuestion, simplified canUseTool's AskUserQuestion branch.

## Hook timeout — must override the 60s default

The SDK's default `HookMatcher.timeout` is **60 seconds**. AskUserQuestion can sit pending for many minutes (the user reads carefully, switches context, comes back later). If the hook times out, the SDK proceeds without staged answers — `pendingAskAnswers` stays empty, the tool runs with `answers={}`, and PostToolUse skips because there's nothing to inject. The model sees the same empty answer the bug was supposed to fix.

Symptom in `~/.quack/daemon-diag.log`:

```
PreToolUse AskUserQuestion fired ... toolUseId=toolu_xxx
... (~60s pass) ...
RESULT_EVENT: subtype=success
canUseTool AskUserQuestion bypassed ... (same toolUseId)
PostToolUse AskUserQuestion: no staged answers for toolUseId=toolu_xxx (skipping)
```

Fix: set `timeout: 86400` (24h) on the PreToolUse HookMatcher. The hook then effectively waits forever for the user, matching the documented `canUseTool` semantic ("The callback can stay pending indefinitely").

## Verification

`~/.quack/daemon-diag.log` shows the correct flow when the fix works:

```
PreToolUse AskUserQuestion fired for query=… toolUseId=toolu_…
RESPONSE on stdin: requestId=…
PreToolUse staged answers for toolUseId=toolu_…: {"Auth strategy":"…","Login methods":[…]}
canUseTool AskUserQuestion bypassed (PreToolUse hook handled it) for query=…
PostToolUse AskUserQuestion appending context for toolUseId=toolu_…: {…}
```

Sources for the diagnosis: [SDK CHANGELOG 0.2.113](https://github.com/anthropics/claude-agent-sdk-typescript/blob/main/CHANGELOG.md), [Handle approvals and user input docs](https://code.claude.com/docs/en/agent-sdk/user-input), [Hooks docs](https://code.claude.com/docs/en/agent-sdk/hooks), [Issue #29547](https://github.com/anthropics/claude-code/issues/29547), Brain `fix-askuserquestion-native-cli-strips-answers.md` (predecessor, for context).
