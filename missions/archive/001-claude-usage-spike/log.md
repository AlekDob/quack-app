# Log — claude-usage-spike

- (Yuri (Planner)) # Spike: Quack vs Claude Desktop GUI — quanto consumiamo davvero?

## Obiettivo (misurabile)
Rispondere in 2-3 ore a 3 domande:
1. **Esiste davvero un gap?** Quack consuma oggettivamente più token/costo della GUI desktop di Claude Code per task equivalenti?
2. **Qual è il colpevole nel codice?** Dove Quack "perde" token che la GUI risparmia?
3. **`npx ccusage@latest` funziona da Tauri?** È invocabile come comando Rust in un child process senza frizioni (PATH, permessi, JSON output)?

Se tutte e 3 sì → GO, si apre il piano di integrazione. Se 1 è no → il problema percepito è un'illusione (o una subscription diversa). Se 2 o 3 è no → va ridisegnato.

## Contesto già acquisito (rileggere prima di partire)
- **`src-tauri/src/claude_usage.rs`** (74 righe): comando `claude_usage_limits` chiama `https://api.anthropic.com/api/oauth/usage` e `profile` con token OAuth da `~/.claude/.credentials.json`. Restituisce `{usage, profile, subscriptionType, rateLimitTier}`. La token NON esce da Rust.
- **`src-tauri/src/claude_code.rs`** (1245 righe): spawn di `claude -p`, legge stream-json. Su ogni `result` event emette `cost_usd` + `usage` (input/output/cacheRead/cacheCreate). Ha `claude_code_list_sessions` che parsa già i JSONL di `~/.claude/projects/.../*.jsonl`.
- **`src/aiUsageLog.ts`** (318 righe): ledger in localStorage. Già registra per ogni turno: `costUsd`, `tokensIn`, `tokensOut`, `wsId`, `chatId`. Espone `loadUsage()`, `subscribeUsage()`, hard cap, per-workspace budget. **Già funzionante.**
- **`src/providers/claudeCode.ts`** (riga 147-149): se `resumeSessionId` esiste, invia SOLO l'ultimo messaggio utente. Se no, fa `flattenMessages(messages)` reinviando l'intera history `[User]/[Assistant]/[Tool result]`. **Qui si nasconde il primo problema.**
- **`src-tauri/src/claude_code.rs`** (riga 657): `MAX_THINKING_TOKENS=31999` quando `thinking=true`. Default Quack = thinking attivo.
- **`src/components/AIChatPanel.tsx`** (riga 2202-2205): cattura `claudeSessionId` dall'event `kind:"session"` e lo passa al turno successivo per il `--resume`.

## Ipotesi sul gap Quack vs GUI (da verificare sperimentalmente)

| # | Ipotesi | Come verificare | Probabilità |
|---|---------|------------------|-------------|
| H1 | **Cache miss sistematico**: Quack flatting history al primo turno o dopo restart → API conteggia tutto come nuovi token, nessun cache hit | Estrarre da 10 JSONL recenti in `~/.claude/projects/`, calcolare `cache_read_input_tokens / (cache_read + input)`. Confronto con chat Quack (in `aiUsageLog`) vs chat CLI nativo. | Alta |
| H2 | **Thinking forzato a 32k**: Quack default = `thinking:true`, GUI probabilmente minore | Contare `output_tokens` medi per task vs GUI. Se Quack ha costantemente ~30k extra output per task, è questo. | Media |
| H3 | **Subagent sidechain reinjectati**: `claude_code_load_subagent` carica transcript sideagent, vengono visualizzati e probabilmente reinviati | Verificare se i subagent vengono appiattiti in `flattenMessages` o se vengono saltati. Se inclusi → token-spree enorme. | Alta |
| H4 | **MCP + skills + workspace rules**: gonfiano system prompt di N-mila token ogni turno | Sommare byte dei file `~/.claude/CLAUDE.md`, MCP server configs, `workspaceRules.ts` → stima token overhead. | Media |
| H5 | **Stream-json verbose + include-partial-messages**: extra wire-format ma NON dovrebbe costare token in più | Verificare campo `output_tokens` nel `result` event: dovrebbe essere uguale a CLI non-verbose. | Bassa (escludibile presto) |
| H6 | **--resume che fallisce silenziosamente**: se il workspace cwd cambia o la session è scaduta, CLI riceve `--resume <stale_id>` e riparte da zero flatting | Verificare stderr del bridge per warning `--resume` ignorati. | Media |

