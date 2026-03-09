---
type: bug_fix
project: quack-app
created: 2026-03-08
last_verified: 2026-03-08
tags: [token-tracking, stamina, prompt-caching, sdk, context-fill]
---

# Fix: Stamina Bar mostra 100% a causa di input_tokens che esclude i cached tokens

## Problema

La stamina bar mostrava sempre 100% (sessione "fresca") anche dopo molti turn di conversazione. Il problema era che `input_tokens` dalla SDK Claude include **solo** i token NON cachati. Con il prompt caching attivo, questo valore era spesso molto basso (es. 24 token) o addirittura 0.

Il codice usava `usage.input_tokens` direttamente come misura del context window fill, causando:
- `messageTokens = inputTokens - overhead(~38k)` → risultato negativo → troncato a 0
- `staminaPercentage = 100%` (nessun utilizzo rilevato)

## Causa Radice

Con il **prompt caching** abilitato, il Claude SDK suddivide i token di input in tre categorie:
- `input_tokens`: token NON cachati (può essere bassissimo, es. 24)
- `cache_read_input_tokens`: token letti dalla cache
- `cache_creation_input_tokens`: token usati per creare la cache

Il **context window fill reale** di una singola chiamata API è la somma di tutti e tre:
```
context_fill = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
```

Usare solo `input_tokens` sottostima drasticamente il fill effettivo.

Documentazione Anthropic:
> "input_tokens: Number of input tokens which were not read from or used to create a cache"

## Soluzione

Calcolare il context fill sommando tutti i componenti del token usage:

```typescript
// Brain: fix-stamina-bar-input-tokens-cached

// PRIMA (sbagliato — solo token non cachati)
inputTokens: usage.input_tokens

// DOPO (corretto — fill completo del context window)
const cacheRead = usage.cache_read_input_tokens ?? 0;
const cacheCreation = usage.cache_creation_input_tokens ?? 0;
const contextWindowFill = usage.input_tokens + cacheRead + cacheCreation;
inputTokens: contextWindowFill
```

## Key Insight

**Con prompt caching attivo**: `input_tokens` NON equivale al context window fill. Bisogna sempre sommare tutti e tre i componenti (`input_tokens + cache_read + cache_creation`) per ottenere il fill reale.

Inoltre:
- Gli eventi `result` della SDK contengono usage **cumulativo** su tutti gli step agentici — non usarli per il fill per-turn.
- Gli eventi `assistant` contengono usage **per singola chiamata API** — fonte corretta per il context fill.

## File Coinvolti

- `src/App.tsx` — `handleTokenUpdate`: formula cache-inclusive
- `src/hooks/useClaudeChat.ts` — stessa correzione nel hook client-side
- `src-tauri/src/claude_cli.rs` — rimosso fallback sbagliato su `modelUsage`

## Riferimenti

- Voce correlata con analisi approfondita: `fix-stamina-messages-zero-modelusage-fallback.md`
- Documentazione Anthropic sul Prompt Caching: https://platform.claude.com/docs/en/build-with-claude/prompt-caching
