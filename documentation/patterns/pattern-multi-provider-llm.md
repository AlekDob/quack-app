---
type: pattern
project: quack-app
created: 2026-02-23
last_verified: 2026-02-23
tags: [llm, provider, ollama, multi-model, architecture]
---
# Multi-Provider LLM Architecture

## Overview

Quack supports three LLM providers: **Anthropic** (default), **Ollama** (local/cloud), and **Custom Endpoint** (any OpenAI-compatible API). The provider is selected in Settings and persisted in Zustand store.

## Architecture Flow

```
Settings UI (provider select)
  -> settingsStore.claude (Zustand persisted)
    -> App.tsx / usePopoutKanbanChat.ts (reads provider settings)
      -> Tauri invoke('stream_claude_message', { provider, provider_base_url, ... })
        -> claude_cli.rs (match provider -> set env vars on Command)
          -> Node.js stream-claude.js (uses ANTHROPIC_BASE_URL)
            -> Claude Agent SDK query() (talks to configured endpoint)
```

## Key Mechanism

The Claude Agent SDK always uses the Anthropic Messages API format. Ollama v0.14.0+ exposes an Anthropic-compatible endpoint, so the SDK works natively without adapters.

**Env vars injected per provider (in claude_cli.rs):**

| Provider | ANTHROPIC_BASE_URL | ANTHROPIC_API_KEY | ANTHROPIC_AUTH_TOKEN |
|----------|-------------------|-------------------|---------------------|
| anthropic | _(not set, uses default)_ | _(from credential resolution)_ | _(from credential resolution)_ |
| ollama | `http://localhost:11434` | `ollama` | `ollama` |
| custom | user-provided URL | user-provided key | _(not set)_ |

## Key Files

| File | Role |
|------|------|
| `src/types.ts` | `LLMProviderType`, `OllamaModel` types |
| `src/stores/settingsStore.ts` | Persisted provider settings (provider, baseUrl, apiKey, model) |
| `src/services/ollamaService.ts` | Health check + model discovery via `/api/tags` |
| `src/services/claudeSDK.ts` | `getProviderRequestFields()`, `getActiveModelName()` |
| `src-tauri/src/claude_cli.rs` | Env var injection per provider |
| `src-tauri/node-sdk/stream-claude.js` | Auth bypass when `ANTHROPIC_BASE_URL` is set |
| `src/components/settings/categories/ClaudeCodeSettings.tsx` | Provider selection UI |
| `src/components/ChatSettingsMenu.tsx` | Provider-aware model display in chat footer |
| `src/components/MessageSettingsBadges.tsx` | Model name badge on messages |

## Ollama Cloud Models

Ollama acts as a unified gateway for both local and cloud models. Cloud models (e.g., `glm-5:cloud`, `kimi-k2.5:cloud`, `minimax-m2.5:cloud`) require:

1. An Ollama account (`ollama signin`)
2. An API key from `ollama.com/settings/keys`
3. `export OLLAMA_API_KEY=...` before `ollama serve`

No provider-specific API keys needed — Ollama proxies everything.

## Zero Impact on Anthropic

The original Anthropic auth flow (env var / OAuth / claude.json) is completely untouched. The `match active_provider` in Rust falls to the default `_` branch for Anthropic, preserving all existing behavior.