## Metodo operativo (cosa fa il Builder)

### Step 1 — Misura reale del gap (45 min)
1. Aprire il progetto Quack e una sessione Claude Desktop GUI sullo stesso workspace.
2. Svolgere 3 task identici in parallelo (es. "refactorizza la funzione X", "trova bug in Y", "scrivi test per Z") — uno su Quack, uno su Claude Desktop, uno su `claude -p` puro nel terminale.
3. Alla fine di ogni task, raccogliere:
   - `cost_usd` dal `result` event (Quack) / dal `/usage` slash (GUI / CLI).
   - `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens` dal JSONL in `~/.claude/projects/...`.
4. Salvare in `missions/001-claude-usage-spike/data/{quack,desktop,cli}.json`.

### Step 2 — Root cause (45 min)
1. Leggere gli ultimi 20 JSONL in `~/.claude/projects/` (chiama `claude_code_list_sessions`).
2. Per ogni sessione, estrarre `cache_read_input_tokens / (cache_read + cache_creation + input)`. Se < 30% su Quack → H1 confermata.
3. Leggere `src/providers/claudeCode.ts:147-149` e verificare se i messaggi `role: "tool"` vengono flattenati. Se sì → H3 probabile.
4. Grep `MAX_THINKING_TOKENS` nel codice e verificare il default passato dal frontend.
5. Sommare system prompt overhead (MCP + CLAUDE.md + skills) per il workspace corrente.

### Step 3 — Fattibilità `npx ccusage@latest` da Tauri (30 min)
1. In un Tauri command scratch (`src-tauri/src/bin/spike_ccusage.rs` o comando `tauri::command` provvisorio), spawnare:
   ```
   Command::new("npx")
       .args(["ccusage@latest", "blocks", "--json"])
       .output()
   ```
2. Verificare: PATH disponibile in `std::process`? npx risolve ccusage? output JSON è parsable?
3. Testare anche `npx ccusage@latest daily --json` e `ccusage claude blocks --json` (focused su Claude Code).
4. Su macOS: probabilmente ok. Su Windows: verificare `creation_flags(0x08000000)` per CREATE_NO_WINDOW.

### Step 4 — Verdetto (30 min)
Scrivere `missions/001-claude-usage-spike/VERDICT.md` con:
- Numeri del gap (es: "Quack consuma 2.3x di CLI puro, 1.7x di GUI desktop").
- Root cause ranking (H1 > H3 > H2 > H4).
- Fattibilità ccusage: OK / problemi di PATH / problemi di output.
- Raccomandazione: GO con scope X / NO-GO perché Y / GO ma prima fixare Z.

## Criteri di successo (per chiudere la missione)
- [ ] `data/{quack,desktop,cli}.json` esiste e ha almeno 3 task ciascuno
- [ ] Root cause confermata o esclusa con evidenza (file:riga + numero)
- [ ] `npx ccusage@latest blocks --json` invocato con successo da Rust, output parsato
- [ ] `VERDICT.md` scritto con GO/NO-GO esplicito

## Branch
`feature/claude-usage-spike` (NON mergeare, è solo investigativo).

## Non fare (out of scope per lo spike)
- Non scrivere dashboard nuova
- Non modificare il bridge di Quack
- Non toccare `aiUsageLog.ts` se non in lettura
- Non fare refactor
- Non impegnare lavoro > 3 ore
- (Yuri (Planner)) ## Task di riferimento per Step 1 (fornito dall'utente)

L'utente sta lavorando a un'attività reale chiamata **"Mastra cost"** (costing/analisi costi di Mastra, framework agentico). Questo è il banco di prova perfetto perché:
- È il task che ha fatto scattare il sospetto del gap.
- È rappresentativo del flusso quotidiano (analisi lunga, multi-tool, sub-ricerche).
- Coinvolge verosimilmente: lettura file, ricerche, calcoli, sintesi → tutte leve di cache hit/miss.

**Istruzione al Builder per Step 1**: riprodurre lo stesso tipo di task "Mastra cost" — idealmente una variante equivalente di difficoltà simile — su tutte e 3 le superfici (Quack, Claude Desktop GUI, CLI puro `claude -p`). Se l'utente ha il workspace Mastra aperto, usare quello; altrimenti riprodurre su un workspace di pari complessità.

Annotare nel JSON finale: numero di turni distinti, dimensione input/output, suddivisione tool_use (quanti Read, Grep, Bash, Edit), e se sono stati spawnati subagent Task.
- (Yuri (Planner)) ## Cambio di approccio (in corso d'opera)

