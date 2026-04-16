# Feature Specification: Smart Auto-Update

## Problem Statement

Oggi l'utente Quack riceve una notifica toast quando e' disponibile un nuovo aggiornamento, ma deve:
1. Cliccare "Download" che apre il browser su GitHub Releases
2. Scaricare manualmente il `.dmg` (Mac) o `.exe` (Windows)
3. Chiudere Quack
4. Installare il nuovo pacchetto
5. Riaprire l'app

Questo flusso causa **friction**, ritardi nell'adozione e utenti che restano su versioni vecchie. Quack ha gia' il plugin `tauri-plugin-updater v2` configurato in `Cargo.toml` e `tauri.conf.json`, ma non viene mai invocato per il download e l'installazione automatica.

## User Stories

### Story 1: Aggiornamento con un click

Come utente Quack,
voglio poter aggiornare l'app con un singolo click dalla notifica,
in modo da non dover mai uscire dall'app o aprire il browser.

**Acceptance Criteria:**
- [ ] Quando e' disponibile un update, appare un toast con versione e changelog sintetico
- [ ] L'utente clicca "Aggiorna" e il download parte in-app
- [ ] Una progress bar mostra l'avanzamento del download
- [ ] Al completamento, l'utente riceve una conferma "Riavviare ora?" con opzioni Si/Piu' tardi
- [ ] Se conferma, l'app si chiude, installa e riapre automaticamente
- [ ] Se sceglie "Piu' tardi", l'update e' applicato al prossimo riavvio naturale

### Story 2: Check manuale dalle Settings

Come utente Quack,
voglio poter forzare un check aggiornamenti dalla pagina About,
in modo da verificare subito se c'e' una nuova versione.

**Acceptance Criteria:**
- [ ] Il pulsante "Cerca aggiornamenti" in AboutSettings forza un check immediato (bypass cache)
- [ ] Se disponibile, mostra versione + changelog + pulsante "Aggiorna"
- [ ] Se gia' aggiornato, mostra "Sei aggiornato alla versione X.Y.Z"
- [ ] Il download puo' essere avviato anche da qui con la stessa UX del toast

### Story 3: Changelog inline

Come utente Quack,
voglio vedere cosa cambia nella nuova versione prima di aggiornare,
in modo da decidere consapevolmente se aggiornare subito.

**Acceptance Criteria:**
- [ ] Il toast e il pannello About mostrano le prime 3-5 righe del release body (markdown)
- [ ] Il changelog e' renderizzato come testo semplice (no HTML complesso)
- [ ] Un link "Vedi tutto" apre la pagina completa della release su GitHub

### Story 4: Gestione errori e retry

Come utente Quack,
voglio essere informato se l'aggiornamento fallisce,
in modo da poter riprovare o scaricare manualmente.

**Acceptance Criteria:**
- [ ] Se il download fallisce (rete, timeout), appare un messaggio di errore con "Riprova" e "Scarica manualmente"
- [ ] "Scarica manualmente" apre la pagina release su GitHub (fallback attuale)
- [ ] Se la verifica firma fallisce, l'update viene rifiutato con messaggio chiaro
- [ ] I retry non spammano — max 2 tentativi automatici con backoff

### Story 5: Supporto multi-piattaforma

Come sviluppatore di Quack,
voglio che l'auto-update funzioni su macOS e Windows,
in modo da coprire tutta la base utenti.

**Acceptance Criteria:**
- [ ] macOS: download `.app.tar.gz` (non `.dmg`), install via Tauri updater nativo
- [ ] Windows: download NSIS installer, install via Tauri updater nativo
- [ ] Il `latest.json` contiene gli endpoint per entrambe le piattaforme
- [ ] Il CI genera e pubblica automaticamente il `latest.json` corretto
- [ ] La firma digitale e' presente e verificata per entrambe le piattaforme

## Non-Functional Requirements

- **Sicurezza**: Ogni update DEVE essere firmato con chiave Ed25519. La pubkey e' embeddata nell'app. Nessun update non firmato puo' essere installato.
- **Performance**: Il download non deve bloccare l'UI. L'utente puo' continuare a lavorare durante il download.
- **Affidabilita'**: Se l'update fallisce in qualsiasi punto, l'app corrente resta intatta. Zero rischio di corruzione.
- **Banda**: Il check update e' leggero (solo `latest.json`, ~1KB). Il download del bundle avviene solo su conferma esplicita.
- **Privacy**: Nessun dato utente inviato durante il check. Solo GET request anonime a GitHub.

## Success Metrics

- Riduzione del tempo medio tra release e adozione (oggi ~giorni, target <24h per il 50% degli utenti attivi)
- Zero casi di corruzione app post-update
- Tasso di completamento update >90% (chi inizia il download lo porta a termine)

## Out of Scope

- Canali beta/nightly (feature futura)
- Update delta/incrementali (troppo complesso, bundle completo e' ok per ora)
- Auto-update silenzioso senza conferma utente
- Rollback automatico a versione precedente
- Linux support (non abbiamo build Linux al momento)
