---
type: pattern
project: quack-app
created: 2026-04-01
last_verified: 2026-04-01
tags: [hooks, brain, automation, claude-code, openwolf]
---

# Pattern: Brain Hooks (Automated Knowledge Surfacing)

## Contesto

Il Quack Brain ha 200+ entry di conoscenza (gotcha, bug, pattern, decision) ma senza automazione gli agenti devono ricordarsi di consultarlo manualmente. Ispirato da OpenWolf, 4 hook Claude Code rendono il Brain proattivo.

## I 4 Hook

### 1. session-start.js (SessionStart)

- Crea `_brain-session.json` per tracciare letture/scritture della sessione
- Mostra statistiche Brain: conteggio entry per tipo, data ultimo diary
- Avvisa se entry stale (last_verified > 7 giorni)

### 2. pre-read.js (PreToolUse → Read)

- Lookup in `AST.md`: mostra descrizione ed export del file
- Scan `gotchas/` e `bugs/` per menzioni del file (scoring: exact path > backtick > basename)
- Avvisa se file gia' letto nella sessione con stima token
- Traccia lettura in `_brain-session.json`

### 3. pre-write.js (PreToolUse → Write|Edit)

- Cerca gotcha/bug per il file target
- Risolve Brain breadcrumbs (`// Brain: {slug}`) nel file esistente
- Controlla contenuto nuovo vs pattern Do-Not-Repeat (pattern quotati nei gotcha)

### 4. stop.js (Stop)

- Genera summary sessione (file letti/scritti, token stimati, letture ripetute)
- Auto-appende entry a `documentation/diary/YYYY-MM-DD.md`
- Pulisce `_brain-session.json`

## Architettura

```
Claude Code SDK
    ├─ SessionStart → session-start.js → _brain-session.json
    ├─ PreToolUse(Read) → pre-read.js → AST + gotchas via stderr
    ├─ PreToolUse(Write|Edit) → pre-write.js → warnings via stderr
    └─ Stop → stop.js → diary append + cleanup
```

## Principi di Design

1. **Mai bloccare**: sempre `process.exit(0)`, errori su stderr
2. **Zero dipendenze**: puro Node.js `fs` e `path`
3. **Timeout-safe**: ogni hook < 5 sec (10 sec per stop)
4. **Read-only + append-only**: non modifica entry Brain esistenti
5. **Portabile**: usa `$CLAUDE_PROJECT_DIR` e `$HOME`, funziona ovunque

## Installazione

File in `~/.quack/hooks/brain/`. Registrazione in `.claude/settings.json`:

```json
{
  "hooks": {
    "SessionStart": [{ "matcher": "", "hooks": [{ "type": "command", "command": "node \"$HOME/.quack/hooks/brain/session-start.js\"" }] }],
    "PreToolUse": [
      { "matcher": "Read", "hooks": [{ "type": "command", "command": "node \"$HOME/.quack/hooks/brain/pre-read.js\"" }] },
      { "matcher": "Write|Edit", "hooks": [{ "type": "command", "command": "node \"$HOME/.quack/hooks/brain/pre-write.js\"" }] }
    ],
    "Stop": [{ "matcher": "", "hooks": [{ "type": "command", "command": "node \"$HOME/.quack/hooks/brain/stop.js\"" }] }]
  }
}
```

## Token Estimation

Approccio character-ratio (da OpenWolf):
- Code: 3.5 chars/token
- Prose: 4.0 chars/token
- Mixed: 3.75 chars/token

Accuratezza ~85%. Sufficiente per warnings, non per billing.

## Quack UI Integration (nativa, zero setup)

Due componenti funzionano per TUTTI gli utenti Quack senza installare il plugin:

### BrainContextBanner

Banner collapsibile sopra la chat, visibile quando `messages.length === 0` (sessione nuova).
Mostra stats Brain: conteggio gotcha/bug/pattern/decision, ultimo diary, entry stale.
Pattern: segue `AgentRulesBanner` (collapsibile, glassmorphism, dismiss).

Files: `src/components/BrainContextBanner.tsx`, `src/components/BrainContextBanner.css`, `src/hooks/useBrainStats.ts`
Integrato in: `src/components/ChatView.tsx` (dopo AgentRulesBanner, prima di MessageList)

### Auto-Diary su Mark as Done

Quando l'utente chiude una sessione con "Mark as Done", `sessionStore.markDone()` chiama
`brainSessionService.appendBrainDiaryOnDone()` che auto-appende una riga al diary:
`- [HH:MM] (Auto) Sessione completata: sessione "titolo", N messaggi, durata`

File: `src/services/brainSessionService.ts`
Integrato in: `src/stores/sessionStore.ts` (markDone action)

### Architettura a 3 livelli

| Livello | Cosa | Serve setup? |
|---------|------|-------------|
| UI Banner | Stats Brain ad ogni sessione nuova | No (nativo) |
| Auto-Diary | Diary su Mark as Done | No (nativo) |
| CLI Hooks | pre-read, pre-write, token tracking | Si (plugin marketplace) |

## Marketplace

Plugin `brain-hooks` v1.0.0 nel Quack Store, categoria "Hooks". Richiede `quack-brain` installato.
