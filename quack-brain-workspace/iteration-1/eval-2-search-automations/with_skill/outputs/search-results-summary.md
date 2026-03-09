---
type: search-summary
project: quack-app
date: 2026-03-08
query: "cosa sappiamo sulle automazioni"
---

# Ricerca Brain - Sistema di Automazioni

## Fonti consultate (Access Chain)

1. CLAUDE.md - Knowledge Base section (riferimenti a gotchas e patterns)
2. `documentation/map.md` - Architettura generale
3. `documentation/patterns/pattern-automation-layer.md`
4. `documentation/guide/automations/overview.md`
5. `documentation/gotchas/gotcha-automation-scheduler-log-spam.md`
6. `documentation/gotchas/gotcha-automation-job-provider-not-passed.md`
7. `documentation/bugs/fix-automation-job-fires-repeatedly.md`
8. `documentation/bugs/fix-automation-session-title-missing.md`
9. `~/.quack/brain/` - nessun file specifico sulle automazioni trovato

---

## Architettura del Sistema

### Flusso generale

```
Rust Scheduler (tokio 30s tick + cron crate)
  --> emits `automation-scheduler-tick` Tauri event
  --> App.tsx GLOBAL listener (sempre montato) controlla nextRunAt di tutti i job abilitati
  --> Se il job è in scadenza: markJobRunning → advance nextRunAt → createSession → sendMessage
  --> La sessione appare sotto l'agente nella sidebar con titolo [Auto] <job name>
```

### Storage
- File: `quack-automations.json` (Tauri Store JSON)
- Zustand store: `src/stores/automationStore.ts`
- Service: `src/services/automationStorage.ts`
- Cron parsing: `src/services/cronUtils.ts`

### Tipo principale (`src/types.ts`)

```ts
interface AutomationJob {
  id: string;
  name: string;
  agentId: string;
  projectPath: string;
  cronExpression: string;
  prompt: string;
  enabled: boolean;
  provider?: LLMProviderType;  // aggiunto post-bugfix
  model?: string;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}
```

### Componenti Frontend

| Componente | Ruolo |
|-----------|-------|
| `AutomationView` | Vista principale con lista job + history (solo UI, no tick) |
| `AutomationJobCard` | Card singolo job con toggle enable/disable |
| `AutomationJobForm` | Form modale creazione/modifica job |
| `CronPresetInput` | Input cron con preset (daily, weekday, weekly, monthly, ogni 6h) |
| `AutomationHistoryList` | Timeline delle esecuzioni passate |
| `AutomationTabView` | Tab wrapper (pattern singleton come `useKanbanTab`) |

### Backend Rust (`src-tauri/src/automation.rs`)
- Usa crate `cron = "0.12"` per parsing delle espressioni
- Loop tokio interval (30s) emette evento al frontend
- Timestamp con `chrono::Local` (timezone utente, non UTC)

---

## Gotchas Critici

### 1. Log Spam all'avvio (`gotcha-automation-scheduler-log-spam`)

**Sintomo**: Avviando `npm run dev`, la console viene inondata di `[Automation] Scheduler already running`.

**Causa**: Il `useEffect` in `App.tsx` che chiama `invoke('start_automation_scheduler')` ha dipendenze instabili (`createSession`, `sendMessageForTargetAgent` sono `useCallback` la cui identità cambia ad ogni render).

**Fix applicato**: `log::info!` → `log::debug!` in `automation.rs:97`.

**Fix profondo (differito)**: Stabilizzare le deps dell'effect con `useRef`, o spostare lo start dello scheduler in un effect separato con `[]` deps.

**File**: `src-tauri/src/automation.rs:97`, `src/App.tsx:9208-9331`

---

### 2. Provider non passato al job (`gotcha-automation-job-provider-not-passed`)

**Sintomo**: Un job con modello Ollama parte con il modello sbagliato (es. Opus 4.6) o mostra "model not found".

**Causa**: `AutomationJob` non aveva il campo `provider`. `sendMessageForTargetAgent` leggeva il provider globale da `settingsStore`, che per Anthropic non sapeva risolvere `kimi-k2.5:cloud`.

**Fix (2026-02-27)**:
- Aggiunto `provider?: LLMProviderType` a `AutomationJob`
- `AutomationJobForm` salva `provider` insieme a `model`
- `ChatSendOptions` accetta `provider?: LLMProviderType`
- Entrambi i fire path (manuale + scheduler) passano model e provider

**Regola chiave**: Qualsiasi feature che crea sessioni programmaticamente (automation, remote execute, webhooks) DEVE passare sia model che provider.

**ATTENZIONE - Duplicazione codice**: La logica di fire è duplicata in App.tsx:
- `handleAutomationFireJob` (~line 9163) — pulsante "Fire Now" manuale
- Scheduler tick listener (~line 9251) — cron automatico
Ogni fix deve essere applicato a ENTRAMBI. Sarebbe utile estrarre un `executeAutomationJob()` condiviso.

---

## Bug Risolti

### 3. Job non scatta / scatta in loop (`fix-automation-job-fires-repeatedly`)

