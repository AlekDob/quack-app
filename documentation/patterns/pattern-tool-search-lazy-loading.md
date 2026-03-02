---
type: pattern
project: quack-app
created: 2026-03-02
last_verified: 2026-03-02
tags: [optimization, tokens, context-window, tools, mcp, lazy-loading]
---

# Pattern: Tool Search & Lazy Loading per ridurre overhead contesto

## Fonte

Kenneth Liao (Substack): "Connecting 7 MCP servers to Claude Code ate 50% of my context window before I typed a single word."

## Il problema

Ogni tool caricato nel contesto consuma token PRIMA che l'utente scriva qualcosa. Con il preset `claude_code`, 16 tool built-in costano ~18.1k token (9% di 200k). MCP servers aggiungono ~3-5k ciascuno.

## Stato attuale in Quack

- `ENABLE_TOOL_SEARCH: 'auto'` — GIA' attivo nel daemon. I tool MCP vengono caricati on-demand.
- `tools: { type: 'preset', preset: 'claude_code' }` — carica TUTTI i 16 tool built-in sempre.
- `allowedTools` — filtra quali tool l'agente può usare, ma le definizioni sono comunque nel contesto.

## Opportunità di ottimizzazione (non ancora implementate)

### 1. Tool profiles per ruolo agente (~5-8k risparmiati)

Invece di caricare tutti i tool per ogni agente, definire profili minimali per ruolo:

```
Developer:    Read, Write, Edit, Bash, Glob, Grep, WebFetch, WebSearch, Task, TodoWrite, Skill, AskUserQuestion (~18k)
PM/Reviewer:  Read, Glob, Grep, WebFetch, WebSearch, AskUserQuestion, Skill, Task (~10k)
Writer:       Read, Write, WebFetch, WebSearch, AskUserQuestion, Skill (~8k)
```

Implementazione: mappare il ruolo agente (da CLAUDE.md agent header) a un set di tool e passarlo come `allowedTools`. Serve verificare se l'SDK supporta il caricamento selettivo delle definizioni (non solo il filtering).

### 2. Lazy-load dei tool non-core (~3-5k risparmiati)

Tool come NotebookEdit, ExitPlanMode, KillShell, BashOutput sono usati raramente. Potrebbero essere resi "deferred" come i tool MCP, caricati solo quando Tool Search li trova necessari.

Richiede: investigare se l'Agent SDK supporta tool deferred per i built-in, non solo per MCP.

### 3. System prompt append condizionale (~1-2k risparmiati)

Il blocco `append` nel systemPrompt (istruzioni AskUserQuestion, Debug Mode, Team augmentation) potrebbe essere iniettato solo quando il contesto lo richiede:
- AskUserQuestion instructions → solo se il tool è nel set
- Debug mode → solo se `debugMode === true` (già fatto)
- Team augmentation → solo se `teamContext` esiste (già fatto)

### Totale potenziale: ~8-12k token = 4-6% contesto extra

## Riferimenti

- `src-tauri/node-sdk/stream-daemon.js` linea 284-288 (defaultAllowedTools)
- `src-tauri/node-sdk/stream-daemon.js` linea 295 (tools preset)
- `src-tauri/node-sdk/stream-daemon.js` linea 420 (ENABLE_TOOL_SEARCH)
- Agent SDK docs: tool search, deferred tools
