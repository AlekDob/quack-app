# Feature Specification: Anthropic-Compatible Custom Providers

**Feature Branch**: `037-anthropic-compatible-providers`
**Created**: 2026-05-12
**Status**: Draft
**Input**: "Integrare z.ai (GLM), MiniMax, Kimi/Moonshot, Qwen e altri provider che espongono un endpoint Anthropic-compatible, usabili dalla Claude Agent SDK via `ANTHROPIC_BASE_URL` + `ANTHROPIC_AUTH_TOKEN`. Ollama non basta perché non instrada subscription remote z.ai/minimax."

## Clarifications

### Session 2026-05-12

- Q: Scope del provider attivo (globale / per-agente / per-sessione)? → A: per-sessione — l'utente sceglie il provider al momento dello spawn di una nuova sessione, con un default globale come fallback.
- Q: Coesistenza OAuth Anthropic + custom provider? → A: coesistenza — il token OAuth resta valido nel secure storage; viene usato solo quando la sessione punta a "Anthropic". Selezionare un custom provider non causa logout.
- Q: Storage delle API key dei custom provider? → A: riusare `save_api_key`/`get_ai_api_key` con chiavi namespaced (`provider:<providerId>`). VINCOLO: non rompere l'uso esistente (OpenAI key in `AIAssistantSettings`) — il namespacing deve essere additive, mai modificare lo schema esistente.
- Q: Editabilità preset built-in? → A: built-in read-only (URL + modelli fissi, solo API key editabile); azione "Duplica come custom" permette personalizzazione. Gli update Quack possono aggiornare i preset senza conflitti.
- Q: Comportamento "Test connection"? → A: call reale `POST /messages` con `max_tokens: 1` e prompt minimale — valida endpoint, auth e modello in un colpo. Mostra latency + risposta OK / errore dettagliato.

## Contesto

L'Agent SDK (e il CLI bundled in Quack) rispetta gli env `ANTHROPIC_BASE_URL` e `ANTHROPIC_AUTH_TOKEN`. Provider come z.ai (`/api/anthropic`), MiniMax (`/anthropic`), Kimi, Qwen DashScope, DeepSeek (via SiliconFlow) espongono endpoint conformi al wire protocol Anthropic. Ollama serve solo modelli locali / Ollama-cloud, non funge da reverse-proxy verso queste subscription.

