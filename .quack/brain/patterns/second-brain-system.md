---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# Second Brain System

Frontend: SecondBrainTabView.tsx, OutlinerEditor.tsx, InlineOutliner.tsx, EntityAutocomplete.tsx

Service: brainService.ts (33K LOC), obsidianSyncService.ts (19K LOC)

MCP Server: brain-mcp-server.js (57K LOC) - entity CRUD, canvas tools, WikiLinks

Backend: brain/ folder (db.rs, types.rs, commands.rs, watcher.rs)

Features: Obsidian vault sync, SQLite backend, WikiLinks, daily diary, canvas diagrams, force-directed graph

## Cos'e il Second Brain?

Il Second Brain e un sistema di knowledge management ispirato a Tana e Logseq. Permette di:
- Salvare pattern, decisioni, bug fix
- Creare relazioni tra concetti (`[[WikiLinks]]`)
- Sincronizzare con Obsidian vault
- Rendere la conoscenza accessibile all'AI

## Architettura a 3 Livelli

1. **SQLite Database** - Storage primario (fast queries)
2. **Obsidian Vault** - File markdown per editing umano
3. **MCP Server** - Espone i dati a Claude

## Sync Bidirezionale

```
Quack App <---> SQLite DB <---> Obsidian Vault
                   |
                   v
              MCP Server ---> Claude Agent SDK
```

Modifichi in Quack? Si sincronizza su Obsidian.
Modifichi in Obsidian? Il watcher aggiorna SQLite.

## Entity Types

| Tag | Cartella | Uso |
|-----|----------|-----|
| `pattern` | patterns/ | Best practices |
| `bug` | bugs/ | Bug fix documentati |
| `decision` | decisions/ | ADR |
| `component` | components/ | Documentazione codice |
| `task` | tasks/ | Task completati |

## WikiLinks e Graph

Usa `[[Nome Nota]]` per creare collegamenti. Obsidian mostra un graph interattivo delle relazioni. I backlinks sono queryabili via MCP.
