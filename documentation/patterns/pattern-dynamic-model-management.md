---
type: pattern
created: 2026-02-02
tags: [supabase, models, dynamic-config, remote-config]
---

# Pattern: Dynamic Model Management via Supabase

## Problem

Hardcoded model lists required a deploy to add new models. With Anthropic releasing new models frequently, we needed instant updates.

## Solution

Central `modelService.ts` with Supabase-driven config and hardcoded fallback.

### Architecture

```
Supabase app_config (key="models", value=JSON array)
  -> useAppConfig() fetches + caches in localStorage (1h TTL, versioned)
    -> useModelsConfig() hook exposes models to components
      -> getModelOptions(remoteModels) builds dropdown options
      -> getModelId(friendlyName, remoteModels) resolves API model ID
```

### ModelConfig Interface

```typescript
interface ModelConfig {
  id: string;        // Short ID: "opus", "sonnet5"
  modelId: string;   // API ID: "claude-opus-4-5-20251101"
  label: string;     // Display: "Opus 4.5"
  isDefault: boolean;
  isActive: boolean;  // false = hidden from dropdown
  sortOrder: number;  // Lower = higher in dropdown
}
```

### Adding a New Model

1. Open Supabase Dashboard -> `app_config` table
2. Edit the `models` row -> add entry to JSON array
3. All users see it after cache expires (1h) or on next fresh load

### Fallback

If Supabase is unreachable, `FALLBACK_MODELS` in modelService.ts provides Opus 4.5, Sonnet 4.5, Haiku 4.5.

## Key Decisions

- **`id` vs `modelId`**: `id` is the short friendly name used in state/storage. `modelId` is the full Anthropic API identifier.
- **`isActive` flag**: Allows pre-configuring unreleased models without showing them.
- **Cache versioning**: `CACHE_VERSION` in useAppConfig.ts auto-invalidates stale caches.

## Key Files

| File | Role |
|------|------|
| `src/services/modelService.ts` | Core service: getModels, getModelId, getModelOptions, getModelLabel |
| `src/hooks/useAppConfig.ts` | Supabase fetch + localStorage cache + useModelsConfig hook |
| `src/components/ChatSettingsMenu.tsx` | Chat model dropdown (dynamic) |
| `src/components/settings/categories/AgentModesSettings.tsx` | Agent modes model dropdown (dynamic) |
