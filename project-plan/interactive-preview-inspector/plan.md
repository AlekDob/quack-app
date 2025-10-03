## Interactive Preview Inspector Plan

### Visione generale
- Integrare nel layout principale un pannello browser-like che permetta di visualizzare build/dev server locali (sia già avviati su porta nota sia lanciati dall’app).
- Offrire una modalità inspector attivabile via pulsante flottante “inspect” in stile Nuxt DevTools per identificare rapidamente componente React e file sorgente dell’elemento cliccato.
- Rendere disponibili metadati (per AI/prompt) come path file, export name e posizione grazie alle source map quando disponibili.

### Obiettivi chiave
1. **Preview auto-configurabile**: supporto per URL/porta personalizzabile, fallback a server interno (es. `npm run dev`) con log e stato.
2. **Inspector contestuale**: overlay che evidenzia elementi hover, cattura click e mostra card con dettagli componente/file + pulsante “Copia per AI”.
3. **Metadata pipeline**: risalire dal DOM al componente React usando React DevTools hook o attributi generati (`data-component`, source map) e mantenere cache locale.
4. **Esperienza pulita**: componenti React modulari, logica estratta in composable hooks, styling con classi Tailwind inline.

### Requisiti funzionali
- Configurare e salvare profili di preview (porta, comando di bootstrap opzionale, URL custom).
- Visualizzare stato del server (in esecuzione, avvio in corso, errore) con feedback nel UI.
- Supporto ricarica manuale e auto-refresh (eventualmente via websocket/polling).
- Pulsante flottante (bottom-right di preview) per attivare/disattivare inspector.
- Overlay inspector: highlight elemento, breadcrumbs (App → Layout → Component), link apri file in editor (via Tauri `open`/`shell`), copia testo.
- Integrare con AI workflow esistente (es. salva contesto negli appunti o passa a pannello AI).
- Gestione errori server (porta occupata, comando non trovato) con notifiche.

### Requisiti tecnici
- Utilizzare `tauri://` APIs per spawn processi (quando serve avvio comando) e comunicare stato.
- Per inspector: includere `react-devtools-core` o sviluppare bridge custom che sfrutta global `__REACT_DEVTOOLS_GLOBAL_HOOK__` se disponibile.
- Per progetti senza DevTools hook (es build prod): generare `data-component` via script di build opzionale oppure fallback a analisi DOM + heuristics.
- Source maps: caricare file `.map` via fetch dalla preview, risolvere mapping con `source-map` pkg lato frontend (verificare bundle size → opportuno lazy load).
- Sicurezza: isolare preview in `<webview>` Tauri o `<iframe>` con permissive toggles, considerare CORS e gesture.

### Architettura proposta
1. **PreviewManagerProvider (hook composable)**
   - Stato su URL corrente, stato server, inspector attivo, mapping cache.
   - Espone metodi `startServer(profile)`, `setPreviewUrl(url)`, `toggleInspector()`, `resolveNodeInfo(node)`.
2. **PreviewPanel componente**
   - Contiene `<iframe>`/`<webview>` e overlay inspector.
   - Pulsanti tailwind inline per controlli (refresh, open external, inspect, settings).
3. **InspectorOverlay componente**
   - Porta un root React nel documento preview via `postMessage` + content script iniettato.
   - Gestisce highlight, tooltip floating con info componente/file.
4. **Tauri backend estensioni**
   - Comando `spawn_preview_server { command, cwd, port }` con monitor stdout/stderr.
   - Comando `stop_preview_server` e query stato.
   - Bridge per open-in-editor (usare `tauri::api::process::Command` + `tauri::api::path`).
5. **Source map resolver service**
   - Lato frontend: mod `src/services/sourceMapResolver.ts` con funzioni per scaricare/cache map e restituire path/linea.
   - Lato preview script: ottiene stack trace minima o `__REACT_DEVTOOLS_GLOBAL_HOOK__` fiber -> file.

### Roadmap fasi
#### Fase 1 – Setup infrastruttura preview
- [ ] Creare provider contestuale + stato base (URL, porta, running status).
- [ ] Implementare form configurazione/toolbar (Tailwind inline) per definire profili preview.
- [ ] Integrare componente `<PreviewPanel>` con iframe placeholder e controlli refresh/open.
- [ ] Aggiungere comandi Tauri per pingare server esterno (senza inspector).

