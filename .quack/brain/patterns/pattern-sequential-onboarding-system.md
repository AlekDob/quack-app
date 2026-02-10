---
type: pattern
project: quack-app
created: 2026-02-09
tags: [onboarding, first-run, setup, ui, zustand]
---

# Pattern: Sequential Onboarding System

Pattern per gestire una sequenza di onboarding steps al primo avvio di Quack.

## Architecture Overview

```
Splash Screen → Git Config Check → IDE Selection → Main App
                 (if needed)         (if needed)
```

Ogni step di onboarding è:
- **Indipendente**: ha il proprio store Zustand con flag di completamento
- **Condizionale**: si mostra solo se non completato
- **Sequenziale**: l'ordine è garantito dal rendering in `App.tsx`

## Existing Implementation: IDE Onboarding

### Store (`ideStore.ts`)

```typescript
interface IDEState {
  preferredIDE: string | null;
  hasCompletedOnboarding: boolean;
  // ...
}

const useIDEStore = create<IDEState>()(
  persist(
    (set, get) => ({
      hasCompletedOnboarding: false,
      completeOnboarding: () => set({ hasCompletedOnboarding: true }),
      // ...
    }),
    { name: 'ide-settings' }
  )
);

export const selectShouldShowOnboarding = (state: IDEState): boolean => {
  return !state.hasCompletedOnboarding && state.preferredIDE === null;
};
```

### Component (`IDEOnboarding.tsx`)

```typescript
export default function IDEOnboarding() {
  const shouldShow = useIDEStore(selectShouldShowOnboarding);

  if (!shouldShow) return null;

  return (
    <div className="onboarding-modal">
      {/* Fullscreen backdrop */}
      {/* Card with IDE selection */}
      {/* No skip button (obbligatorio) */}
    </div>
  );
}
```

### Integration (`App.tsx`)

```tsx
<IDEOnboarding />
```

Reso **dopo** lo splash screen ma **prima** dell'UI principale.

## Pattern for New Onboarding Steps

### 1. Create Zustand Store

```typescript
// stores/gitConfigStore.ts
interface GitConfigState {
  hasConfiguredGit: boolean;
  gitUserName: string | null;
  gitUserEmail: string | null;
  completeGitConfig: () => void;
}

const useGitConfigStore = create<GitConfigState>()(
  persist(
    (set) => ({
      hasConfiguredGit: false,
      gitUserName: null,
      gitUserEmail: null,
      completeGitConfig: () => set({ hasConfiguredGit: true }),
    }),
    { name: 'git-config' }
  )
);

export const selectShouldShowGitConfig = (state: GitConfigState): boolean => {
  return !state.hasConfiguredGit && (!state.gitUserName || !state.gitUserEmail);
};
```

### 2. Create Component

```typescript
// components/GitConfigOnboarding.tsx
export default function GitConfigOnboarding() {
  const shouldShow = useGitConfigStore(selectShouldShowGitConfig);

  if (!shouldShow) return null;

  return (
    <div className="onboarding-modal">
      {/* Same styling as IDEOnboarding */}
      {/* Form with name + email */}
      {/* No skip button */}
    </div>
  );
}
```

### 3. Integrate in App.tsx

```tsx
{/* Sequential rendering ensures correct order */}
<GitConfigOnboarding />  {/* First */}
<IDEOnboarding />         {/* Second */}
```

## Key Principles

### Independent Flags

Each onboarding step has its own persistence:
- `git-config` store → `hasConfiguredGit`
- `ide-settings` store → `hasCompletedOnboarding`

Nessun "orchestrator" centrale — ogni step decide autonomamente se mostrarsi.

### Render Order = Execution Order

L'ordine dei componenti in `App.tsx` determina la sequenza:
```tsx
<GitConfigOnboarding />  {/* Shows first if needed */}
<IDEOnboarding />         {/* Shows only after Git is done */}
```

Se Git non è configurato, `GitConfigOnboarding` si mostra (fullscreen backdrop blocca UI). Solo quando l'utente completa Git, il componente scompare e `IDEOnboarding` può apparire (se necessario).

### No Skip Button

Gli onboarding obbligatori (Git, IDE) non hanno "Skip" button. L'utente deve completare il setup prima di accedere all'app.

**Pattern**: il pulsante primario chiama `completeOnboarding()` solo **dopo** aver salvato le impostazioni.

### Optimistic Updates with Rollback

Pattern da `ideStore`:
```typescript
const setPreferredIDE = async (ideId: string) => {
  const previous = get().preferredIDE;
  set({ preferredIDE: ideId }); // Optimistic

  try {
    await invoke('ide_set_preferred', { ideId });
  } catch (error) {
    set({ preferredIDE: previous }); // Rollback
    throw error;
  }
};
```

## Styling Guidelines

### Fullscreen Backdrop

```css
.onboarding-modal {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Card Container

```css
.onboarding-card {
  background: var(--background-elevated);
  border-radius: 12px;
  padding: 32px;
  max-width: 600px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
}
```

### Typography

- Title: 24px, semibold
- Subtitle/instructions: 14px, muted color
- Input labels: 12px, uppercase, letter-spacing 0.5px

## Backend Pattern (Rust)

### Git Config Check

```rust
#[tauri::command]
pub fn git_check_global_config() -> Result<(Option<String>, Option<String>), String> {
    let name = run_git_global(&["config", "--global", "--get", "user.name"])
        .ok()
        .map(|s| s.trim().to_string());
    let email = run_git_global(&["config", "--global", "--get", "user.email"])
        .ok()
        .map(|s| s.trim().to_string());
    Ok((name, email))
}

#[tauri::command]
pub fn git_set_global_config(name: String, email: String) -> Result<(), String> {
    run_git_global(&["config", "--global", "user.name", &name])?;
    run_git_global(&["config", "--global", "user.email", &email])?;
    Ok(())
}

fn run_git_global(args: &[&str]) -> Result<String> {
    let output = Command::new("git")
        .args(args)
        .output()
        .context("Failed to execute git")?;

    if !output.status.success() {
        return Err(anyhow!("Git command failed"));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}
```

### IDE Detection Pattern

Già implementato in `ide_integration.rs`:
```rust
#[tauri::command]
pub fn ide_detect_installed() -> Result<Vec<InstalledIDE>, String> {
    // Platform-specific detection logic
}
```

## Testing Checklist

- [ ] Primo avvio (nessun store persisted) → mostra Git onboarding
- [ ] Git configurato, IDE non configurato → mostra solo IDE onboarding
- [ ] Entrambi configurati → nessun onboarding, vai diretto all'app
- [ ] Validazione form (email format, nome non vuoto)
- [ ] Error handling (Git command fallisce)
- [ ] Persistenza (riavvio app mantiene configurazione)
- [ ] Cross-platform (Mac e Windows)

## When to Add New Onboarding Steps

Aggiungi un onboarding step quando:
- La configurazione è **obbligatoria** per usare l'app (non opzionale)
- È una **one-time setup** (non ricorrente)
- Richiede **user input** (non può essere auto-detected o defaulted)

Esempi validi: Git config, IDE selection, license activation
Esempi non validi: feature tour, tips, configurazioni opzionali

## Related Files

| File | Purpose |
|------|---------|
| `src/stores/ideStore.ts` | IDE onboarding state |
| `src/components/settings/IDEOnboarding.tsx` | IDE onboarding UI |
| `src-tauri/src/ide_integration.rs` | IDE detection backend |
| `src-tauri/src/git.rs` | Git commands backend |
| `src/App.tsx` | Onboarding sequence integration |
