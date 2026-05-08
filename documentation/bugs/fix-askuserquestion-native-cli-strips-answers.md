---
type: bug_fix
project: quack-app
created: 2026-05-04
last_verified: 2026-05-04
tags: [sdk, ask-user-question, native-cli, ipc, can-use-tool, daemon, stream-daemon]
---

# Fix: AskUserQuestion answers silently dropped when daemon used native CLI binary

## Symptom

After answering an AskUserQuestion in Quack, the assistant replied as if the user had skipped:

> "It looks like the answer came back empty — did you skip it?"
> "Looks like no answer came through — let me know if you want to try again."

Affected only some users: those who had the standalone Claude Code installer at `~/.local/bin/claude`. Users who installed via Homebrew, npm, or another path-prefixed location were unaffected — they appeared in `which claude` but not at the path Quack's daemon checks.

The frontend logs showed the answer was sent successfully. The daemon-diag log showed `canUseTool AskUserQuestion RESOLVED ...: {"Color":"Red"}` — i.e. the answer reached the SDK callback. Yet the model still saw an empty answer.

## Root Cause

`stream-daemon.js` had a forked CLI selection (added 2026-03-16, see resolved gotcha `gotcha-sdk-bundled-cli-200k-context-window`):

```js
const nativeClaudePath = join(homedir(), '.local', 'bin', 'claude');
const hasNativeCli = existsSync(nativeClaudePath);
const options = {
  ...(hasNativeCli ? { pathToClaudeCodeExecutable: nativeClaudePath } : {}),
  // ...
};
```

When the override was active, the SDK spawned the **native** CLI binary as a child process and communicated with it over IPC. When the override wasn't, the SDK loaded the bundled `cli.js` (from `node_modules/@anthropic-ai/claude-agent-sdk`) and ran it in the **same JS context** as the daemon.

Quack's `canUseTool` callback returns AskUserQuestion answers like this:

```js
return {
  behavior: 'allow',
  updatedInput: { questions: input.questions, answers: response.answers },
};
```

The bundled `cli.js`'s AskUserQuestion implementation reads `answers` directly from its input:

```js
async call({questions, answers = {}, annotations}, _) {
  return { data: { questions, answers, ...(annotations && {annotations}) } };
}
```

But `answers` is **not** in the public `AskUserQuestionInput` type (`sdk-tools.d.ts:566` declares only `questions`). The bundled CLI honored the off-schema field because it ran in-process — the field passed through unchanged. The native binary's IPC layer enforces the declared schema and **strips off-schema fields** during serialization, so `answers` never reached the tool's `call()`. The tool ran with no answers, the model saw an empty result.

Same Claude Code release on both Macs (2.1.126), same SDK (`@anthropic-ai/claude-agent-sdk@0.2.111`), same daemon code — only the IPC layer differed.

## Fix

Removed the `pathToClaudeCodeExecutable` branch entirely. The 200k-context workaround that justified the override has since been resolved upstream: bundled `cli.js` now correctly reports `modelUsage.contextWindow: 1000000` for `claude-opus-4-7[1m]` (verified 2026-05-04 against SDK 0.2.111). With no override, the daemon always uses bundled `cli.js`, the `canUseTool` answer-routing trick keeps working, and the perf win the override originally bought is no longer relevant.

```js
// stream-daemon.js — before (~lines 388–409)
const isWindows = process.platform === 'win32';
const nativeClaudePath = isWindows
  ? join(homedir(), '.claude', 'local', 'claude.exe')
  : join(homedir(), '.local', 'bin', 'claude');
const hasNativeCli = existsSync(nativeClaudePath);
log('QUERY', `CLI: ${hasNativeCli ? 'native (' + nativeClaudePath + ')' : 'bundled cli.js'}`);
// ...
const options = {
  ...(hasNativeCli ? { pathToClaudeCodeExecutable: nativeClaudePath } : {}),
  // ...
};

// after
log('QUERY', 'CLI: bundled cli.js');
const options = {
  // pathToClaudeCodeExecutable removed
  // ...
};
```

## Why this was hard to spot

- Daemon-side logs were identical in both the working and failing cases — `canUseTool ... RESOLVED: {"Color":"Red"}` printed the same. The break was further downstream, in the SDK→CLI IPC.
- The bug was per-user and per-machine (depending on what installer the user happened to use), so it didn't show in CI or on the developer's machine if they used Homebrew.
- The clue that ruled out parallel daemons (suspected first because of concurrent prod + dev Quack runs) was: with only dev running, native CLI re-enabled, the bug returned.

## Documented vs undocumented

`canUseTool` + `updatedInput.answers` is the only mechanism the SDK exposes for AskUserQuestion answers — there's no separate `onAskUserQuestion` callback, no dedicated control-protocol subtype (the full union of `SDKControlRequestInner` was checked: `can_use_tool`, `request_user_dialog`, `elicitation` are the relevant ones, none specifically for AskUserQuestion). So the trick is the documented path, but it only round-trips through the bundled `cli.js`'s in-process flow. Anyone routing through the native binary's IPC needs a different design.

## Files changed

- `src-tauri/node-sdk/stream-daemon.js` — removed the `hasNativeCli` / `pathToClaudeCodeExecutable` branch.
- `documentation/gotchas/gotcha-sdk-bundled-cli-200k-context-window.md` — marked RESOLVED, with a banner explaining the side benefit for AskUserQuestion answer-routing.
