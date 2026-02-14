# Access Chain - Come l'AI trova la conoscenza

L'Access Chain e' il meccanismo con cui un agente AI accede alla memoria del Brain. Funziona a 3 livelli, dal piu' immediato al piu' profondo.

## I 3 livelli

### Livello 1: CLAUDE.md (sempre caricato)

Il file `CLAUDE.md` nella root del progetto viene letto automaticamente dall'agente ad ogni sessione. Contiene una sezione **Knowledge Base** con link diretti ai file piu' importanti:

```markdown
## Knowledge Base
Read `documentation/map.md` for full architecture overview.

**Critical gotchas:**
- Token tracking: `documentation/gotchas/gotcha-branch-display-race-condition.md`
- Tauri commands: `documentation/gotchas/gotcha-tauri-execute-command-parsing.md`
```

L'agente vede subito i path e puo' leggerli direttamente. Zero ricerca, zero perdita di tempo.

### Livello 2: documentation/ (progetto)

Se il CLAUDE.md non copre il problema, l'agente cerca in `documentation/`:
- Legge `map.md` per orientarsi sull'architettura
- Lista i file nelle sottocartelle (gotchas/, patterns/, decisions/)
- I nomi dei file sono auto-descrittivi: `gotcha-tauri-execute-command-parsing.md`

### Livello 3: ~/.quack/brain/ (globale)

Se il problema non e' specifico del progetto, l'agente cerca nel Brain globale. Qui trova pattern cross-progetto, preferenze personali, note sulle persone con cui lavora.

## Quando viene usato ogni livello

| Situazione | Livello usato |
|------------|---------------|
| L'agente inizia a lavorare | Livello 1 — legge CLAUDE.md automaticamente |
| Deve modificare un modulo specifico | Livello 2 — cerca gotcha/pattern nel progetto |
| Incontra un problema generico (es. React hooks) | Livello 3 — cerca nel brain globale |
| Scopre qualcosa di nuovo e critico | Salva + linka nel Livello 1 (CLAUDE.md) |

## Come si configura

L'Access Chain e' definito in 3 posti:

| File | Cosa dice | Chi lo legge |
|------|-----------|--------------|
| `CLAUDE.md` (Knowledge Base section) | **Dove** guardare — link diretti ai file critici | Ogni agente, ogni sessione |
| `~/.claude/rules/use-quack-brain.md` | **Quando** cercare e **quando** salvare | Ogni agente, ogni sessione |
| `~/.claude/skills/quack-brain/SKILL.md` | **Come** leggere/scrivere entry (formato, criteri) | Solo quando l'agente invoca la skill |

La sezione Knowledge Base nel CLAUDE.md e' posizionata **fuori** dall'header auto-generato dell'agente, quindi persiste anche quando cambi personalita' o agente.

## Migrare documentazione esistente

Se un progetto ha gia' documentazione sparsa in posti diversi (`.quack/brain/`, `.claude/docs/`, file markdown nella root, cartelle `docs/`), puoi usare la skill `brain-migrate` per convertirla nella struttura v2 (`documentation/` + `guide/`). La skill scansiona, classifica, e migra con approvazione a ogni step.
