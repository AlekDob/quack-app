---
type: gotcha
project: quack-app
created: 2026-04-16
last_verified: 2026-04-16
tags: [sdk, cli, betas, oauth, claude-max, context-window, 1M]
severity: high
---

# OAuth/Max users must NOT receive custom `betas` — silently forces 200k context

## Symptom

On Claude Max (OAuth subscription) the Stamina Bar / Context Receipt shows
`200.0k` for Opus 4.7 (and 4.6) even though:

- Native CLI (`claude --resume <id>`) on the same binary shows
  `Opus 4.7 (1M context) · Claude Max`.
- `pathToClaudeCodeExecutable` is pointed at the native CLI binary
  (`~/.local/bin/claude` 2.1.111+).
- `options.betas = ['context-1m-2025-08-07']` is set in `stream-daemon.js`.

## Smoking gun

`~/.quack/daemon-diag.log` repeatedly contains:

```
[SessionProcess <id>] stderr: Warning: Custom betas are only available for API
key users. Ignoring provided betas.
```

## Root cause

When the SDK forwards `options.betas` to the spawned Claude CLI, the CLI
detects an OAuth session and **rejects the entire custom-beta request**. In
doing so it also **disables the server-side Max 1M auto-flag** for that
process, silently falling back to 200k.

| Auth type | `options.betas` sent | CLI behaviour | Effective context |
|-----------|---------------------|---------------|-------------------|
| API key (`ANTHROPIC_API_KEY`) | `['context-1m-2025-08-07']` | Accepts beta | 1M |
| OAuth / Claude Max | `['context-1m-2025-08-07']` | Warns, rejects, *also* drops Max auto-1M | 200k |
| OAuth / Claude Max | (not set) | Uses Max auto-1M | 1M |

Native CLI used interactively from terminal never sends `--betas`, so it
always gets the Max auto-1M. The SDK path — which **does** send `--betas` —
is the only code path that triggers the rejection.

## Fix

In `src-tauri/node-sdk/stream-daemon.js` guard the `betas` assignment:

```js
const hasApiKey = !!(process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY);
if (hasApiKey) {
  options.betas = ['context-1m-2025-08-07'];
}
```

API key users still get the 1M opt-in explicitly; OAuth users get the Max
auto-1M by staying silent.

## Verification

After the fix, quit Quack completely (Cmd+Q), relaunch, send any message
with Opus 4.7/4.6 and tail the daemon log:

```
tail -f ~/.quack/daemon-diag.log
```

- The `Warning: Custom betas are only available for API key users` line must
  no longer appear.
- The Context Receipt should show `1.0M` for Opus 4.7/4.6.

## Do-not-repeat

Never pass `betas` unconditionally to the CLI. Any beta that requires
an API key auth path must be guarded by an env-var check. If a new beta is
needed for OAuth users in the future, treat it as a separate code path with
its own server-side feature flag — do **not** rely on `--betas`.

## Files

| File | Change |
|------|--------|
| `src-tauri/node-sdk/stream-daemon.js` | guard `options.betas` with `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY` env check |
