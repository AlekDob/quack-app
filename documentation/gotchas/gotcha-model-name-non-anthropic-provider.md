---
type: gotcha
project: quack-app
created: 2026-02-23
last_verified: 2026-02-23
tags: [model-name, provider, ollama, ui, display]
---
# Model Name Shows "Opus 4.6" When Using Non-Anthropic Provider

## Trigger

Using Ollama or Custom provider, the UI shows "Opus 4.6" in the footer bar and message badges instead of the actual model name (e.g., `glm-5:cloud`).

## Root Cause

Three places stored the model name using the Anthropic default fallback:

1. **Message settings** in `App.tsx`: `model: options?.model || 'opus46'` — always fell back to Anthropic default
2. **Footer label** in `ChatSettingsMenu.tsx`: `getModelLabel(model, remoteModels)` — always resolved to Anthropic label
3. **Message badge** in `MessageSettingsBadges.tsx`: model metadata was saved with Anthropic default key

## Fix

Use `getActiveModelName()` from `claudeSDK.ts` which checks `settingsStore.claude.provider`:

```typescript
// Before (broken)
model: options?.model || 'opus46'

// After (fixed)
model: getActiveModelName(options?.model)
```

This function returns the `ollamaModel` name when provider !== 'anthropic', so all UI elements show the correct model.

## Files Affected

- `src/services/claudeSDK.ts` — `getActiveModelName()` utility
- `src/App.tsx` — message settings model field
- `src/components/ChatSettingsMenu.tsx` — footer label
- `src/components/MessageSettingsBadges.tsx` — badge display

## Key Insight

When adding multi-provider support, always trace every place the model name is displayed or stored. The Anthropic default (`'opus46'`) was hardcoded in multiple locations that needed to become provider-aware.
