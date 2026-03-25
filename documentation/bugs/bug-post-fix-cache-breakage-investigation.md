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

### Canonical captured baseline on the current branch

This is the first checked-in post-fix baseline captured from `~/.quack/cache-investigation.log`.

- Artifact: `documentation/bugs/artifacts/cache-investigation-session-1773999614211-782jy1t.jsonl`
- Session id: `session-1773999614211-782jy1t`
- Prompt: `Test message - Answer with ”ok"`
- Session shape: large resumed session
- Model: `claude-haiku-4-5-20251001`
- Provider/auth: Anthropic with Claude Code auth
- Open IDE file: `/Users/fredric/Dev/flow/components/Projects/ProjectsReportDashboard.vue`
- MCP server count: `7`
- Dynamic context changed between turns: `no`
- Investigation mode: `baseline`

| Turn | `cacheReadTokens` | `cacheCreationTokens` | `effectiveContextFill` | `contextWindow` |
|---|---:|---:|---:|---:|
| 1 | `0` | `66786` | `66796` | `200000` |
| 2 | `15282` | `51702` | `66994` | `200000` |
| 3 | `39081` | `28100` | `67191` | `200000` |
| 4 | `39081` | `28292` | `67383` | `200000` |

Stable hashes across all 4 turns:

- `prompt.hash`: `2a98b75f87e46395`
- `ideContext.hash`: `5104dec2d6758318`
- `systemPromptAppend.hash`: `340081fd6e9b103f`
- `instructionFilesComposite`: `6c09c2ffcf69ea4d`
- `allowedTools`: `b2608f9ec3c986fd`
- `mcpServers`: `580c38ebc9dd6d93`

Current conclusion from this canonical capture:

- the visible cache-relevant prompt shape is byte-stable across resumed turns
- the remaining resumed recache is still substantial even after the `<system-reminder>` migration
- the next isolation step should target SDK preset/tool scaffold and MCP scaffold size rather than dynamic context placement

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

Current implementation for this stage:

- `QUACK_CACHE_INVESTIGATION_MODE=baseline`
  - keep `tools: { type: 'preset', preset: 'claude_code' }`
  - keep built-in MCP servers enabled
- `QUACK_CACHE_INVESTIGATION_MODE=explicit-tools`
  - replace the preset tool scaffold with an explicit tool list derived from `allowedTools`
  - keep built-in MCP servers enabled
- `QUACK_CACHE_INVESTIGATION_MODE=preset-no-builtin-mcp`
  - keep the preset tool scaffold
  - disable Quack's built-in MCP servers
- `QUACK_CACHE_INVESTIGATION_MODE=explicit-tools-no-builtin-mcp`
  - use the explicit tool list
  - disable Quack's built-in MCP servers

These modes are for investigation only. `baseline` remains the default if the env var is unset.

Success criterion:

- attribute a measurable share of `cacheCreationTokens` to preset/tool scaffold rather than dynamic user-message context

### Completed 2x2 result on Haiku (`claude-haiku-4-5-20251001`, `200000` context window)

The preset/MCP scaffold matrix is now complete for the same large resumed session shape.

Steady-state comparison:

| Mode | Built-in MCP | Tool mode | `cacheReadTokens` | `cacheCreationTokens` | Outcome |
|---|---|---|---:|---:|---|
| `baseline` | enabled | `claude_code` preset | `39081` | `28100-28292` | Best result |
| `explicit-tools` | enabled | explicit tool list | `29962` | `30268-30750` | Worse than baseline |
| `preset-no-builtin-mcp` | disabled | `claude_code` preset | `37426` | `31706` | Worse than baseline |
| `explicit-tools-no-builtin-mcp` | disabled | explicit tool list | `28307` | `32184-32662` | Worst result |

Representative turns from the final `explicit-tools-no-builtin-mcp` run:

| Turn | `cacheReadTokens` | `cacheCreationTokens` | `effectiveContextFill` | `contextWindow` |
|---|---:|---:|---:|---:|
| 1 | `7895` | `52357` | `60262` | `200000` |
| 2 | `28307` | `32184` | `60501` | `200000` |
| 3 | `28307` | `32423` | `60740` | `200000` |
| 4 | `28307` | `32662` | `60979` | `200000` |

What this rules out:

- replacing the `claude_code` preset with an explicit tool list is **not** the fix
- removing Quack's built-in MCP scaffold is **not** the fix
- combining both changes is worse than the original baseline

What remained stable within each mode:

- `prompt.hash`
- `ideContext.hash`
- `systemPromptAppend.hash`
- `payloadHashes.instructionFilesComposite`
- `payloadHashes.allowedTools`
- `payloadHashes.mcpServers` within the mode under test

