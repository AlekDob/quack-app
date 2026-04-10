---
type: guide
project: quack-app
created: 2026-04-10
tags: [whiteboard, feature-map, canvas, annotazioni, architettura, nested-components, agente]
---

# Whiteboard — La mappa visuale del tuo progetto

Il Whiteboard e' la mappa interattiva di Quack. Visualizza tutti i tuoi feature doc come nodi su una canvas SVG, raggruppati per layer architetturale. In un colpo d'occhio vedi com'e' strutturato il tuo progetto, quali feature condividono file, e dove si trovano le connessioni tra i moduli.

## Come aprirlo

Premi `Cmd+Shift+W` (macOS) oppure `Ctrl+Shift+W` (Windows/Linux). In alternativa, clicca l'icona Whiteboard nella action bar in alto.

Il Whiteboard legge automaticamente tutti i file in `documentation/features/` del progetto corrente e costruisce il grafo.

## Layer architetturali e auto-classificazione

Ogni feature viene classificata automaticamente in uno dei tre layer in base ai tag nel frontmatter:

| Layer | Colore | Keywords usate per la classificazione |
|-------|--------|---------------------------------------|
| UI Components | Cyan (`#5ce0ff`) | editor, tab, whiteboard, search, diff, visualization, popout |
| Business Logic | Viola (`#c084fc`) | permission, team, sdk, agent-mode, chat, mention, delegation |
| Infrastructure | Grigio (`#94a3b8`) | terminal, ide, git, tauri, context-injection |

Se una feature non corrisponde chiaramente a nessun layer, viene messa in Infrastructure. Le connessioni tra nodi appaiono quando due feature condividono gli stessi file sorgente.

## Interagire con i nodi

**Click su un nodo** apre un popover con il dettaglio della feature: titolo, scopo, file coinvolti, feature connesse. Se il frontmatter contiene `image: images/screenshot.png`, viene mostrata un'anteprima. Cliccando il titolo nel popover, il file `.md` si apre nel Code Editor.

**Drag su un nodo** lo riposiziona liberamente sulla canvas. Le posizioni custom vengono salvate in `.whiteboard.json`. Un puntino giallo indica i nodi con posizione personalizzata.

**Reset** — se hai spostato dei nodi, compare un pulsante "Reset" nell'header. Cliccandolo, tutti i nodi tornano al layout automatico.

## Annotazioni: post-it, gruppi, immagini

Puoi arricchire il canvas con tre tipi di annotazioni, tutte persistite in `.whiteboard.json`:

**Post-it**: note testuali colorate. Clicca sulla canvas in modalita' Post-it per crearne una. Puoi trascinarla, editare il testo cliccandoci sopra, cambiare colore (6 preset) o eliminarla con il pulsante che appare all'hover.

**Group rect**: rettangoli con etichetta per raggruppare visivamente aree del canvas. In modalita' Group, disegna il rettangolo con click-drag. Puoi ridimensionarlo dai 4 angoli e rinominare l'etichetta.

**Immagini**: screenshot o diagrammi direttamente sulla canvas. Trascinali dal Finder/Explorer oppure seleziona la modalita' Image nella toolbar e clicca per aprire il file picker. Le immagini vengono salvate in `documentation/features/images/`.

## Toolbar e modalita'

La toolbar flottante in basso al centro gestisce le modalita' della canvas:

| Modalita' | Descrizione |
|-----------|-------------|
| Select | Modalita' default — click e drag su nodi/annotazioni |
| Lasso | Click-drag per selezionare piu' elementi in area |
| Post-it | Click sulla canvas per creare un post-it |
| Group | Click-drag per disegnare un rettangolo di gruppo |
| Image | Click sulla canvas per inserire un'immagine da file picker |

Premi `Escape` per tornare in modalita' Select e deselezionare tutto.

## Multi-selezione e drag di gruppo

Puoi selezionare piu' elementi in due modi:

- **Lasso**: passa in modalita' Lasso e disegna un rettangolo attorno agli elementi
- **Shift+click**: tieni Shift e clicca sui singoli nodi o annotazioni per aggiungerli alla selezione

