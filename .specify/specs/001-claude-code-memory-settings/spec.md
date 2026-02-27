# Feature Specification: Claude Code Memory Settings

## Problem Statement

Claude Code v2.1.59 ha introdotto l'**Auto Memory** — una funzionalità che permette a Claude di salvare automaticamente contesto utile (pattern, preferenze, insight) in una directory persistente (`~/.claude/projects/<project>/memory/`). Quack, come workspace costruito sopra Claude Code, non offre ancora un modo per gestire questa funzionalità dalla UI.

L'utente deve attualmente modificare file JSON a mano o usare variabili d'ambiente per controllare la memoria. Questo va contro il principio "AI-First Architecture" della constitution — ogni capability del SDK deve essere accessibile dalla UI di Quack.

## User Stories

### Story 1: Toggle Auto Memory On/Off

Come utente di Quack,
voglio abilitare o disabilitare la memoria automatica di Claude Code dalla UI dei settings,
così da controllare se Claude salva automaticamente note e pattern durante le sessioni.

**Acceptance Criteria:**
- [ ] Toggle visibile nella sezione "Claude Code" dei Settings
- [ ] Stato del toggle riflette il valore corrente di `autoMemoryEnabled`
- [ ] La modifica viene persistita in `~/.claude/settings.json` (NOT localStorage)
- [ ] La modifica ha effetto sulle nuove sessioni senza riavviare l'app
- [ ] L'env var `CLAUDE_CODE_DISABLE_AUTO_MEMORY` sovrascrive il setting quando presente

### Story 2: Visualizzare lo Stato della Memoria

Come utente di Quack,
voglio vedere se la memoria automatica è attiva o meno per il progetto corrente,
così da sapere se Claude sta imparando dalla sessione.

**Acceptance Criteria:**
- [ ] Indicatore visuale nella sezione Settings che mostra lo stato corrente
- [ ] Il path della directory memory del progetto corrente è visibile
- [ ] Se l'env var override è attivo, viene mostrato un badge/avviso

### Story 3: Aprire la Directory Memory

Come utente di Quack,
voglio poter aprire la directory della memoria del progetto corrente nel Finder/Explorer,
così da ispezionare e modificare i file di memoria manualmente.

**Acceptance Criteria:**
- [ ] Pulsante "Open Memory Folder" nella sezione Settings
- [ ] Apre il Finder/Explorer alla directory `~/.claude/projects/<project>/memory/`
- [ ] Se la directory non esiste, mostra un messaggio informativo

### Story 4: Passare il Setting al SDK

Come sviluppatore di Quack,
voglio che il setting `autoMemoryEnabled` venga passato correttamente al processo Claude SDK,
così che il comportamento di memoria sia rispettato durante le sessioni AI.

**Acceptance Criteria:**
- [ ] Il setting viene letto da `~/.claude/settings.json` al lancio della sessione
- [ ] Il valore viene passato come env var `CLAUDE_CODE_DISABLE_AUTO_MEMORY` al processo Node.js
- [ ] Se il toggle è OFF → `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`
- [ ] Se il toggle è ON → env var non presente (default del SDK = abilitato)

## Non-Functional Requirements

- **Performance**: La lettura del setting non deve aggiungere latenza percepibile al lancio sessione
- **Compatibilità**: Deve funzionare con Claude Code CLI >= v2.1.59
- **Persistenza**: Il setting vive in `~/.claude/settings.json`, non in localStorage di Quack
- **Reversibilità**: L'utente può cambiare idea in qualsiasi momento senza perdere dati

## Success Metrics

- L'utente può controllare la memoria automatica di Claude senza toccare file di configurazione
- Il setting viene rispettato dal SDK in tutte le sessioni successive
- Nessuna regressione sulle funzionalità esistenti dei settings

## Clarifications

### Q1: Dove vive il toggle nella UI?
**Risposta**: Nella sezione "Claude Code" dei Settings, vicino alle config esistenti (API key, model, permission mode).

### Q2: Come viene persistito il setting?
**Risposta**: Direttamente in `~/.claude/settings.json` — il file config ufficiale di Claude Code. Così funziona anche fuori da Quack.

### Q3: Scope del primo rilascio?
**Risposta**: Toggle on/off + pulsante "Open Memory Folder" che apre la directory nel Finder.

## Out of Scope

- Editing dei singoli file di memoria dalla UI (troppo complesso per v1)
- Visualizzazione del contenuto di MEMORY.md nella UI
- Memory Tool API per l'SDK (tool type `memory_20250818`) — è una feature API separata, non CLI
- Project-level memory settings (solo user-level per v1)
- Migrazione o import/export di file di memoria tra progetti
