---
type: gotcha
created: 2026-02-02
last_verified: 2026-02-14
tags: [cache, localStorage, supabase, config]
---

# Gotcha: localStorage Cache Prevents New Supabase Config from Loading

## Trigger

Adding a new key to Supabase `app_config` table (e.g. `models`) but users don't see it because their localStorage cache still contains the old config without the new key. The 1h TTL hasn't expired yet.

## Solution: Cache Versioning

Added `CACHE_VERSION` constant in `src/hooks/useAppConfig.ts`. When the version doesn't match, the cache is treated as expired regardless of TTL.

```typescript
const CACHE_VERSION = 2; // Bump when adding new config keys

interface CachedConfig {
  data: AppConfig;
  timestamp: number;
  version?: number;  // Added for version checking
}

function getCachedConfig(): AppConfig | null {
  const parsed = JSON.parse(cached);
  // Version mismatch = treat as expired
  if (parsed.version === CACHE_VERSION && now - parsed.timestamp < CACHE_TTL) {
    return parsed.data;
  }
  return null;
}
```

## When to Bump

Bump `CACHE_VERSION` whenever:
- Adding a new key to `app_config` table
- Changing the structure of an existing config value
- Any schema change that old caches wouldn't include

## Alternative for Users

Users can manually clear by: DevTools → Application → Local Storage → delete `quack_app_config` → reload.
