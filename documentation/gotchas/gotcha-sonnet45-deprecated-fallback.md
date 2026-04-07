---
type: gotcha
project: quack-app
created: 2026-04-07
last_verified: 2026-04-07
tags: [models, sonnet, deprecation, migration, settings]
---

# Sonnet 4.5 Deprecated -- Silent Fallback to Wrong Model

## Trigger
When adding or removing models from the active list, check that **all hardcoded model IDs** are still valid. Deprecated IDs cause silent fallbacks.

## Problem
`sonnet45` was hardcoded in 4 places:
1. `settingsStore.ts` -- Chat mode preset default
2. `settingsStore.ts` -- `LEGACY_MODEL_MAP` (`'sonnet' -> 'sonnet45'`)
3. `modelService.ts` -- `LEGACY_ID_MAP` (same)
4. `App.tsx` -- `normalizeModelName()` API ID fallback

When Sonnet 4.5 was removed, users on Chat mode saw "sonnet45" in the footer instead of a valid model label. The SDK received an unknown model ID and fell back silently.

## Fix
- Updated all 4 maps to point `sonnet` and `sonnet45` to `sonnet46`
- Added migration v9 in `settingsStore.ts` to upgrade persisted user data
- `MessageSettingsBadges.tsx` keeps `sonnet45: 'Sonnet 4.5'` for rendering old messages

## Prevention
When deprecating a model ID:
1. Search all `LEGACY_*_MAP` constants and `normalizeModel*` functions
2. Add a migration step in `settingsStore.ts` (bump version)
3. Keep the label in `MessageSettingsBadges` for historical display