L'utente chiede di sostituire l'approccio "3 task sintetici" con un'analisi comparativa su TUTTE le sessioni reali: sessioni originate da Quack vs sessioni originate da Claude Desktop GUI (vs CLI puro). Obiettivo: trovare anomalie statistiche, non misurare un task controllato.

**Vantaggi del nuovo approccio**:
- Statistical power: N=decine/centinaia di sessioni invece di 3.
- Nessun costo di esecuzione di task sintetici.
- Cattura il comportamento quotidiano reale (incluso il task "Mastra cost" che ha fatto scattare il sospetto).
- Permette di identificare outlier specifici e pattern.

**Nuovo piano Step 1** (sostituisce il precedente):
1. Mappare `~/.claude/projects/*/` per scoprire quanti workspace e quante sessioni ci sono.
2. Per ogni JSONL estrarre: `cwd`, `model`, `cost_usd` totale, somma `input_tokens`/`output_tokens`/`cache_creation_input_tokens`/`cache_read_input_tokens`, numero di turni (user messages), numero di subagent `Task` tool_use, presenza di thinking blocks.
3. Identificare un marker per separare Quack vs Desktop GUI vs CLI:
   - **Ipotesi**: campo `cwd` + timestamp. Quack usa workspace paths specifici (es. `/Users/alekdob/Desktop/Dev/Personal/codetta` o simili), GUI Desktop probabilmente ha cwd diversi. CLI puro probabilmente lanciato da terminale iTerm/Terminal.
   - Marker più affidabile: leggere le prime righe di ogni sessione per estrarre `env` o working directory iniziale.
4. Aggregare per popolazione (Quack / GUI / CLI) e produrre statistiche descrittive.
5. Identificare outliers e pattern anomali.

**Decisione pending**: identificare il marker Quack è il punto critico. Vediamo dopo l'esplorazione quali dati sono disponibili.
- (Yuri (Planner)) ## Spike COMPLETATO — verdetto: GO

Tutti gli step eseguiti. Numeri in `VERDICT.md`. Riassunto ultra-compresso:

- 313 sessioni analizzate (57 Quack + 256 CLI).
- Mediana costo Quack vs CLI: **Quack -6%** (NON consuma di più in mediana).
- Mean costo Quack vs CLI: +30% ma trainato da outlier (poche sessioni lunghe).
- Cache hit: Quack 95.5% > CLI 93.8% (Quack leggermente MEGLIO).
- Causa reale del "consumo percepito": sessioni 1.57x più lunghe, +43% thinking, +54% subagent, e **100% cache writes 1h vs 99.4% CLI** (l'unico vero spreco).
- Risparmio se si passa cache a 5m con auto-promozione: **10.4%** validato per simulazione su Mastra cost.

3 deliverable consigliati per la prossima missione (002):
1. Cache TTL toggle (5m/1h/Auto) — bassa complessità, alto impatto.
2. Dashboard live OAuth 5h/7day in StatusBar.
3. Alert intelligenti in-chat.

`npx ccusage@latest blocks --json` testato e funzionante — fattibile al 100% da Tauri.

---

## REVISIONE v2 — feedback utente: "Mastra cost l'ho gestito solo in quack"

L'utente ha giustamente contestato il confronto "Mastra cost Quack vs CLI": le 25 sessioni CLI che matchavano "mastra" + "cost" erano in realtà task completamente diversi (moduli gare, keycloak, log, integrazioni). Era solo rumore testuale che condivideva parole con il vero task "Mastra cost" gestito ESCLUSIVAMENTE in Quack.

### Cosa ho fatto

1. Rimosso il confronto Quack vs CLI su "Mastra cost".
2. Esplorato i prompt reali di tutte le 46 sessioni → confermato che non sono confrontabili.
3. Rifatto l'analisi su confronti apples-to-apples:
   - **Sessioni Quack LONG (≥200 turns) vs SHORT (<200 turns)**
4. Tracciato l'evoluzione del context nella sessione Quack più cara (1538 turns, $549).
5. Identificato che auto-compact di Claude Code funziona (context oscilla, non cresce linearmente).

### Nuova causa vera

L'80% del costo Quack è concentrato nel 25% delle sessioni più lunghe. Non è un bug tecnico — è che Quack è usato per task di sviluppo attivo che sono oggettivamente più lunghi delle chat occasionali della GUI. Il moltiplicatore è N turni.

VERDICT.md aggiornato in v2.
