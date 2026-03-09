---
type: eval-output
task: search-automations
method: without_skill
date: 2026-03-08
---

# Automation System - Knowledge Search Summary

## Sources Searched

1. `documentation/patterns/pattern-automation-layer.md` — architettura principale
2. `documentation/gotchas/gotcha-automation-job-provider-not-passed.md` — bug provider/model
3. `documentation/gotchas/gotcha-automation-scheduler-log-spam.md` — log spam su dev startup
4. `documentation/guide/automations/overview.md` — guida utente
5. `documentation/bugs/fix-automation-job-fires-repeatedly.md` — bug scheduler loop
6. `documentation/bugs/fix-automation-session-title-missing.md` — bug titolo "Untitled"
7. `src/stores/automationStore.ts` — Zustand store
8. `src/services/automationStorage.ts` — persistenza Tauri Store
9. `src/services/cronUtils.ts` — parsing cron + calcolo next fire
10. `src/App.tsx` (linee 9354-9510) — fire logic (manuale + scheduler)
11. `src/types.ts` (linee 468-504) — interfacce TypeScript
12. `~/.quack/brain/projects/quack-app/` — global brain (nessun file specifico sulle automazioni trovato)

---

## Architettura Generale

```
Rust Scheduler (automation.rs)
  → tokio interval 30s
  → emette evento Tauri `automation-scheduler-tick`
  → App.tsx (GLOBAL useEffect, sempre montato)
      → legge jobs da useAutomationStore
      → controlla nextRunAt vs now
      → se job scaduto: claimJobForFiring() → createSession() → sendMessageForTargetAgent()
      → session compare nella sidebar come "[Auto] <job name>"
```

Il tick listener DEVE stare in `App.tsx`, non in `AutomationView` (che si smonta quando si cambia tab).

---

## Tipi Chiave (src/types.ts)

```ts
interface AutomationJob {
  id: string;                   // "auto-{timestamp}-{random}"
  name: string;
  cronExpression: string;       // cron 5 campi, es. "0 9 * * *"
  agentId: string;
  agentName: string;
  projectPath: string;
  projectName: string;
  promptTemplate: string;
  model?: string;               // Override modello (default: modello agente)
  provider?: LLMProviderType;   // CRITICO: anthropic | ollama | custom
  enabled: boolean;
  createdAt: number;
  updatedAt: number;
  lastRunAt?: number;
  lastRunStatus?: AutomationRunStatus;
  nextRunAt?: number;           // Pre-calcolato, timestamp del prossimo fire
  timeoutMinutes?: number;      // Default: 10
  skipIfRunning?: boolean;      // Previene run sovrapposti
}

type AutomationRunStatus = 'running' | 'success' | 'failed' | 'cancelled' | 'timeout';

interface AutomationRunHistory {
  id: string;                   // "run-{timestamp}-{random}"
  jobId: string;
  jobName: string;
  startedAt: number;
  completedAt?: number;
  status: AutomationRunStatus;
  durationMs?: number;
  sessionId?: string;
  error?: string;
}
```

---

## File del Sistema

### Nuovi (creati per la feature)
- `src-tauri/src/automation.rs` — scheduler Rust
- `src/components/automation/AutomationView.tsx` + `.css`
- `src/components/automation/AutomationJobCard.tsx`
- `src/components/automation/AutomationJobForm.tsx`
- `src/components/automation/CronPresetInput.tsx`
- `src/components/automation/AutomationHistoryList.tsx`
- `src/views/AutomationTabView.tsx`
- `src/stores/automationStore.ts`
- `src/services/automationStorage.ts`
- `src/services/cronUtils.ts`
- `src/hooks/useAutomationTab.ts`

### Modificati
- `src/App.tsx` — global tick listener + `handleAutomationFireJob`
- `src/types.ts` — `AutomationJob`, `AutomationRunHistory`
- `src/hooks/useClaudeChat.ts` — `ChatSendOptions.provider`
- `src/TabBar.tsx`, `src/ActionIcons.tsx` — tab integration
- `src-tauri/src/lib.rs`, `Cargo.toml`

### Storage
- File: `quack-automations.json` (Tauri Store JSON)
- Chiavi: `jobs`, `history`
- Limite history: 500 entries (trim automatico)
- Test mode: supportato via `getTestModeStoreName()`

