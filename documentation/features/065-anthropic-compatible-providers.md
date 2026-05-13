---
type: feature
project: quack-app
slug: anthropic-compatible-providers
created: 2026-05-13
last_verified: 2026-05-13
tags: [providers, sdk, z.ai, minimax, kimi, qwen, deepseek, daemon, settings, brain-037]
---

# 065 — Anthropic-compatible Providers

Multi-provider system that routes Claude Agent SDK sessions through any
Anthropic-compatible endpoint (z.ai/GLM, MiniMax M2, Kimi, Qwen DashScope,
DeepSeek/SiliconFlow, or any custom proxy). Provider is per-session with a
global default; API keys are namespaced; per-query env injection into the
persistent daemon — no env-at-spawn (deviation from the original spec).

## Status

| Field | Value |
|---|---|
| State | working (MVP + US2 + US3 + US4 implemented, smoke E2E pending real key) |
| Owner | Alek |
| Spec | `specs/037-anthropic-compatible-providers/` |
| Brain refs | `patterns/pattern-anthropic-compatible-providers.md` |
| SDK version | `@anthropic-ai/claude-agent-sdk@0.2.138` |
| Settings store | v13 |

## Files

| File | Role |
|---|---|
| `src/types/providers.ts` | Type definitions: `ProviderPreset`, `CustomProvider`, `ActiveProviderState`, `QuackProviderConfig`, `TestConnectionResult`. |
| `src/constants/providerPresets.ts` | 6 built-in presets (Anthropic, Z.AI, MiniMax, Kimi, Qwen, DeepSeek) + `findPresetById`. |
| `src/services/providerService.ts` | CRUD: `listAllProviders`, `addCustomProvider`, `updateCustomProvider`, `deleteCustomProvider`, `saveProviderToken`, `getProviderToken`, `testConnection`. Delete-active fallback → `{kind:'anthropic'}`. |
| `src/services/providerEnvBuilder.ts` | `buildProviderConfig(activeProvider, sessionOverride?) → QuackProviderConfig | null`. Override > default; Anthropic preset returns null. |
| `src/services/sessionProviderOverrides.ts` | In-memory `Map<sessionId, providerId>` for per-session overrides (NOT persisted). `useSessionProviderOverride` hook via `useSyncExternalStore`. |
| `src/services/claudeSDK.ts` | `getActiveProviderConfig(sessionId?)` — entry point used by every invoke site to resolve the config (override > default). |
| `src/stores/settingsStore.ts` | `ClaudeSettings.activeProvider`, `ClaudeSettings.customProviders`. v12→v13 migration preserves legacy `provider="custom"` as `customProviders[0]` with id `legacy-custom`. |
| `src-tauri/src/providers.rs` | `test_provider_connection` command: POST `/v1/messages` with `max_tokens=1`, Bearer auth, 5s timeout. |
| `src-tauri/src/preferences.rs` | New commands `save_provider_api_key` / `get_provider_api_key` (namespaced, base64). Additive — leaves `openai_api_key` schema unchanged. |
| `src-tauri/src/claude_cli.rs` | `ClaudeCliRequest.provider_config: Option<serde_json::Value>`. Injected into the daemon query JSON. |
| `src-tauri/node-sdk/stream-daemon.js` | `handleQuery` extends env-override block: when `providerConfig` is present, sets `ANTHROPIC_BASE_URL` / `AUTH_TOKEN` / `DEFAULT_SONNET_MODEL` / `DEFAULT_HAIKU_MODEL` / `MODEL`, clears `ANTHROPIC_API_KEY` (Bearer wins), restores in `finally`. |
| `src/components/settings/categories/ClaudeCodeSettings.tsx` | Mounts `<ProviderManager />` in a new "Anthropic-compatible Providers" section. |
| `src/components/settings/categories/providers/ProviderManager.tsx` | List of all presets + customs, "+ Add provider" button, set-as-default radio. |
| `src/components/settings/categories/providers/ProviderCard.tsx` | Per-provider row: name, baseUrl, API key field, test button, duplicate, delete. |
| `src/components/settings/categories/providers/ProviderTestButton.tsx` | Wraps `testConnection`, shows OK + latency + modelEcho or error+status. |
| `src/components/settings/categories/providers/ProviderAddModal.tsx` | Form to add a custom provider; validates baseUrl `^https?://` and `contextWindow ≥ 4096`. |
| `src/components/chat/NewSessionProviderPicker.tsx` | Dropdown in the chat input footer to override the default for the active session. |
| `src/components/chat/SessionProviderBadge.tsx` | Compact badge showing the provider name + sonnet model when streaming. |
| `src/components/chat/UnifiedActionBar.tsx` | Mounts picker (idle) or badge (streaming) before the send button. |
| `src/components/ChatView.tsx` | `effectiveProviderContextWindow` overrides the stamina bar `maxTokens` when a custom provider is active. |

