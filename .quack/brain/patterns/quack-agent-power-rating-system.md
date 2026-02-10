---
type: pattern
project: quack-app
created: 2026-01-10
migrated: true
---

# Quack Agent Power Rating System

## Power Rating System

**Filosofia**: Semplice, intuitivo, non invasivo. Un numero che indica quanto e' "equipaggiato" un agente.

### Formula di Calcolo

```
Power = (Skills x 100) + (Droids x 150) + (Rules x 50) + (Commands x 75) + Base
```

**Pesi:**
| Componente | Peso | Rationale |
|------------|------|----------|
| Skill | 100 | Core abilities |
| Droid | 150 | Subagents sono potenti |
| Rule | 50 | Linee guida, meno impattanti |
| Command | 75 | Utility shortcuts |
| Base | 100 | Tutti partono da 100 |

### Esempi

**Agent Minimal** (1 skill):
- Power = 100 + 100 = **200**

**Agent Standard** (2 skills, 1 droid, 2 rules):
- Power = 200 + 150 + 100 + 100 = **550**

**Agent Pro** (4 skills, 2 droids, 3 rules, 2 commands):
- Power = 400 + 300 + 150 + 150 + 100 = **1100**

### UI Display

```
+------------------+
| POWER: 850       |
| ||||||||....     |
+------------------+
```

- Barra visuale con colore gradient (verde -> giallo -> rosso)
- Numero prominente
- Opzionale: breakdown on hover

### Vantaggi

1. **Zero complessita** - Un calcolo, un numero
2. **Feedback immediato** - Vedi subito l'impatto di aggiungere equipment
3. **Comparabile** - Facile confrontare agenti nel marketplace
4. **Non bloccante** - Nessun unlock, nessun livello richiesto

### Tag per Query

Tutta la documentazione del sistema Agent Bundle usa il tag:
**#quack-bundles**

Query: `mcp__brain__search({ query: "quack-bundles" })`

[2026-01-10] Tag: #quack-bundles - Sistema di calcolo power semplice per agenti

[2026-01-10] Moved to quack-bundles/ folder for better organization
