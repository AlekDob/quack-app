---
type: bug
project: quack-app
created: 2026-04-10
last_verified: 2026-04-10
tags: [prompt-cache, sdk, query-per-message, persistent-subprocess, investigation]
---

# Investigation: query() per message — Cache Bisection Tests

## Background

Quack historically broke prompt caching when using the SDK's `query()` per message. A persistent subprocess workaround was introduced (~400 lines in `stream-daemon.js`) that keeps the CLI process alive across turns, achieving ~230 tokens cache creation per turn. However, this architecture introduced multiple application-layer bugs (stale closures, unsolicited events, tainted sessions, overlap detection).

A reference app (Kite, in `claude-agents-test/`) uses `query()` per message with minimal options and achieves near-perfect cache hits. This investigation tests whether Quack can do the same.

## Kite vs Quack — SDK options comparison

**Kite (caching works perfectly):**
```ts
const options = { cwd, permissionMode: 'acceptEdits', includePartialMessages: true, abortController, canUseTool }
if (sessionId) options.resume = sessionId
query({ prompt: stringPrompt, options })
```

**Quack (required persistent subprocess for caching):**
All of the above PLUS: `systemPrompt.append`, `tools`, `allowedTools`, `betas`, `env`, `mcpServers`, `settingSources`, `thinking`, `effort`, `agents`, `enableFileCheckpointing`, and `ideContext` prepended to user prompt as `<system-reminder>`. Uses `generateMessages()` async generator instead of plain string.

## Test 1: Incremental Option Addition (back-to-back, no delay)

Script: `src-tauri/node-sdk/cache-test-incremental.mjs`

Added one Quack option per level, 3 turns each. All levels tested with plain string prompt.

| Level | Options Added | Turn 2 Hit% | Turn 3 Hit% |
|-------|-------------|-------------|-------------|
| L0 Kite baseline | cwd, permissionMode | 0.0%* | 99.8% |
| L1 + model | explicit model ID | 99.8% | 99.8% |
| L2 + betas | context-1m-2025-08-07 | 98.8% | 99.8% |
| L3 + systemPrompt.append | AskUserQuestion block | 99.5% | 0.0%** |
| L4 + allowedTools | static tool array | 99.6% | 99.8% |
| L5 + mcpServers | context7 | 99.5% | 99.8% |
| L6 + env overrides | ENABLE_TOOL_SEARCH | 99.6% | 77.1%** |
| L7 + all remaining | settingSources, tools, checkpoint | 99.8% | 99.8% |

\* L0 didn't set model → SDK defaulted to Opus → different cache partition. Not a real issue.
\** Random cache TTL evictions from back-to-back test runs competing for slots. Not systematic.

**Conclusion: No individual Quack option breaks caching with string prompts.**

## Test 2: String vs AsyncGenerator Prompt (back-to-back, no delay)

Script: `src-tauri/node-sdk/cache-test-string-vs-generator.mjs`

Same full Quack options, same prompt text, same constant ideContext. Only difference: prompt format.

| Mode | Turn 2 Hit% | Turn 3 Hit% |
|------|-------------|-------------|
| **String** prompt | 60.7% | 0.0% |
| **AsyncGenerator** prompt | 99.3% | 99.7% |

