---
type: bug
project: quack-app
created: 2026-03-26
last_verified: 2026-03-26
tags: [markdown, rendering, chat, underscore]
---

# Underscore spariscono nel rendering markdown della chat

## Sintomo
Testi come `retry_request_status` o `products_file_source` perdono gli underscore nella chat.
Risultato visivo: `retryrequeststatus`, `productsfilesource`.

## Root Cause
In `src/components/MarkdownText.tsx`, la regex per italic con underscore:
```
/(?<!_)_([^_]+)_(?!_)/g
```
Matcha underscore intra-word: `retry_request_status` → `_request_` viene catturato come italic → `<em>request</em>` → underscore rimossi.

## Fix
Aggiornare le regex per underscore (sia italic `_` che bold `__`) per richiedere che NON siano circondati da caratteri alfanumerici, come da specifica CommonMark/GFM:

```js
// Bold __text__
/(?<![a-zA-Z0-9])__(.+?)__(?![a-zA-Z0-9])/g

// Italic _text_
/(?<![a-zA-Z0-9_])_([^_]+)_(?![a-zA-Z0-9_])/g
```

## File modificato
- `src/components/MarkdownText.tsx` — `processInlineMarkdown()`
