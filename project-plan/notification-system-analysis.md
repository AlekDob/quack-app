# Analisi Sistema di Notifiche TerminalFlow
## Report Completo - 14 Ottobre 2025

*Documento preparato da Mike - Project Manager*

---

## 📊 STATO ATTUALE DEL SISTEMA

### 1. OVERVIEW ARCHITETTURA NOTIFICHE

Il sistema di notifiche di TerminalFlow è un sistema complesso e multi-layered che coordina:
- **Notifiche Desktop** (Tauri plugin-notification)
- **Audio Feedback** ("quack" sound via Web Audio API)
- **Visual Feedback** (pulsing dots, badges, progress bars)
- **Status Management** (busy/idle states con timer multipli)
- **External Integration** (HTTP endpoint per Claude Code hooks)

### 2. COMPONENTI PRINCIPALI

#### 2.1 Frontend (React/TypeScript)

**File principale: `src/App.tsx`**

##### Stati e Timers:
```typescript
// 3 tipi di timer separati per gestire diversi aspetti:
- idleTimersRef: Timer per activity bar (5 secondi)
- notificationTimersRef: Timer per notifiche desktop (60 secondi)
- visualIdleTimersRef: Anti-flickering delay (400ms)

// Costanti temporali:
IDLE_TIMEOUT_MS = 5000           // Activity bar response
NOTIFICATION_TIMEOUT_MS = 60000  // Desktop notification delay
VISUAL_IDLE_DELAY_MS = 400      // Anti-flickering delay
```

##### Stato Terminal:
```typescript
interface TerminalInfo {
  status?: "idle" | "busy"
  needsAttention?: boolean       // Mostra pulsing se true
  hasResponded?: boolean         // Ha già risposto a questo prompt
  responseStartTime?: number     // Timestamp inizio lavoro
}
```

#### 2.2 Backend (Rust/Tauri)

**HTTP Endpoint: `src-tauri/src/lib.rs`**
- Porta: 6768 (localhost only)
- Endpoint: `/terminal/status`
- Metodo: POST
- Payload:
```json
{
  "id": "Terminal ID or Label",
  "status": "busy" | "idle",
  "notify": true/false  // Optional, default true
}
```

#### 2.3 Visual Components

**TerminalActivityBar (`src/components/TerminalActivityBar.tsx`)**
- Dot colorato con animazione pulsing quando busy
- Status badge: ⚡ (busy) o ✓ (idle)
- Progress bar animata durante attività
- Delay di 1 secondo prima di confermare idle (anti-flickering)

---

## 🔄 FLUSSO DEGLI EVENTI

### Scenario 1: Input Utente → Terminal Busy
1. Utente invia comando nel terminal
2. `handleTerminalInput` triggera `markTerminalBusy()`
3. Cancella tutti i timer esistenti
4. Imposta `status: "busy"`, `needsAttention: false`
5. Visual: dot pulsa, badge mostra ⚡, progress bar appare

### Scenario 2: Terminal Output → Idle Detection
1. Dati arrivano via evento `terminal-data`
2. Sistema accumula output in buffer (300ms chunks)
3. Controlla se contiene prompt (es. `$`, `>`, `%`)
4. Se prompt trovato:
   - Schedule `visualIdleTimer` (400ms delay)
   - Dopo delay: imposta `status: "idle"`
   - Schedule `notificationTimer` (60 secondi)
5. Visual: dot smette di pulsare, badge mostra ✓

### Scenario 3: Notifica Desktop (dopo 60 secondi idle)
1. `notificationTimer` scade dopo 60 secondi
2. Controlla condizioni:
   - Terminal è ancora idle?
   - `hasResponded === false`? (prima risposta)
   - Tempo dall'ultimo busy > 5 secondi?
3. Se tutte le condizioni sono vere:
   - Play "quack" sound (0.6 volume)
   - Mostra toast in-app (sonner)
   - Invia notifica desktop (se permessi OK)
   - Imposta `needsAttention: true` (pulsing visual)

### Scenario 4: Claude Code Hook Integration
1. Hook esterno fa POST a `http://127.0.0.1:6768/terminal/status`
2. Backend emette evento `external-terminal-status`
3. Frontend:
   - Risolve terminal per ID o label
   - Aggiorna status (busy/idle)
   - Può sopprimere notifica se `notify: false`

---

## 🎯 CONDIZIONI PER LE NOTIFICHE

### Notifica viene triggerata quando:
✅ Terminal diventa idle dopo essere stato busy
✅ Sono passati 60 secondi di inattività
✅ `hasResponded === false` (non ha ancora notificato per questo prompt)
✅ Terminal non è quello attualmente attivo (o `NOTIFY_ACTIVE_TERMINAL = true`)
✅ Tempo dall'ultimo busy > 5 secondi (anti-spam)