Current conclusion for the preset/MCP layer:

- the best local configuration tested so far is still the original `baseline`
- the persistent resumed recache is not primarily caused by Quack's current tool-preset selection
- the persistent resumed recache is not primarily caused by Quack's built-in MCP scaffold
- the next investigation stage should move to execution/runtime path comparisons rather than further preset/MCP tuning

### C. Execution / runtime layer

Goal: determine whether the bug is specific to one execution path.

Compare:

- daemon path vs legacy `stream-claude.js` path
- native Claude binary vs SDK-managed path, if that override exists in the branch under test
- same model, same prompt sequence, same auth mode

Success criterion:

- know whether the behavior is path-specific or shared across SDK-backed paths

### Native Claude Code CLI control (`claude-haiku-4-5`)

This control was run in the terminal against the same project/session shape using Claude Code CLI directly. The `/cost` values below are cumulative totals, so the per-turn comparison uses deltas between successive `/cost` snapshots.

Prompt:

- `Test message - Answer with ok`

Observed cumulative `/cost` totals:

| Turn | Cache read total | Cache write total |
|---|---:|---:|
| 1 | `0` | `76.3k` |
| 2 | `76.3k` | `76.6k` |
| 3 | `152.9k` | `76.9k` |
| 4 | `229.7k` | `77.2k` |

Converted per-turn deltas:

| Turn | Cache read delta | Cache write delta |
|---|---:|---:|
| 1 | `0` | `76.3k` |
| 2 | `76.3k` | `0.3k` |
| 3 | `76.6k` | `0.3k` |
| 4 | `76.8k` | `0.3k` |

Comparison against Quack's best Haiku baseline:

| Path | Turn | `cacheReadTokens` | `cacheCreationTokens` |
|---|---|---:|---:|
| Claude Code CLI | 2 | `76.3k` | `0.3k` |
| Claude Code CLI | 3 | `76.6k` | `0.3k` |
| Claude Code CLI | 4 | `76.8k` | `0.3k` |
| Quack `baseline` | 2 | `15.3k` | `51.7k` |
| Quack `baseline` | 3 | `39.1k` | `28.1k` |
| Quack `baseline` | 4 | `39.1k` | `28.3k` |

Current conclusion from this control:

- native Claude Code CLI shows healthy cache reuse after the first turn
- the same model (`claude-haiku-4-5`) is capable of near-full prefix reuse in the same general workload shape
- Quack's remaining recache is therefore not explained by model behavior alone
- the strongest remaining suspect is Quack's SDK / runtime execution path rather than the model itself

### Quack daemon vs Quack legacy path (`claude-haiku-4-5`, `baseline` mode)

The next runtime control compared Quack's two SDK-backed paths directly:

- daemon path: `stream-daemon.js`
- legacy per-process path: `stream-claude.js`

Both runs used:

- the same model: `claude-haiku-4-5-20251001`
- the same large resumed session shape
- the same prompt: `Test message - Answer with ok`
- the same baseline investigation mode

#### Daemon baseline

| Turn | `cacheReadTokens` | `cacheCreationTokens` |
|---|---:|---:|
| 2 | `15282` | `51702` |
| 3 | `39081` | `28100` |
| 4 | `39081` | `28292` |

#### Legacy baseline

| Turn | `cacheReadTokens` | `cacheCreationTokens` | Notes |
|---|---:|---:|---|
| 1 | `15282` | `57697` | Stable visible hashes |
| 2 | `15282` | `57890` | Stable visible hashes |
| 3 | `0` | `73365` | Same prompt/system/tools, reuse collapsed |
| 4 | `0` | `73619` | `ideContext.hash` drifted on this turn |

Interpretation:

- the legacy `stream-claude.js` path is materially worse than the daemon path
- the daemon path is the better Quack runtime path currently available
- neither Quack path comes close to native Claude Code CLI cache behavior

What this proves:

- the remaining cache problem is not just "the SDK in general behaves this way"
- Quack's internal runtime path changes the caching outcome materially
- at least part of the residual issue is Quack-runtime-path specific

Current conclusion for the runtime layer:

- native Claude Code CLI: healthy caching
- Quack daemon path: degraded, but substantially better than legacy
- Quack legacy path: severely degraded, with cache reuse collapsing to zero in the tested run
- further local investigation should focus on the daemon/session integration path, not the legacy path

### Daemon baseline with all MCP disabled

The next daemon-only control disabled all explicit MCP configuration:

- no passed MCP servers
- no `.mcp.json` / global MCP loading from Quack
- no built-in Quack MCP servers

Investigation mode:

