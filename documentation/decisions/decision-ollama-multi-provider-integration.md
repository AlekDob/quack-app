---
type: decision
project: quack-app
created: 2026-02-23
last_verified: 2026-02-23
tags: [ollama, provider, multi-model, architecture, decision]
---
# Decision: Ollama as Multi-Provider Gateway

## Context

Users wanted to use models beyond Claude (local and cloud) within Quack. Options considered:

1. **Direct API integration per provider** — implement adapters for OpenAI, Google, MiniMax, etc.
2. **OpenRouter as unified gateway** — single API key, translation layer
3. **Ollama as unified gateway** — local proxy, Anthropic-compatible API

## Decision

**Option 3: Ollama as primary gateway**, with Custom Endpoint as escape hatch.

## Rationale

- **Zero adapter code**: Ollama v0.14.0+ exposes Anthropic Messages API natively. The Claude Agent SDK talks to it without modification.
- **Unified local+cloud**: Ollama serves both local models and cloud models (via `ollama.com` proxy) through the same `localhost:11434` endpoint.
- **No API key management**: Cloud models (GLM, Kimi, MiniMax) run on Ollama's infrastructure — users only need an Ollama account, not individual provider keys.
- **Existing ecosystem**: Users already have Ollama installed for local model experimentation.
- **Fallback**: Custom Endpoint option covers providers not supported by Ollama (direct API access with user's own key).

## Trade-offs

- **Dependency on Ollama**: Cloud model availability depends on Ollama's partnerships
- **Quality gap**: Non-Claude models lack extended thinking, have smaller context, variable tool-use
- **No native provider keys**: Can't use personal MiniMax/xAI API keys through Ollama (need Custom Endpoint for that)

## Implementation

Env var injection in Rust backend — same Claude Agent SDK, different endpoint. Three fields added to `ClaudeCliRequest`: `provider`, `provider_base_url`, `provider_api_key`. See `pattern-multi-provider-llm.md` for full architecture.