Oggi Quack ha 3 provider hardcoded (`Anthropic`, `Ollama`, `Custom`) in `ClaudeCodeSettings` (feature 037 — unified settings panel). Manca:
- preset multipli per Anthropic-compatible providers
- override modelli (`ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, `ANTHROPIC_MODEL`)
- gestione token per provider (non sovrascrivere la chiave Anthropic ufficiale)

## User Scenarios & Testing

### User Story 1 — Usare GLM-4.6 via z.ai Coding Plan (Priority: P1)

Utente con subscription z.ai Coding Plan vuole usare GLM-4.6 come default model in Quack senza toccare file di config a mano.

**Why P1**: è il driver principale della feature. z.ai Coding Plan costa ~10$/mese vs ~200$ Claude Max e molti utenti italiani di Quack lo richiedono.

**Independent Test**: in Settings > Claude Code, selezionare preset "Z.AI (GLM)", inserire la API key, mandare un prompt e verificare che la sessione SDK risponda usando `glm-4.6` (visibile nello status / token usage panel).

**Acceptance Scenarios**:
1. **Given** API key z.ai valida, **When** seleziono preset "Z.AI" e mando un messaggio, **Then** la sessione SDK parte con `ANTHROPIC_BASE_URL=https://api.z.ai/api/anthropic`, `ANTHROPIC_AUTH_TOKEN=<key>`, `ANTHROPIC_DEFAULT_SONNET_MODEL=glm-4.6`.
2. **Given** preset Z.AI attivo, **When** apro Token Usage modal, **Then** vedo il modello reale (`glm-4.6`) e non `claude-sonnet-4-7`.

### User Story 2 — Aggiungere un provider custom Anthropic-compatible (Priority: P1)

Power user vuole puntare a un endpoint custom (es. proxy aziendale, MiniMax, SiliconFlow) non presente nei preset.

**Why P1**: estendibilità. Senza questa, ogni nuovo provider richiede una release.

**Independent Test**: aggiungere un provider con `name`, `baseUrl`, `authToken`, `sonnetModel`, `haikuModel`, salvarlo, selezionarlo, verificare che le env siano iniettate correttamente nello spawn del processo SDK.

**Acceptance Scenarios**:
1. **Given** form "Aggiungi provider", **When** compilo i campi e salvo, **Then** il provider appare nella dropdown e può essere selezionato come attivo.
2. **Given** provider custom attivo, **When** la sessione SDK viene spawnata, **Then** gli env del provider sostituiscono quelli Anthropic default solo per quel processo (nessuna leak globale).

### User Story 3 — Switch rapido tra provider (Priority: P2)

Utente alterna tra Anthropic ufficiale (per task critici) e z.ai (per task economici) più volte al giorno.

**Why P2**: nice-to-have, ma migliora il valore percepito.

**Independent Test**: switch via dropdown senza riavviare Quack, la sessione SDK successiva usa il nuovo provider.

**Acceptance Scenarios**:
1. **Given** sessione attiva con Anthropic, **When** switch a Z.AI dalla dropdown, **Then** la nuova sessione (next spawn) usa Z.AI; la sessione corrente continua col vecchio provider fino a fine turno.

### User Story 4 — Token usage / context window accurati (Priority: P3)

I provider Anthropic-compatible riportano `usage` nello stesso formato. Lo Stamina Bar e il Token Usage modal devono mostrare numeri corretti anche con context window non-200k (es. GLM-4.6 ha 200k, MiniMax M2 ha 1M, Qwen 256k).

**Why P3**: cosmetico ma importante per UX.

**Acceptance Scenarios**:
1. **Given** provider con context window != 200k dichiarato nel preset, **When** mando messaggi, **Then** lo Stamina Bar usa quel limite per la percentuale.

### Edge Cases

- **Auth token vuoto / invalido**: errore SDK in stream → mostrare error toast con link al provider docs.
- **Endpoint irraggiungibile** (rete down, URL typo): timeout chiaro, fallback a "Configura provider".
- **Sovrapposizione con Anthropic ufficiale**: se l'utente ha già `ANTHROPIC_API_KEY` o token OAuth (Claude Pro/Max) impostato e seleziona un provider custom per una sessione, il provider VINCE per quella sessione. Il token OAuth Anthropic RIMANE valido nel secure storage e viene riusato automaticamente per le sessioni che puntano ad "Anthropic" — nessun logout, nessuna re-auth richiesta.
- **Modello non valido per provider**: l'override `ANTHROPIC_DEFAULT_SONNET_MODEL` punta a un modello che il provider non ha → 400 dal provider → mostrare hint.
- **Provider rimosso ma attivo**: se elimino il provider attualmente selezionato, fallback ad Anthropic ufficiale.
- **Bedrock vs custom provider**: mutually exclusive — selezionare custom provider disabilita il toggle Bedrock e viceversa.

## Requirements

### Functional Requirements

- **FR-001**: Sistema MUST permettere di gestire una lista di "Anthropic-compatible providers", ciascuno con: `id`, `name`, `baseUrl`, `authToken`, `sonnetModel` (opzionale override), `haikuModel` (opzionale), `defaultModel` (opzionale), `contextWindow` (opzionale, default 200k), `notes` (opzionale).
- **FR-002**: Sistema MUST shippare preset built-in per: `Anthropic ufficiale` (default), `Z.AI (GLM-4.6)`, `MiniMax M2`, `Kimi K2 (Moonshot)`, `Qwen 3 (DashScope)`, `DeepSeek (SiliconFlow)`. Ogni preset porta `baseUrl` e modelli di default precompilati, l'utente inserisce solo la API key.
- **FR-002a**: I preset built-in MUST essere read-only su `baseUrl`, `sonnetModel`, `haikuModel`, `defaultModel`, `contextWindow` — solo la API key è editabile. Per personalizzarli, l'utente usa l'azione **"Duplica come custom"** che crea un provider custom modificabile pre-popolato. Gli aggiornamenti di Quack POSSONO aggiornare i campi dei preset built-in senza chiedere conferma all'utente.
- **FR-003**: Sistema MUST iniettare i corretti env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_AUTH_TOKEN`, `ANTHROPIC_DEFAULT_SONNET_MODEL`, `ANTHROPIC_DEFAULT_HAIKU_MODEL`, opzionalmente `ANTHROPIC_MODEL`) al momento dello spawn del processo Claude SDK, SOLO se un provider custom è attivo. Se è attivo "Anthropic ufficiale", NON impostare `ANTHROPIC_BASE_URL` (lascia il default SDK).
- **FR-004**: API key dei provider MUST essere salvate via i Tauri commands esistenti `save_api_key` / `get_ai_api_key`, usando chiavi namespaced del tipo `provider:<providerId>` (es. `provider:zai`, `provider:minimax`). VINCOLO non-regressione: lo schema esistente per la OpenAI key (usata da `AIAssistantSettings`) NON deve essere modificato — l'estensione è puramente additive (nuovi key namespace, stesso command).
- **FR-005**: Utente MUST poter selezionare un **default globale** del provider da Settings > Claude Code. Lo switch MUST applicarsi alle nuove sessioni senza riavvio app.
- **FR-005a**: Al momento dello spawn di una nuova sessione, MUST essere disponibile un selettore "Provider" (es. dropdown nella chat input / new-session modal) che permette di override il default globale per quella sessione specifica. Il provider scelto MUST rimanere fisso per tutta la vita della sessione (no switch mid-stream).
- **FR-005b**: Le sessioni attive MUST mostrare visivamente il provider in uso (es. badge nel session header), per evitare confusione con il default globale.
- **FR-006**: Utente MUST poter testare il provider (pulsante "Test connection") che esegue una `POST /messages` reale con `max_tokens: 1` e prompt minimale (es. `"hi"`). MUST mostrare: stato (OK/errore), latency in ms, modello effettivamente ritornato dal provider, ed errore dettagliato (status code + body) in caso di fallimento. Costo stimato per test: <0.001$ per provider.
- **FR-007**: Sistema MUST mostrare nel Token Usage modal e nello Stamina Bar il `model` reale ricevuto dal provider (non il nome canonico Anthropic).
- **FR-008**: Sistema MUST validare che esattamente una opzione tra `{Anthropic, Bedrock, Custom Provider}` sia attiva alla volta.
- **FR-009**: Daemon mode (`stream-daemon.js`) MUST ricevere il provider config dal frontend allo spawn (env vars passati al child process), come già succede per Bedrock.
- **FR-010**: Migrazione: il provider type esistente `"Custom"` nell'attuale `ClaudeSettings.provider` MUST essere migrato al nuovo modello (diventa un'entry nella lista provider con id `legacy-custom`).

### Key Entities

- **CustomProvider**: rappresenta una configurazione Anthropic-compatible provider. Attributi: id, name (human-readable), baseUrl (URL endpoint), authTokenSecretId (riferimento al secure storage), sonnetModel, haikuModel, defaultModel, contextWindow, isBuiltIn (bool), createdAt.
- **ActiveProviderState**: tipo discriminato `{ kind: "anthropic" } | { kind: "bedrock", config: ... } | { kind: "custom", providerId: string }`. Sostituisce l'attuale `provider: LLMProviderType`.

## Success Criteria

- **SC-001**: Un nuovo utente con subscription z.ai può configurare il provider e mandare il primo prompt funzionante in <2 minuti dall'apertura di Settings.
- **SC-002**: Zero leak di env vars provider-custom verso sessioni che usano Anthropic ufficiale (verificato con test integrazione su `spawn` del processo SDK).
- **SC-003**: Token usage display mostra il modello corretto (es. `glm-4.6`) in 100% dei casi quando un custom provider è attivo.
- **SC-004**: Switch tra provider applicato in <1s dalla selezione (next-spawn).
- **SC-005**: Riduzione delle richieste support / Discord su "come uso z.ai con Quack" del 80% (proxy: assenza di domande del genere nei 30gg post-release).

## Relazione con feature 037-unified-settings-panel

Questa feature **estende** la categoria `ClaudeCodeSettings` (file `src/components/settings/categories/ClaudeCodeSettings.tsx`) dentro l'Unified Settings Panel — NON crea una nuova categoria sidebar. Il pattern segue le altre integrazioni già presenti (Bedrock toggle, Ollama).

Punti di intervento:
- `ClaudeCodeSettings.tsx`: sostituire la dropdown `LLMProviderType` (Anthropic/Ollama/Custom) con un selettore "Provider preset" + lista provider gestibile.
- `settingsStore.ts`: estendere `ClaudeSettings` con `customProviders: CustomProvider[]` e `activeProvider: ActiveProviderState`.
- Nuovo file `src/services/providerService.ts`: gestisce preset, save/load token via Tauri secure storage, test connection.
- `stream-claude.js` / `stream-daemon.js`: leggere `QUACK_PROVIDER_CONFIG` env (JSON) e tradurlo in `ANTHROPIC_BASE_URL` + token al momento dello spawn.
- Migrazione settings store v11 → v12 per il nuovo schema.

Out of scope per la feature 037-unified-settings-panel: la struttura UI (sidebar, overlay, animation) resta invariata.

## Out of Scope

- Routing intelligente automatico (es. "usa GLM per task semplici, Opus per task complessi"). Sarà una feature separata.
- Cost tracking per provider (calcolo €/sessione). Separata.
- Proxy locale tipo LiteLLM. Restiamo sull'endpoint diretto.
- Supporto provider NON-Anthropic-compatible (OpenAI raw, Gemini native). Quelli passano già da `AIAssistantSettings` (modello secondario per task non-agentic).
