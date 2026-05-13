---
type: gotcha
project: quack-app
created: 2026-05-13
last_verified: 2026-05-13
tags: [providers, anthropic-compatible, minimax, zai, kimi, debugging, brain-037]
---

# Anthropic-compatible clones lie about their identity

## Trigger

You configure Quack to route through z.ai, MiniMax, or Kimi. You ask the
running session "che modello sei?" / "what model are you?". The reply is
something like:

> Sono **Claude Sonnet 4.6** — l'ultimo modello di Anthropic.

You panic and start debugging the provider routing. **Stop.** The routing
is almost certainly correct. The model is just lying.

## Root cause

Open-weight clones with an Anthropic-compatible API surface (MiniMax M2,
Z.AI GLM, Kimi K2) are trained on Claude conversation transcripts. They
absorb the "I am Claude" persona during fine-tuning. When asked their
identity they default to the training-set answer, **regardless** of what
HTTP endpoint actually served the request.

This is identity hallucination, not a routing bug.

## How to verify routing is correct

Three independent signals, in order of trust:

### 1. The session JSONL `model` field

`~/.claude/projects/<encoded-cwd>/<sessionId>.jsonl` — every assistant
message carries the `model` echoed back by the provider:

```json
{"message":{"role":"assistant","model":"MiniMax-M2.7",...}}
```

If you see `MiniMax-M2.7` or `glm-4.6` there, the request is going to the
right place. (Anthropic itself would echo `claude-sonnet-4-6-20251022` or
similar.)

### 2. `~/.quack/daemon-diag.log`

Look for the line emitted at query start:

```
PROVIDER_CONFIG_APPLIED: baseUrl=https://api.minimax.io/anthropic
  sonnetModel=MiniMax-M2.7-highspeed haikuModel=MiniMax-M2.7-highspeed
  oauthCleared=false
```

If that line is present, the daemon set the env override before invoking
the SDK. If only `PROVIDER_CONFIG: present=true ... usingProviderConfig=false`
appears (no `_APPLIED`), the override did NOT fire — that's a real bug.

### 3. Behavioral probes that bypass identity

- "What is your knowledge cutoff date?" — providers diverge here far more
  than they do on "what model are you".
- Ask in a less-common dialect (Italian regional dialect, Brazilian
  Portuguese slang). Anthropic Claude handles these gracefully; clones
  fall apart faster.
- Tool-use density — clones are noticeably more rigid with complex tool
  chains.

## Cache-hit signal

The Token Usage modal's cache-hit % is another indicator. A long-running
custom-provider session will sit at very low cache hits (clones have
small or no prompt cache). If you see 90%+ cache hits, the request is
probably reaching Anthropic — that's a provider routing bug **or** you're
resuming a session that was originally created on Anthropic (the JSONL
already had cached prompt fragments).

## Resumed-session caveat

If a session was started on one provider and you switch the active
provider mid-flight, the binary may continue talking to the original
endpoint (the JSONL session id is meaningful only on the provider that
issued it). Always start a **fresh session** when validating a new
custom provider. Once verified, switching mid-session is fine — just be
aware that `modelUsage` in the Token Usage modal accumulates across
both providers.

## Resolution

Don't "fix" identity hallucination. Document it for the user and move on.
Quack already shows the real provider model name in the message badge
and chat-settings chip via `getActiveModelDisplayName` (sources it from
`activeProvider.activeModel` or the provider preset's `sonnetModel`),
which gives a UI-side ground truth that doesn't rely on what the model
says about itself.

## Related

- Feature: `documentation/features/065-anthropic-compatible-providers.md`
- Pattern: `documentation/patterns/pattern-anthropic-compatible-providers.md`
- Gotcha (sibling): `documentation/gotchas/gotcha-model-name-non-anthropic-provider.md`
