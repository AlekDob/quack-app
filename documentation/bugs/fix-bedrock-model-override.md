---
type: bug
project: quack-app
created: 2026-03-26
last_verified: 2026-03-26
tags: [bedrock, vertex, model, override, cloud-provider, arn]
---
# Bedrock Model Override — "model identifier is invalid" fix

## Symptom

Users with `CLAUDE_CODE_USE_BEDROCK=1` selecting newer models (Opus 4.6, Sonnet 4.6) get:
```
API Error (claude-opus-4-6): 400 The provided model identifier is invalid.
Try --model to switch to us.anthropic.claude-opus-4-1-20250805-v1:0.
```

Secondary symptom: "No session ID found for this agent" — because the SDK fails immediately, no session is created.

## Root Cause

Bedrock uses **ARN-based model identifiers** (e.g., `arn:aws:bedrock:eu-west-1:478301880010:inference-profile/global.anthropic.claude-sonnet-4-5-20250929-v1:0`), not standard Anthropic model IDs. The Claude Code CLI/SDK translates model names to Bedrock format internally, but:

1. **Newer models** (Opus 4.6, Sonnet 4.6) may not have Bedrock mappings in the bundled SDK version
2. **Bedrock availability varies by region** — models may not be deployed in the user's AWS region
3. ARN format includes account-specific and region-specific components

## Fix

Added a **Model Override** field in Settings → Cloud Provider when Bedrock is enabled:

1. **`settingsStore.ts`**: Added `bedrockModelOverride` field to `ClaudeSettings`
2. **`ClaudeCodeSettings.tsx`**: Text input for Bedrock model ID/ARN, with contextual warnings
3. **`claudeSDK.ts`**: `getProviderRequestFields().resolveModel()` checks `bedrockModelOverride` first — when set, bypasses Supabase model ID resolution entirely
4. **`ChatSettingsMenu.tsx`**: Shows "BEDROCK" badge and dims model dropdown when override is active
5. **`StreamMessage.tsx`**: Enriched error display with actionable hint when "model identifier is invalid" error occurs

### How the override works

```
User pastes ARN → bedrockModelOverride in settingsStore
  → getProviderRequestFields().resolveModel() returns override
    → invoke('send_message_via_sdk_streaming', { model: override })
      → claude_cli.rs → --model <override> → SDK uses it as-is
```

When `bedrockModelOverride` is empty, normal Supabase model resolution applies (backward compatible).

## Trigger

Search: `bedrockModelOverride` or `fix-bedrock-model-override` in codebase.

## Related

- `fix-bedrock-env-vars-gui-launch.md` — env var propagation to SDK process
- `bug-daemon-missing-provider-env-vars.md` — daemon provider env vars
- `pattern-multi-provider-llm.md` — multi-provider architecture
