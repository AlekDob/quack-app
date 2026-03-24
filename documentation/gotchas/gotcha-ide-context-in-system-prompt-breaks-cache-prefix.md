---
type: gotcha
project: quack-app
created: 2026-03-24
last_verified: 2026-03-24
tags: [sdk, context, caching, ide-context, prompt-structure]
---

# IDE context inside system prompt breaks cache prefix reuse

## Problem

Quack injects IDE context (`open file`, git summary, selection context) into the SDK request as part of `systemPromptAppend`, not as turn-local message content.

This does **not** appear to duplicate the user message or `CLAUDE.md`, but it does make the cached prefix more fragile. When the IDE-opened file changes, cache reuse drops and fresh cache creation rises on the next turn.

## What we tested

We added `DAEMON:CONTEXT` and `DAEMON:USAGE` logs to inspect:

- prompt summary + hash
- `ideContext` summary + hash
- `systemPromptAppend` summary + hash
- loaded instruction file hashes
- `cacheReadTokens`
- `cacheCreationTokens`
- `effectiveContextFill`

We then ran controlled repeated-message tests in:

- `quack-app`
- a clean test project
- a long-running real session in `flow`

with combinations of:

- IDE context enabled / disabled
- `settingSources: ['project', 'user', 'local']` vs `['project']`
- built-in MCP servers enabled / disabled

## Key findings

### 1. No evidence of duplicate visible context

Across repeated identical prompts, the visible injected blocks stayed byte-stable unless we intentionally changed the IDE-opened file:

- `ideContext.hash`
- `systemPromptAppend.hash`
- instruction file hashes
- `settingSources` hash
- `allowedTools` hash
- `mcpServers` hash

When these hashes stayed fixed, there was no evidence that Quack was accidentally sending the visible context twice.

### 2. `ideContext` is a cache-boundary problem, not mainly a raw token-volume problem

In reduced setups, enabling `ideContext` only added about `100-170` effective tokens. The larger problem appeared when `ideContext` changed between turns.

In `quack-app`, with the same prompt and same session:

| Turn | `ideContext.hash` | `systemPromptAppend.hash` | `cacheReadTokens` | `cacheCreationTokens` |
|------|-------------------|---------------------------|-------------------|-----------------------|
| Stable IDE file | `2c576dfd09b339f3` | `df5aa6a88b948ccf` | `29718` | `6242` |
| Stable IDE file | `2c576dfd09b339f3` | `df5aa6a88b948ccf` | `29718` | `6326` |
| Different IDE file | `1eb3028e15c1f612` | `b5af7c505d66fbe7` | `23196` | `12926` |

Changing the IDE-opened file produced an almost direct swap:

- `cacheReadTokens`: `29718 -> 23196` (`-6522`)
- `cacheCreationTokens`: `6326 -> 12926` (`+6600`)

The same pattern appeared in a large real session in `flow`:

- `cacheReadTokens`: `35458 -> 28948` (`-6510`)
- `cacheCreationTokens`: `47208 -> 53792` (`+6584`)

So an IDE-file change costs about **6.5k tokens of cache reuse** on the next turn.

### 3. `ideContext` also mutates `systemPromptAppend`

When the open file changed, `systemPromptAppend.hash` changed too. That is expected from the current implementation, because `ideContext` is literally concatenated into the same appended system string.

So the problem is not only that the IDE block changes. It changes the **system-layer cached prefix**.

### 4. With frozen `ideContext`, long sessions still show some hidden cache variability

Even with:

- identical user prompt
- identical `ideContext.hash`
- identical `systemPromptAppend.hash`
- identical instruction file hashes

large warm sessions still showed some cache variation:

| Turn | `cacheReadTokens` | `cacheCreationTokens` |
|------|-------------------|-----------------------|
| 1 | `15031` | `67783` |
| 2 | `35458` | `47430` |
| 3 | `28948` | `53954` |
| 4 | `35458` | `47578` |
| 5 | `35458` | `47652` |

This means there is also hidden provider / SDK / session cache-layer behavior independent of visible prompt changes.

### 5. Disabling `ideContext` improves stability more than size

In long warm sessions, turning `ideContext` off did **not** materially reduce the steady-state prompt size or cache totals. The main benefit was removing one obvious source of cache invalidation when the open file changes.

So the right diagnosis is:

- not duplicate context
- not mainly raw IDE token overhead
- mainly **cache prefix invalidation caused by placing IDE context inside the system prompt**

### 6. Removing `ideContext` entirely does NOT eliminate the large-session `~48k` recache

We reran the same long-session repeated-message test with `buildContextPrefix()` hard-disabled so that:

- `ideContext` was always empty
- nothing related to IDE context could be appended into `systemPromptAppend`

The steady-state numbers remained almost unchanged:

| Turn | `cacheReadTokens` | `cacheCreationTokens` | `effectiveContextFill` |
|------|-------------------|-----------------------|------------------------|
| 2 | `35313` | `48134` | `83457` |
| 3 | `35313` | `48217` | `83540` |
| 4 | `35313` | `48301` | `83624` |

This is effectively the same as the prior long-session runs with IDE context present but stable.

So:

- `ideContext` is **not** the source of the large persistent `~47k-48k` recache in long sessions
- removing it entirely does not materially change the steady-state recache baseline
- the large recache is likely coming from hidden SDK / bundled CLI / session / tool scaffold behavior upstream of Quack's visible IDE-context injection

The practical interpretation is:

- `ideContext` explains the additional **~6.5k cache-reuse loss when it changes**
- it does **not** explain the large steady-state recache that remains even when it is gone

## Root cause

`ideContext` is constructed in the frontend and passed as a separate field:

- `src/App.tsx`

But the Node SDK wrappers append it into `systemPromptAppend`:

- `src-tauri/node-sdk/stream-daemon.js`
- `src-tauri/node-sdk/stream-claude.js`

Current effective structure:

1. preset system prompt
2. appended system scaffold
3. `## IDE Context`
4. user message

That means any IDE-context change mutates the cached prefix **before** the user turn content.

## Recommendation

Move `ideContext` out of `systemPrompt.append`.

Preferred structure:

1. stable system prompt
2. stable settings / `CLAUDE.md`
3. turn-local IDE context
4. user message

If the SDK allows it, the IDE block should be injected as turn-local message content immediately before the user message.

If the SDK does not support a hidden turn-scoped context block, the next-best option is:

- prepend `ideContext` to the current user-turn message content
- keep it out of `systemPrompt.append`

This preserves the system prefix as a stable cache target while still giving the model the IDE context for the current turn.

This change is still worthwhile, but it should be understood as a **secondary cache-friendliness improvement**, not the full fix for the large-session recache baseline.

## Related findings

- Reducing `settingSources` from `['project', 'user', 'local']` to `['project']` materially reduced hidden prompt overhead.
- Disabling built-in MCP servers reduced base size somewhat but did not improve resumed-turn cache reuse.
- Claude Code CLI showed a similar overall hidden cached scaffold size, which suggests Quack is not wildly over-sending context relative to Claude Code. The main difference is cache friendliness, not gross duplication.
- Claude Code issue [#34629](https://github.com/anthropics/claude-code/issues/34629) reports a resume/caching regression where large portions of conversation history are rebuilt every turn. Quack's behavior is not identical, but this issue strengthens the hypothesis that the remaining large recache is at least partly upstream of Quack's own prompt assembly.
