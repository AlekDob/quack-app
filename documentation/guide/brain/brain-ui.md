# Brain UI - La finestra visuale

Il Brain ha una finestra dedicata che si apre come webview Tauri separata. Mostra la conoscenza del progetto in modo visuale.

## Come aprirla

Dalla app principale di Quack, il pulsante Brain apre la finestra. Si apre con il path del progetto attivo.

## Layout

La finestra ha due aree:

- **Sidebar** (sinistra): navigazione, scope toggle, conteggi
- **Content** (destra): la vista attiva (Timeline, Knowledge, Graph) o l'editor

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
- **Knowledge** — griglia di entry per categoria
- **Graph** — grafo delle connessioni tra entry

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

Grafo interattivo delle connessioni tra entry. Ogni nodo e' un entry, colorato per tipo. Le connessioni sono basate sui tag condivisi — piu' tag in comune, piu' forte la connessione.

Si puo' zoomare, trascinare i nodi, e cliccare per aprire l'editor.

Tag usati da piu' di 20 nodi vengono esclusi per evitare cluster troppo densi.

## Editor

Quando clicchi un entry (da Knowledge o Graph) o un file pinnato, si apre l'editor inline al posto della vista attiva. Mostra il markdown renderizzato con possibilita' di modifica.

Il bottone X in alto chiude l'editor e torna alla vista precedente.
