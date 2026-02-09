---
type: pattern
project: quack-app
created: 2026-02-09
tags: [onboarding, prerequisites, git, nodejs, claude-cli, windows, macos]
---

# Pattern: Prerequisites Check Onboarding

## Overview

Sistema di verifica prerequisiti che controlla l'installazione di Git, Node.js e Claude CLI prima del primo avvio di Quack. Appare come PRIMO step dell'onboarding, prima della configurazione Git e selezione IDE.

## Why This Pattern

- **Problema**: Utenti potrebbero non avere i tool necessari installati
- **Soluzione**: Check automatico + installazione guidata con link download
- **Beneficio**: Setup completo garantito, meno supporto richiesto

## Architecture

### Ordine Onboarding

```
1. PrerequisitesCheck (z-index: 10003) → PRIMO
2. GitConfigOnboarding (z-index: 10002) → SECONDO
3. IDEOnboarding (z-index: 10001) → TERZO
```

### 1. Backend (Rust)

**File**: `src-tauri/src/prerequisites.rs`

```rust
#[derive(Serialize)]
pub struct PrerequisiteStatus {
    name: String,
    installed: bool,
    version: Option<String>,
    download_url: Option<String>,
}

#[derive(Serialize)]
pub struct PrerequisitesCheck {
    git: PrerequisiteStatus,
    nodejs: PrerequisiteStatus,
    claude_cli: PrerequisiteStatus,
    all_installed: bool,
}

#[tauri::command]
pub fn check_prerequisites() -> Result<PrerequisitesCheck, String>

#[tauri::command]
pub fn install_claude_cli() -> Result<String, String>
```

**Come funziona**:
- `check_git()`: Esegue `git --version` → parse version
- `check_nodejs()`: Esegue `node --version` → parse version
- `check_claude_cli()`: Esegue `npm list -g @anthropic-ai/claude-code` → parse version
- `install_claude_cli()`: Esegue `npm install -g @anthropic-ai/claude-code`

### 2. Frontend State Management

**File**: `src/stores/prerequisitesStore.ts`

```typescript
export interface PrerequisitesState {
  hasCompletedOnboarding: boolean;
  prerequisites: PrerequisitesCheck | null;
  isChecking: boolean;
  isInstalling: boolean;

  checkPrerequisites: () => Promise<void>;
  installClaudeCLI: () => Promise<void>;
  completeOnboarding: () => void;
  resetOnboarding: () => void;
}
```

**Auto-complete**: Se `all_installed = true` → `hasCompletedOnboarding = true`

### 3. UI Component

**File**: `src/components/settings/PrerequisitesCheck.tsx`

Features:
- Check automatico al mount
- Lista prerequisiti con status icon (✓ verde / ✗ rossa)
- Versione mostrata se installato
- Bottone "Download" per Git e Node.js → apre link esterno
- Bottone "Install" per Claude CLI → esegue `npm install -g`
- Bottone "Re-check" per ricontrollare dopo installazioni manuali
- Bottone "Continue" abilitato solo se `all_installed = true`

**CSS**: `src/components/settings/PrerequisitesCheck.css`
- Design coerente con Git/IDE onboarding
- Stati "installed" (verde) e "missing" (rosso)
- Loading spinner durante check e install

### 4. Integration

**File**: `src/App.tsx`

```tsx
{/* Prerequisites Check - FIRST */}
<PrerequisitesCheck />

{/* Git Config Onboarding - SECOND */}
<GitConfigOnboarding />

{/* IDE Onboarding - THIRD */}
<IDEOnboarding />
```

## User Flow

1. **Primo avvio** → `PrerequisitesCheck` appare
2. **Check automatico** → Verifica Git, Node.js, Claude CLI
3. **Scenario A - Tutto installato**:
   - Tutti ✓ verdi → Auto-complete → Passa a GitConfigOnboarding
4. **Scenario B - Qualcosa manca**:
   - ✗ rossi → Mostra link "Download" o bottone "Install"
   - Utente installa manualmente o via npm
   - Click "Re-check" → Rivela installazione
   - Click "Continue" → Passa a GitConfigOnboarding

## Prerequisites Details

### Git
- **Check**: `git --version`
- **Missing**: Link a https://git-scm.com/downloads
- **Required**: Sì (obbligatorio per Quack)

### Node.js
- **Check**: `node --version`
- **Missing**: Link a https://nodejs.org/
- **Required**: Sì (per Claude CLI e npm)

### Claude CLI
- **Check**:
  1. Primary: `claude --version` (rileva tutte le installazioni in PATH)
  2. Fallback: `npm list -g @anthropic-ai/claude-code --depth=0` (npm global)
- **Missing**: Bottone "Install" → `npm install -g @anthropic-ai/claude-code`
- **Required**: Sì (core di Quack)
- **Disabilitato se**: Node.js non installato
- **Note**: Supporta installazioni locali (`.local/bin/`) e npm global

## Debug Panel

Settings → Debug → "Onboarding Testing":

**Show (Instant)**:
- "Show Prerequisites" → Appare subito senza restart

**Reset (Permanent)**:
- "Reset Prerequisites" → Reset permanente (richiede restart)

## Testing

### Manual Test
1. Disinstalla uno dei tool (es. Claude CLI: `npm uninstall -g @anthropic-ai/claude-code`)
2. Cancella localStorage: `quack-prerequisites`
3. Riavvia app
4. Verifica che appaia PrerequisitesCheck con ✗ rosso
5. Click "Install" per Claude CLI
6. Verifica che diventi ✓ verde
7. Click "Continue" → passa a GitConfigOnboarding

### Edge Cases
- Git non installato → Link download
- Node.js non installato → Link download + Claude CLI disabled
- Claude CLI non installato → Install via npm
- Tutti installati → Auto-complete skip

## Cross-Platform

- ✅ **Windows**: Comandi Git/Node/npm standard
- ✅ **macOS**: Comandi Git/Node/npm standard
- ✅ **Linux**: Comandi Git/Node/npm standard (non testato ma dovrebbe funzionare)

## Key Features

### Auto-Install Claude CLI
- Usa npm per installare automaticamente
- Loading spinner durante installazione
- Error handling con messaggio user-friendly

### Smart Continue Button
- Abilitato solo se `all_installed = true`
- Visual feedback chiaro (disabled state)

### Re-check Button
- Utile dopo installazioni manuali
- Permette di rivalidare senza restart

## Code Organization

```
src-tauri/src/
  prerequisites.rs            # Check e install logic

src/
  stores/
    prerequisitesStore.ts     # Zustand store con persist

  components/settings/
    PrerequisitesCheck.tsx    # UI component
    PrerequisitesCheck.css    # Styling

  App.tsx                     # Render PRIMA di Git/IDE onboarding
```

## Future Enhancements

- [ ] Check versione minima richiesta (es. Node.js >= 18)
- [ ] Supporto per package manager alternativi (yarn, pnpm)
- [ ] Auto-install anche Git e Node.js (richiede permessi admin)
- [ ] Link a troubleshooting docs se check fallisce
- [ ] Supporto offline (cache dello stato)

## Related Patterns

- `git-config-onboarding.md` — Step successivo dopo prerequisites
- `ide-onboarding-system.md` — Step finale del setup

## Notes

- **Z-index massimo**: 10003 → appare sopra tutti gli altri onboarding
- **Mandatory**: Nessun skip possibile, tutti i tool devono essere installati
- **Claude CLI specifico**: Solo questo viene installato automaticamente via npm
- **Cross-platform**: Usa comandi standard disponibili su tutti gli OS
