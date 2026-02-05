---
type: pattern
project: quack-app
created: 2026-02-02
tags: [supabase, models, dynamic-config, remote-config]
---

# Pattern: Dynamic Model Management via Supabase

## Problem

Hardcoded model lists (`'opus' | 'sonnet' | 'haiku'`) required a deploy to add new models. With Anthropic releasing new models frequently (e.g. Sonnet 5), we needed instant updates.

## Solution

Central `modelService.ts` with Supabase-driven config and hardcoded fallback.

### Architecture

```
Supabase app_config (key="models", value=JSON array)
  → useAppConfig() fetches + caches in localStorage (1h TTL, versioned)
    → useModelsConfig() hook exposes models to components
      → getModelOptions(remoteModels) builds dropdown options
      → getModelId(friendlyName, remoteModels) resolves API model ID
```

### Key Files

| File | Role |
|------|------|
| `src/services/modelService.ts` | Core service: getModels, getModelId, getModelOptions, getModelLabel |
| `src/hooks/useAppConfig.ts` | Supabase fetch + localStorage cache + useModelsConfig hook |
| `src/components/ChatSettingsMenu.tsx` | Chat model dropdown (dynamic) |
| `src/components/settings/categories/AgentModesSettings.tsx` | Agent modes model dropdown (dynamic) |

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

### Supabase JSON Format

```json
[
  { "id": "sonnet5", "modelId": "claude-sonnet-5-20260203", "label": "Sonnet 5", "isActive": true, "isDefault": false, "sortOrder": 0 },
  { "id": "opus", "modelId": "claude-opus-4-5-20251101", "label": "Opus 4.5", "isActive": true, "isDefault": false, "sortOrder": 1 }
]
```

### Adding a New Model

1. Open Supabase Dashboard → `app_config` table
2. Edit the `models` row → add entry to JSON array
3. All users see it after cache expires (1h) or on next fresh load

### Fallback

If Supabase is unreachable, `FALLBACK_MODELS` in modelService.ts provides Opus 4.5, Sonnet 4.5, Haiku 4.5.

## Key Decisions

- **`id` vs `modelId`**: `id` is the short friendly name used in state/storage. `modelId` is the full Anthropic API identifier. This decouples internal naming from API changes.
- **`isActive` flag**: Allows pre-configuring unreleased models without showing them.
- **Cache versioning**: `CACHE_VERSION` in useAppConfig.ts auto-invalidates stale caches when config schema changes.

## Gotchas

- All `'opus' | 'sonnet' | 'haiku'` union types were replaced with `string` across 12+ files
- `TOKEN_LIMITS` in conversationRecovery.ts changed to `Record<string, number>` with `?? 200000` fallback
- `stream-claude.js` (Node backend) keeps its own `getModelId()` as fallback since it doesn't have Supabase access