- `QUACK_CACHE_INVESTIGATION_MODE=all-mcp-disabled`

#### Daemon `all-mcp-disabled`

| Turn | `cacheReadTokens` | `cacheCreationTokens` |
|---|---:|---:|
| 1 | `15282` | `54228` |
| 2 | `33946` | `35818` |
| 3 | `33946` | `36011` |
| 4 | `33946` | `36265` |

Comparison against the best daemon baseline:

| Mode | `cacheReadTokens` | `cacheCreationTokens` |
|---|---:|---:|
| `baseline` | `39081` | `28100-28292` |
| `all-mcp-disabled` | `33946` | `35818-36265` |

So:

- removing all explicit MCP changes the numbers
- but it still does **not** outperform the normal daemon baseline
- the remaining cache loss is not solved by simply zeroing out Quack-managed MCP configuration

#### Key hidden-runtime finding

The daemon `SESSION` telemetry showed:

- effective config: `mcpCount: 0`
- Claude `system_init`: `mcpServerCount: 5`
- Claude `system_init`: `toolsAvailable: 46`

That means the runtime still initializes with a nontrivial server/tool scaffold even when Quack passes zero MCP servers in the daemon config.

#### Strong lead from SDK docs

The installed SDK type definitions document that:

- `settingSources` controls filesystem settings loading
- when `settingSources` is present, the SDK loads `user`, `project`, and `local` settings files
- the SDK settings model includes MCP-related fields such as:
  - `enableAllProjectMcpServers`
  - `enabledMcpjsonServers`
  - `disabledMcpjsonServers`
  - `allowedMcpServers`

This strongly suggests the hidden `mcpServerCount: 5` is not coming from Quack's explicit `options.mcpServers`, but from SDK-loaded filesystem settings triggered by:

- `settingSources: ['project', 'user', 'local']`

Current conclusion from this control:

- Quack's daemon path is correctly resuming the same Claude session
- Quack's explicit MCP config can be reduced to zero without eliminating the hidden server/tool scaffold
- the strongest remaining local suspect is now SDK filesystem settings loading via `settingSources`, not Quack's explicit MCP map

#### Daemon `all-mcp-disabled-project-only-settings`

This variant kept:

- no explicit MCP
- no built-in Quack MCP
- `settingSources: ['project']`

Results:

| Turn | `cacheReadTokens` | `cacheCreationTokens` |
|---|---:|---:|
| 1 | `0` | `71287` |
| 2 | `15031` | `56449` |
| 3 | `35324` | `36410` |
| 4 | `35324` | `36603` |

Key `SESSION` findings:

- effective config: `mcpCount: 0`
- effective config: `settingSources: ['project']`
- Claude `system_init`: `mcpServerCount: 4`
- Claude `system_init`: `toolsAvailable: 60`

This did **not** support the narrower theory that only `user` / `local` settings were responsible. Project-only settings were still enough to produce a large hidden scaffold before history.

#### Daemon `all-mcp-disabled-no-settings`

This is the sharpest isolation run so far:

- no explicit MCP
- no built-in Quack MCP
- `settingSources: []`

Results:

| Turn | `cacheReadTokens` | `cacheCreationTokens` |
|---|---:|---:|
| 1 | `0` | `57067` |
| 2 | `24778` | `32543` |
| 3 | `24778` | `32736` |
| 4 | `24778` | `32929` |

Key `SESSION` findings:

- effective config: `mcpCount: 0`
- effective config: `settingSources: []`
- Claude `system_init`: `mcpServerCount: 0`
- Claude `system_init`: `toolsAvailable: 27`

This is the first run where hidden MCP servers actually disappeared. That means filesystem-loaded SDK settings really were contributing hidden pre-history scaffold before message history.

What improved relative to earlier daemon runs:

- hidden `mcpServerCount` dropped from `5` / `4` to `0`
- hidden `toolsAvailable` dropped from `46-60` to `27`
- `effectiveContextFill` dropped from roughly `69k-72k` to roughly `57k`
- subjective latency also improved noticeably during manual testing

What did **not** happen:

- cache behavior still did not approach native Claude Code CLI
- steady-state cache creation remained about `32.5k-32.9k`

So the `settingSources` hypothesis is now partially confirmed:

- SDK filesystem settings loading was a real hidden injection source before history
- but removing it entirely still leaves a substantial residual scaffold and recache problem
- the remaining gap is now more likely inside the Claude Code preset / SDK runtime itself than in Quack's explicit settings or MCP plumbing

#### Daemon `minimal-no-preset-no-settings`

This control stripped the daemon path down as far as possible while still using the SDK query flow:

- no explicit MCP
- no built-in Quack MCP
- `settingSources: []`
- no Claude Code preset
- no tools
- minimal plain system prompt

Results:

| Turn | `cacheReadTokens` | `cacheCreationTokens` | `effectiveContextFill` |
|---|---:|---:|---:|
| 1 | `0` | `28455` | `28465` |
| 2 | `28455` | `193` | `28658` |
| 3 | `28648` | `254` | `28912` |
| 4 | `28902` | `193` | `29105` |

Key `SESSION` findings:

- effective config: `toolConfigMode: 'no_tools'`
- effective config: `settingSources: []`
- effective config: `mcpCount: 0`
- Claude `system_init`: `toolsAvailable: 0`
- Claude `system_init`: `mcpServerCount: 0`

This is the first Quack daemon run whose steady-state cache behavior lands in the same ballpark as native Claude Code CLI. After turn 1, cache creation collapsed from tens of thousands of tokens down to roughly `193-254` tokens per turn.

That means the remaining cache break was **not** coming from:

- visible user-message context (`ideContext`, `gitContext`)
- Quack's explicit MCP map
- SDK filesystem settings alone

It was primarily coming from the hidden scaffold introduced by continuing to force:

- `tools: { type: 'preset', preset: 'claude_code' }`
- `systemPrompt: { type: 'preset', preset: 'claude_code', ... }`

through the daemon path.

### Revised diagnosis after minimal control

At this point, the evidence supports a much more specific root cause:

- moving dynamic context out of `systemPrompt.append` fixed one real cache breaker
- SDK filesystem settings loading via `settingSources` added a second hidden source of pre-history scaffold
- but the **largest remaining local cause** was the Claude Code preset/runtime scaffold itself
- once the daemon path used:
  - no settings
  - no MCP
  - no tools
  - no Claude Code preset
  cache creation dropped to near-ideal repeated-turn levels

So the primary residual issue is no longer best described as "upstream SDK behavior in general". It is more precisely:

- Quack's daemon integration is restoring a heavy Claude Code preset/runtime path whose hidden scaffold is not being reused the way native Claude Code CLI reuses it

### Code-level finding: skill scaffold is re-sent as "initial" on resumed turns

The daemon scaffold-debug run produced the first concrete code-level explanation for the repeated large cache writes.

Relevant SDK runtime code from the bundled `cli.js`:

- `Kn_()` sends the hidden `skill_listing` attachment and logs:
  - `Sending ${_.length} skills via attachment (${Y ? "initial" : "dynamic"}, ...)`
- `Pe4()` sets an internal flag so the next `Kn_()` call will treat skills as already known
- `OR_()` only calls `Pe4()` when resumed messages contain an attachment with:
  - `attachment.type === "skill_listing"`
- `w16()` is the resume loader used for resumed sessions

What the code means in plain terms:

- the runtime only avoids re-sending the full initial skill scaffold if it can reconstruct prior `skill_listing` attachments during resume
- if those attachments are missing from the resumed transcript, the internal skill state stays empty
- once that state is empty, `Kn_()` sends the full skills block again and marks it as `initial`

### Transcript evidence from the actual resumed Quack session

The resumed session transcript on disk for the tested Quack daemon run:

- `/Users/fredric/.claude/projects/-Users-fredric-Dev-flow/ae0a6c1a-0790-4492-a4a8-ed7dcf7f0c61.jsonl`

contains:

- `attachment: 0`
- `skill_listing: 0`
- `invoked_skills: 0`
- `dynamic_skill: 0`

and `rg` confirms there are no `skill_listing` records in that transcript at all.

This matters because the same daemon scaffold-debug run logged:

- `Sending 18 skills via attachment (initial, 18 total sent)`

on every repeated resumed turn.

Current interpretation:

- the SDK runtime is not recovering prior skill-attachment state during Quack resume
- as a result, the coding-agent skill scaffold is treated as fresh on every message
- this provides a concrete mechanism for why large hidden pre-history content is repeatedly recreated before the actual message history

### Code-level finding: file history is copied into a fresh internal session id each turn

The bundled runtime also explains the `FileHistory: Copied backup ...` lines.

Relevant SDK runtime code:

- `Ey8()` copies file-history backups from the previous persisted session id into the current internal runtime session id
- it compares:
  - previous session id from resumed messages
  - current internal `E8()` session id
- when they differ, it hard-links or copies all tracked file-history backups into the new internal session folder

This matches the debug logs:

- Quack keeps the same external Claude session id
- but the runtime still creates a fresh internal file-history destination UUID on resumed queries

Current interpretation:

