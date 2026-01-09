# GIF Reactions for Tool/MCP Usage

## Overview

This feature displays animated GIFs from Giphy API when AI tools execute, making the streaming chat more visually engaging and entertaining.

## How It Works

1. When a tool executes (e.g., `brain_search`, `Read`, `Bash`), the system:
   - Looks up appropriate keywords for that tool
   - Fetches a relevant **landscape GIF** from Giphy API
   - Displays it **inline** in the chat with a caption "Using {ToolName}..."

2. The GIF remains visible as part of the conversation history

3. Tool widgets are **collapsed by default** and expandable

## User Experience

GIFs appear as inline chat bubbles above each tool widget:

```
User: "Search for React hooks patterns"
       ↓
Agent starts brain_search tool
       ↓
[GIF: landscape brain thinking animation]
"Using Search..."
       ↓
▼ [Collapsed Tool Widget] (click to expand)
       ↓
Result displayed normally
```

The GIF stays in the chat history, giving a visual record of what tools were used.

## Setup

The Giphy API key is **bundled with the app** - no configuration needed!

### Enable in Settings

Navigate to **Settings > General > Chat Experience** and toggle "GIF Reactions" on.

### Category Toggles

You can enable/disable GIFs for specific tool categories:

| Category | Tools | Default |
|----------|-------|---------|
| Brain/Memory | mcp__brain__*, mcp__memory__* | ON |
| File Operations | Read, Write, Edit | ON |
| Shell Commands | Bash | ON |
| Search Tools | Grep, Glob, WebSearch | OFF |
| AI Agents | Task | ON |

> **Note for developers:** You can override the default API key by setting `VITE_GIPHY_API_KEY` in your `.env` file.

## Layout & Dimensions

GIFs are displayed inline with WhatsApp-style design:

- **max-width**: 400px
- **min-height**: 150px
- **max-height**: 250px
- **border-radius**: 16px
- **Glassmorphism**: backdrop-blur effect
- **Animation**: pop-in effect on load

## Landscape-Only Filter

GIFs are filtered to show only horizontal/landscape orientation:

- **Aspect ratio minimum**: 1.2 (width >= 120% of height)
- Fetches 25 results to find good landscape options
- Falls back to widest available if no landscape found

## Variety System (Anti-Repetition)

The system ensures you see different GIFs each time:

1. **Random offset** (0-49) in Giphy search
2. **Random selection** among landscape GIFs found
3. **Keyword rotation** - tracks last 10 keywords used, prefers unused ones
4. **Cache by toolId** - same GIF on re-render, different GIF for new invocation

## Architecture

### Files

| File | Purpose |
|------|---------|
| `src/services/giphyService.ts` | Giphy API integration, caching, keyword mapping, variety system |
| `src/components/ToolGifInline.tsx` | Inline GIF component with caption |
| `src/components/ToolGifInline.css` | WhatsApp-style bubble styling |
| `src/components/StreamMessage.tsx` | Integrates GIF inline + collapsible tool widgets |

### Tool-to-Keyword Mapping

The service maps tool names to search keywords:

