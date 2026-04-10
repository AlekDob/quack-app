# Feature Specification: Vercel AI SDK Multi-Provider Engine

## Problem Statement

Quack currently supports only Anthropic models natively via the Claude Agent SDK. Non-Anthropic models (OpenAI, Google, Ollama) require the user to set up an external proxy (LiteLLM) or use the "Custom Endpoint" hack that overrides `ANTHROPIC_BASE_URL`. This approach is fragile, undiscoverable, and provides no model listing, no proper token tracking, and no tool use translation.

Meanwhile, the NamiOS project (`/Users/alekdob/Desktop/Dev/Personal/meow`) already has a battle-tested multi-provider layer built on Vercel AI SDK v6, supporting 47 models across 8 providers with auto-detection, smart presets, and native streaming + tool use.

The goal is to integrate the Vercel AI SDK as a **second engine** inside Quack's existing Node.js daemon (`stream-daemon.js`), enabling native support for OpenAI (including Codex), Google Gemini, and other providers — all using Quack's existing premium UI/UX.

## User Stories

### Story 1: Select a non-Anthropic model from the chat UI

As a Quack user
I want to select an OpenAI or Google model from the chat footer dropdown
So that I can use the best model for each task without external proxies

**Acceptance Criteria:**
- [ ] The provider dropdown shows: Anthropic, OpenAI, Google, OpenRouter (in addition to existing Ollama/Custom)
- [ ] Selecting a provider shows available models for that provider
- [ ] Models are auto-discovered based on configured API keys
- [ ] The selected model persists across sessions

### Story 2: Configure API keys for multiple providers

As a Quack user
I want to enter my OpenAI/Google/OpenRouter API keys in Settings
So that models from those providers become available

**Acceptance Criteria:**
- [ ] Settings > LLM Provider section has input fields for each provider's API key
- [ ] Keys are persisted securely in the settings store
- [ ] After saving a key, the corresponding models appear in the chat dropdown immediately
- [ ] A "Test connection" button validates the key works

### Story 3: Chat with OpenAI Codex model

As a developer
I want to use OpenAI Codex (codex-mini-latest) for coding tasks
So that I can compare quality/speed against Claude

**Acceptance Criteria:**
- [ ] Codex appears in the OpenAI model list when OPENAI_API_KEY is set
- [ ] Streaming responses work with the same UX as Anthropic models
- [ ] Tool use (file read/write, bash) works through the Vercel AI SDK tool translation
- [ ] The chat renders markdown, code blocks, and tool results identically

### Story 4: Transparent engine switching

As a user
I want the chat experience to be identical regardless of which provider I'm using
So that switching models feels seamless

**Acceptance Criteria:**
- [ ] The same chat input, message rendering, and tool result display works for all providers
- [ ] StaminaBar adapts to the provider's context window (or hides if unknown)
- [ ] The session transcript captures messages from any provider
- [ ] Error messages are provider-aware (e.g., "OpenAI rate limit" not "Anthropic error")

### Story 5: Model presets (fast/smart/pro)

As a power user
I want quick-switch presets that auto-select the best model per tier
So that I don't have to manually pick models for different tasks

**Acceptance Criteria:**
- [ ] Three preset buttons: Fast, Smart, Pro (matching NamiOS tiers)
- [ ] Each preset picks the best available model based on configured API keys
- [ ] Presets prefer tool-use-capable models
- [ ] Presets prefer direct providers over OpenRouter (lower latency)

## Non-Functional Requirements

- **Performance**: Engine switch must not add >50ms latency vs direct SDK calls
- **Compatibility**: Existing Anthropic workflow (Claude Agent SDK with persistent subprocess) must remain untouched and default
- **Security**: API keys stored only in local Tauri store, never sent to external services except the provider's own API
- **Stability**: If Vercel AI SDK fails to load or a provider is unreachable, fall back gracefully to Anthropic

## Architecture Constraint

The Vercel AI SDK engine operates as a **parallel path** in the daemon, not a replacement:
- Provider = `anthropic` → Claude Agent SDK (existing path, unchanged)
- Provider = `openai` | `google` | `openrouter` → Vercel AI SDK (`streamText()`)
- Provider = `ollama` → Existing Ollama path (unchanged) OR Vercel AI SDK via `@ai-sdk/openai` compatible endpoint
- Provider = `custom` → Existing custom path (unchanged)

## Success Metrics

- Users can chat with OpenAI Codex and Google Gemini models without any external proxy
- Model selection dropdown shows auto-discovered models per provider
- Streaming + basic tool use works for OpenAI and Google providers
- No regressions on existing Anthropic workflow

## Out of Scope

- Persistent subprocess support for non-Anthropic providers (they use query-only mode)
- Full agentic loop (teams, subagents, hooks) for non-Anthropic providers
- Extended thinking / prompt caching for non-Anthropic providers
- NamiOS Soul/Memory/Skills integration (Quack has its own Brain system)
- Billing/cost tracking per provider (future feature)