- this file-history copy behavior is real and repeatable
- but it does not yet look like the primary cache-break mechanism by itself
- the stronger lead remains the missing attachment-backed skill restore, because that directly controls whether the hidden skill scaffold is emitted as `initial` every turn

### Refined local root-cause hypothesis

The strongest local explanation now is:

- Quack's resumed SDK path restores user/assistant conversation state, but does not restore enough hidden attachment state for the Claude Code runtime to consider the coding-agent scaffold already established
- because the prior `skill_listing` attachment state is missing during resume, the runtime re-sends the skill scaffold as `initial` on every resumed turn
- that repeated hidden scaffold emission is a concrete, code-backed explanation for the persistent high `cacheCreationTokens`

The remaining investigation question is now narrower:

- is this attachment-loss behavior caused by Quack's SDK invocation pattern
- or is it an SDK / Claude Code runtime limitation of the `sdk-ts` resume path itself

### Follow-up control: preserve skill attachments in the persisted transcript

To test that hypothesis directly, Quack was run in a patched mode that preserves:

- `skill_listing`
- `invoked_skills`
- `dynamic_skill`

in the persisted session JSONL instead of dropping all attachments.

Mode:

- `baseline-preserve-skill-attachments`

Result:

| Turn | `cacheReadTokens` | `cacheCreationTokens` |
|---|---:|---:|
| 1 | `15282` | `63363` |
| 2 | `15282` | `63500` |
| 3 | `38852` | `40126` |
| 4 | `38852` | `40261` |

Transcript result:

- the resumed session transcript now contains `attachment: 1`
- specifically:
  - `type: "skill_listing"`
  - `isInitial: true`
  - `skillCount: 18`

Interpretation:

- this proves the transcript persistence drop was real
- and it proves Quack can preserve the attachment state the runtime expects
- but fixing that bug did **not** collapse steady-state `cacheCreationTokens` toward native Claude Code CLI levels
- therefore the missing `skill_listing` attachment was a real cache-break bug, but not the primary remaining one

### Follow-up control: remove Quack's explicit `allowedTools` injection

Next, Quack was run with the full Claude Code preset/runtime still enabled, but without sending the explicit `allowedTools` list from Quack.

Mode:

- `baseline-no-allowed-tools`

Result:

| Turn | `cacheReadTokens` | `cacheCreationTokens` |
|---|---:|---:|
| 1 | `38852` | `40457` |
| 2 | `38852` | `40592` |
| 3 | `38852` | `40727` |
| 4 | `38852` | `40923` |

Runtime result:

- `toolsAvailable` remained `83`
- `mcpServerCount` remained `8`
- the same large permission updates still applied on every turn
- the same skill reloads still occurred on every turn

Interpretation:

- Quack's explicit `allowedTools` parameter is not the primary source of the repeated permission scaffold
- the repeated permission/settings/tool scaffold is being rebuilt by the preset/runtime/settings path itself

### Combined control: preserve skill attachments and remove settings loading

The next control combined the two proven real fixes:

- preserve the skill attachment state used for resume
- disable SDK filesystem settings loading with `settingSources: []`

Mode:

- `baseline-preserve-skill-attachments-no-settings`

Result:

| Turn | `cacheReadTokens` | `cacheCreationTokens` |
|---|---:|---:|
| 1 | `13792` | `54646` |
| 2 | `13792` | `54781` |
| 3 | `35511` | `33197` |
| 4 | `13792` | `55051` |

Runtime result:

- `settingSources: []`
- `toolsAvailable` dropped from `83` to `75`
- `mcpServerCount` dropped from `8` to `7`
- debug logs showed:
  - `Loaded 0 unique skills`
  - repeated `FileHistory: Copied backup ...` on every resumed turn

Interpretation:

- the combination still did not produce healthy cache behavior
- so the primary remaining cache break is not explained by:
  - dynamic system prompt content
  - missing `skill_listing` persistence alone
  - SDK filesystem settings alone
  - Quack's explicit `allowedTools` injection

At this point, the strongest remaining suspect is the file checkpointing / file-history restore machinery that still replays backup state into a fresh internal UUID on every resumed query.

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

## Next investigation phase

The next phase should stay on the daemon path, but file checkpointing / file-history restore is no longer the leading suspect.

What is now ruled out or reduced to secondary causes:

- dynamic `systemPrompt.append` mutation
- Quack-owned `ideContext` / `gitContext` placement
- Quack's explicit `allowedTools` injection
- built-in MCP removal as a sufficient fix
- SDK filesystem settings as a sufficient fix
- missing `skill_listing` persistence as a sufficient fix
- native vs bundled Claude executable as the primary cause
- the legacy `stream-claude.js` path as the main optimization target
- SDK file checkpointing / file-history restore as the primary remaining cause

