---
type: bug_fix
created: 2026-02-02
tags: [models, normalization, dynamic-models]
---

# Bug: normalizeModelName overwrites new model IDs

## Symptom

Selecting "Sonnet 5" (id: `"sonnet5"`) in the dropdown always reverted to "Sonnet 4.5" (id: `"sonnet"`).

## Root Cause

Two functions used `.includes()` to normalize model names:

```typescript
// App.tsx - normalizeModelName()
if (model.includes("sonnet")) return "sonnet";

// AgentViewer.tsx - getModelDisplayName()
if (model.includes("sonnet")) return "sonnet";
```

`"sonnet5".includes("sonnet")` is `true` → mapped back to `"sonnet"`.

These functions were legacy code from before dynamic models, designed to convert full API IDs like `"claude-sonnet-4-5-20250929"` to short names.

## Fix

Guard normalization to only trigger for legacy full API model IDs:

```typescript
const normalizeModelName = (model: string): string => {
  // Only normalize legacy full API model IDs (contain "claude-")
  if (model.startsWith("claude-")) {
    if (model.includes("opus")) return "opus";
    if (model.includes("haiku")) return "haiku";
    if (model.includes("sonnet")) return "sonnet";
  }
  // Short IDs (opus, sonnet, sonnet5, haiku, etc.) pass through as-is
  return model;
};
```

## Files Fixed

- `src/App.tsx` — `normalizeModelName()`
- `src/components/AgentViewer.tsx` — `getModelDisplayName()`

## Trigger Condition

Any new model whose `id` contains a substring of an existing model (e.g. "sonnet5" contains "sonnet").
