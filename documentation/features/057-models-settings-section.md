---
type: feature-doc
project: quack-app
stack: Tauri (Rust + React 18 + TypeScript)
created: 2026-04-13
last_verified: 2026-04-13
tags: [models, settings, provider, llm, multi-provider, vercel-ai-sdk, ollama, bedrock]
---

## Models & Settings Section
**Purpose:** Multi-provider LLM selection, API key management, per-message settings tracking, and model resolution across Anthropic, OpenAI, Google, OpenRouter, MiniMax, ZAI, Ollama, and custom endpoints.
**Stack:** React 18 + TypeScript (frontend), Node.js Vercel AI SDK daemon (backend), Zustand (state)

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Service | `src/services/modelService.ts` | `ModelConfig`, `getModels()`, `getModelId()`, `getDefaultModel()`, `getModelOptions()`, `getModelLabel()` — Supabase-driven model catalog with emergency fallback |
| Service | `src/services/ollamaService.ts` | `checkOllamaRunning()`, `fetchOllamaModels()`, `getOllamaModelOptions()` — Ollama local server discovery and model listing |
| Service | `src-tauri/node-sdk/model-registry.js` | `REGISTRY`, `detectApiKeys()`, `getAvailableModels()`, `pickBestModel()`, `findModel()`, `createModel()`, `getRegistry()` — Vercel AI SDK model catalog (OpenAI, Google, OpenRouter, MiniMax, ZAI) |
| Util | `src/utils/modelUtils.ts` | `normalizeModelName()` — Legacy model ID normalization (sonnet->sonnet46, opus->opus46) |
| Component | `src/components/ChatSettingsMenu.tsx` | `ChatSettingsMenu` — Per-chat popover with provider tabs, model dropdown, mode, effort selectors |
| Component | `src/components/MessageSettingsBadges.tsx` | `MessageSettingsBadges` — Inline badges showing model/effort/thinking per message |
| Component | `src/components/settings/categories/ClaudeCodeSettings.tsx` | `ClaudeCodeSettings` — Settings panel: LLM provider dropdown, API keys, Ollama status, Bedrock override, BTW model, memory |
| Component | `src/components/settings/categories/AIAssistantSettings.tsx` | `AIAssistantSettings` — OpenAI API key for AI suggestions + image model selection (gpt-image-1.5, DALL-E 3) |
| Component | `src/components/settings/categories/AgentModesSettings.tsx` | `AgentModesSettings` — Per-mode model presets (plan/build/debug/ask/chat) |
| Store/State | `src/stores/settingsStore.ts` | `ClaudeSettings` interface, `useSettingsStore` — Persisted Zustand store with provider, model, API keys, Bedrock override |
| Component | `src/components/settings/SettingsSidebar.tsx` | `SettingsSidebar`, `SettingsCategory` type — Settings navigation (no dedicated "models" tab; model config lives in claude-code and ai-assistant) |
| Component | `src/components/settings/UnifiedSettings.tsx` | `UnifiedSettings` — Settings modal shell, routes categories to panels |
| Component | `src/components/settings/SettingsContent.tsx` | `SettingsContent` — Content wrapper for active settings panel |
| Model/Type | `src/types.ts` | `LLMProviderType`, `OllamaModel`, `MessageSettingsMetadata`, `EffortLevel` |
| Service | `src/hooks/useAppConfig.ts` | `useModelsConfig()` — Fetches remote model list from Supabase `app_config` |

### Data Flow

**Model resolution (Anthropic):**
`Supabase app_config` -> `useModelsConfig()` -> `modelService.getModels()` -> `ChatSettingsMenu` dropdown -> `settingsStore.claude.model` -> `modelService.getModelId()` -> SDK CLI spawn

**Model resolution (Vercel providers):**
`settingsStore.claude.provider + ollamaModel + apiKeys` -> `node-sdk/model-registry.js` -> `createModel()` -> `stream-vercel.js` -> Vercel AI SDK `streamText()`

**Ollama discovery:**
`ollamaService.checkOllamaRunning(baseUrl)` -> `fetchOllamaModels()` -> `ClaudeCodeSettings` status + model dropdown

**Per-message settings:**
`ChatSettingsMenu` selections -> `MessageSettingsMetadata` stored in `ChatMessage.settings` -> `MessageSettingsBadges` renders inline