The generator (Quack's actual format) performs better than string. String mode had cache eviction issues in this test run.

**Conclusion: The async generator prompt format does NOT degrade caching. It works well.**

## Test 3: Constant vs Changing ideContext (back-to-back, no delay)

Script: `src-tauri/node-sdk/cache-test-ide-context.mjs`

Full Quack options, async generator prompt. Tests whether switching the open IDE file between turns affects caching.

### Constant ideContext (same file every turn)

| Turn | Cache Read | Cache Create | Hit Rate |
|------|-----------|-------------|----------|
| 1 | 24,144 | 15,313 | 61% |
| 2 | **39,457** | **197** | **99.5%** |
| 3 | **39,654** | **123** | **99.7%** |
| 4 | **39,777** | **120** | **99.7%** |

### Changing ideContext (different open file each turn)

| Turn | Cache Read | Cache Create | Hit Rate |
|------|-----------|-------------|----------|
| 1 | 39,457 | 0 | 100% |
| 2 | 24,144 | 15,434 | 61% |
| 3 | 24,144 | 15,548 | 61% |
| 4 | **39,578** | **235** | **99.4%** |

**Conclusion: With constant ideContext, cache create drops to ~120-200 tokens per turn (comparable to persistent subprocess's ~230). Changing ideContext causes ~15k cache recreation in back-to-back tests but stabilizes by Turn 4.**

## Test 4: Realistic User Timing — Warm Cache (35s between turns)

Script: `src-tauri/node-sdk/cache-test-realistic.mjs`

Full Quack options, async generator, changing ideContext AND changing prompts, 35s pause between turns (simulating real user read+think time). CWD: quack-app (had warm cache from prior tests).

| Turn | Cache Read | Cache Create | Hit Rate | Cost |
|------|-----------|-------------|----------|------|
| 1 | 41,453 | 2,730 | 93.8% | $0.0464 |
| 2 | 45,320 | 1,224 | **97.4%** | $0.0260 |
| 3 | 46,976 | 781 | **98.3%** | $0.0153 |
| 4 | 48,452 | 1,755 | **96.5%** | $0.0178 |
| 5 | 47,757 | 3,153 | **93.8%** | $0.0097 |

Average resumed hit rate: **96.5%**

**Caveat: CWD had warm cache from prior tests. Turn 1's 41k cache_read is not a cold start.**

## Test 5: Realistic User Timing — Cold(er) Start (35s between turns)

Script: `src-tauri/node-sdk/cache-test-cold-start.mjs`

Same as Test 4 but with `claude-agents-test` CWD (not previously tested with these options). Real questions, changing ideContext, 35s pauses.

| Turn | Cache Read | Cache Create | Hit Rate | Cost |
|------|-----------|-------------|----------|------|
| 1 | 36,275 | 814 | 97.8%* | $0.0653 |
| 2 | 37,089 | 492 | **98.7%** | $0.0054 |
| 3 | 37,581 | 6,046 | **86.1%** | $0.0189 |
| 4 | 37,581 | 6,607 | **85.0%** | $0.0151 |
| 5 | 37,581 | 7,315 | **83.7%** | $0.0133 |

Average resumed hit rate: **88.4%**

\* Turn 1 still had partial cache from shared system prompt + tool definitions (same model across projects).

**Key finding: cache_read plateaus at 37,581 from Turn 3 onward. cache_create grows (6k→7.3k) as conversation history accumulates but isn't fully cached. The system prompt cache (37k tokens) is stable; the conversation history (~6-7k) regenerates each turn.**

## Summary of Findings

| Scenario | Avg Resumed Hit% | Cache Create/Turn |
|----------|-----------------|-------------------|
| Persistent subprocess (current) | ~99.5% | ~230 tokens |
| query() + constant ideContext (Test 3) | **99.6%** | **~120-200 tokens** |
| query() + changing ideContext, warm cache (Test 4) | 96.5% | ~1.5k tokens |
| query() + changing ideContext, cold(er) start (Test 5) | 88.4% | ~6-7k tokens |

### Key insights

1. **No individual Quack option breaks caching.** systemPrompt.append, allowedTools, mcpServers, betas, env — all produce >99% cache hits when tested individually with string prompts.

2. **The async generator prompt format works fine.** It actually outperformed string prompt in our A/B test.

3. **Constant ideContext with query() per message matches persistent subprocess performance** (~120-200 tokens cache creation). This is the ideal scenario.

4. **Changing ideContext causes cache degradation** on cold starts (~6-7k tokens/turn), but stabilizes with warm cache (~1.5k tokens/turn).

5. **The remaining gap vs persistent subprocess is in conversation history caching.** The system prompt (37k tokens) is always cached. The conversation history portion gets recreated when the API's internal cache breakpoints don't cover it fully across fresh subprocess spawns.

## Open Questions

1. Why does changing ideContext (in the user message, NOT system prompt) cause ~15k cache recreation in back-to-back tests but only ~6-7k with realistic timing?
2. Can the conversation history cache be improved by adjusting cache breakpoint placement (SDK-level control)?
3. Is the ~6-7k cache_create per turn acceptable given the architectural simplification of removing the persistent subprocess?

## Test Scripts

All scripts are in `src-tauri/node-sdk/`:
- `cache-test-incremental.mjs` — option-by-option bisection
- `cache-test-string-vs-generator.mjs` — prompt format comparison
- `cache-test-ide-context.mjs` — constant vs changing ideContext
- `cache-test-realistic.mjs` — warm cache, realistic timing
- `cache-test-cold-start.mjs` — cold(er) start, realistic timing

## Related

- `documentation/bugs/bug-post-fix-cache-breakage-investigation.md` — original investigation (2026-03-25)
- `documentation/gotchas/gotcha-sdk-bundled-cli-200k-context-window.md` — context window gotcha
- `documentation/bugs/bug-delayed-agent-message-stale-closure.md` — persistent subprocess bug
- `documentation/bugs/bug-background-task-unsolicited-events.md` — persistent subprocess bug
