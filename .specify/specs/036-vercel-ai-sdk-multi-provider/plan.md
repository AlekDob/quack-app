# Implementation Plan: Vercel AI SDK Multi-Provider Engine

## Technology Stack

### New Dependencies (Node.js daemon)
- `ai` (Vercel AI SDK v6 core) — `streamText()`, `generateText()`, tool schemas
- `@ai-sdk/openai` — OpenAI + Codex + OpenRouter + any OpenAI-compatible endpoint
- `@ai-sdk/google` — Google Gemini models
- `@ai-sdk/anthropic` — Anthropic models via Vercel SDK (fallback path, not primary)

### Existing Stack (unchanged)
- `@anthropic-ai/claude-agent-sdk` — Primary engine for Anthropic (persistent subprocess, agentic)
- React 18 + Zustand (frontend)
- Rust/Tauri v2 (backend relay)

## Architecture

### Dual Engine Design

```
Quack UI (React)
      |
      v
  Tauri invoke('send_message_via_sdk_streaming')
      |
      v
  claude_cli.rs (Rust relay)
      |
      v
  stream-daemon.js (Node.js)
      |
      +-- isAnthropicProvider? ──> Claude Agent SDK (query/persistent subprocess)
      |                            [existing path, untouched]
      |
      +-- isVercelProvider? ──────> stream-vercel.js (NEW)
      |                            streamText() / generateText()
      |                            Event normalization → same format as Claude SDK
      |
      +-- isOllamaProvider? ─────> existing Ollama path (unchanged)
      +-- isCustomProvider? ──────> existing custom path (unchanged)
```

### Component Design

#### 1. `stream-vercel.js` (NEW — core engine)

**Responsibility**: Handle all Vercel AI SDK interactions, normalize events to match Claude SDK event format.

**Interface**:
```javascript
export async function streamVercelQuery({
  model,          // e.g., 'gpt-4o', 'codex-mini-latest', 'gemini-2.5-pro'
  provider,       // 'openai' | 'google' | 'openrouter'
  apiKey,
  messages,       // conversation history
  systemPrompt,
  tools,          // Quack tool definitions → converted to Zod schemas
  cwd,            // working directory for tool execution
  abortController,
  onEvent,        // callback: emits normalized events (same shape as Claude SDK)
}) => Promise<void>
```

**Event normalization**: Maps Vercel AI SDK stream events to the same `{ type, ... }` format that `stream-daemon.js` already emits, so the Rust relay and React frontend see no difference.

| Vercel AI SDK event | Normalized to |
|---------------------|---------------|
| `streamText()` text delta | `{ type: 'assistant', message: { content: [{ type: 'text', text: delta }] } }` |
| `onStepFinish` (tool call) | `{ type: 'assistant', message: { content: [{ type: 'tool_use', ... }] } }` |
| Stream complete | `{ type: 'result', result: { ... }, usage: { ... } }` |
| Error | `{ type: 'error', error: { message: '...' } }` |

#### 2. `model-registry.js` (NEW — model catalog)

**Responsibility**: Port of NamiOS `models.ts` adapted for Quack. Provides:
- `REGISTRY[]` — all known models with metadata (provider, preset, toolUse, vision, contextWindow)
- `detectApiKeys()` — scans env vars for available providers
- `getAvailableModels(keys)` — filters registry by available keys
- `pickBestModel(preset, keys)` — auto-select best model per tier
- `createModel(entry, keys)` — instantiate Vercel AI SDK model object

**Source**: Adapted from `/Users/alekdob/Desktop/Dev/Personal/meow 😻/src/config/models.ts`

#### 3. Router in `stream-daemon.js` (MODIFIED)

**Change**: Add routing logic after the existing `isAnthropicProvider` check:

```javascript
const isVercelProvider = ['openai', 'google', 'openrouter'].includes(provider);

if (isVercelProvider) {
  await streamVercelQuery({ model, provider, apiKey, messages, ... });
} else if (provider === 'ollama') {
  // existing path
} else {
  // existing Anthropic/custom path
}
```

#### 4. Frontend Changes

**`src/types.ts`**: Expand `LLMProviderType`:
```typescript
export type LLMProviderType = 'anthropic' | 'ollama' | 'custom' | 'openai' | 'google' | 'openrouter';
```

**`src/stores/settingsStore.ts`**: Add per-provider API key fields:
```typescript
openaiApiKey: string;
googleApiKey: string;
openrouterApiKey: string;
```

**`src/components/settings/categories/ClaudeCodeSettings.tsx`**: Add API key inputs for new providers.

**`src/components/ChatSettingsMenu.tsx`**: Add OpenAI/Google/OpenRouter tabs with model dropdown. Models fetched via new Tauri command `get_available_vercel_models`.

**`src/services/claudeSDK.ts`**: Extend `getProviderRequestFields()` to pass provider-specific API keys.

#### 5. Rust Relay (MINIMAL CHANGE)

**`src-tauri/src/claude_cli.rs`**: The `SdkStreamRequest` struct already has `provider`, `providerBaseUrl`, `providerApiKey` fields. These get passed through to the daemon. Only change: ensure the new provider values ('openai', 'google', 'openrouter') are forwarded correctly.

New Tauri command: `get_available_vercel_models` — calls daemon to list models based on configured API keys.

## Tool Translation Strategy

Claude Agent SDK has its own tool system (preset: 'claude_code'). For Vercel AI SDK, we need a minimal tool set:

**Phase 1 (MVP)**: No tool use — pure chat/completion with streaming. This covers 80% of use cases.

**Phase 2 (follow-up)**: Port essential tools as Zod schemas:
- `readFile` — read file content
- `writeFile` — write file content
- `bash` — execute command
- `search` — grep/glob

This matches NamiOS's approach: tools defined with `tool()` from 'ai' package with Zod validation.

## Error Handling

```typescript
try {
  return { success: true, data };
} catch (err) {
  // Provider-aware error messages
  const providerLabel = { openai: 'OpenAI', google: 'Google', openrouter: 'OpenRouter' }[provider];
  return { success: false, error: `${providerLabel}: ${err.message}` };
}
```

Rate limit errors (429) surface as user-visible warnings, not crashes.

## Migration Path

1. Existing users see no change — Anthropic remains default
2. New provider options appear in Settings after update
3. Users opt-in by adding API keys
4. No data migration needed — provider is per-session setting
