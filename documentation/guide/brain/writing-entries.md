# Scrivere Entry nel Brain

In genere sono gli agenti AI a scrivere nel Brain, ma puoi farlo anche tu manualmente. Ecco il formato e le regole.

## Formato file

Ogni entry e' un file `.md` con frontmatter YAML in cima:

```markdown
---
type: gotcha
created: 2026-02-14
last_verified: 2026-02-14
tags: [tauri, cli, rust]
---

# Titolo descrittivo

Contenuto in markdown...
```

### Campi obbligatori

| Campo | Formato | Note |
|-------|---------|------|
| `type` | stringa | Uno tra: `gotcha`, `pattern`, `decision`, `bug_fix`, `diary`, `preference`, `person`, `tool` |
| `created` | YYYY-MM-DD | Data di creazione |
| `tags` | array | Minimo 1 tag, usare nomi brevi e riutilizzabili |

### Campi opzionali

| Campo | Formato | Note |
|-------|---------|------|
| `last_verified` | YYYY-MM-DD | Ultima volta che il contenuto e' stato confermato corretto |
| `project` | stringa | Nome del progetto (obbligatorio per diary) |
| `summary` | stringa | Riassunto in 1 riga per la Dashboard umana |

### last_verified

Questo campo traccia la "freschezza" dell'entry. Se un entry ha `last_verified` piu' vecchio di 3 mesi, o se fa riferimento a numeri di riga specifici nel codice, va ri-verificato o rimosso.

## Naming

I nomi dei file devono essere **auto-descrittivi** in kebab-case:

| Buono | Cattivo |
|-------|---------|
| `gotcha-tauri-execute-command-parsing.md` | `gotcha-1.md` |
| `fix-stamina-bar-prompt-caching.md` | `bug-fix-feb.md` |
| `decision-remove-monaco-use-codemirror.md` | `editor-decision.md` |

Il nome deve bastare a capire il contenuto senza aprire il file.

## Dove salvare

| Tipo | Cartella | Livello |
|------|----------|---------|
| gotcha | `gotchas/` | Progetto o Globale |
| pattern | `patterns/` | Progetto o Globale |
| decision | `decisions/` | Solo Progetto |
| bug_fix | `bugs/` | Solo Progetto |
| diary | `diary/` | Progetto o Globale |
| preference | `preferences/` | Solo Globale |
| person | `people/` | Solo Globale |
| tool | `tools/` | Solo Globale |

**Regola:** se l'entry e' specifico di un progetto, va in `{progetto}/documentation/`. Se e' cross-progetto, va in `~/.quack/brain/`.

## Criteri per salvare

L'agente AI segue 4 criteri prima di creare un entry:

1. **Scoperta genuina?** Non basta una ricerca nella documentazione
2. **Utile tra 6 mesi?** Se e' troppo specifico o temporaneo, non salvare
3. **Soluzione verificata?** Non salvare ipotesi non testate
4. **Trigger chiaro?** Deve essere ovvio QUANDO questo entry e' rilevante

Se tutti e 4 sono veri, l'entry viene salvato. Se l'entry e' critico (gotcha che fa perdere ore, pattern architetturale), viene anche linkato nel CLAUDE.md del progetto.

## Diary: il diario giornaliero

Il diary ha regole speciali:

- **Un file per giorno**: `diary/2026-02-14.md`
- **Max 30 righe**: se sfora, i dettagli vanno in un entry dedicato (bug/pattern)
- **Ogni bullet**: COSA + INSIGHT CHIAVE
- **No tags** nel frontmatter del diary
- **Campo `date`** al posto di `created`

```markdown
---
type: diary
project: quack-app
date: 2026-02-14
---
- Brain v2: aggiunto last_verified per tracciare la freschezza degli entry
- Fix timeline: rimossi timestamp fittizi, ora mostra solo la data per le entry diary
```

## Modificare entry esistenti

Puoi aprire qualsiasi entry nell'editor del Brain UI (cliccando la card) o direttamente nel tuo editor di codice. Il file e' un semplice markdown.

Quando modifichi, aggiorna `last_verified` alla data corrente per segnalare che il contenuto e' ancora valido.