## Flow

| # | Component | Action |
|---|---|---|
| 1 | user | Settings → Claude Code → "Anthropic-compatible Providers" → picks preset (e.g. Z.AI), enters API key, Save. |
| 2 | `providerService.saveProviderToken` | invokes `save_provider_api_key("zai", token)`. Token stored base64 in `app-preferences.json` under `provider_api_keys.zai`. |
| 3 | user | clicks "Test connection". |
| 4 | `providerService.testConnection` | reads token, invokes `test_provider_connection(baseUrl, token, model)` → Rust POSTs `/v1/messages` with `max_tokens=1` and returns OK + latency + modelEcho. |
| 5 | user | clicks "Set as default". |
| 6 | `settingsStore` | `claude.activeProvider = {kind:'custom', providerId:'zai'}`. |
| 7 | user | starts a new session, optionally picks a different provider from the per-session dropdown (overrides default for THAT session only). |
| 8 | user | sends a prompt. |
| 9 | `App.tsx` (4 invoke sites) + `usePopoutKanbanChat` | calls `getActiveProviderConfig(sessionId)` which reads override > default → `buildProviderConfig` → returns `QuackProviderConfig` or null. |
| 10 | Rust `send_message_via_daemon` | embeds `providerConfig` into the daemon query JSON. |
| 11 | `stream-daemon.js handleQuery` | saves originals, sets `ANTHROPIC_BASE_URL` / `AUTH_TOKEN` / `DEFAULT_*_MODEL`, deletes `ANTHROPIC_API_KEY`, runs SDK query, restores originals in `finally`. |
| 12 | UI | StaminaBar uses provider's `contextWindow` (e.g. 1M for MiniMax). Badge shows provider + model. |

## Architectural deviation from spec

The original spec proposed `QUACK_PROVIDER_CONFIG` env var **at daemon spawn**.
Quack's daemon is **persistent (singleton)** so env-at-spawn cannot support
per-session overrides without restarting the daemon. The implementation instead
passes `providerConfig` in the **query JSON payload**, reusing the existing
ollama/custom per-query env-override pattern. The daemon saves/restores env per
query.

## Non-regression invariants

- `save_api_key` / `get_ai_api_key` schema (`openai_api_key`) untouched.
  AIAssistantSettings continues to work as before.
- OAuth Anthropic Pro/Max not affected: when `kind="anthropic"`,
  `providerConfig=null` and the daemon uses default env (OAuth or
  `ANTHROPIC_API_KEY` from credentials).
- Bedrock toggle untouched: mutual exclusion enforced by `ActiveProviderState`
  union (only one of anthropic | bedrock | custom).
- Ollama flow untouched: legacy `provider="ollama"` continues to work in
  parallel through the existing env-override path.

## Migration

v12 → v13 (`settingsStore.ts`):

| Legacy state | Resulting `activeProvider` |
|---|---|
| `provider === "custom"` with `providerBaseUrl` set | `{kind:'custom', providerId:'legacy-custom'}` + custom entry inserted. |
| `provider === "anthropic"` (or anything else) | `{kind:'anthropic'}`. |

Legacy fields `provider`, `providerBaseUrl`, `providerApiKey`, `ollamaModel`
are preserved (NOT deleted) for rollback safety.

## Brain breadcrumbs

`// Brain: 037-anthropic-compatible-providers` appears above:
- `buildProviderConfig` in `providerEnvBuilder.ts`
- the `providerConfig` block in `stream-daemon.js handleQuery`
- v12→v13 migration in `settingsStore.ts`
- `ClaudeCliRequest.provider_config` in `claude_cli.rs`
- 4 invoke sites in `App.tsx` + 1 in `usePopoutKanbanChat.ts`
- the new section in `ClaudeCodeSettings.tsx`
- all UI components under `src/components/settings/categories/providers/`
- all session-scoped chat components under `src/components/chat/`