### Notifica NON viene triggerata quando:
❌ Terminal è ancora busy
❌ `hasResponded === true` (già notificato)
❌ Meno di 60 secondi di inattività
❌ `notify: false` nel payload hook esterno

---

## 🎨 FEEDBACK VISIVO

### Stati Visuali:
1. **Busy (IN ESECUZIONE)**
   - Dot colorato con animazione `dotPulse` (1.5s loop)
   - Badge ⚡ (fulmine)
   - Progress bar animata sotto il nome

2. **Idle (PRONTO)**
   - Dot colorato statico
   - Badge ✓ (check)
   - Nessuna progress bar

3. **Needs Attention**
   - Se idle + background terminal
   - Animazione pulsing aggiuntiva
   - Rimossa quando utente seleziona terminal

### Anti-Flickering System:
- 400ms delay prima di mostrare idle visualmente
- 1 secondo delay in `TerminalActivityBar` per conferma status
- Previene sfarfallamento durante output pesanti (Claude Code, etc.)

---

## 📋 AREE MIGLIORABILI

### 1. Configurabilità
- **Timer personalizzabili**: Permettere all'utente di modificare i tempi (5s, 60s, 400ms)
- **Volume audio**: Slider per volume notifica (ora fisso a 0.6)
- **Suoni personalizzati**: Permettere di caricare suoni custom
- **Disabilitare per terminal specifici**: Blacklist di terminal che non devono notificare

### 2. Intelligenza Notifiche
- **Smart detection**: Riconoscere pattern di output oltre ai prompt
- **Contesto-aware**: Diversi comportamenti per diversi tipi di comandi
- **Batch notifications**: Raggruppare notifiche multiple
- **Priority levels**: Notifiche urgenti vs informative

### 3. UI/UX Improvements
- **Notification center**: Storia delle notifiche passate
- **Quick actions**: Bottoni nelle notifiche per azioni rapide
- **Status timeline**: Visualizzare storia busy/idle di un terminal
- **Global mute**: Bottone per silenziare temporaneamente tutto

### 4. Integration Enhancement
- **Webhook support**: Oltre a HTTP, supportare webhooks
- **More hook events**: Non solo status, ma anche progress, errors, etc.
- **API authentication**: Token/key per endpoint HTTP
- **Bi-directional communication**: Terminal può rispondere ai hook

### 5. Performance
- **Debouncing migliorato**: Ottimizzare accumulo output
- **Memory management**: Pulire buffer vecchi più aggressivamente
- **React optimization**: Memoization per ridurre re-render
- **Batch state updates**: Raggruppare update di stato

---

## ❓ DOMANDE PER ALEK

Per capire meglio cosa vuoi modificare, ho bisogno di sapere:

### Priorità Alta:
1. **Cosa ti infastidisce di più** del sistema attuale?
   - Le notifiche sono troppo frequenti/rare?
   - Il timing non è giusto?
   - Il suono è fastidioso?

2. **Quali nuove funzionalità vorresti**?
   - Configurazione personalizzata dei timer?
   - Diversi tipi di notifiche per diversi eventi?
   - Integrazione con altri tool oltre Claude Code?

### Priorità Media:
3. **Come vorresti gestire le notifiche**?
   - Vuoi un notification center/storia?
   - Vuoi poter silenziare temporaneamente?
   - Vuoi notifiche diverse per terminal diversi?

4. **Feedback visivo**:
   - Le animazioni sono troppo/poco evidenti?
   - Vuoi altri indicatori di stato?
   - Colori/icone diverse per stati diversi?

### Priorità Bassa:
5. **Integrazioni esterne**:
   - Quali altri tool dovrebbero poter inviare status?
   - Serve autenticazione per l'endpoint?
   - Altri tipi di eventi oltre busy/idle?

---

## 🚀 POSSIBILI QUICK WINS

Modifiche semplici che possiamo fare subito:

1. **Aggiungere preferences per timer** in `preferences.rs`
2. **Toggle globale notifiche** nel menu Quack
3. **Volume slider** per il suono quack
4. **Blacklist terminal** per escludere specifici agent
5. **Test notification button** per provare suono/notifica

---

## 📊 METRICHE ATTUALI

- **Delay activity bar**: 5 secondi
- **Delay notifica**: 60 secondi
- **Anti-flicker delay**: 400ms
- **Volume quack**: 0.6 (60%)
- **Porta HTTP**: 6768
- **Buffer accumulo**: 300ms chunks

---

*Questo report è stato preparato analizzando il codice esistente senza proporre nuove implementazioni, come richiesto per un progetto EXISTING.*

**Prossimi passi**: Attendo le tue risposte alle domande sopra per capire esattamente quali adattamenti vuoi implementare nel sistema di notifiche.

---

*Mike - Project Manager*
*Quack Agency*