# Fix: ModelService emergency fallback console.warn spam

**Status:** Fixed
**Date:** 2026-04-11
**Author:** (Antonio)

## Symptom

On startup (especially on Linux without `.env`), the console floods with hundreds of
`[ModelService] Using emergency fallback - Supabase models not available` warnings,
repeating indefinitely while the app is running.

## Root Cause

Three compounding issues:

1. **Missing `.env` on Linux** — `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are empty,
   so `fetchAppConfig()` returns `DEFAULT_CONFIG` which has no `models` field.
   `config.models` stays `undefined` forever.

2. **`getModels()` warns on every call** — No deduplication; every invocation with
   `undefined` remoteModels fires `console.warn`.

3. **`ChatSettingsMenu` is always mounted** — Embedded inside `UnifiedActionBar` → `ChatInput`,
   it calls `getModelOptions(remoteModels)` → `getModels(undefined)` on every render.
   Since `ChatInput` re-renders on every keystroke / streaming event / state change,
   the warning fires hundreds of times per minute.

Additionally, two call sites passed no `remoteModels` at all:
- `StaminaBarBorder.tsx:140` — `getModelLabel(model)` (inside modal, lower impact)
- `useBTW.ts:171-174` — `getProviderRequestFields()` and `getModelId(btwModel)` (on BTW send)

## Fix

| File | Change |
|------|--------|
| `src/services/modelService.ts` | Added module-level `_fallbackWarned` flag — warn fires once, resets when models become available |
| `src/components/StaminaBarBorder.tsx` | Added `useModelsConfig()` hook, pass `remoteModels` to `getModelLabel()` |
| `src/hooks/useBTW.ts` | Added `useModelsConfig()` hook, pass `remoteModels` to `getProviderRequestFields()` and `getModelId()` |

## How to Avoid

- Always pass `remoteModels` when calling modelService functions from React components.
  Use `useModelsConfig()` to obtain the models.
- Never use unbounded `console.warn` in hot paths — add deduplication for warnings
  that may fire during render cycles.
