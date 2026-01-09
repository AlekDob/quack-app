---
description: "Esegui sempre questo approccio per ogni task di sviluppo"
globs: ["**/*.ts", "**/*.tsx", "**/*.rs", "**/*.md"]
---

# APATR-D: Analyze → Plan → Act → Test → Review → Document

Workflow operativo per garantire qualità, tracciabilità e knowledge retention.

---

## 1. ANALYZE - Investigate Before Acting

**SEMPRE leggere e comprendere il codice prima di proporre modifiche.**

```
✅ DO: Leggi i file rilevanti, cerca pattern esistenti, cerca nel Brain
❌ DON'T: Speculare su codice non letto, assumere strutture
```

**Azioni obbligatorie:**
- [ ] Cerca nel Brain contesto rilevante: `mcp__brain__smart_search({ query: "..." })`
- [ ] Leggi i file coinvolti prima di proporre soluzioni
- [ ] Identifica vincoli, dipendenze e pattern esistenti
- [ ] Se il task è ambiguo, fai domande specifiche prima di procedere

**Anti-pattern da evitare:**
- Proporre soluzioni senza aver letto il codice
- Assumere strutture dati o API non verificate
- Ignorare pattern già presenti nel progetto

---

## 2. PLAN - Design Before Implementation

**Prepara un piano chiaro. Se qualcosa non è chiaro, chiedi.**

**Per task frontend:**
- Usa le skill: `frontend-design` e `brand-guidelines` come bussola
- Evita l'estetica "AI slop" - sii creativo e distintivo

**Per task complessi:**
- Crea una todo list strutturata con `TodoWrite`
- Definisci criteri di successo chiari
- Identifica il minimum viable solution (evita over-engineering)

**Principio guida:**
> "The right amount of complexity is the minimum needed for the current task."

---

## 3. ACT - Implement with Focus

**Implementa seguendo il piano. Delega ai droids specializzati se necessario.**

| Tipo di lavoro | Droid/Skill da usare |
|----------------|---------------------|
| Frontend React/UI | `frontend-developer` |
| Backend/Data | `data-engineer` |
| Rust/Tauri | Implementazione diretta |

**Regole di implementazione:**
- Una cosa alla volta - completa prima di passare oltre
- Usa `git` per checkpoint e tracking dello stato
- Non creare file temporanei/helper non necessari
- Riusa astrazioni esistenti (DRY principle)

---

## 4. TEST - Smart Testing, Not Excessive Testing

**Test mirati e proporzionati alla complessità del cambiamento.**

```
⚠️ IMPORTANTE: Non over-testare. I test devono essere proporzionati.
```

**Quando testare:**
- [ ] Nuove feature con logica complessa
- [ ] Bug fix che potrebbe regredire
- [ ] Cambiamenti a funzioni critiche (auth, pagamenti, dati)

**Quando NON serve un test formale:**
- Modifiche cosmetiche/UI minori
- Refactoring che non cambia comportamento
- Fix di typo o documentazione
- Cambiamenti già coperti da test esistenti

**Come testare:**
1. **Verifica manuale rapida** - sempre
2. **Test esistenti** - `npm test` per verificare non regressione
3. **Nuovo test** - solo se aggiunge valore reale (vedi criteri sopra)

**Se serve test-engineer droid:** Usalo solo per test suite complesse o copertura critica, non per ogni singolo cambiamento.

---

## 5. REVIEW - Verify Quality

**Revisione del codice con focus su standard e correttezza.**

**Checklist:**
- [ ] Il codice segue i pattern del progetto?
- [ ] Nessuna regressione introdotta?
- [ ] TypeScript strict soddisfatto?
- [ ] Nessun `any` type introdotto?
- [ ] File < 300 righe, funzioni < 20 righe?

**Per review approfondite:** Usa `/code-review` per analisi AI di security e performance.

---

## 6. DOCUMENT - Save to Brain (Not Files)

**Documenta nel Quack Brain, non in file locali.**

```
✅ DO: Salva pattern, decisioni e bug fix nel Brain
❌ DON'T: Creare file .md nella cartella del progetto per documentazione
```

**Cosa documentare nel Brain:**

| Tipo | Entity Type | Quando |
|------|-------------|--------|
| Bug risolto | `bug` | Sempre per bug non triviali |
| Pattern scoperto | `pattern` | Quando è riusabile |
| Decisione architetturale | `decision` | Scelte significative |
| Gotcha/Pitfall | `gotcha` | Problemi che altri potrebbero incontrare |
| Feature implementata | `note` | Feature significative |

**Struttura feature-based (Quack Brain):**
```
QuackBrain/projects/quack-app/
├── terminal/
│   ├── bug-pty-crash.md
│   └── pattern-process-management.md
├── kanban/
│   └── decision-task-isolation.md
└── chat/
    └── pattern-streaming.md
```

**Come salvare:**
```typescript
mcp__brain__create_entity({
  name: "bug-{feature}-{descrizione}",  // o pattern-, decision-, etc.
  entityType: "bug",                     // bug, pattern, decision, gotcha, note
  projectId: "quack-app",               // scope al progetto
  observations: ["Descrizione del problema e soluzione"]
})
```

---

## Quick Reference

```
┌─────────────────────────────────────────────────────────────────┐
│  APATR-D Workflow                                               │
├─────────────────────────────────────────────────────────────────┤
│  1. ANALYZE  │ Leggi codice, cerca nel Brain, identifica scope  │
│  2. PLAN     │ Todo list, criteri successo, minimum viable      │
│  3. ACT      │ Implementa, delega ai droids, una cosa alla volta│
│  4. TEST     │ Smart testing - proporzionato, non eccessivo     │
│  5. REVIEW   │ Standard check, no regression, /code-review      │
│  6. DOCUMENT │ Salva nel Brain (NON file locali)                │
└─────────────────────────────────────────────────────────────────┘
```

**Principi chiave:**
1. 🔍 Investigate before acting
2. 📐 Minimum viable complexity
3. 🧪 Test smart, not excessive
4. 🧠 Document in Brain, not files