### Latest result: file checkpointing disabled

Investigation mode:

- `baseline-preserve-skill-attachments-no-settings-no-file-checkpointing`

Per-turn result on the same Haiku resumed session:

| Turn | `cacheReadTokens` | `cacheCreationTokens` |
|---|---:|---:|
| 1 | `13792` | `55268` |
| 2 | `35511` | `33705` |
| 3 | `35511` | `33861` |
| 4 | `13792` | `55797` |

Runtime evidence:

- `SESSION.effective_config.fileCheckpointingEnabled = false`
- `SESSION.effective_config.disableFileCheckpointing = true`
- the SDK debug logs no longer contain `FileHistory: Copied backup ...`

Conclusion from this step:

- file checkpointing really was disabled
- the file-history restore path disappeared from the debug logs
- `cacheCreationTokens` did **not** materially improve

So file checkpointing / file-history restore was a real runtime behavior, but it is **not** the main driver of the remaining steady-state cache break.

### Immediate next step

Inspect the remaining hidden preset/runtime scaffold that still exists even after:

- `settingSources: []`
- persisted `skill_listing` preservation
- file checkpointing disabled

The most useful next isolation is now:

- compare the remaining full preset/runtime path against a no-skills / no-agents / no-custom-instructions variant while keeping tool support on
- trace which hidden runtime block still accounts for `toolsAvailable: 75` and the `~33k-55k` repeated cache creation

### Latest result: actual `/v1/messages` payload diff

Investigation mode:

- `baseline-preserve-skill-attachments-no-settings-no-file-checkpointing-capture-request`

Captured artifacts:

- `~/.quack/cache-debug/q_session-1773999614211-782jy1t_09117272-861d-435d-93b1-03cd6bffa099.cli-api-request.01.json`
- `~/.quack/cache-debug/q_session-1773999614211-782jy1t_1336fcc2-6654-4c1a-97e5-18667166c1a7.cli-api-request.01.json`
- `~/.quack/cache-debug/q_session-1773999614211-782jy1t_74ca9a1c-624c-4796-94f1-caba7bcbba68.cli-api-request.01.json`
- `~/.quack/cache-debug/q_session-1773999614211-782jy1t_d83c6c9f-f4c9-4347-97b7-edfaee0356ce.cli-api-request.01.json`

Key serializer/runtime functions in the bundled SDK path:

- `wJY(...)`: builds the outgoing `body.messages` array
- `ejY(...)`: serializes user messages
- `AJY(...)`: serializes assistant messages

Relevant bundled runtime behavior:

- `ejY(A, q = false, K, _)` adds `cache_control: { type: 'ephemeral' }` only when `q === true`, meaning only the current latest user message gets the cache marker
- the TodoWrite reminder block is injected as a hidden meta/user block before the current latest user text

What the actual payload diff showed:

- top-level `body.system` was stable across repeated turns
- top-level `body.mcp_servers` was stable across repeated turns
- top-level `body.metadata` was stable across repeated turns
- message count grew by exactly `+2` each turn as expected
- but the request body was **not** append-only

Concrete mutation found between turn 2 and turn 3:

- first differing historical message index: `230`
- turn 2 request posted message `230` as:
  - hidden TodoWrite reminder block
  - then the real user text block
  - and that real user text block had `cache_control: { type: 'ephemeral' }`
- turn 3 request posted that **same historical user message** as:
  - only the plain user text block
  - no TodoWrite reminder block
  - no `cache_control`

The same pattern repeated between turn 3 and turn 4 at message index `232`.

Conclusion from this step:

- Quack's actual posted `/v1/messages` history is being rewritten between repeated resumed turns
- the rewrite happens exactly at the boundary of the previously-latest user message
- the current turn's user message is serialized with hidden TodoWrite reminder + `cache_control`
- on the next turn, that same message is rehydrated as plain text history without the reminder and without `cache_control`
- this is now the first directly observed pre-history mutation in the real API payload, not just an inference from token counts

Immediate implication:

- the remaining cache break is not only "large hidden scaffold exists"
- the runtime is also mutating previously-posted history at a cache-sensitive boundary
- that mutation is a strong candidate for why Quack still fails to approach native Claude Code CLI cache reuse even after other fixes

### Quantitative payload diff: prefix break analysis

Script: `scripts/cache-payload-diff.mjs`

This analysis compared the 4 captured `/v1/messages` payloads byte-for-byte to determine exactly where and how much the prefix breaks between consecutive turns.

#### Mutation summary

