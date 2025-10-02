# Sistema Gestione Comandi Salvati e Processi Attivi

## Obiettivo
Implementare un sistema per salvare comandi frequenti (es. `npm run tauri:dev`), lanciarli rapidamente in nuovi terminali, e monitorare tutti i processi attivi con relative porte in un drawer dedicato.

## Use Case Principale
1. Utente salva comando `npm run tauri:dev` con nome "Dev Server"
2. Click su "Dev Server" → apre nuovo terminale ed esegue il comando
3. Drawer processi mostra: "Dev Server | :1420 | PID: 12345 | 🟢"
4. Click sulla porta → apre browser su localhost:1420
5. Click "Go to Terminal" → focus sul tab del terminale

## Architettura

### Backend (Rust)

#### Nuovo Modulo: `src-tauri/src/commands.rs`
Gestisce CRUD dei comandi salvati usando `tauri-plugin-store`.

**Strutture Dati**:
```rust
#[derive(Serialize, Deserialize, Clone)]
pub struct SavedCommand {
    pub id: String,           // UUID
    pub name: String,         // "Dev Server", "Build Prod", etc.
    pub command: String,      // "npm run tauri:dev"
    pub cwd: Option<String>,  // Directory di lavoro
    pub color: String,        // Colore badge (hex)
    pub category: String,     // "dev", "build", "test", "custom"
}

#[derive(Serialize, Clone)]
pub struct ProcessInfo {
    pub terminal_id: String,
    pub terminal_label: String,
    pub command: Option<String>,
    pub pid: Option<u32>,
    pub port: Option<u16>,
    pub uptime_seconds: u64,
    pub status: String,       // "running" | "idle"
}
```

**Comandi Tauri**:
- `load_saved_commands() -> Vec<SavedCommand>`
- `save_command(command: SavedCommand) -> Result<()>`
- `update_command(id: String, command: SavedCommand) -> Result<()>`
- `delete_command(id: String) -> Result<()>`
- `get_active_processes() -> Vec<ProcessInfo>`

**Storage**: `tauri-plugin-store` salva in `~/.quack-app/commands.json` (path app data macOS)

#### Estensione: `src-tauri/src/terminal.rs`
Aggiunge tracking processi e rilevamento porte.

**Modifiche a `TerminalSession`**:
```rust
struct TerminalSession {
    label: String,
    color: String,
    cwd: PathBuf,
    alive: bool,
    process: Option<TerminalProcess>,
    // NUOVO:
    command_origin: Option<String>,  // ID comando salvato che ha lanciato questo terminale
    started_at: SystemTime,          // Timestamp avvio
    detected_port: Option<u16>,      // Porta rilevata dinamicamente
}
```

**Modifiche a `TerminalProcess`**:
```rust
struct TerminalProcess {
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
    // NUOVO:
    pid: Option<u32>,  // PID processo
}
```

**Rilevamento Porte**:
1. **Parsing Output**: Monitor output terminale per pattern tipo:
   - `listening on port 1420`
   - `Server running at http://localhost:3000`
   - `Local: http://localhost:5173`
2. **Fallback `lsof`**: Su macOS, eseguire `lsof -nP -iTCP -sTCP:LISTEN -p <PID>` per ottenere porte in ascolto

**Nuovo Comando**:
- `get_terminal_process_info(id: String) -> ProcessInfo`

### Frontend (React + TypeScript)

#### Nuovo File: `src/types.ts` (estensione)
```typescript
export interface SavedCommand {
  id: string;
  name: string;
  command: string;
  cwd?: string;
  color: string;
  category: 'dev' | 'build' | 'test' | 'custom';
}

export interface ProcessInfo {
  terminalId: string;
  terminalLabel: string;
  command?: string;
  pid?: number;
  port?: number;
  uptimeSeconds: number;
  status: 'running' | 'idle';
}
```

#### Nuovo Componente: `src/components/SavedCommands.tsx`
Sezione nella sidebar per gestire comandi salvati.

**Features**:
- Lista comandi categorizzati (dev, build, test, custom)
- Badge colorato per ogni comando
- Hover actions: Play (launch), Edit, Delete
- Bottone "+ Nuovo Comando"
- Modal creazione/modifica con form:
  - Nome comando
  - Comando da eseguire (textarea)
  - Directory (opzionale, con picker Tauri dialog)
  - Colore (preset + color picker)
  - Categoria (dropdown)

**Interazione**:
- Click su comando → apre `NewTerminalModal` pre-compilato con dati del comando
- Opzione "Launch Now" → esegue immediatamente senza modal

#### Nuovo Componente: `src/components/ProcessesDrawer.tsx`
Drawer laterale che mostra tutti i processi attivi.

**Posizionamento**: Accanto alla sezione Git esistente (stesso livello gerarchico)

**Features**:
- Toggle button per aprire/chiudere drawer
- Lista processi attivi con card per ognuno:
  ```
  ┌─────────────────────────────┐
  │ 🟢 Dev Server               │
  │ npm run tauri:dev           │
  │ :1420 | PID: 12345 | ⏱️ 5m  │
  │ [Go to Terminal] [Open URL] │
  └─────────────────────────────┘
  ```
- Click porta → apre `http://localhost:<PORT>` in browser di sistema
- Click "Go to Terminal" → `setActiveTerminal(terminalId)` per focus
- Badge stato (🟢 running / 🟡 idle)
- Auto-refresh ogni 3 secondi

