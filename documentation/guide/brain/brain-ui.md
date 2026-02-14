# Brain UI - La finestra visuale

Il Brain ha una finestra dedicata che si apre come webview Tauri separata. Mostra la conoscenza del progetto in modo visuale, separando chiaramente i contenuti per umani da quelli per AI.

## Come aprirla

Dalla app principale di Quack, il pulsante Brain apre la finestra. Si apre con il path del progetto attivo.

## Layout

La finestra ha due aree:

- **Sidebar** (sinistra): navigazione, scope toggle, conteggi, sezioni Human/AI
- **Content** (destra): la vista attiva (Timeline, Knowledge, Graph, Guide) o l'editor

## Sidebar

### Scope Toggle

In alto trovi due bottoni: **Project** e **Global**.

- **Project** mostra gli entry in `{progetto}/documentation/`
- **Global** mostra quelli in `~/.quack/brain/`

Quando cambi scope, i conteggi e il contenuto si aggiornano.

### Pin

Sotto lo scope toggle ci sono i file pinnati:

- **Map** — apre `map.md`, l'indice architetturale del progetto
- **CLAUDE.md** — apre le istruzioni dell'agente (solo in scope Project)

### Categorie Knowledge

Le categorie mostrano i conteggi per tipo:

- Decisions (N)
- Bug Fix (N)
- Pattern (N)
- Gotcha (N)

Cliccare una categoria apre la vista Knowledge filtrata su quel tipo.

### Viste

- **Timeline** — feed cronologico dell'attivita'
- **Graph** — grafo delle connessioni tra entry (con filtri AI/Human)

### Human Guides

Sezione dedicata alle guide scritte per umani (label `HUMAN GUIDES` in maiuscolo). Mostra le feature con navigazione a 3 livelli:

1. **Sezione** — "HUMAN GUIDES" (label fissa, senza freccia)
2. **Feature** — es. "Brain" con freccia espandibile
3. **Pagine** — le singole pagine della guida (overview, access chain, ecc.)

Cliccando la freccia accanto a una feature si espandono le pagine sottostanti. La pagina attiva e' evidenziata in arancione (`#FF6B35`).

Le guide sono visibili solo in scope **Project** (non Global).

### AI Knowledge

Sezione dedicata alla conoscenza per agenti AI (label `AI KNOWLEDGE` in maiuscolo). Contiene le stesse categorie di prima (Decisions, Bug Fix, Pattern, Gotcha) ma sotto un header distinto.

### Separatori

Le sezioni sono divise da separatori orizzontali sfumati (gradiente) per una gerarchia visiva chiara.

## Audience Indicators

Il Brain UI distingue i contenuti per audience con badge colorati:

| Badge | Colore | Icona | Significato |
|-------|--------|-------|-------------|
| User | Verde | Icona utente | Contenuto per umani (guide narrative) |
| Bot | Viola | Icona robot | Contenuto per AI (entry tecnici) |

## Timeline

Mostra l'attivita' in ordine cronologico inverso (piu' recente in alto), raggruppata per giorno.

Due fonti di dati:
1. **Diary** (`documentation/diary/*.md`) — le entry del diario giornaliero
2. **JSONL** (`~/.claude/projects/*/`) — eventi delle sessioni Claude (commit, tool calls)

Le entry del diary mostrano solo la data (senza orario). Gli eventi JSONL mostrano l'orario reale.

## Knowledge

Griglia di card, una per entry. Ogni card mostra:
- Titolo (estratto dal primo heading `#` del file)
- Tipo (badge colorato)
- Data di creazione
- Tags

Le entry sono ordinate per data decrescente (le piu' recenti prima).

Cliccando una card si apre l'editor inline.

## Graph

Grafo interattivo delle connessioni tra entry, con **filtri per audience**.

### Filtri

Tre bottoni in alto a destra:

| Filtro | Cosa mostra |
|--------|-------------|
| **All** | Tutti i nodi (AI + Human) |
| **AI** (icona Bot) | Solo nodi AI Knowledge (gotcha, pattern, decision, bug) |
| **Human** (icona User) | Solo nodi Human Guides (guide + hub feature) |

### Nodi AI

Ogni nodo e' un entry, colorato per tipo. Le connessioni sono basate sui tag condivisi — piu' tag in comune, piu' forte la connessione. Tag usati da piu' di 20 nodi vengono esclusi per evitare cluster troppo densi.

### Nodi Guide (Human)

Le guide sono organizzate a stella intorno a nodi hub:

- **Hub node** — nodo centrale piu' grande (verde scuro `#16a34a`, val: 6), rappresenta una feature (es. "Brain"). Non e' cliccabile.
- **Page nodes** — nodi verdi (`#22c55e`, val: 2) collegati al hub, una per pagina della guida. Cliccando si apre l'editor.

Il layout a stella rende immediata la relazione feature → pagine.

### Interazione

Si puo' zoomare, trascinare i nodi, e cliccare per aprire l'editor (eccetto i nodi hub).

## Editor

Quando clicchi un entry (da Knowledge o Graph) o un file pinnato, si apre l'editor inline al posto della vista attiva. Mostra il markdown renderizzato con supporto per:

- Headings, bold, italic, inline code
- Link (colore arancione `#FF6B35`)
- Tabelle con header evidenziato e hover sulle righe
- Code blocks

Il bottone X in alto chiude l'editor e torna alla vista precedente.