```typescript
const TOOL_GIF_KEYWORDS = {
  // Brain/Memory tools
  'mcp__brain__brain_search': ['brain thinking', 'searching database', 'detective'],
  'mcp__brain__brain_create_entity': ['writing notes', 'taking notes', 'lightbulb idea'],
  'mcp__brain__brain_add_observation': ['adding note', 'writing', 'remember'],
  'mcp__brain__brain_get_graph': ['network graph', 'connections', 'mind map'],
  'mcp__brain__brain_create_relation': ['connecting dots', 'linking', 'relationship'],
  'mcp__brain__brain_list_entities': ['list checking', 'inventory', 'browsing'],

  // Semantic Search tools
  'mcp__semantic-search__semantic_search_code': ['code search', 'finding code', 'magnifying glass'],
  'mcp__semantic-search__index_project': ['indexing files', 'organizing', 'cataloging'],

  // Kanban tools
  'mcp__kanban-tools__kanban_list_tasks': ['todo list', 'checking tasks', 'clipboard'],
  'mcp__kanban-tools__kanban_create_task': ['creating task', 'adding item', 'new task'],
  'mcp__kanban-tools__kanban_move_task': ['moving task', 'drag drop', 'organizing'],

  // IDE tools
  'mcp__ide-tools__ide_open': ['opening file', 'code editor', 'developer'],

  // File operations
  read: ['reading book', 'studying', 'examining'],
  write: ['typing fast', 'coding', 'writing code'],
  edit: ['editing document', 'fixing code', 'refactoring'],
  glob: ['finding files', 'searching folders', 'file explorer'],
  grep: ['searching text', 'detective', 'magnifying glass'],

  // Shell
  bash: ['terminal hacking', 'command line', 'matrix'],
  killshell: ['stopping process', 'terminator', 'stop sign'],

  // Web
  webfetch: ['fetching data', 'internet', 'downloading'],
  websearch: ['googling', 'internet search', 'web browser'],

  // Task/Agent
  task: ['robot working', 'ai assistant', 'automation'],

  // Notebook
  notebookedit: ['jupyter notebook', 'data science', 'python coding'],

  // Default fallback
  default: ['robot working', 'ai thinking', 'processing'],
};
```

### Caching Strategy

1. **Service-level cache**: By `toolId` to avoid refetching on re-renders
2. **Keyword rotation**: Tracks recently used keywords to ensure variety
3. **No keyword caching**: Each new tool invocation gets a fresh search

### Rate Limiting

- Minimum 500ms between API requests
- Smart rate limiting: 1 GIF every 3 consecutive tools (except Brain/Agent tools which always show)
- Skipped tools: `todowrite`, `askuserquestion`

### Collapsible Tool Widgets

All generic tool widgets are collapsed by default:

```typescript
const CollapsibleToolWidget = ({ toolName, input, isLoading }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // ... renders header with chevron, content hidden until expanded
};
```

## Settings

Located in `src/stores/settingsStore.ts`:

```typescript
interface GeneralSettings {
  enableToolGifs: boolean; // Default: true
  toolGifCategories: {
    brain: boolean;   // Default: true
    fileOps: boolean; // Default: true
    shell: boolean;   // Default: true
    search: boolean;  // Default: false (too frequent)
    agents: boolean;  // Default: true
  };
}
```

## Giphy Attribution

Per Giphy API terms, the logo is shown on hover:
- `opacity: 0` by default
- `opacity: 0.7` on hover
- Small 12px logo in bottom-right corner

## Testing

```bash
npm test -- --run src/tests/giphyService.test.ts
```

Tests cover:
- Tool-to-keyword mapping
- Cache management
- Keyword variety
- Landscape filtering

## Design Notes

Follows Quack Design System:
- WhatsApp-style inline bubble
- Dark theme with glassmorphism
- Reduced motion support
- Pop-in animation
- Giphy attribution (required by API terms)

## Acceptance Criteria

- [x] GIF appears inline when tool executes
- [x] GIF stays visible in conversation history
- [x] Tool-to-keyword mapping works
- [x] Toggle in settings to disable
- [x] Category toggles for granular control
- [x] API key bundled with app for all users
- [x] Rate limiting to avoid API spam
- [x] Family-friendly GIFs only (rating: G)
- [x] Landscape-only GIFs
- [x] Variety system (different GIF each time)
- [x] Collapsible tool widgets
- [x] Caption "Using {ToolName}..."
- [x] Giphy logo hidden by default, shown on hover

## Future Enhancements (v2)

- [ ] Custom GIF collections per tool category
- [ ] User-uploaded custom GIFs
- [ ] GIF preview in settings
- [ ] Sound effects option
- [ ] Favorite GIFs system
