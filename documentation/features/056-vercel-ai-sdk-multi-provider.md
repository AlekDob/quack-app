---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React + Node.js)
created: 2026-04-10
last_verified: 2026-04-10
tags: [vercel-ai-sdk, multi-provider, openai, google, openrouter, streaming]
---

## Vercel AI SDK Multi-Provider
**Purpose:** Enable non-Anthropic LLM providers (OpenAI, Google, OpenRouter) via Vercel AI SDK, normalizing their streaming events to match the Claude Agent SDK format.
**Stack:** Node.js (Vercel AI SDK) + Rust (Tauri) + React (Zustand)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src-tauri/node-sdk/stream-vercel.js` | `streamVercelQuery()` — streams non-Anthropic queries, emits Claude-compatible events |
| Service | `src-tauri/node-sdk/model-registry.js` | `detectApiKeys()`, `getAvailableModels()`, `pickBestModel()`, `findModel()`, `createModel()`, `getRegistry()` — model catalog + SDK instantiation |
| Service | `src-tauri/node-sdk/stream-daemon.js` | Entry point; routes queries to `streamVercelQuery` when provider is openai/google/openrouter |
| Repository/API | `src-tauri/src/claude_cli.rs` | `get_vercel_models()`, `vercel_model_registry()`, `VercelModelEntry` — Rust-side static registry mirror for UI discovery |
| Model/Type | `src/types.ts` | `LLMProviderType` — union type including `openai`, `google`, `openrouter` |
| Service | `src/services/claudeSDK.ts` | `getProviderRequestFields()` — resolves API key + provider flags for request routing |
| Store/State | `src/stores/settingsStore.ts` | `openaiApiKey`, `googleApiKey`, `openrouterApiKey` — per-provider API key persistence |
| Component | `src/components/settings/categories/ClaudeCodeSettings.tsx` | Provider selector, API key inputs, model dropdown for Vercel providers |
| Component | `src/components/ChatSettingsMenu.tsx` | Quick-switch provider tabs + model picker in chat header |

### Data Flow
```
[ChatSettingsMenu / ClaudeCodeSettings] → [settingsStore (provider + apiKey + model)]
  → [claudeSDK.getProviderRequestFields()] → [stream-daemon.js]
  → [stream-vercel.js / streamVercelQuery()] → [Vercel AI SDK streamText()]
  → [normalized Claude-format events] → [Rust relay (claude_cli.rs)]
  → [React frontend (same handler as Claude SDK events)]
```

```
[UI model discovery] → [Rust get_vercel_models(api_keys)] → [static registry filter]
  → [JSON to frontend] (no Node.js round-trip needed)
```

### Key Functions
- `streamVercelQuery({ modelId, provider, apiKey, messages, systemPrompt, abortController, onEvent }) → void` — main streaming entry; emits `system/init`, `assistant` deltas, `result/success`, or `error` events
- `normalizeMessages(messages) → Array<{role, content}>` — converts Claude SDK message format to Vercel AI SDK format
- `createAdHocModel(modelId, provider, apiKey) → LanguageModel` — fallback for models not in registry
- `detectApiKeys(override?) → DetectedKeys` — merges explicit keys with `process.env` vars
- `getAvailableModels(keys) → ModelEntry[]` — filters registry by which API keys are present
- `pickBestModel(preset, keys) → ModelEntry | null` — auto-selects best model for fast/smart/pro tier
- `findModel(nameOrId) → ModelEntry | undefined` — case-insensitive lookup by ID or label
- `createModel(entry, keys) → LanguageModel` — instantiates Vercel AI SDK model object
- `get_vercel_models(api_keys: HashMap) → Result<String>` — Tauri command returning filtered model JSON

### State
- `provider`: LLMProviderType — active LLM provider (global)
- `openaiApiKey`: string — OpenAI API key (global)
- `googleApiKey`: string — Google AI API key (global)
- `openrouterApiKey`: string — OpenRouter API key (global)
- `ollamaModel`: string — selected model ID for non-Anthropic providers (global)

### External Dependencies
- `ai` (^6.0.156): Vercel AI SDK core — `streamText()`
- `@ai-sdk/openai` (^3.0.52): OpenAI + OpenRouter provider adapter
- `@ai-sdk/google` (^3.0.61): Google Generative AI provider adapter
- `@ai-sdk/anthropic` (^3.0.68): Anthropic provider adapter (for Vercel path)

### Config
- `OPENAI_API_KEY`: env var fallback for OpenAI (detected by `detectApiKeys`)
- `GOOGLE_AI_API_KEY`: env var fallback for Google (detected by `detectApiKeys`)
- `OPENROUTER_API_KEY`: env var fallback for OpenRouter (detected by `detectApiKeys`)
- `ANTHROPIC_API_KEY`: env var fallback for Anthropic-via-Vercel (detected by `detectApiKeys`)
- `maxTokens`: hardcoded 16384 output tokens per response in `streamVercelQuery`

### Model Registry (25 models)
| Provider | Models | Context Window |
|----------|--------|---------------|
| OpenAI (direct) | Codex Mini, o4 Mini, o3, GPT-4o Mini, GPT-4o, GPT-4.1, GPT-4.1 Mini, GPT-4.1 Nano | 128k-1M |
| Google (direct) | Gemini 2.5 Pro, Gemini 2.5 Flash, Gemini 2.5 Flash Lite | 1M |
| OpenRouter | GPT-4o, GPT-4o Mini, Gemini 2.5 Pro/Flash, Llama 4 Maverick, DeepSeek R1, Qwen3 Coder | 128k-1M |
