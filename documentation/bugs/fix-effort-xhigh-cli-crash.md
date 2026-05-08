# Fix: `effort: xhigh` crashes the subagent process on outdated Claude CLI

**Type:** Bug fix (capability detection)
**Affected:** Sessions started with `effort: 'xhigh'` ("Deep") on machines whose
installed Claude Code CLI predates the version that introduced `xhigh`.

**Symptom (user-facing):**

> Error: A subagent process crashed unexpectedly. This can happen due to rate limits, timeout, or temporary issues. Please try again.

## Root cause

`xhigh` is the **official** Anthropic-recommended default effort level for
Opus 4.7, announced in
[anthropic.com/news/claude-opus-4-7](https://www.anthropic.com/news/claude-opus-4-7):

> Opus 4.7 introduces a new `xhigh` ("extra high") effort level between `high` and `max`.
> In Claude Code, we've raised the default effort level to `xhigh` for all plans.

The Claude Code CLI added support for the value in 2.1.x. **CLIs older than that
release reject it** (`--effort` accepts only `low | medium | high | max`):

```
error: option '--effort <level>' argument 'xhigh' is invalid.
It must be one of: low, medium, high, max
```

The CLI exits with code 1, the SDK surfaces a `ProcessTransport` failure, the
daemon classifies it as a subagent crash, and the user sees the friendly
"crashed" message.

`daemon-diag.log` signature:

```
SUBAGENT_CRASH: query=<id> errorMsg=Claude Code process exited with code 1
```

with `model=claude-opus-4-7` and effort `xhigh`. The signature is
indistinguishable from a real subagent crash — the only diagnostic is the
installed CLI version (`claude --version`).

## Why a hardcoded version check would be wrong

Anthropic ships the CLI bundled inside the SDK package, the npm
`@anthropic-ai/claude-code` global install, and via `claude update`. Users on
the same Quack version can have wildly different CLI versions (auto-update
disabled, package pinned, IT-managed environments). Hardcoding "≥ 2.1.x" in the
daemon would still ship breakage to users with stale CLIs and would itself rot
when Anthropic adds the next level.

## Fix: auto-detect CLI capabilities

`src-tauri/node-sdk/stream-daemon.js` now:

1. Runs `claude --help` once per CLI path on first use, caches the result.
2. Parses the line `--effort <level> ... (low, medium, high, xhigh, max)` to
   extract the actual supported set.
3. When a query's `effort` is not in that set, clamps it to the strongest
   supported level ≤ requested using the canonical order
   `low < medium < high < xhigh < max`. So `xhigh` on an old CLI is degraded to
   `high` (the strongest available below it), not silently dropped to `medium`.
4. Logs the detected set and any clamps to `~/.quack/daemon-diag.log`
   (`CLI_CAP` and `EFFORT_CLAMP` markers).
5. Falls back to a conservative `{low, medium, high, max}` set if `--help`
   cannot be parsed (corrupted CLI, permission denied, etc.).

The frontend keeps `xhigh` as a first-class option in the UI and as the Opus 4.7
default — exactly as documented by Anthropic. No migration of persisted
settings is needed.

## What the user should do

If the user keeps seeing `EFFORT_CLAMP` events in the diag log, they can update
the CLI to regain full `xhigh` support:

```bash
# Inside Claude Code:
/update

# Or via npm if that's how it was installed:
npm i -g @anthropic-ai/claude-code@latest
```

After update, the daemon will detect the new capability set on next query
(cache is per-process; daemon restart picks it up immediately).

## Reproduction

```bash
# Reproduce the original crash on an old CLI:
~/.local/bin/claude --print --model claude-opus-4-7 --effort xhigh 'hi'
# → option '--effort <level>' argument 'xhigh' is invalid. exit 1

# After fix: identical query routed through stream-daemon clamps to 'high',
# no crash, EFFORT_CLAMP entry logged.
```

## Files touched

- `src-tauri/node-sdk/stream-daemon.js` — added `getSupportedEffortLevels()` +
  `clampEffortToSupported()`, replaced the previous hardcoded "xhigh requires
  Opus 4.7" guard with auto-detect.
- `src/types.ts` — comment updated to reference this Brain entry.
- `src/services/modelService.ts` — doc comment updated.
- `src/components/settings/categories/AgentModesSettings.tsx` — comment notes
  the auto-detect behavior.
- `documentation/bugs/fix-effort-xhigh-cli-crash.md` — this entry.
- `CLAUDE.md` — index entry under "Critical gotchas".

## Initial misdiagnosis (preserved for context)

The first investigation incorrectly concluded that `xhigh` was a documentation-
only level not actually shipped in the CLI, and proposed removing it from the
UI/types. That was wrong: the value is real and shipped, just in a CLI version
newer than 2.1.108 (the version on the reporting machine). The corrected fix
preserves `xhigh` everywhere and adds the auto-detect clamp instead.
