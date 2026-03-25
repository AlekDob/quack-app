---
type: bug
project: quack-app
created: 2026-03-25
last_verified: 2026-03-25
tags: [prompt-cache, investigation, sdk, claude-code, telemetry]
---

# Bug: Post-fix cache breakage investigation

## Summary

This note freezes the **current post-fix state** after moving `ideContext` and `gitContext` out of `systemPrompt.append` and into the user message as a `<system-reminder>` block.

That change removed the known local cache breaker caused by dynamic system prompt content. However, resumed sessions still show a large steady-state `cacheCreationTokens` footprint that is too high to explain with dynamic IDE or git context alone.

This document is the canonical investigation note for the **remaining** cache loss. It is intentionally separate from `fix-session-limit-prompt-cache.md`, which documents the first fix.

## Current architecture baseline

### What changed

- `ideContext` is no longer appended to `systemPrompt.append`
- `gitContext` is no longer appended to `systemPrompt.append`
- both are prepended to the user message inside a `<system-reminder>` block

This keeps the static system prompt stable across turns and removes the original "entire system prompt cache invalidated on every turn" failure mode.

### What improved

- changing the open IDE file should no longer mutate the system-prompt cache prefix
- changing git state should no longer mutate the system-prompt cache prefix
- the largest local cache-busting behavior that Quack owned directly has been removed

### What is still broken

- large resumed sessions still show high steady-state `cacheCreationTokens` even when the visible prompt is unchanged
- repeated identical resumed turns still recache a large hidden chunk instead of mostly reusing cache
- this means the remaining issue is likely in one of:
  - hidden prompt shape still produced by Quack
  - SDK `claude_code` preset/tool scaffold
  - daemon vs legacy runtime path differences
  - upstream Claude Code / Agent SDK cache regression

## Canonical telemetry

### Source of truth

Use:

```text
~/.quack/cache-investigation.log
```

The SDK wrappers append JSONL entries for:

- `CONTEXT`
- `USAGE`

### Canonical fields to compare

From `CONTEXT`:

- `queryId`
- `resume`
- `prompt.hash`
- `ideContext.hash`
- `systemPromptAppend.hash`
- `payloadHashes.instructionFilesComposite`
- `payloadHashes.allowedTools`
- `payloadHashes.mcpServers`
- `estimatedInjectedTokens.*`

From `USAGE`:

- `eventType`
- `inputTokens`
- `cacheReadTokens`
- `cacheCreationTokens`
- `effectiveContextFill`
- `contextWindow`
- `contextUtilizationPct`

### Helper command

Use the local summary tool to inspect one captured session:

```bash
npm run cache:investigation
```

Useful variants:

```bash
npm run cache:investigation -- --list-sessions
npm run cache:investigation -- --session session-...
npm run cache:investigation -- --source stream-daemon
```

## Baseline scenarios

## 1. Small / fresh session with repeated identical prompts

### Scenario definition

- Prompt: `Testing - Message - Don’t do anything. Just answer ”OK"`
- Session shape: fresh session, then repeated identical turns
- Model: `claude-haiku-4-5-20251001`
- Provider/auth: Anthropic / Claude Code auth unless explicitly noted otherwise
- IDE state: keep the same file open across all turns
- MCP config: current Quack defaults for the repo under test
- Dynamic context change: none between turns

### Current status

This scenario must be refreshed from `~/.quack/cache-investigation.log` on the current branch. Historical small-session measurements were collected before the dedicated JSONL logger existed, so this note treats them as reference only, not canonical current-state evidence.

### Capture checklist

- 1 first-turn capture
- at least 3 resumed turns
- same repo
- same `CLAUDE.md`
- same effort
- same IDE-open-file state

## 2. Large / resumed session with repeated identical prompts

### Scenario definition

- Prompt: `Testing - Message - Don’t do anything. Just answer ”OK"`
- Session shape: already-large resumed session
- Model: `claude-haiku-4-5-20251001`
- Provider/auth: Anthropic / Claude Code auth unless explicitly noted otherwise
- IDE state: same open file across turns
- MCP config: repo defaults
- Dynamic context change: none between turns

### Historical baseline from the 2026-03-24 investigation

This baseline was measured after the `<system-reminder>` move became the working architecture.

| Turn type | `cacheReadTokens` | `cacheCreationTokens` | `effectiveContextFill` | Notes |
|---|---:|---:|---:|---|
| First turn in sequence | `0` | `~83.3k-84.2k` | `~83.4k-84.2k` | First query warms or rebuilds the large session scaffold |
| Stable resumed turns | `~35.3k-35.5k` | `~47.4k-48.6k` | `~83.0k-84.1k` | The persistent unexplained recache |

### Known conclusion from that baseline

