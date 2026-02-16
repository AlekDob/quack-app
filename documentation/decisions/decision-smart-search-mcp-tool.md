---
type: decision
created: 2026-01-09
tags: [mcp, search, brain, nlp]
---

# smart-search-mcp-tool

> [!note] Some details may be outdated.

Nuovo tool MCP `smart_search` per ricerche semantiche nel brain usando linguaggio naturale

Handler: `handleBrainSmartSearch()` in brain-mcp-server.js (linee 658-733)

Tool definition: linee 1574-1600

Switch case: linee 1956-1957

Funzionamento: rimuove stop words inglesi, estrae keyword, costruisce query FTS5 con OR join

Output include: extractedKeywords per debugging, context per logging

Differenza da `search`: accetta linguaggio naturale invece di keyword FTS5 esatte

[2026-01-09] Implementato e verificato. Stop words solo inglese, italiano pianificato come miglioramento futuro.
