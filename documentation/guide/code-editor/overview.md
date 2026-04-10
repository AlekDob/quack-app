---
type: guide
project: quack-app
created: 2026-04-10
tags: [editor, codemirror, diff, outline, preview, markdown, mermaid, code-intel, shortcut, multi-tab]
---

# Code Editor — L'editor integrato di Quack

Il Code Editor e' l'editor di codice integrato in Quack, costruito su CodeMirror 6. Ti permette di leggere e modificare i file del progetto senza uscire dall'app, vedere le modifiche proposte dall'agente in modalita' diff, e navigare il codice tramite l'outline AST.

## Come aprirlo

| Metodo | Descrizione |
|--------|-------------|
| `Cmd+E` | Apri/chiudi il tab editor (toggle) |
| Click su un file | Da File Explorer, chat, o Brain sidebar |
| Click sul titolo nel popover Whiteboard | Apre direttamente il `.md` della feature |
| Chip simbolo in chat | Naviga a una definizione nel codice |

Se nelle impostazioni e' selezionato "Editor esterno" come target, i click sui file aprono l'IDE esterno (VS Code, Cursor, ecc.) invece dell'editor interno.

## Multi-tab: un tab per file

Ogni file aperto crea il proprio tab, identificato dal percorso (`code-editor-{path}`). Puoi avere piu' file aperti contemporaneamente e passare da uno all'altro senza perdere la posizione del cursore.

## Linguaggi supportati

L'editor supporta 23 linguaggi con syntax highlighting:

| Gruppo | Linguaggi |
|--------|-----------|
| Web | JavaScript, TypeScript, HTML, CSS, SCSS, Less, Vue |
| Backend | Python, Rust, Go, Java, PHP, C/C++, Ruby |
| Mobile | Swift, Kotlin, Dart |
| Config/Data | JSON, YAML, XML, TOML, SQL, Markdown, Shell |

## Funzionalita' principali

### Ricerca e sostituzione (Cmd+F)

Premi `Cmd+F` per aprire il pannello di ricerca integrato. Supporta regex, case-sensitive e ricerca per parola intera. La ricerca evidenzia tutte le occorrenze nel file corrente.

### Minimap

Sulla destra dell'editor c'e' la minimap, una vista compatta del file che mostra la struttura del codice in piccolo. Clicca sulla minimap per navigare velocemente nelle sezioni del file.

### Salvataggio (Cmd+S)

Salva il file con `Cmd+S`. La status bar in fondo all'editor mostra lo stato: "Salvato" / "Non salvato". Il file viene scritto direttamente su disco via Tauri.

## Outline panel (code-intel)

L'outline mostra i simboli del file corrente: funzioni, classi, variabili, tipi — estratti tramite tree-sitter in modo accurato.

**Come attivarlo**: clicca il pulsante "Toggle Outline" nell'header dell'editor (visibile solo per i linguaggi supportati).

**Navigazione**: clicca un simbolo nell'outline per saltare direttamente a quella riga nel file.

**Linguaggi supportati dall'outline** (14 in totale): JavaScript, TypeScript, Python, Rust, Go, Java, PHP, C, C++, Ruby, Swift, Kotlin, Dart, Vue.

Il pulsante Outline non appare per file in linguaggi non supportati (JSON, YAML, HTML, ecc.).

## Preview mode (Cmd+Shift+P)

Per i file `.md`, `.mdx`, `.mmd` e `.html`, il pulsante "Preview" nell'header attiva la modalita' anteprima:

| Estensione | Preview |
|------------|---------|
| `.md` / `.mdx` | Markdown renderizzato con chip cliccabili per file e simboli |
| `.mmd` | Diagramma Mermaid con zoom/pan |
| `.html` / `.htm` | Iframe sandboxed con auto-resize |

In modalita' Preview, il pulsante Outline viene nascosto. Premi di nuovo `Cmd+Shift+P` per tornare all'editor.

## Modalita' Diff — revisione delle modifiche agente

Quando l'agente propone una modifica a un file (tool `editFile`), l'editor entra automaticamente in modalita' Diff. Vedi il file originale e la versione proposta affiancati, con le righe aggiunte/modificate/rimosse evidenziate.

Hai tre opzioni:

| Pulsante | Shortcut | Azione |
|----------|----------|--------|
| Accetta | — | Scrive la versione proposta su disco |
| Rifiuta | — | Scarta la modifica, torna alla versione originale |
| Modifica | — | Passa in modalita' edit per intervenire manualmente |

Dopo la tua scelta, la risposta viene inviata all'agente e il flusso continua.

## Navigazione da simbolo in chat

Quando l'agente menziona una funzione o un simbolo nel messaggio di chat, appare un chip cliccabile. Cliccando il chip:

1. L'editor apre (o passa al focus su) il file che contiene il simbolo
2. Lo scorrimento si posiziona sulla riga della definizione
3. Il cursore viene piazzato sulla riga

Se la definizione non viene trovata, appare un toast "Definizione non trovata".

## Popout window

Il tab Code Editor puo' essere estratto in una finestra separata, come tutti i tab di Quack. Utile per lavorare su due monitor o tenere il file aperto mentre scrivi nella chat principale.

## Aprire con IDE esterno

Nell'header dell'editor c'e' il dropdown IDE con due opzioni:

- **Apri in [VS Code / Cursor / ...]**: apre il file nell'IDE configurato, posizionandosi sulla riga corrente se disponibile
- **Mostra nel Finder** (macOS) / **Mostra in Explorer** (Windows): rivela il file nel file manager di sistema

## Impostazioni

In Impostazioni > Editor, puoi configurare:

**File open target**: scegli se i file si aprono nell'editor interno di Quack o direttamente nell'IDE esterno. Cambia questa preferenza in base al tuo workflow.

**IDE preferito**: seleziona VS Code, Cursor, o altro IDE installato sul sistema.

## Scorciatoie tastiera

| Azione | macOS | Windows/Linux |
|--------|-------|---------------|
| Apri/chiudi editor | `Cmd+E` | `Ctrl+E` |
| Salva | `Cmd+S` | `Ctrl+S` |
| Ricerca | `Cmd+F` | `Ctrl+F` |
| Toggle Preview | `Cmd+Shift+P` | `Ctrl+Shift+P` |

---

Vedi anche: [Whiteboard](../whiteboard/overview.md) — il Whiteboard usa il Code Editor per aprire i file feature direttamente dal popover.
