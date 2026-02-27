# Implementation Plan: Claude Code Memory Settings

## Architecture Overview

Questa feature segue esattamente il pattern già stabilito per "Agent Teams" in `ClaudeCodeSettings.tsx`:
1. **Frontend** legge lo stato via `invoke('get_claude_settings_flag')`
2. **Frontend** scrive lo stato via `invoke('set_claude_settings_flag')`
3. **Rust** legge/scrive `~/.claude/settings.json` tramite `read_settings/write_settings`
4. Il setting `autoMemoryEnabled` è un campo top-level nel JSON (non sotto `env`)

### Flusso Dati

```
User toggles switch in Settings UI
    ↓
ClaudeCodeSettings.tsx → invoke('set_claude_settings_flag', { key: 'autoMemoryEnabled', value: true/false })
    ↓
hooks.rs → read_settings() → settings.other["autoMemoryEnabled"] = value → write_settings()
    ↓
~/.claude/settings.json updated: { "autoMemoryEnabled": false, ... }
    ↓
Claude Code SDK legge il file al prossimo lancio sessione
```

## Technology Choices

### Perché riusare `settings.other` (flatten HashMap)
La struct `ClaudeSettings` in `hooks.rs` ha `#[serde(flatten)] pub other: HashMap<String, serde_json::Value>`. Questo significa che `autoMemoryEnabled` viene serializzato/deserializzato automaticamente senza aggiungere un campo esplicito alla struct. Questo è il pattern più semplice e meno invasivo.

### Perché NON env var
Il setting `autoMemoryEnabled` di Claude Code è un campo top-level in `settings.json`, NON una env var sotto `env: {}`. L'env var `CLAUDE_CODE_DISABLE_AUTO_MEMORY` è un override separato. Scriviamo nel formato nativo del Claude Code.

## Components Affected

### 1. Rust Backend — `src-tauri/src/hooks.rs`
**Nuovi comandi Tauri:**
- `get_claude_settings_flag(key: String) -> Option<bool>` — legge un flag booleano da `settings.other`
- `set_claude_settings_flag(key: String, value: Option<bool>)` — scrive un flag booleano, rimuove se None

Questi comandi sono generici e riutilizzabili per altri flag futuri.

### 2. Rust Registration — `src-tauri/src/lib.rs`
Registrare i nuovi comandi nel `.invoke_handler()`.

### 3. Frontend — `src/components/settings/categories/ClaudeCodeSettings.tsx`
**Aggiungere:**
- Nuova `SectionHeader` "Memory" dopo "Experimental Features"
- `SettingsRow` con `IOSSwitch` per toggle autoMemory
- `SettingsRow` con button "Open Memory Folder"
- Path display della memory directory

### 4. Rust Backend — `src-tauri/src/fs.rs` (o nuovo comando)
**Aggiungere:**
- Comando `open_memory_folder(project_path: Option<String>)` per aprire il Finder alla directory memory
- Calcola il path: `~/.claude/projects/<hashed-project-path>/memory/`

## Design Decisions

### Memory Directory Path Calculation
Claude Code usa il git root come identificatore del progetto. Il path memory è:
`~/.claude/projects/<git-root-based-path>/memory/`

Per calcolare questo nel Rust, possiamo:
1. Usare il working directory corrente (passato dal frontend)
2. Trovare il git root (già implementato in `git.rs`)
3. Convertire in path relativo sotto `~/.claude/projects/`

**Nota**: Il formato esatto del path potrebbe variare. Dobbiamo verificare come Claude Code genera il path. Opzione safe: cercare la directory con un glob pattern.

### Error Handling
- Se `~/.claude/settings.json` non esiste → lo creiamo
- Se la memory directory non esiste → mostriamo messaggio "Memory not initialized"
- Se il file JSON è malformato → fallback a default (memory enabled)

## Security Considerations

- Nessun dato sensibile coinvolto (è solo un flag booleano)
- Il file `~/.claude/settings.json` è già letto/scritto dal sistema hooks

## Performance

- Lettura file JSON sincrona al caricamento del componente Settings (< 1ms)
- Nessun impatto sulle sessioni AI in corso

## Testing Strategy

- Manuale: toggle on → verifica in settings.json → lancio sessione → verifica comportamento
- Manuale: toggle off → verifica che Claude non salvi in auto-memory
- Manuale: pulsante Open Folder → verifica che Finder si apra
