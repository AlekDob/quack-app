---
type: bug_fix
created: 2026-02-06
tags: [startup, bootstrap, ui, welcome-screen, race-condition]
---

# Bug: Welcome Screen Flash Between Splash and Loaded UI

## Problem

Durante l'avvio dell'app, l'utente vedeva una sequenza scattosa:

```
Splash screen (duck) → Welcome screen ("What will you build today?") → UI completa con progetti
```

La welcome screen appariva per ~100-400ms come stato intermedio visibile, creando un'esperienza di caricamento non fluida.

## Root Cause

**Due bootstrap paralleli con race condition**:

1. **Bootstrap agenti** (`App.tsx:5654-5671`) — veloce (~50ms)
   - Caricava solo gli agenti dalla cartella `.claude/agents/`
   - **Chiamava `setBooting(false)` per primo** → sbloccava la UI
   - Ma `terminals` e `persistedProjects` erano ancora vuoti

2. **Bootstrap principale** (`App.tsx:6146-6374`) — lento (~200-500ms)
   - Caricava terminali, progetti, sessions da storage Tauri
   - Chiamava `setBooting(false)` anche lui (ma troppo tardi)

### Flusso prima del fix

```typescript
// Bootstrap agenti (veloce)
loadAgents() → setAgents([...]) → setBooting(false) ← SBLOCCA UI TROPPO PRESTO
                                                    ↓
                                 React render: terminals=[], persistedProjects=[]
                                                    ↓
                      Condizione riga 10301: `terminals.length === 0 && persistedProjects.size === 0`
                                                    ↓
                                         Welcome screen visible
                                                    ↓
// Bootstrap principale (lento)                     ↓
loadSavedAgents() → setTerminals([...]) → setPersistedProjects(...)
                                                    ↓
                                    Condizione diventa false → UI completa
```

### La condizione welcome screen

**`App.tsx:10301`**:
```tsx
{terminals.length === 0 && persistedProjects.size === 0 ? (
  /* Welcome screen: "What will you build today?" */
) : (
  /* UI normale con projects/terminals */
)}
```

Questa condizione era `true` perche' il bootstrap agenti sbloccava la UI prima che i progetti fossero caricati.

## Solution

**Una modifica, 7 righe rimosse**: il bootstrap agenti non controlla piu' `booting`.

**`App.tsx:5654-5661` (dopo)**:
```typescript
// Load agents in parallel with main bootstrap (non-blocking)
// booting/hasBootstrapped are controlled by main bootstrap only (line ~6355)
useEffect(() => {
  if (!tauriAvailable) return;
  console.log('[Startup] Loading agents...');
  void loadAgents().then(() => console.log('[Startup] Agents loaded'));
}, [tauriAvailable]);
```

**Rimosso**:
- `setBooting(false)` — ora solo nel bootstrap principale
- `setHasBootstrapped(true)` — idem

### Flusso dopo il fix

```typescript
// Bootstrap agenti (parallelo, non-blocking)
loadAgents() → setAgents([...]) → nessun effetto su `booting`

// Bootstrap principale (unico controller)
loadSavedAgents() → setTerminals([...]) → setPersistedProjects(...)
                                        ↓
                            setBooting(false) ← SBLOCCA UI QUI
                                        ↓
                React render: terminals=[...], persistedProjects=Map(...)
                                        ↓
         Condizione riga 10301: `false` (ha gia' dati) → UI completa
```

## Additional Polish

Allungato il fade-out dello splash per maggiore fluidita':

**`index.html:27`**:
```css
transition: opacity 0.8s cubic-bezier(0.4, 0, 0.2, 1); /* era 0.5s */
```

**`App.tsx:5262`**:
```typescript
setTimeout(() => appLoader.remove(), 800); // era 500
```

## Result

```
Prima:  splash (800ms) → welcome screen (100-400ms) → UI completa
Ora:    splash (800ms) → UI completa (transizione morbida)
```

Nessun flash intermedio, caricamento lineare e fluido.

## Files Modified

1. **`src/App.tsx`** (riga ~5654-5661) — rimozione `setBooting(false)` dal bootstrap agenti
2. **`index.html`** (riga 27) — fade-out splash da 0.5s → 0.8s
3. **`src/App.tsx`** (riga 5262) — timeout DOM removal da 500ms → 800ms

## Key Insight

**Non lasciare che bootstrap veloci sbloccino la UI prima che i dati critici siano pronti**. Se hai multiple async operations in parallelo, identifica quale e' il **gate keeper** (nel nostro caso: il bootstrap principale che carica progetti/terminali) e fai controllare `booting` solo a quello.
