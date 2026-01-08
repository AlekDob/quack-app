# GIF Reactions for Tool/MCP Usage

## Overview

This feature displays animated GIFs from Giphy API when AI tools execute, making the streaming chat more visually engaging and entertaining.

## How It Works

1. When a tool executes (e.g., `brain_search`, `Read`, `Bash`), the system:
   - Looks up appropriate keywords for that tool
   - Fetches a relevant GIF from Giphy API
   - Displays it **inline** in the chat as a message bubble (WhatsApp style)

2. The GIF remains visible as part of the conversation history

## User Experience

GIFs appear as inline chat bubbles above each tool widget:

```
User: "Search for React hooks patterns"
       ↓
Agent starts brain_search tool
       ↓
[GIF bubble: brain thinking animation]
[Tool widget: brain_search results]
       ↓
Result displayed normally
```

The GIF stays in the chat history, giving a visual record of what tools were used.

## Setup

The Giphy API key is bundled with the app - no configuration needed!

### Enable in Settings

Navigate to **Settings > General > Chat Experience** and toggle "GIF Reactions" on.

> **Note for developers:** You can override the default API key by setting `VITE_GIPHY_API_KEY` in your `.env` file.

## Architecture

### Files

| File | Purpose |
|------|---------|
| `src/services/giphyService.ts` | Giphy API integration, caching, keyword mapping |
| `src/components/ToolGifInline.tsx` | Inline GIF component displayed above tool widgets |
| `src/components/ToolGifInline.css` | WhatsApp-style bubble styling |
| `src/components/StreamMessage.tsx` | Integrates GIF inline with tool widgets |

### Tool-to-Keyword Mapping

The service maps tool names to search keywords:

```typescript
const TOOL_GIF_KEYWORDS = {
  // Brain/Memory tools
  'mcp__brain__brain_search': ['brain thinking', 'searching database', 'detective'],
  'mcp__brain__brain_create_entity': ['writing notes', 'taking notes', 'lightbulb idea'],

  // File operations
  read: ['reading book', 'studying', 'examining'],
  write: ['typing fast', 'coding', 'writing code'],
  edit: ['editing document', 'fixing code', 'refactoring'],

  // Shell
  bash: ['terminal hacking', 'command line', 'matrix'],

  // Web
  webfetch: ['fetching data', 'internet', 'downloading'],
  websearch: ['googling', 'internet search', 'web browser'],

  // Default fallback
  default: ['robot working', 'ai thinking', 'processing'],
};
```

### Caching

GIFs are cached:
1. **Service-level cache**: Keyword -> GIF mapping to avoid duplicate API calls
2. **Component-level cache**: ToolId -> GIF mapping to prevent re-fetches on re-render

### Rate Limiting

- Minimum 500ms between API requests
- Skipped tools: `todowrite`, `askuserquestion`

## Settings

Located in `src/stores/settingsStore.ts`:

```typescript
interface GeneralSettings {
  // ...
  enableToolGifs: boolean; // Default: true
}
```

## Testing

```bash
npm test -- --run src/tests/giphyService.test.ts
```

Tests cover:
- Tool-to-keyword mapping
- Cache management
- Keyword variety

## Design Notes

Follows Quack Design System:
- WhatsApp-style inline bubble
- Dark theme with glassmorphism
- Reduced motion support
- Giphy attribution (required by API terms)

## Acceptance Criteria

- [x] GIF appears inline when tool executes
- [x] GIF stays visible in conversation history
- [x] Tool-to-keyword mapping works
- [x] Toggle in settings to disable
- [x] API key bundled with app for all users
- [x] Rate limiting to avoid API spam
- [x] Family-friendly GIFs only (rating: G)

## Future Enhancements (v2)

- [ ] Custom GIF collections per tool category
- [ ] User-uploaded custom GIFs
- [ ] GIF preview in settings
- [ ] Sound effects option
