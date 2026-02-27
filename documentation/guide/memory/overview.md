---
type: guide
project: quack-app
created: 2026-02-27
tags: [memory, claude-code, settings, auto-memory]
---

# Memoria di Claude Code

Claude Code salva automaticamente quello che impara mentre lavora: pattern del progetto, preferenze, insight di debug, note architetturali. Questi appunti persistono tra sessioni diverse, permettendo a Claude di riprendere il contesto senza ripartire da zero ogni volta.

## Cos'e' la Memoria Automatica

Ogni volta che Claude Code lavora su un progetto, puo' salvare nella memoria informazioni utili per le sessioni future. Non si tratta di una chat history — e' una knowledge base strutturata che Claude stesso decide di popolare quando incontra qualcosa che vale la pena ricordare.

Esempi di cosa Claude puo' salvare:

- "In questo progetto si usa `pnpm`, non `npm`"
- "I test API richiedono Redis locale sulla porta 6379"
- "Il file chiave per la logica di autenticazione e' `src/auth/authService.ts`"
- "Build command: `cargo tauri dev`, non usare `npm run dev` direttamente"

La prossima sessione, Claude trova gia' questo contesto nel system prompt e lo usa immediatamente — senza che tu debba rispiegare le stesse cose.

## Dove viene salvata la memoria

Ogni progetto ha una directory dedicata:

```
~/.claude/projects/-{percorso-progetto}/memory/
```

Ad esempio, per il progetto in `/Users/alekdob/Desktop/Dev/quack-app`, la directory sarebbe:

```
~/.claude/projects/-Users-alekdob-Desktop-Dev-quack-app/memory/
```

Il file principale e' `MEMORY.md`. Claude carica automaticamente le **prime 200 righe** di questo file nel system prompt all'inizio di ogni sessione.

Puoi anche creare file topic separati nella stessa cartella — ad esempio `debugging.md` o `patterns.md` — che Claude legge on-demand quando servono. Questo ti permette di tenere `MEMORY.md` conciso e spostare i dettagli in file piu' specifici.

## Come attivare o disattivare la memoria

Vai in **Settings → Claude Code** e cerca la sezione **Memory**.

| Stato | Cosa succede |
|-------|-------------|
| Toggle ON (default) | La memoria automatica e' attiva. Claude salva e legge la memoria ad ogni sessione. |
| Toggle OFF | Scrive `"autoMemoryEnabled": false` in `~/.claude/settings.json`. Claude non salva piu' nulla automaticamente. |

:::callout[info]
La modifica ha effetto sulle sessioni successive. Le sessioni gia' aperte non vengono influenzate.
:::

:::callout[warning]
Se hai impostato la variabile d'ambiente `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1`, il toggle viene disabilitato con un avviso. La variabile d'ambiente ha la precedenza sulla configurazione in Settings.
:::

## Come aprire la cartella Memory

Nella sidebar di Quack, passa il mouse sopra il nome di un progetto — appare una barra di azioni con icone. Tra queste c'e' un bottone **cyan** (icona cartella/memoria) che apre direttamente la directory memory del progetto nel Finder.

Se la directory non esiste ancora, Quack mostra un toast:

> "Memory not initialized. Start a Claude Code session first."

La cartella viene creata automaticamente alla prima sessione Claude Code sul progetto.

## Cosa salva Claude nella memoria

Claude decide in autonomia cosa vale la pena salvare. In generale tende a memorizzare:

| Categoria | Esempi |
|-----------|--------|
| **Pattern del progetto** | Comandi build, convenzioni per i test, stile del codice |
| **Insight di debug** | Soluzioni a problemi ricorrenti, cause di errori comuni |
| **Note architetturali** | File chiave, relazioni tra moduli, decisioni tecniche |
| **Preferenze utente** | Stile di comunicazione preferito, workflow abituali |

Non tutto viene salvato — Claude salva solo le informazioni che ritiene utili e durature. Informazioni temporanee o specifiche di un singolo task non vengono memorizzate.

## Come chiedere a Claude di ricordare qualcosa

Basta dirglielo direttamente durante una sessione:

```
"Ricorda che in questo progetto usiamo pnpm, non npm"
```

```
"Salva in memoria che i test API richiedono Redis locale attivo sulla porta 6379"
```

```
"Tieni a mente che il file src/auth/authService.ts e' il punto di ingresso per tutta la logica auth"
```

Claude aggiorni `MEMORY.md` con l'informazione e la trovera' gia' caricata nelle sessioni successive.

## Come modificare la memoria manualmente

I file nella cartella memory sono normali file markdown — puoi aprirli con qualsiasi editor di testo.

Alcune cose da tenere a mente:

- `MEMORY.md` viene caricato solo per le **prime 200 righe**: tienilo conciso. Se la memoria cresce, sposta i dettagli in file topic separati (`debugging.md`, `conventions.md`, ecc.)
- I file aggiuntivi vengono letti on-demand da Claude quando sono rilevanti per il task in corso
- Puoi eliminare informazioni obsolete direttamente dal file — Claude non le vedra' piu' nelle sessioni successive
- Le modifiche manuali hanno effetto dalla sessione successiva in poi

:::callout[info]
Per aprire rapidamente la cartella memory del tuo progetto, usa il bottone cyan nella barra azioni del progetto nella sidebar di Quack, invece di navigare manualmente nel Finder.
:::
