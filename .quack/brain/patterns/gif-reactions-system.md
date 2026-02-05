---
type: component
project: quack-app
created: 2026-01-08
migrated: true
---

# GIF Reactions System

## Sistema GIF Reactions

Quack mostra **GIF animate** quando Claude usa tool, rendendo l'esperienza piu engaging e visivamente interessante.

## Come Funziona

1. Claude inizia a usare un tool (es. `Read`, `Edit`, `Bash`)
2. Sistema cerca GIF appropriata via Giphy API
3. GIF viene mostrata durante l'esecuzione
4. GIF scompare quando tool completa

## Mapping Tool -> Keywords

Ogni tool ha keyword associate per cercare GIF appropriate:

```typescript
TOOL_GIF_KEYWORDS = {
  'brain_search': ['brain thinking', 'searching'],
  'Read': ['reading book', 'studying'],
  'Write': ['typing fast', 'coding'],
  'Edit': ['editing', 'fixing'],
  'Bash': ['terminal', 'hacking'],
  'default': ['robot working', 'ai thinking']
}
```

## Componenti

| File | Data | Ruolo |
|------|------|-------|
| `giphyService.ts` | Jan 8 | Client API Giphy |
| `useToolGifReaction.ts` | Jan 8 | Hook reazione tool |
| `ToolGifWidget.tsx` | Jan 8 | Widget GIF |
| `ToolGifInline.tsx` | Jan 8 | GIF inline nel messaggio |
| `ToolGifOverlay.tsx` | Jan 8 | GIF overlay |

## Configurazione

- Toggle on/off nelle Settings
- Richiede `VITE_GIPHY_API_KEY` in `.env`
- Rating: G (contenuto sicuro)
- Rate limiting per evitare spam API

[2026-01-08] ## Aggiornamento Completo Sistema GIF Reactions

### API Key Bundled
La Giphy API key è ora **integrata nell'app** - non richiede configurazione utente:
```typescript
const GIPHY_API_KEY = import.meta.env.VITE_GIPHY_API_KEY || 'w9lZ6fgXmVo8lFFSdlFRJ1qHpEzYfvAX';
```

### Layout e Dimensioni
GIF mostrate **inline stile WhatsApp**:
- max-width: 400px
- min-height: 150px
- max-height: 250px
- border-radius: 16px
- Glassmorphism con backdrop-blur

### GIF Solo Landscape
Filtro aspect ratio per selezionare solo GIF orizzontali:
- Aspect ratio minimo: 1.2 (larghezza >= 120% altezza)
- Cerca 25 risultati per avere più scelta
- Fallback al più largo se nessun landscape trovato

### Sistema di Varietà (anti-ripetizione)
1. **Offset casuale** (0-49) nella ricerca Giphy
2. **Selezione casuale** tra GIF landscape trovate
3. **Rotazione keyword** - traccia ultime 10 usate, preferisce nuove
4. **Cache per toolId** - stessa GIF per re-render, diversa per nuova invocazione

### Tool Widget Collapsabili
Tutti i tool widget sono **collapsati di default** ed espandibili cliccando l'header. Struttura:
```
[GIF animata]
"Using Search..."
▼ [Tool Widget Header] (click to expand)
   { "query": "...", "limit": 20 }
```

### Smart Rate Limiting
- Mostra GIF ogni **3 tool** consecutivi
- **Brain e Agent tools**: sempre GIF (importanti)
- **Search tools**: disabilitati di default

### Toggle per Categoria in Settings
In Settings > General > Chat Experience:
- Brain/Memory Tools - ON
- File Operations (Read, Write, Edit) - ON
- Shell Commands (Bash) - ON
- Search Tools (Grep, Glob, WebSearch) - OFF
- AI Agents (Task) - ON

### Brand Giphy Nascosto
Logo Giphy `opacity: 0` di default, visibile solo su hover (0.7)

### Mapping Tool → Keywords Ampliato
```typescript
TOOL_GIF_KEYWORDS = {
  // Brain/Memory
  'mcp__brain__search': ['brain thinking', 'searching database', 'detective'],
  'mcp__brain__create_entity': ['writing notes', 'taking notes', 'lightbulb idea'],
  'mcp__brain__add_observation': ['adding note', 'writing', 'remember'],
  'mcp__brain__get_graph': ['network graph', 'connections', 'mind map'],
  // Semantic Search
  'mcp__semantic-search__semantic_search_code': ['code search', 'finding code'],
  // Kanban
  'mcp__kanban-tools__kanban_list_tasks': ['todo list', 'checking tasks'],
  // IDE
  'mcp__ide-tools__ide_open': ['opening file', 'code editor'],
  // File operations
  'read': ['reading book', 'studying', 'examining'],
  'write': ['typing fast', 'coding', 'writing code'],
  'edit': ['editing document', 'fixing code', 'refactoring'],
  // Shell
  'bash': ['terminal hacking', 'command line', 'matrix'],
  // Web
  'webfetch': ['fetching data', 'internet', 'downloading'],
  'websearch': ['googling', 'internet search', 'web browser'],
  // Agents
  'task': ['robot working', 'ai assistant', 'automation'],
  // Default
  'default': ['robot working', 'ai thinking', 'processing'],
}
```
