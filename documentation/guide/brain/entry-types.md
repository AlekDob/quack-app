# Tipi di Entry

Ogni file nel Brain ha un `type` nel frontmatter YAML. Il tipo determina dove viene salvato e come viene mostrato nella UI.

## I tipi principali

### Gotcha

**Cos'e':** un errore subdolo, non ovvio, che fa perdere tempo se non lo conosci.

**Quando si crea:** quando l'agente (o tu) trova un comportamento inaspettato — qualcosa che "dovrebbe funzionare" ma non funziona per un motivo nascosto.

**Esempio:** Tauri splitta gli argomenti di un comando con `split_whitespace()`, che non rispetta le virgolette. Se passi un path con spazi, si rompe silenziosamente.

**Struttura tipica:**
```markdown
---
type: gotcha
created: 2026-02-02
tags: [tauri, rust]
---
# Gotcha: Titolo descrittivo

## Problem
Cosa succede e perche' e' inaspettato

## Impact
Cosa si rompe in pratica

## Workarounds
Come risolvere
```

**Dove:** `documentation/gotchas/` (progetto) o `~/.quack/brain/gotchas/` (globale)

---

### Pattern

**Cos'e':** una soluzione riutilizzabile a un problema ricorrente.

**Quando si crea:** quando trovi un approccio che funziona bene e puo' essere applicato in situazioni simili.

**Esempio:** il pattern del Brain System stesso — come organizzare un knowledge store a due livelli con file markdown.

**Struttura tipica:**
```markdown
---
type: pattern
created: 2026-02-13
tags: [architecture, knowledge-store]
---
# Pattern: Nome

## Overview
Cosa risolve

## Architecture
Come funziona

## Implementation
Dettagli tecnici
```

**Dove:** `documentation/patterns/` o `~/.quack/brain/patterns/`

---

### Decision

**Cos'e':** il perche' di una scelta architetturale. Non cosa hai fatto, ma *perche' hai scelto questo approccio*.

**Quando si crea:** quando prendi una decisione tecnica significativa — scelta di una libreria, cambio di architettura, rimozione di un componente.

**Esempio:** "Rimuovere Monaco Editor e usare CodeMirror" — con motivazioni, alternative valutate, e trade-off accettati.

**Struttura tipica:**
```markdown
---
type: decision
created: 2026-01-20
tags: [editor, architecture]
---
# Decision: Cosa hai deciso

## Context
Perche' serviva decidere

## Options Considered
Alternative valutate

## Decision
Cosa hai scelto e perche'

## Consequences
Trade-off accettati
```

**Dove:** `documentation/decisions/` (sempre a livello progetto)

---

### Bug Fix

**Cos'e':** l'analisi di un bug — root cause, fix, e la lezione imparata.

**Quando si crea:** quando il fix di un bug rivela qualcosa di non ovvio che vale la pena ricordare.

**Esempio:** la stamina bar mostrava 100% perche' `input_tokens` con il prompt caching restituisce solo i token non-cached, non il totale.

**Struttura tipica:**
```markdown
---
type: bug_fix
created: 2026-02-13
tags: [react, tokens]
---
# Fix: Descrizione

## Problem
Sintomo visibile

## Root Cause
Perche' succede

## Solution
Come e' stato risolto

## Key Insight
La lezione da portarsi a casa
```

**Dove:** `documentation/bugs/`

---

### Diary

**Cos'e':** il diario giornaliero — cosa e' stato fatto oggi, in bullet points.

**Quando si crea:** automaticamente, ogni giorno di lavoro. Max 30 righe.

**Esempio:**
```markdown
---
type: diary
project: quack-app
date: 2026-02-14
---
- Brain v2: aggiunto campo last_verified per staleness tracking
- Fix timeline: rimossi timestamp fittizi dalle entry del diary
- Creata sezione Knowledge Base nel CLAUDE.md
```

Ogni bullet = COSA + INSIGHT CHIAVE. I dettagli vanno nei bug/pattern dedicati.

**Dove:** `documentation/diary/` (progetto) o `~/.quack/brain/diary/` (globale)

---

## Tipi solo globali

Questi tipi vivono solo in `~/.quack/brain/`:

| Tipo | Uso |
|------|-----|
| `preference` | Preferenze personali (stile di codice, tool preferiti) |
| `person` | Note sulle persone con cui lavori |
| `tool` | Conoscenza specifica su tool (VSCode, Tauri, ecc.) |

## Riepilogo rapido

| Tipo | Domanda chiave | Cartella |
|------|----------------|----------|
| Gotcha | "Perche' non funziona come mi aspetto?" | gotchas/ |
| Pattern | "Come risolvo questo tipo di problema?" | patterns/ |
| Decision | "Perche' abbiamo scelto X?" | decisions/ |
| Bug Fix | "Qual e' la root cause di questo bug?" | bugs/ |
| Diary | "Cosa ho fatto oggi?" | diary/ |
