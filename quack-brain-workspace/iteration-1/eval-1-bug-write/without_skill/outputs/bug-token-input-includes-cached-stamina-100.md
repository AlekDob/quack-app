---
type: bug_fix
project: quack-app
created: 2026-03-08
last_verified: 2026-03-08
tags: [token-tracking, stamina, prompt-caching, input-tokens, context-fill]
---

# Fix: input_tokens includeva i cached tokens — stamina bar mostrava 100%

## Problema

La stamina bar mostrava sempre 100% (contesto fresco) anche dopo molti turn di conversazione. Il token tracking usava `usage.input_tokens` direttamente come misura del contesto riempito, ma con il prompt caching attivo questo valore rappresenta **solo i token NON cached**, che può essere basso come 24 token.

Con `inputTokens: 24` e un overhead di ~38k token, il calcolo `Messages = inputTokens - overhead = max(0, 24 - 38000) = 0` produceva stamina al 100%.

## Root Cause

Con prompt caching abilitato, `usage.input_tokens` dalla Claude SDK rappresenta **solo i token che NON erano in cache**. Non è il context window fill reale.

Il context window fill corretto è:
```
context_fill = input_tokens + cache_read_input_tokens + cache_creation_input_tokens
```

Documentazione Anthropic:
> "input_tokens: Number of input tokens which were not read from or used to create a cache"

## Soluzione

Calcolare il `contextWindowFill` sommando tutti e tre i campi di usage:

```typescript
// PRIMA (sbagliato — solo token non cached)
inputTokens: usage.input_tokens

// DOPO (corretto — fill reale del context window)
const cacheRead = usage.cache_read_input_tokens || 0;
const cacheCreation = usage.cache_creation_input_tokens || 0;
const contextWindowFill = usage.input_tokens + cacheRead + cacheCreation;
inputTokens: contextWindowFill
```

## File Coinvolti

- `src/App.tsx` — `handleTokenUpdate`: formula cache-inclusive aggiunta
- `src/hooks/useClaudeChat.ts` — stessa fix applicata al client-side SDK hook

## Key Insights

1. **Con prompt caching**: `input_tokens` != context fill. Bisogna sempre sommare i cache tokens.
2. **Formula corretta**: `context_fill = input_tokens + cache_read_input_tokens + cache_creation_input_tokens`
3. **Result event usage**: Cumulativo su tutti gli agentic steps — non usare per context fill per-turn.
4. **Assistant message usage**: Per-step, per-API-call — fonte corretta per il context fill corrente.

## Testing

1. Inviare un messaggio e verificare che la stamina bar scenda da 100%
2. Controllare il Context Receipt — "Messages" deve essere non-zero dopo il primo turn
3. Confrontare con output di `/context` nel terminale — i valori devono essere nello stesso ordine di grandezza
