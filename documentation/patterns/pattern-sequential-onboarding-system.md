---
type: pattern
created: 2026-02-09
tags: [onboarding, first-run, setup, ui, zustand]
---

# Pattern: Sequential Onboarding System

Pattern per gestire una sequenza di onboarding steps al primo avvio di Quack.

## Architecture Overview

```
Splash Screen -> Git Config Check -> IDE Selection -> Main App
                 (if needed)         (if needed)
```

Ogni step di onboarding e:
- **Indipendente**: ha il proprio store Zustand con flag di completamento
- **Condizionale**: si mostra solo se non completato
- **Sequenziale**: l'ordine e garantito dal rendering in `App.tsx`

## Key Principles

### Independent Flags

Each onboarding step has its own persistence. No central orchestrator -- each step decides autonomously whether to show.

### Render Order = Execution Order

L'ordine dei componenti in `App.tsx` determina la sequenza:
```tsx
<GitConfigOnboarding />  {/* Shows first if needed */}
<IDEOnboarding />         {/* Shows only after Git is done */}
```

### No Skip Button

Mandatory onboarding steps have no skip. The primary button calls `completeOnboarding()` only after saving settings.

### Optimistic Updates with Rollback

Set state optimistically, rollback on error.

## When to Add New Onboarding Steps

Add when:
- Configuration is **mandatory** for app use
- It's a **one-time setup** (not recurring)
- Requires **user input** (cannot be auto-detected)

## Related Files

| File | Purpose |
|------|---------|
| `src/stores/ideStore.ts` | IDE onboarding state |
| `src/components/settings/IDEOnboarding.tsx` | IDE onboarding UI |
| `src/stores/gitConfigStore.ts` | Git config state |
| `src/components/settings/GitConfigOnboarding.tsx` | Git config UI |
| `src/App.tsx` | Onboarding sequence integration |
