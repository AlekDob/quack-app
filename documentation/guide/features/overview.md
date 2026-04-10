---
type: guide
project: quack-app
created: 2026-04-10
tags: [features, feature-doc, knowledge, architettura, skill, whiteboard, kanban, brain]
---

# Features — I mattoni del tuo progetto

In Quack, le **Features** sono documenti strutturati che descrivono le parti del tuo progetto: componenti, servizi, store, integrazioni. Non sono task da completare, ma descrizioni vive di come il software e' costruito. Ogni feature e' un file Markdown con frontmatter YAML che l'agente legge, indicizza, e usa come base di conoscenza.

## Cosa sono concretamente

Ogni feature corrisponde a un file in `documentation/features/`, nominato con un numero sequenziale:

```
documentation/features/
  001-fulltext-search.md
  002-telegram-chat.md
  024-integrated-code-editor.md
  026-feature-map-whiteboard.md
  .whiteboard.json          <- stato canvas, non editare a mano
  images/                   <- screenshot e immagini delle feature
```

L'agente usa questi file per capire com'e' strutturato il progetto senza dover ogni volta rileggere tutto il codice sorgente.

## Formato del file feature

Ogni file feature ha questa struttura:

```markdown
---
type: feature-doc
project: nome-progetto
stack: React 18 + TypeScript + Tauri v2
created: 2026-04-10
last_verified: 2026-04-10
shortcut: Cmd+Shift+W
tags: [whiteboard, canvas, svg, annotation]
image: images/screenshot.png
---

## Titolo della Feature
**Purpose:** Descrizione concisa dello scopo.
**Stack:** Tecnologie specifiche usate.
**Shortcut:** Scorciatoia tastiera (se applicabile).

### Files
| Type | Path | Exports/Purpose |
|------|------|-----------------|
| Component | `src/components/MyComponent.tsx` | Descrizione |
| Store | `src/stores/myStore.ts` | Stato gestito |

### Data Flow
Descrizione del flusso dati principale.

### Key Functions
- `functionName(params) -> ReturnType` -- descrizione

### State
- `stateName`: tipo -- descrizione

### Config
- Configurazioni rilevanti
```

I campi frontmatter principali:

| Campo | Obbligatorio | Descrizione |
|-------|-------------|-------------|
| `type` | Si | Sempre `feature-doc` |
| `project` | Si | Nome del progetto |
| `stack` | Si | Tecnologie usate |
| `created` | Si | Data creazione `YYYY-MM-DD` |
| `tags` | Si | Array di tag per classificazione |
| `image` | No | Path relativo a `documentation/features/` |
| `shortcut` | No | Shortcut tastiera della feature |

## Numerazione automatica

Le feature sono numerate sequenzialmente: 001, 002, ... 024, 025, 026. Quando crei una nuova feature, il numero viene assegnato in automatico dalla skill che la crea. Non modificare i numeri esistenti — sono usati come riferimento stabile.

## Come creare una Feature

### Metodo 1: skill `/create feature` (consigliato)

Scrivi nella chat con l'agente:

```
/create feature
```

La skill ti guida nella creazione: chiede il nome, lo stack, i file coinvolti, e genera il documento nel formato corretto con il numero sequenziale giusto.

### Metodo 2: skill `feature-creator`

La skill `feature-creator` e' una versione piu' guidata, progettata per creare feature partendo da un'analisi del codice esistente. L'agente esamina i file sorgente e genera automaticamente la tabella Files, le Key Functions e il Data Flow.

### Metodo 3: manuale

Crea un file `documentation/features/NNN-nome-feature.md` rispettando il formato sopra. Utile se vuoi documentare qualcosa rapidamente senza passare per la skill.

## Come aggiornare una Feature

Le feature vanno aggiornate ogni volta che il codice cambia in modo significativo. Puoi:

- Chiedere all'agente di aggiornarla dopo un refactor: "Aggiorna la feature 024 con le modifiche che abbiamo fatto"
- Modificarla manualmente nel Code Editor (`Cmd+E`)
- Fare click sul titolo nel popover del Whiteboard per aprirla direttamente

Tieni aggiornato il campo `last_verified` ogni volta che verifichi che il documento rispecchia ancora il codice reale.

## Come le Feature si integrano con il resto di Quack

### Whiteboard

Ogni feature diventa automaticamente un nodo sulla canvas del [Whiteboard](../whiteboard/overview.md). La classificazione per layer (UI, Business Logic, Infrastructure) avviene leggendo i tag del frontmatter. Le connessioni tra nodi indicano feature che condividono file sorgente.

### Sidebar Features Panel

Nel pannello laterale Features (icona grafo, colore oro), le feature sono raggruppate per layer architetturale. Da qui puoi:
- Cliccare una feature per aprirne il `.md` nel Code Editor
- Trascinarla nella chat per inserire un mention `@file:...`

### Chat con @mention

Puoi citare una feature nella chat in due modi:

**Drag dalla sidebar**: trascina la feature dal pannello Features al campo chat.

**Autocomplete @**: digita `@` nel campo chat, cerca il nome della feature o un suo tag. La feature appare come chip dorato sopra il campo di testo, con il percorso del file inserito come mention.

### Brain

Le feature sono parte del sistema di conoscenza del progetto. L'agente le legge tramite `documentation/AST.md` e `CLAUDE.md`. Quando un agente scopre qualcosa di nuovo su una feature (un bug, un pattern), lo salva nei gotcha/pattern del Brain che possono riferirsi alla feature specifica.

### Kanban

Le feature possono essere tracciate come task nel Kanban board, specialmente durante lo sviluppo di nuove funzionalita'. Il collegamento non e' automatico — sei tu a decidere quando creare un task associato a una feature.

## Best practice

**Una feature, un concetto**: ogni feature deve descrivere una singola funzionalita' coerente. Se ti accorgi che un file sta descrivendo due sistemi separati, spezzalo in due feature.

**Tag significativi**: i tag guidano la classificazione automatica nel Whiteboard e la ricerca nell'autocomplete. Usa termini specifici (es. `codemirror`, `tauri`, `zustand`) invece di generici (es. `frontend`, `backend`).

**Aggiorna quando cambi il codice**: una feature obsoleta e' peggio di nessuna feature. Dopo un refactor, aggiorna il documento. Bastano pochi minuti e l'agente non rimane nel passato.

**Usa `image`**: aggiungere uno screenshot al frontmatter rende il popover nel Whiteboard immediatamente riconoscibile e utile per il team.

**Mantieni la tabella Files accurata**: e' la parte piu' utile per l'agente. File path, tipo, e scopo di ogni file coinvolto. Senza questa, la classificazione nel Whiteboard perde precisione.

---

Vedi anche: [Whiteboard](../whiteboard/overview.md) — come le feature diventano nodi visivi sulla canvas.