- moving dynamic context into the user message fixed the obvious Quack-owned cache breaker
- it did **not** remove the large steady-state resumed `cacheCreationTokens`
- the remaining issue is therefore not explained by `ideContext` or `gitContext` placement alone

## 3. Large / resumed session with only IDE file change

### Historical baseline from the 2026-03-24 investigation

Before the `<system-reminder>` migration was finalized, changing only the open IDE file typically shifted about:

- `cacheReadTokens`: `-6.5k`
- `cacheCreationTokens`: `+6.5k`

This remains a useful historical control because it quantified the size of the old local cache-boundary problem. It is much smaller than the later `~47k-48k` resumed recache, which means the residual issue must come from elsewhere.

## Reproducible test matrix

Run these tests in order and do not improvise new branches of investigation until the matrix is complete.

| Order | Test case | Variable under test | Expected comparison target |
|---|---|---|---|
| 1 | Fresh session, repeated identical prompt, current Quack defaults | Baseline fresh-session behavior | Establish first-turn vs resumed-turn shape |
| 2 | Large resumed session, repeated identical prompt, current Quack defaults | Baseline resumed behavior | Confirm steady-state resumed recache |
| 3 | Large resumed session, same prompt, change only open IDE file | Dynamic context sensitivity | Should no longer mutate the system prompt prefix |
| 4 | Large resumed session, same prompt, no IDE file change | Stability control | Confirms whether hidden drift remains |
| 5 | Claude Code native CLI control run | Upstream control | Compare Quack vs CC CLI cache shape |
| 6 | Quack legacy `stream-claude.js` path | Runtime path comparison | Detect daemon-specific vs shared behavior |

Rules for every row:

- keep prompt text identical
- keep model and effort identical
- keep repo identical
- keep `CLAUDE.md` identical
- keep MCP config identical unless MCP is the variable under test
- collect 1 first turn plus at least 3 resumed turns

## Investigation order

### A. Prompt-shape layer

Goal: prove whether Quack still changes any cache-relevant prefix during resumed turns.

Check:

- `systemPromptAppend.hash`
- `payloadHashes.allowedTools`
- `payloadHashes.mcpServers`
- `payloadHashes.instructionFilesComposite`
- any other `CONTEXT` field that drifts while the visible prompt remains constant

Success criterion:

- either the cache-relevant prefix is byte-stable, or the exact drifting field is identified

### B. SDK preset / tool scaffold layer

Goal: quantify whether the `claude_code` preset and bundled tool scaffold are the primary source of the persistent resumed recache.

Controlled comparisons:

- current `claude_code` preset baseline
- minimal explicit tool configuration
- reduced MCP server set
- no MCP servers, if safe on the path under test

Success criterion:

- attribute a measurable share of `cacheCreationTokens` to preset/tool scaffold rather than dynamic user-message context

### C. Execution / runtime layer

Goal: determine whether the bug is specific to one execution path.

Compare:

- daemon path vs legacy `stream-claude.js` path
- native Claude binary vs SDK-managed path, if that override exists in the branch under test
- same model, same prompt sequence, same auth mode

Success criterion:

- know whether the behavior is path-specific or shared across SDK-backed paths

### D. Upstream regression layer

Goal: determine whether the residual behavior matches Claude Code issue `#34629`.

Control:

- same repo
- same prompt sequence
- same session shape
- compare Quack per-turn logs against Claude Code CLI `/cost` deltas

Success criterion:

- classify the residual issue as:
  - Quack-local
  - SDK/preset-local
  - matching upstream regression
  - mixed

## Root-cause conclusion checklist

When the matrix is complete, update this document with a final diagnosis that answers:

1. What portion of the original cache breakage was fixed by moving dynamic context into the user message?
2. What portion remains?
3. Which exact layer owns the remaining steady-state resumed recache?
4. Is the residual issue actionable in Quack or blocked upstream?

The final diagnosis must end with one implementation direction:

1. Quack fix available now
2. Quack workaround available now, real fix upstream
3. Upstream-only issue, Quack already at local optimum
4. Mixed: one remaining local optimization plus one upstream blocker

## Raw artifact handling

- Treat `~/.quack/cache-investigation.log` as the primary raw artifact
- archive the exact session slices used in any conclusion
- compare Quack resumed turns directly from `USAGE` events, not from cumulative totals
- never mix fresh-session and resumed-session numbers in the same conclusion table

## Current best hypothesis

As of 2026-03-25, the best-supported working hypothesis is:

- the old Quack-local cache breaker caused by dynamic `systemPrompt.append` content has been fixed
- a second, larger residual issue remains in the SDK / preset / runtime path
- the residual issue is probably mixed: partially attributable to Quack’s chosen SDK path and partially attributable to upstream Claude Code / Agent SDK cache behavior

That hypothesis is not yet final. The fixed matrix above is required before locking the root cause.