**Problema 1 - Job non scatta mai**: Il listener `automation-scheduler-tick` era dentro `AutomationView.tsx` che si smonta quando si cambia tab. I tick venivano persi. Al ritorno nel tab, `initialize()` ricalcolava `nextRunAt` e saltava all'esecuzione successiva.

**Fix 1**: Spostato il listener + fire logic in un `useEffect` in `App.tsx` (sempre montato). `AutomationView` gestisce solo UI (CRUD, form, history).

**Problema 2 - Job scatta ogni 30s**: `fireJob()` non ricalcolava `nextRunAt` dopo l'esecuzione. Ogni tick trovava `now >= nextRunAt` vero.

**Fix 2**: Dopo `markJobRunning()`, calcola immediatamente il nuovo `nextRunAt` con `getNextFireTime(job.cronExpression)` (non-inclusive) e persiste via `updateJob()`.

**Fix aggiuntivi**:
- `initialize()`: ricalcola `nextRunAt` solo se undefined o nel passato (preserva timestamp futuri)
- `getNextFireTime()`: aggiunto parametro `inclusive` — `true` alla creazione, `false` dopo il fire
- `CronPresetInput`: "Every 6 hours" non si sovrappone più con "Every day"

---

### 4. Sessioni automation create con titolo "Untitled" (`fix-automation-session-title-missing`)

**Sintomo**: Le sessioni create dai job appaiono come "Untitled" nella sidebar invece di `[Auto] <job name>`.

**Causa**: Race condition tra `store.reload()` e `store.save()` nel plugin Tauri Store:
1. `createSession()` chiama `store.set(sessions)` (cache in-memory)
2. `store.save()` flushes su disco (async)
3. Prima che il save completi, il polling chiama `store.reload()`
4. `store.reload()` legge i dati stale dal disco e sovrascrive la cache in-memory
5. Il prossimo `store.save()` scrive i dati stale — titolo e status persi definitivamente

Il meccanismo `sessionWriteLock` con `shouldSkipReload()` esisteva ma non era mai chiamato.

**Fix (2026-03-03)**:
- Layer 1: Collegato il write lock — in `loadAgentSessions()`, check `sessionWriteLock.shouldSkipReload()` prima di `store.reload()`
- Layer 2: Defense-in-depth in `updateSession` — ripristina title/status se persi nel merge
- Layer 3: Warning in `saveAgentSessions` prima di persistere dati incompleti
- Estratto `sessionWriteLock` in file separato (`src/stores/sessionWriteLock.ts`) per evitare circular dependency

**Regola chiave**: `store.reload()` legge dal disco e sostituisce tutta la cache in-memory. Usare sempre un write lock per proteggere la finestra tra `set()` e `save()`.

---

## Integrazione Tab

- Hook singleton: `useAutomationTab` (stesso pattern di `useKanbanTab`)
- ActionIcons: icona orologio SVG con badge cyan per job in esecuzione
- Keyboard shortcut: Cmd+J
- Tab type: `'automation'` in TabBar union

---

## Presets Cron Disponibili

| Preset | Espressione | Descrizione |
|--------|-------------|-------------|
| Every day | `0 9 * * *` | Ogni giorno alle 09:00 |
| Mon-Fri | `0 9 * * 1-5` | Lun-Ven alle 09:00 |
| Weekly | `0 9 * * 1` | Lunedì alle 09:00 |
| Monthly | `0 9 1 * *` | Il 1° del mese alle 09:00 |
| Every 6 hours | `0 */6 * * *` | Ogni 6 ore |
| Custom | qualsiasi | Espressione cron 5-field personalizzata |

---

## File Chiave (riferimento rapido)

| File | Scopo |
|------|-------|
| `src-tauri/src/automation.rs` | Scheduler Rust (tokio tick + evento) |
| `src/App.tsx` (righe ~9163-9331) | Listener globale tick + fire logic (DUPLICATO!) |
| `src/components/automation/AutomationView.tsx` | UI solo |
| `src/components/automation/AutomationJobCard.tsx` | Card job |
| `src/components/automation/AutomationJobForm.tsx` | Form creazione/modifica |
| `src/components/automation/CronPresetInput.tsx` | Input cron |
| `src/components/automation/AutomationHistoryList.tsx` | History |
| `src/services/automationStorage.ts` | Persistenza CRUD |
| `src/services/cronUtils.ts` | Parsing cron + nextRunAt |
| `src/stores/automationStore.ts` | Zustand store |
| `src/stores/sessionWriteLock.ts` | Write lock (estratto per evitare circular dep) |

---

## Aree di Miglioramento Identificate

1. **Duplicazione fire logic in App.tsx**: Estrarre `executeAutomationJob()` condiviso tra fire manuale e scheduler
2. **useEffect instabile**: Le deps `createSession` e `sendMessageForTargetAgent` cambiano ad ogni render - da stabilizzare con `useRef`
3. **App.tsx enorme**: Le righe 9163-9331 sono un segnale che questa logica dovrebbe essere estratta in un hook dedicato (es. `useAutomationScheduler`)
