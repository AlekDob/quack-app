---
type: pattern
project: quack-app
created: 2026-02-09
tags: [git, onboarding, first-run, windows, macos]
---

# Pattern: Git Config Onboarding (First-Run Setup)

## Overview

Sistema di onboarding obbligatorio che verifica e configura `user.name` e `user.email` di Git durante il primo avvio di Quack, sia su macOS che su Windows.

## Why This Pattern

- **Problema**: Gli utenti potrebbero non avere Git configurato, causando errori durante i commit
- **Soluzione**: Controllo obbligatorio al primo avvio, prima della selezione dell'IDE
- **Beneficio**: Esperienza utente fluida, configurazione completa fin dall'inizio

## Architecture

### 1. Backend (Rust)

**File**: `src-tauri/src/git.rs`

Due nuovi comandi Tauri:

```rust
#[tauri::command]
pub fn git_get_user_config() -> Result<GitUserConfig, String>

#[tauri::command]
pub fn git_set_user_config(name: String, email: String) -> Result<(), String>
```

**Struttura dati**:
```rust
#[derive(Serialize, Clone)]
pub struct GitUserConfig {
    pub name: Option<String>,
    pub email: Option<String>,
}
```

**Implementazione**:
- Usa `git config --global --get user.name` e `user.email` per leggere
- Usa `git config --global user.name "..."` e `user.email "..."` per scrivere
- Gestione errori con `anyhow::Result`

**Registrazione comandi**: Aggiunti in `src-tauri/src/lib.rs` nell'array `invoke_handler!`

### 2. Frontend State Management

**File**: `src/stores/gitConfigStore.ts`

Store Zustand separato da `gitStore.ts` (che gestisce staging/commits):

```typescript
export interface GitConfigState {
  hasCompletedOnboarding: boolean;
  userConfig: GitUserConfig | null;
  isChecking: boolean;

  checkGitConfig: () => Promise<void>;
  setGitConfig: (name: string, email: string) => Promise<void>;
  completeOnboarding: () => void;
}
```

**Persistenza**: Usa `zustand/middleware/persist` con chiave `quack-git-config`

**Auto-complete**: Se al check `user.name` e `user.email` sono già impostati, `hasCompletedOnboarding` diventa automaticamente `true`

### 3. UI Component

**File**: `src/components/settings/GitConfigOnboarding.tsx`

- Design coerente con `IDEOnboarding.tsx`
- Form con 2 campi: Full Name e Email Address
- Validazione: nome non vuoto, email contiene `@`
- Enter key per submit rapido
- Nessun pulsante "Skip" — configurazione obbligatoria
- Loading state durante il check iniziale
- Error handling con messaggio visibile

**CSS**: `src/components/settings/GitConfigOnboarding.css`
- Stile identico a `IDEOnboarding.css`
- `z-index: 10002` (più alto di IDE onboarding) per apparire per primo

### 4. Integration

**File**: `src/App.tsx`

```tsx
{/* Git Config Onboarding - FIRST */}
<GitConfigOnboarding />

{/* IDE Onboarding - SECOND */}
<IDEOnboarding />
```

## User Flow

1. **Primo avvio app**
2. `GitConfigOnboarding` si mostra (overlay fullscreen)
3. Controlla se `user.name` e `user.email` sono configurati
4. Se NO → mostra form (obbligatorio)
5. Utente inserisce nome ed email
6. Click "Continue" o Enter → salva in Git config globale
7. Overlay si chiude
8. `IDEOnboarding` si mostra (se non configurato)
9. Utente sceglie IDE preferito
10. Overlay si chiude
11. App pronta all'uso

## Key Features

### Mandatory Configuration
- Nessun pulsante "Skip"
- L'utente DEVE configurare Git prima di procedere
- Form disabled durante submit per evitare doppi submit

### Cross-Platform
- Funziona su **macOS** e **Windows**
- Usa comandi Git standard (`git config --global`)
- Gestione path e output multi-platform in Rust

### Error Handling
- Try/catch su frontend e backend
- Messaggi d'errore user-friendly
- Fallback graceful se Git non è installato (rare)

### Persistence
- Salva stato in localStorage via Zustand persist
- Se già configurato, non si mostra mai più
- Reset manuale possibile cancellando `quack-git-config` da localStorage

## Code Organization

```
src-tauri/src/
  git.rs                          # Nuovi comandi: git_get_user_config, git_set_user_config
  lib.rs                          # Registrazione comandi

src/
  stores/
    gitConfigStore.ts             # Store Zustand per config Git (separato da gitStore.ts)

  components/settings/
    GitConfigOnboarding.tsx       # Componente React onboarding
    GitConfigOnboarding.css       # Stile matching con IDEOnboarding

  App.tsx                         # Import e render GitConfigOnboarding PRIMA di IDEOnboarding
```

## Testing

### Manual Testing
1. Cancella localStorage: `quack-git-config`
2. Riavvia app
3. Verifica che appaia GitConfigOnboarding
4. Compila form con nome ed email
5. Click Continue
6. Verifica in terminale: `git config --global user.name` e `user.email`
7. Riavvia app → NON deve apparire più

### Debug Panel Testing (NEW)

**Opzione 1: Show Onboarding (Instant - NO restart)**
1. Apri Settings → Debug
2. Sezione "Onboarding Testing" → "Show onboarding dialogs immediately"
3. Click "Show Git Config" → onboarding appare SUBITO
4. Click "Show IDE Setup" → onboarding appare SUBITO
5. Completa il flow o ricarica l'app per ripristinare stato precedente

**Opzione 2: Reset Onboarding (Permanent - requires restart)**
1. Apri Settings → Debug
2. Sezione "Onboarding Testing" → "Reset onboarding state permanently"
3. Click "Reset Git Config" → conferma
4. Riavvia app → GitConfigOnboarding appare
5. Click "Reset IDE Setup" → conferma
6. Riavvia app → IDEOnboarding appare

**Utile per**:
- **Show**: Testing rapido, demo, QA iterativo (nessun riavvio)
- **Reset**: Testing completo del flusso from scratch (con riavvio)

### Edge Cases
- Git non installato → errore mostrato
- Email senza `@` → validazione blocca submit
- Nome vuoto → validazione blocca submit
- Già configurato (primo avvio) → skip automatico
- Reset da Debug Panel → NON fa auto-check, mostra sempre il form

## Future Enhancements

- [x] Debug panel buttons per reset onboarding (IMPLEMENTATO)
- [ ] Pre-compilazione form con valori esistenti (se presenti ma non completi)
- [ ] Link a documentazione Git se non installato
- [ ] Supporto per configurazione locale (per progetto) oltre a globale
- [ ] Migrazione da localStorage a file config (se necessario)

## Related Patterns

- `ide-onboarding-system.md` — Pattern simile per selezione IDE
- `first-run-experience.md` — Flow completo primo avvio (se esiste)

## Notes

- **Z-index**: Git onboarding ha `z-index: 10002`, IDE ha `10001` → Git sempre sopra
- **Store naming**: `gitConfigStore.ts` è separato da `gitStore.ts` (staging/commits)
- **Global config**: Usa `--global` perché è configurazione utente, non per progetto
- **No emoji**: Seguendo le UI guidelines di Quack
- **Manual reset flag**: `manuallyReset` flag previene auto-complete dopo reset da Debug Panel. Quando `true`, `checkGitConfig()` NON completa automaticamente l'onboarding anche se Git è configurato nel sistema.