**Test**
- Avviare preview su porta esistente (es Vite dev server) e verificare rendering.
- Validare error handling per porta non raggiungibile.

#### Fase 2 – Gestione server locali
- [ ] Comando Tauri per lanciare processo (npm/yarn/pnpm) con streaming log nel UI.
- [ ] UI log console minimal + pulsante stop.
- [ ] Persistenza preferenze profilo (Store API) e auto-reconnect.

**Test**
- Unit test hook stato (mock Tauri invoke).
- Avvio/stop su progetto demo, verifica cleanup processo.

#### Fase 3 – Inspector overlay MVP
- [ ] Iniettare script nel documento preview tramite iframe communication.
- [ ] Implementare overlay highlight + tooltip statico con tag HTML e path DOM.
- [ ] Pulsante flottante `Inspect` (style tailwind inline) che abilita/disabilita overlay.

**Test**
- Manuel QA: attivare inspector, selezionare elementi, verificare highlight stabile.
- Snapshot/storybook (se disponibile) per overlay component.

#### Fase 4 – Risalita componente React
- [ ] Integrare `react-devtools-core` bridge: ottenere fiber da elemento cliccato.
- [ ] Estrarre displayName, location (file,line,column) via `debugSource` o hooks.
- [ ] Fallback se non disponibile: sfruttare `data-component` attributi (documentare come abilitarli) o stack trace generata via `console.trace()`.
- [ ] Mostrare pannello dettagli con componente, path, line/col + pulsanti “Copy context”, “Apri file”.

**Test**
- Test manuale su progetti React 18 (dev mode) con source map attive.
- Validare fallback scenario (no devtools) restituisce info minima.

#### Fase 5 – Source map resolver e AI integration
- [ ] Implementare `sourceMapResolver` per fetch `.map`, usare `source-map` pkg (lazy import) per tradurre location.
- [ ] Ottimizzare caching e invalidazione.
- [ ] Integrare con AI workflow: creare helper `buildAIContext(componentInfo)` e pulsante per inviare aprendo modale AI già esistente.
- [ ] UX: toasts (inspection success, missing map) e documentazione inline tooltip su come abilitare maps.

**Test**
- Unit test resolver con map fittizie.
- QA manuale con build Vite + source map.

#### Fase 6 – Polish e performance
- [ ] Gestire multi-tab preview (più profili) e switch rapido.
- [ ] Shortcut tastiera per togglare inspector.
- [ ] Animazioni leggere (Tailwind + Framer Motion se già usato) per overlay.
- [ ] Scrivere commenti essenziali e garantire composables/hook riusabili.

**Test**
- Verifica memoria CPU (nessun leak da processi spawn) durante 5 minuti.
- ESLint/Prettier, test end-to-end manuale Tauri.

### Rischi e mitigazioni
- **Disponibilità React DevTools hook**: alcune build prod non includono metadata → fallback attributi + manual mapping.
- **Security/CORS**: iframe potrebbe bloccare accesso a `postMessage` se `X-Frame-Options` disabilita → prevedere apertura esterna in tal caso.
- **Gestione processi**: spawn server multipli rischia zombie process → implementare kill on app close e limitare a un processo per profilo.
- **Peso bundle**: `source-map` >200kb → caricarlo on demand e valutare worker separato.

### Deliverable attesi
- Componenti React: `PreviewPanel`, `PreviewToolbar`, `InspectorToggle`, `InspectorOverlay`, `InspectorDetailsPanel`.
- Hooks/composables: `usePreviewManager`, `useInspectorBridge`, `useSourceMapResolver`.
- Estensioni Rust: modulo `preview_server.rs` con comandi Tauri.
- Aggiornamenti UI: pulsante inspector stile tailwind inline, log console area.
- Documentazione rapida (inline comments + eventuale nota in plan).

### Open questions
- Serve supporto per framework non React (Vue/Svelte)? Possibile in futuro se esponiamo interfaccia generica.
- Modalità offline? Potremmo consentire preview statiche (render HTML file) come estensione.
- Registrare sessioni inspector per playback AI? Potenziale fase futura.