| Transition | Mutated msgs | Nature | Mutation size |
|---|---:|---|---:|
| Turn 0 → 1 | 1 | TodoWrite removed + `cache_control` removed from msg[228] | 549 bytes |
| Turn 1 → 2 | 1 | TodoWrite removed + `cache_control` removed from msg[230] | 549 bytes |
| Turn 2 → 3 | 1 | TodoWrite removed + `cache_control` removed from msg[232] | 549 bytes |

Additionally, Turn 2 → 3 showed `body.tools` **reordered** (MCP tool positions shifted, same tools present). This is a secondary instability.

#### Prefix divergence point

| Transition | First divergence | Section | Stable prefix chars | Unstable tail chars |
|---|---:|---|---:|---:|
| Turn 0 → 1 | char 383,152 | msg[228] (user) | ~95,788 est tokens | ~485 est tokens |
| Turn 1 → 2 | char 384,199 | msg[230] (user) | ~96,050 est tokens | ~485 est tokens |
| Turn 2 → 3 | char 121,905 | tools (offset 94242) | ~30,476 est tokens | ~66,320 est tokens |

#### `cache_control` breakpoint positions across turns

| Turn | system breakpoints | tool breakpoints | message breakpoints |
|---|---|---|---|
| Turn 0 | system[1], system[2] | none | msg[228] |
| Turn 1 | system[1], system[2] | none | msg[230] |
| Turn 2 | system[1], system[2] | none | msg[232] |
| Turn 3 | system[1], system[2] | none | msg[234] |

#### Request body composition

| Section | Chars | Est. tokens |
|---|---:|---:|
| `body.system` | 27,664 | ~6,916 |
| `body.tools` | 107,516 | ~26,879 |
| `body.messages` (228-235 msgs) | 248,000-252,000 | ~62,000-63,000 |
| **Total** | ~384,000-387,000 | ~96,000-97,000 |

#### Why the small mutation causes a large cache miss

The mutation itself is tiny (549 bytes per turn). But the cache miss is large because of **cache breakpoint placement**:

1. The API creates cache entries only at positions marked with `cache_control: { type: 'ephemeral' }`
2. The only breakpoints are at system[1], system[2], and the **latest user message**
3. There are **no breakpoints on `body.tools`** — tools are only cached as part of the message-level cache entry
4. When the latest user message moves from msg[N] to msg[N+2], the old breakpoint at msg[N] no longer matches (because msg[N] was mutated)
5. The API falls back to the last matching breakpoint: system[2] (~6,916 tokens)
6. Everything from system[2] onward (tools + all messages = ~89,000 tokens) must be re-cached as a new entry at the new msg[N+2] breakpoint

This explains the observed cache behavior:

| Turn | Observed `cacheReadTokens` | Explanation |
|---|---:|---|
| 1 | 0 | First query, no prior cache |
| 2 | 15,282 | Falls back to system[2] breakpoint from turn 1 |
| 3 | 39,081 | Partial prefix match against turn 2's msg[230] cache entry (msg[228] unchanged since turn 2) |
| 4 | 39,081 | Same partial match depth stabilizes |

The steady-state `cacheCreationTokens` of ~28,000-33,000 represents the portion of the request from the cache-break boundary through the new latest message — everything the API cannot match against any prior cache entry.

#### Why native Claude Code CLI does not have this problem

In native CLI, the session lives in a single long-running process. Messages are appended in-memory. The `ejY()` serializer decorates only the current latest message, but historical messages retain their original serialization (including TodoWrite and `cache_control`) because they are never re-serialized from disk.

In Quack's daemon path, each `query()` call resumes from the persisted session JSONL. The SDK re-loads and re-serializes all messages from scratch. The `ejY()` serializer then treats previously-latest messages as plain historical messages — stripping the TodoWrite reminder and `cache_control` that were present when they were originally sent.

This re-serialization-from-disk behavior is the fundamental difference.

## Current best hypothesis

As of 2026-03-25, the best-supported working hypothesis is:

- the old Quack-local cache breaker caused by dynamic `systemPrompt.append` content has been fixed
- a second, larger residual issue remains in the SDK / runtime path
- the completed preset/MCP 2x2 indicates the residual issue is **not** primarily explained by Quack's current `claude_code` preset choice or by built-in MCP injection
- the native Claude Code CLI control indicates the residual issue is **not** primarily explained by Haiku model behavior alone
- the daemon-vs-legacy comparison indicates the issue is at least partly runtime-path specific inside Quack
- daemon session lifecycle logging indicates session resume IDs are stable and correct
- the `all-mcp-disabled` control indicates hidden server/tool scaffold still appears even with `mcpCount: 0`
- the `all-mcp-disabled-no-settings` control confirms that SDK filesystem settings loading via `settingSources` was one real hidden pre-history source
- even with `settingSources: []`, the daemon still initializes with `toolsAvailable: 27` and much worse cache behavior than native Claude Code CLI
- scaffold-debug inspection of the bundled runtime shows that skill state is only restored from prior `skill_listing` attachments during resume
- the resumed Quack session transcript originally contained zero `attachment` / `skill_listing` entries, and preserving that state proved one real persistence bug
- fixing that persistence bug did not collapse steady-state cache creation, so it is a secondary cause rather than the primary remaining one
- removing Quack's explicit `allowedTools` injection did not help, so the repeated permission scaffold is coming from deeper preset/runtime behavior
- combining preserved skill attachments with `settingSources: []` still did not produce healthy cache behavior
- disabling file checkpointing removed the `FileHistory` restore logs but did not materially reduce `cacheCreationTokens`, so file checkpointing is not the primary remaining cause
- direct `/v1/messages` capture now proves that the bundled runtime rewrites the previous latest user message between turns by dropping the hidden TodoWrite reminder block and the `cache_control` marker when that message becomes historical
- the strongest remaining suspect is now the bundled runtime's user-message serialization / rehydration path around `wJY(...)` / `ejY(...)`, especially the latest-message-only reminder and `cache_control` transform
- quantitative payload diff analysis (`scripts/cache-payload-diff.mjs`) now confirms:
  - the prefix diverges at the previously-latest user message (~549 bytes mutation per turn)
  - but the cascade is large because `cache_control` breakpoints exist only on system[1], system[2], and the latest user message — with **no breakpoints on tools**
  - the API falls back to the system[2] breakpoint (~15k tokens), forcing re-cache of tools + all messages (~80k+ tokens)
  - after 2-3 turns the cache partially warms (prefix match against prior entries stabilizes at ~39k read), but steady-state creation remains ~28-33k
  - the fundamental cause is re-serialization from disk: native CLI keeps messages in-memory with their original decorations, while Quack's daemon resume path re-serializes all messages, stripping `cache_control` and TodoWrite from historical messages
  - a secondary instability is MCP tool reordering between turns (observed in Turn 2→3), which breaks the prefix at the tools section

## Root-cause conclusion

### 1. What portion of the original cache breakage was fixed?

Moving `ideContext` and `gitContext` out of `systemPrompt.append` into the user-message `<system-reminder>` block fixed the Quack-owned dynamic system prompt mutation. This eliminated the failure mode where every IDE file change or git status change invalidated the entire system prompt cache.

### 2. What portion remains?

Steady-state resumed sessions still show ~28,000-33,000 `cacheCreationTokens` per turn. This is roughly 30-35% of the effective context being re-cached on every turn, compared to ~0.3k (near-zero) in native Claude Code CLI.

### 3. Which exact layer owns the remaining steady-state resumed recache?

The remaining issue is in the **Claude Code SDK / bundled runtime's message serialization path**, specifically:

- **Primary cause**: `ejY()` re-serializes historical messages without the TodoWrite reminder and `cache_control: { type: 'ephemeral' }` that they had when originally sent. This breaks the cache prefix at the most recent historical user message boundary. Combined with the absence of intermediate `cache_control` breakpoints on the tools section, this forces re-caching of a large portion of the request.

- **Secondary cause**: MCP tool ordering instability between turns (observed sporadically) breaks the prefix earlier in the serialized stream.

- **Root mechanism**: Quack's daemon resume path re-loads sessions from the persisted JSONL and passes them to the SDK's `query()`. The SDK re-serializes all messages from scratch, applying latest-message-only decorations that differ from the original serialization. Native CLI avoids this because sessions stay in-memory within a single process.

### 4. Is the residual issue actionable in Quack or blocked upstream?

**Classification: Mixed (option 4)**

- **One remaining local optimization**: Quack could potentially stabilize MCP tool ordering to prevent the secondary prefix break. This is a minor improvement.
- **One upstream blocker**: The primary cause — `ejY()` stripping `cache_control` and TodoWrite from re-serialized historical messages — is inside the bundled Claude Code runtime. Quack cannot fix this without either:
  - An SDK option to preserve `cache_control` on historical messages during resume
  - An SDK option to add `cache_control` breakpoints on the tools section
  - A change to the SDK resume path that retains the original message serialization

**Implementation direction**: Quack is now at or near the local optimum for the daemon path. The largest remaining gain requires upstream SDK changes. Quack should:
1. Stabilize MCP tool ordering (local fix, minor gain)
2. Report the re-serialization cache regression to the Claude Code SDK team with the payload evidence in this document
3. Monitor SDK updates for resume-path caching improvements
