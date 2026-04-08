---
type: gotcha
project: quack-app
created: 2026-04-08
last_verified: 2026-04-08
tags: [typography, zustand, persist, migration, nan]
---
# Custom Font Size NaN from Stale Persisted State

## Trigger
Adding `customFontSize` field to `TypographySettings` interface when existing users have persisted state without it.

## Problem
Zustand persist middleware restores the old state object verbatim. If `customFontSize` didn't exist before, it's `undefined`. Arithmetic on `undefined` (`undefined - 1`, `undefined + 1`) produces `NaN`, which cascades into CSS variables (`NaNpx`) and renders as "NaN" in the UI.

## Fix
`safeCustomSize()` in `src/constants/typography.ts` guards every access point:
- `resolveScale()` — CSS variable generation
- `setCustomFontSize()` — store action  
- `TypographySettings.tsx` — UI display via `currentCustom` derived value

```ts
export function safeCustomSize(raw: number | undefined): number {
  if (raw == null || Number.isNaN(raw)) return DEFAULT_CUSTOM_FONT_SIZE;
  return Math.max(MIN_CUSTOM_FONT_SIZE, Math.min(MAX_CUSTOM_FONT_SIZE, raw));
}
```

## Rule
When adding new numeric fields to Zustand-persisted interfaces, **always** create a safe accessor that handles `undefined`/`NaN`. Store migration alone is not enough — the migration runs once, but the raw field access happens on every render.