Gli elementi selezionati mostrano un bordo blu. Il badge nella toolbar indica quanti elementi sono selezionati. Trascinando uno qualsiasi degli elementi selezionati, tutti si muovono insieme.

## Navigazione sulla canvas

**Pan**: trascina lo sfondo oppure usa il trackpad (due dita per scorrere, pinch per zoomare).
**Zoom**: rotella del mouse, `Ctrl+scroll`, oppure pinch sul trackpad.
**Middle-click drag**: sempre pan, indipendentemente dalla modalita'.
**Space+drag**: forza pan anche in modalita' annotazione (stile Figma).

Al primo caricamento, il canvas fa auto-fit per mostrare tutto il contenuto. I layer collassabili si gestiscono cliccando l'intestazione del layer.

## Minimap

In basso a destra c'e' la minimap: un pannello overview che mostra tutti i nodi come puntini colorati e il viewport corrente come rettangolo. Clicca un punto della minimap per navigare rapidamente in quella zona del canvas.

## Undo / Redo

| Azione | macOS | Windows/Linux |
|--------|-------|---------------|
| Undo | `Cmd+Z` | `Ctrl+Z` |
| Redo | `Cmd+Shift+Z` | `Ctrl+Shift+Z` |

Lo stack undo copre: creazione/modifica/eliminazione di annotazioni, riposizionamento di nodi, reset. Lo stack in memoria tiene fino a 50 snapshot.

## Componenti annidati (Matryoshka)

I componenti sono group rect speciali che funzionano come sub-whiteboard. Permettono di organizzare annotazioni in livelli gerarchici, fino a 5 livelli di profondita'.

**Creare un componente**: seleziona 2 o piu' annotazioni, poi clicca "Create Component" nella toolbar. Le annotazioni selezionate diventano i figli del componente.

**Entrare in un componente**: doppio-click sul componente per entrare e vedere solo i suoi figli. I nodi feature vengono nascosti.

**Navigazione con breadcrumb**: la barra in alto mostra il percorso `Root > Genitore > Componente Corrente`. Clicca un segmento per risalire.

**Uscire**: premi `Escape` o `Backspace` per tornare al livello superiore.

**Drag-assign**: trascinando un'annotazione sopra un componente, questa viene assegnata al componente (bordo ambra durante l'hover).

**Drag-eject**: dentro un componente, trascina un'annotazione verso il bordo superiore della canvas per espellerla al livello superiore.

## Skill agente: `/whiteboard`

L'agente puo' interagire con il Whiteboard via skill. Le modifiche appaiono sulla canvas entro 2 secondi (polling).

| Azione | Descrizione |
|--------|-------------|
| `list` | Mostra lo stato corrente del whiteboard |
| `add-postit --color --near` | Aggiunge un post-it vicino a un nodo |
| `add-group --around` | Crea un rettangolo di gruppo attorno a nodi indicati |
| `move` | Riposiziona un nodo |
| `clear` | Reset selettivo dello stato |
| `organize` | Auto-layout + gruppi + riepilogo |
| `create-component --around [id1, id2] --label "Nome"` | Crea un componente da annotazioni esistenti |

## Dove vengono salvati i dati

Tutto lo stato del Whiteboard (posizioni, annotazioni, componenti) e' in `documentation/features/.whiteboard.json`. Questo file viene committato con il repo, quindi il team condivide la stessa mappa.

Le immagini canvas sono in `documentation/features/images/`.

## Integrare le feature nella chat

**Drag dalla sidebar**: nel pannello Features della sidebar (icona grafo, colore oro), trascina una feature nella chat. Viene inserita come mention `@file:documentation/features/xxx.md`.

**Autocomplete @**: mentre scrivi nel campo chat, digita `@` e cerca per titolo, tag o "feature". La feature appare come chip dorato sopra il campo di testo.

---

Vedi anche: [Componenti Annidati](../whiteboard-nested-components/README.md) per dettagli avanzati sul sistema Matryoshka.
