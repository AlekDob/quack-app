---
type: bug
project: quack-app
created: 2026-01-17
migrated: true
---

# bug-memory-hook-race-condition-crash

**Bug**: Crash occasionale `TypeError: undefined is not an object (evaluating 'listeners[eventId].handlerId')`

**Root Cause**: Race condition tra Memory Hook AI extraction timeout (3000ms) e Claude SDK event listeners durante streaming

**When**: Occasionale - solo quando AI extraction va in timeout mentre arrivano eventi di streaming dal SDK

**Why AI Extraction Failed**: Memory Hook usa `@anthropic-ai/sdk` direttamente, che richiede `ANTHROPIC_API_KEY` env var. Quack usa sessione autenticata Claude Code CLI, non API key.

**Solution**: Disabled AI extraction (set `useAiExtraction: false` in memory-prompt-hook.js:47) - usa solo legacy keyword extraction basato su stopwords

**Impact**: Nessuna perdita di funzionalità - legacy keywords funzionano bene per Brain search. AI extraction era un nice-to-have per semantic search.

**File Modified**: `src-tauri/node-sdk/memory-prompt-hook.js:47`

**Future**: Se vogliamo AI extraction, dobbiamo far usare al Memory Hook la stessa sessione autenticata del Claude Code CLI invece di creare un nuovo client Anthropic.
