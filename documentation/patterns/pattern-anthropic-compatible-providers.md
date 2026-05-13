---
type: pattern
project: quack-app
created: 2026-05-13
last_verified: 2026-05-13
tags: [providers, sdk, daemon, settings, brain-037, z.ai, minimax]
---

# Anthropic-compatible Providers

## When to apply

When adding support for a new LLM provider that exposes an Anthropic-compatible
endpoint (Z.AI, MiniMax, Kimi, Qwen, DeepSeek, custom company proxy, etc.) — or
when changing how Quack routes Claude Agent SDK calls to different providers.

## Key decisions

### 1. Namespaced API key storage (additive)

`save_api_key`/`get_ai_api_key` are hardcoded to the `openai_api_key` singleton
field in `AppPreferences` (`preferences.rs`). To preserve that schema, providers
use two NEW commands `save_provider_api_key(provider_id, token)` and
`get_provider_api_key(provider_id)` that read/write a separate
`provider_api_keys: HashMap<String,String>` field. **Never** touch the legacy
field — that would break AIAssistantSettings.

### 2. Per-query env injection, not env-at-spawn

The Quack daemon (`stream-daemon.js`) is a **persistent singleton** process
shared across all queries. Setting `ANTHROPIC_BASE_URL` once at spawn would
freeze the daemon to a single provider. The correct pattern:

- The frontend resolves the active provider config and embeds it as
  `providerConfig: QuackProviderConfig` in the daemon query JSON.
- The daemon's `handleQuery` saves `process.env.ANTHROPIC_*` originals,
  applies the provider's values, runs the SDK, and restores in `finally`.
- `ANTHROPIC_API_KEY` MUST be cleared when `ANTHROPIC_AUTH_TOKEN` is set —
  otherwise the SDK sends `x-api-key` and most compatible providers reject it.

### 3. Per-session override wins over global default

Override map is in-memory only (`sessionProviderOverrides.ts`), not persisted.
`getActiveProviderConfig(sessionId?)` reads override first, falls back to
`activeProvider`. Rule applied in `buildProviderConfig`:

```
override.providerId ?? (activeProvider.kind === 'custom' ? activeProvider.providerId : null)
```

If the resolved id is `"anthropic"` (or null) → returns null → daemon uses
default env (OAuth or stored `ANTHROPIC_API_KEY`).

### 4. Built-in presets are read-only, customs are user-managed

`BUILTIN_PRESETS` ship with the codebase (`isBuiltIn: true`). Quack updates can
freely change their `baseUrl` / models without migration. To customize a
built-in, the user uses **"Duplicate as custom"** which creates a new entry in
`customProviders` (persisted in localStorage via Zustand) with `isBuiltIn:
false`.

### 5. Mutual exclusion via discriminated union

`ActiveProviderState = {kind:'anthropic'} | {kind:'bedrock', …} | {kind:'custom',
providerId}` makes it structurally impossible to have two providers active at
once. The radio in the settings UI just maps to setting this state.

### 6. Context window from provider, not from SDK

When a custom provider is active, the bundled `cli.js` SDK reports its OWN
context window (200k), not the provider's. `ChatView` overrides
`sessionTokens.contextWindow` with `provider.contextWindow` (1M for MiniMax,
256k for Kimi/Qwen, 128k for DeepSeek) before passing to `StaminaBarBorder`.

## File touchpoints when adding a new provider

| Step | File | Change |
|---|---|---|
| 1 | `src/constants/providerPresets.ts` | Add entry with `baseUrl`, `sonnetModel`, `haikuModel`, `contextWindow`, `docsUrl`. |
| 2 | (nothing else) | The rest of the pipeline reads `BUILTIN_PRESETS` generically — no per-provider code. |

That's the whole story for built-in presets. Custom providers are handled at
runtime via the Add Provider modal.

## Anti-patterns

- **Don't** set `ANTHROPIC_BASE_URL` at daemon spawn — breaks per-session overrides.
- **Don't** keep `ANTHROPIC_API_KEY` set alongside `ANTHROPIC_AUTH_TOKEN` — providers
  reject it. The daemon explicitly `delete`s it inside the override block.
- **Don't** extend `save_api_key` to add a name parameter — too invasive. Use the
  new namespaced commands.
- **Don't** persist per-session overrides — they're meant to be ephemeral and
  cleared when the app reloads.

## Related Brain entries

- Feature doc: `documentation/features/065-anthropic-compatible-providers.md`
- Spec: `specs/037-anthropic-compatible-providers/`
- Multi-provider LLM (pre-existing, Ollama-focused):
  `documentation/patterns/pattern-multi-provider-llm.md`
