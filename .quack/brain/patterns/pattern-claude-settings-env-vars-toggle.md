---
type: pattern
project: quack-app
created: 2026-02-06
tags: [settings, claude-code, experimental-features, env-vars]
---

# Pattern: Claude Settings Env Vars Toggle

## Contesto

Claude Code Agent SDK 0.2.32+ supporta Agent Teams (swarm mode) come feature sperimentale, abilitabile via env var `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1` nel file `~/.claude/settings.json`.

Quack permette agli utenti di abilitare/disabilitare questa e altre feature sperimentali via UI, scrivendo direttamente nel settings.json invece di dover editare manualmente il file.

## Implementazione

### Backend Rust (hooks.rs)

Aggiunti due comandi Tauri per gestire il campo `env` nel settings.json:

```rust
#[tauri::command]
pub fn get_claude_env_vars() -> Result<HashMap<String, String>, String>

#[tauri::command]
pub fn set_claude_env_var(key: String, value: Option<String>) -> Result<(), String>
```

**Come funziona:**
- La struct `ClaudeSettings` ha già `#[serde(flatten)] pub other: HashMap<String, serde_json::Value>` che preserva campi sconosciuti
- `get_claude_env_vars` legge `settings.other.get("env")` e deserializza le stringhe
- `set_claude_env_var` con `value: None` rimuove la chiave; se `env` diventa vuoto, rimuove l'intero oggetto `env`

### Frontend (ClaudeCodeSettings.tsx)

Aggiunta nuova sezione **"Experimental Features"** con:
- Toggle IOSSwitch per Agent Teams
- `useState` + `useEffect` per caricare lo stato da Rust all'avvio
- Optimistic update con rollback in caso di errore

```tsx
const handleToggleAgentTeams = async (enabled: boolean) => {
  setAgentTeamsEnabled(enabled);
  try {
    await invoke('set_claude_env_var', {
      key: 'CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS',
      value: enabled ? '1' : null,
    });
  } catch (err) {
    // Rollback on error
    setAgentTeamsEnabled(!enabled);
  }
};
```

### Struttura settings.json

Quando attivo:
```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  }
}
```

Quando disattivo:
```json
{
  // campo "env" rimosso completamente se vuoto
}
```

## Pattern Estendibile

Questo pattern è generico per **qualsiasi env var sperimentale**. Per aggiungere un nuovo toggle:

1. **Frontend**: aggiungi una nuova `SettingsRow` nella sezione "Experimental Features"
2. **Logica**: usa `get_claude_env_vars` e `set_claude_env_var` con la chiave env appropriata
3. **Nessuna modifica al Rust**: il backend già gestisce env vars arbitrarie

## Quando Usare

- Feature sperimentali Claude Code che richiedono env var
- Configurazioni che vanno scritte in `~/.claude/settings.json`
- Toggle che devono persistere tra sessioni e funzionare anche fuori da Quack (CLI diretta)

## Vantaggi

1. **Zero Code Changes Policy**: nuove env vars non richiedono modifiche al backend
2. **UI-Driven**: utenti non devono sapere dove si trova settings.json
3. **Pulizia automatica**: rimuove `env` vuoto per evitare inquinamento del file
4. **Rollback**: errori di scrittura non lasciano UI in stato inconsistente
5. **Cross-compatible**: le env var funzionano anche quando si usa Claude Code CLI direttamente

## Trigger

Quando Claude Code introduce una nuova feature sperimentale controllata da env var, aggiungi un toggle in questa sezione settings invece di chiedere agli utenti di editare il JSON manualmente.