**Animazioni**:
- Slide-in drawer da destra
- Smooth transitions con CSS

#### Modifiche: `src/App.tsx`
**Nuovo State**:
```typescript
const [savedCommands, setSavedCommands] = useState<SavedCommand[]>([]);
const [activeProcesses, setActiveProcesses] = useState<ProcessInfo[]>([]);
const [processesDrawerOpen, setProcessesDrawerOpen] = useState(false);
```

**Polling Processi**:
```typescript
useEffect(() => {
  const interval = setInterval(async () => {
    const processes = await invoke<ProcessInfo[]>('get_active_processes');
    setActiveProcesses(processes);
  }, 3000); // ogni 3s

  return () => clearInterval(interval);
}, []);
```

**Caricamento Comandi**:
```typescript
useEffect(() => {
  invoke<SavedCommand[]>('load_saved_commands').then(setSavedCommands);
}, []);
```

### Styling (CSS)

#### `src/App.css` - Nuove Classi

**SavedCommands Section**:
```css
.saved-commands {
  padding: 1rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.saved-command-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}

.saved-command-item:hover {
  background: rgba(255, 255, 255, 0.05);
}

.command-color-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}

.command-actions {
  display: none;
  gap: 0.3rem;
  margin-left: auto;
}

.saved-command-item:hover .command-actions {
  display: flex;
}
```

**ProcessesDrawer**:
```css
.processes-drawer {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 350px;
  background: rgba(24, 26, 33, 0.95);
  backdrop-filter: blur(20px);
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  transform: translateX(100%);
  transition: transform 0.3s ease;
  z-index: 100;
  overflow-y: auto;
}

.processes-drawer.open {
  transform: translateX(0);
}

.process-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 0.75rem;
}

.process-port-link {
  color: #4ecdc4;
  text-decoration: none;
  cursor: pointer;
}

.process-port-link:hover {
  text-decoration: underline;
}
```

## Flow di Implementazione

### Fase 1: Backend Rust
1. Creare `src-tauri/src/commands.rs` con strutture dati e CRUD
2. Implementare storage con `tauri-plugin-store`
3. Estendere `TerminalSession` e `TerminalProcess` in `terminal.rs`
4. Implementare rilevamento porte (parsing + lsof)
5. Aggiungere comando `get_active_processes()`
6. Registrare tutti i comandi in `lib.rs`

### Fase 2: Frontend Components
1. Creare `SavedCommands.tsx` con lista e modal
2. Creare `ProcessesDrawer.tsx` con card processi
3. Estendere `types.ts` con nuove interfacce
4. Integrare componenti in `App.tsx`
5. Implementare polling automatico processi

### Fase 3: Styling e UX
1. Aggiungere CSS per SavedCommands
2. Aggiungere CSS per ProcessesDrawer con animazioni
3. Testare interazioni (launch, edit, delete, drawer toggle)
4. Testare rilevamento porte su processi reali

## Testing

### Test Manuali
1. **Salvataggio Comando**:
   - Creare comando "Dev Server" con `npm run dev`
   - Verificare persistenza dopo riavvio app

2. **Launch Comando**:
   - Click su comando salvato
   - Verificare apertura terminale e esecuzione

3. **Rilevamento Porta**:
   - Lanciare `npm run tauri:dev` (Vite su :1420)
   - Verificare che drawer mostri porta correttamente
   - Click su porta → verifica apertura browser

4. **Tracking Processi**:
   - Aprire 3 terminali con comandi diversi
   - Verificare che drawer mostri tutti e 3
   - Testare "Go to Terminal" per focus corretto

### Edge Cases
- Comando con path non esistente → mostrare errore
- Processo senza porta rilevabile → mostrare solo PID
- Terminale chiuso manualmente → rimuovere da lista processi
- Porta già in uso → gestire errore del comando

## Deliverables

✅ **Backend**:
- `src-tauri/src/commands.rs` (nuovo)
- `src-tauri/src/terminal.rs` (modificato)
- `src-tauri/src/lib.rs` (registrazione comandi)

✅ **Frontend**:
- `src/components/SavedCommands.tsx` (nuovo)
- `src/components/ProcessesDrawer.tsx` (nuovo)
- `src/types.ts` (esteso)
- `src/App.tsx` (integrazione)

✅ **Styling**:
- `src/App.css` (nuove classi)

✅ **Documentazione**:
- Questo file `summary.md`
- Aggiornamento `CLAUDE.md` con nuove features

## Note Tecniche

### Rilevamento Porte - Dettagli
**Regex Patterns** (da applicare all'output del terminale):
```regex
- /listening on (?:port )?(\d+)/i
- /server running at .*:(\d+)/i
- /local.*http:\/\/localhost:(\d+)/i
- /http:\/\/127\.0\.0\.1:(\d+)/i
```

**Comando lsof** (fallback su macOS):
```bash
lsof -nP -iTCP -sTCP:LISTEN -p <PID> | awk 'NR>1 {print $9}' | cut -d':' -f2
```

### Storage Path
`tauri-plugin-store` salva in:
- **macOS**: `~/Library/Application Support/com.quack.app/commands.json`
- Accessibile con `Store::new("commands.json")`

### Performance
- Polling processi ogni 3s è accettabile (operazione leggera)
- Parsing output terminale è evento-driven (no overhead)
- lsof viene chiamato solo una volta all'avvio processo + al refresh manuale

---

**Status**: 📋 Piano completato - Ready for implementation
**Ultima modifica**: 2025-10-02