---

## Gotchas Critici

### 1. Provider DEVE essere passato insieme al modello
**File:** `gotcha-automation-job-provider-not-passed.md`
- `AutomationJob` ha sia `model?` che `provider?`
- Senza `provider`, `sendMessageForTargetAgent` usa il provider globale → errore con Ollama
- Duplicazione: la fix va applicata a ENTRAMBI i path di fire (manuale + scheduler in App.tsx ~9163 e ~9251)
- Pattern: qualsiasi feature che crea sessioni programmaticamente (automation, remote execute, webhook) deve passare ENTRAMBI model e provider

### 2. Log spam su dev startup
**File:** `gotcha-automation-scheduler-log-spam.md`
- L'effect in App.tsx ha dipendenze instabili (`createSession`, `sendMessageForTargetAgent`)
- Il Rust scheduler è idempotente ma loggava a `info` → spam
- Fix: `log::info!` → `log::debug!` in `automation.rs:97`
- Fix profondo (deferred): stabilizzare deps con `useRef`

### 3. Job che non scatta mai / scatta in loop
**File:** `fix-automation-job-fires-repeatedly.md`
- Sintomo 1: listener in `AutomationView` (smontato col tab) → job salta
- Sintomo 2: `nextRunAt` non avanzato dopo il fire → re-fire ogni 30s
- Fix: listener SOLO in App.tsx + avanzare `nextRunAt` immediatamente dopo il fire
- `getNextFireTime(expr, undefined, inclusive)`: `inclusive=true` per creazione, `false` dopo fire

### 4. Titolo sessione perso (Untitled)
**File:** `fix-automation-session-title-missing.md`
- Race condition: `createSession()` → `store.set()` → polling chiama `store.reload()` → sovrascrive dati in-memory non ancora su disco
- Fix (3 layer): write lock in `loadAgentSessions()`, defense-in-depth in `updateSession()`, warning in `saveAgentSessions()`
- File nuovi: `src/stores/sessionWriteLock.ts` (estratto per evitare dipendenza circolare)

---

## Meccanismo Anti-Refire (3 Layer)

Il codice in App.tsx (~9416-9504) implementa 3 livelli di difesa:

1. **`claimJobForFiring(jobId)`** — lock sincrono nel Set `firingJobIds`. Se già claimed, il tick salta
2. **nextRunAt avanzato in-memory SINCRONO** — prima di qualsiasi async, il prossimo tick vede già il nuovo valore
3. **`lastRunStatus = 'running'`** — flag per `skipIfRunning: true`

Release del lock: dopo 5 secondi con `setTimeout` (o in catch).

---

## Preset Cron

| Label | Expression | Descrizione |
|-------|-----------|-------------|
| Every day | `0 9 * * *` | Ogni giorno alle 09:00 |
| Mon-Fri | `0 9 * * 1-5` | Lun-Ven alle 09:00 |
| Weekly | `0 9 * * 1` | Lunedì alle 09:00 |
| Monthly | `0 9 1 * *` | 1° del mese alle 09:00 |
| Every 6 hours | `0 */6 * * *` | 00:00, 06:00, 12:00, 18:00 |

Tutti in **timezone locale** del sistema (chrono::Local su Rust, `new Date()` su JS).

---

## Integrazione Tab

- Hook: `useAutomationTab` (pattern singleton come `useKanbanTab`)
- Icona: clock SVG con badge cyan (count job running)
- Shortcut: Cmd+J (macOS) / Ctrl+J (Windows)
- Tipo tab: `'automation'`

---

## Duplicazione Nota (Warning)

La logica di fire è duplicata in App.tsx:
- `handleAutomationFireJob` (~linea 9355) — bottone "Fire Now" manuale
- Scheduler tick listener (~linea 9422) — fire automatico cron

Entrambi fanno: `inject personality → createSession → sendMessageForTargetAgent`.
Suggerimento non ancora implementato: estrarre `executeAutomationJob()` condiviso.

---

## Global Brain (~/.quack/brain/)

Ricerca effettuata su tutti i file `.md` con parola "automat". Nessun file dedicato trovato nel brain globale per le automazioni. Le conoscenze sono tutte nel progetto locale (`documentation/`).