### Key Functions
- `getModels(remoteModels?) -> ModelConfig[]` — Active models sorted by `sortOrder`, Supabase-first with emergency fallback
- `getModelId(friendlyName, remoteModels?) -> string` — Resolves friendly ID (e.g. `sonnet46`) to API model ID (e.g. `claude-sonnet-4-6`), handles `[1m]` suffix
- `getModelLabel(friendlyName, remoteModels?) -> string` — Display label for model ID
- `normalizeModelName(model) -> string` — Normalizes legacy/API model IDs to Supabase IDs
- `checkOllamaRunning(baseUrl) -> boolean` — Checks Ollama server availability (3s timeout)
- `fetchOllamaModels(baseUrl) -> OllamaModel[]` — Lists installed Ollama models via `/api/tags`
- `detectApiKeys(override?) -> DetectedKeys` — Merges frontend-provided keys with env vars
- `getAvailableModels(keys) -> ModelEntry[]` — Filters registry by available API keys
- `pickBestModel(preset, keys) -> ModelEntry | null` — Selects best model for preset tier (fast/smart/pro)
- `createModel(entry, keys) -> LanguageModel` — Instantiates Vercel AI SDK model object per provider

### State
- `claude.model`: string — Active Anthropic model ID, e.g. `opus46` (global)
- `claude.provider`: LLMProviderType — Active LLM provider: `anthropic | openai | google | openrouter | minimax | zai | ollama | custom` (global)
- `claude.providerBaseUrl`: string — Custom/Ollama endpoint URL (global)
- `claude.providerApiKey`: string — API key for custom endpoint (global)
- `claude.ollamaModel`: string — Model name for non-Anthropic providers (global)
- `claude.openaiApiKey`: string — OpenAI API key (global)
- `claude.googleApiKey`: string — Google AI API key (global)
- `claude.openrouterApiKey`: string — OpenRouter API key (global)
- `claude.minimaxApiKey`: string — MiniMax API key (global)
- `claude.zaiApiKey`: string — ZAI/GLM API key (global)
- `claude.btwModel`: string — Model for BTW side-chain, default `haiku45` (global)
- `claude.bedrockModelOverride`: string — Bedrock ARN/model ID override (global)
- `agentModePresets`: AgentModePresets — Per-mode model + effort + thinking config (global)

### External Dependencies
- Supabase `app_config`: Remote model catalog (models key)
- Ollama API: `{baseUrl}/api/tags` for model discovery
- Vercel AI SDK: `@ai-sdk/openai`, `@ai-sdk/google`, `@ai-sdk/anthropic` for model instantiation
- OpenAI API: Direct GPT/Codex/o3 access
- Google AI API: Direct Gemini access
- OpenRouter API: Aggregated multi-model access
- MiniMax API: M2.5 model access via OpenAI-compatible endpoint
- ZAI API: GLM 4.7/5 model access via OpenAI-compatible endpoint
- AWS Bedrock: Optional routing for Claude SDK agents

### Config
- `CLAUDE_CODE_USE_BEDROCK`: `1` to route SDK calls through AWS Bedrock
- `OPENAI_API_KEY`: Env var fallback for OpenAI key
- `GOOGLE_AI_API_KEY`: Env var fallback for Google key
- `OPENROUTER_API_KEY`: Env var fallback for OpenRouter key
- `MINIMAX_API_KEY`: Env var fallback for MiniMax key
- `ZAI_API_KEY`: Env var fallback for ZAI key

---

## Planned: "Models" Settings Section

### Problem (Current UX)
- Provider/model config is buried inside "Claude Code" settings — not intuitive
- API keys for 6+ providers are scattered in the same long page
- ChatSettingsMenu dropdown shows ALL models regardless of API key availability
- User selects a provider without API key → blank screen, no error (fixed with early-exit but still bad UX)
- No visual feedback on which providers are active/configured

### Design: New "Models" Tab in Settings Sidebar

Add a dedicated **"Models"** category in SettingsSidebar (between "Claude Code" and "AI Assistant") with this layout:

```
Settings > Models
┌─────────────────────────────────────────────────┐
│  Provider API Keys                              │
│  ─────────────────────────────────────────────  │
│                                                 │
│  [Anthropic]  [checkmark green] Active (OAuth)  │
│  ──────────                                     │
│    Auth: OAuth connected (via Claude CLI)       │
│    Models: Opus 4.6, Sonnet 4.6, Haiku 4.5     │
│                                                 │
│  [OpenAI]  [checkmark green] / [x red]          │
│  ──────────                                     │
│    API Key: [sk-...____] [Test] [checkmark/x]   │
│    Models: GPT-5.3 Codex, GPT-4.1, o3, o4-mini │
│                                                 │
│  [Google]  [checkmark/x]                        │
│  ──────────                                     │
│    API Key: [AIza...____] [Test] [checkmark/x]  │
│    Models: Gemini 2.5 Pro, Flash, Flash Lite    │
│                                                 │
│  [OpenRouter]  [checkmark/x]                    │
│  ──────────                                     │
│    API Key: [sk-or...____] [Test]               │
│    Models: All aggregated (GPT-4o, Gemini,      │
│            Llama, DeepSeek, Qwen, MiniMax, GLM) │
│                                                 │
│  [MiniMax]  [checkmark/x]                       │
│  ──────────                                     │
│    API Key: [eyJ...____] [Test]                 │
│    Models: M2.5, M2.5 HighSpeed, M2.1          │
│                                                 │
│  [GLM/ZAI]  [checkmark/x]                       │
│  ──────────                                     │
│    API Key: [...____] [Test]                    │
│    Models: GLM 5, GLM 4.7, GLM 4.7 Flash       │
│                                                 │
│  [Ollama]  [circle green/red] Online/Offline    │
│  ──────────                                     │
│    Base URL: [http://localhost:11434]            │
│    Models: (auto-discovered from /api/tags)     │
│                                                 │
│  [Custom]  [optional]                           │
│  ──────────                                     │
│    Base URL: [...____]                          │
│    API Key: [...____]                           │
│    Model ID: [...____]                          │
│                                                 │
│  ─────────────────────────────────────────────  │
│  Default Model                                  │
│  ──────────                                     │
│    Provider: [dropdown — only validated ones]   │
│    Model:    [dropdown — filtered by provider]  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Key UX Rules

1. **API Key Validation**: Each provider card has a [Test] button that calls a lightweight API endpoint (e.g. `GET /models` for OpenAI, `/api/tags` for Ollama). Show green checkmark or red X + error message.

2. **Validated-Only Model Select**: The ChatSettingsMenu dropdown in chat ONLY shows providers with a validated (non-empty) API key. The provider tab bar also hides providers without keys.

3. **Provider Cards**: Each provider is a collapsible card showing:
   - Status badge (green check / red X / gray unconfigured)
   - API key input (password field)
   - [Test Connection] button
   - List of available models for that provider (read-only, from registry)
   - Link to get API key (external URL)

4. **Anthropic is special**: No API key field — uses OAuth via Claude CLI. Shows "Connected" status from existing auth check.

5. **Ollama is special**: No API key — shows Base URL + online/offline status + auto-discovered models.

6. **Custom Provider**: Free-form Base URL + API Key + Model ID for any OpenAI-compatible endpoint.

### Implementation Plan

| Step | What | Files |
|------|------|-------|
| 1 | Create `ModelsSettings.tsx` component | `src/components/settings/categories/ModelsSettings.tsx` |
| 2 | Add "Models" to SettingsSidebar + UnifiedSettings routing | `SettingsSidebar.tsx`, `UnifiedSettings.tsx` |
| 3 | Build `ProviderCard` sub-component (collapsible, status badge, key input, test button) | `ModelsSettings.tsx` |
| 4 | Add `testProviderConnection(provider, apiKey)` service | `src/services/providerService.ts` |
| 5 | Add `validatedProviders` computed state to settingsStore | `settingsStore.ts` |
| 6 | Filter ChatSettingsMenu tabs by validated providers | `ChatSettingsMenu.tsx` |
| 7 | Move provider/key fields from ClaudeCodeSettings to ModelsSettings | `ClaudeCodeSettings.tsx` |
| 8 | Remove duplicate provider UI from ClaudeCodeSettings (keep BTW, Bedrock, Memory) | `ClaudeCodeSettings.tsx` |

### Validation Endpoints

| Provider | Test Endpoint | Expected |
|----------|--------------|----------|
| OpenAI | `GET https://api.openai.com/v1/models` (with Bearer token) | 200 + JSON |
| Google | `GET https://generativelanguage.googleapis.com/v1beta/models?key=KEY` | 200 + JSON |
| OpenRouter | `GET https://openrouter.ai/api/v1/models` (with Bearer token) | 200 + JSON |
| MiniMax | `GET https://api.minimax.io/v1/models` (with Bearer token) | 200 + JSON |
| ZAI | `GET https://api.z.ai/api/coding/paas/v4/models` (with Bearer token) | 200 + JSON |
| Ollama | `GET {baseUrl}/api/tags` | 200 + JSON |
| Anthropic | Check `~/.claude/credentials.json` exists | File exists |
