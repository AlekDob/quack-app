# Auto Memory Search (SDK 0.2.1)

## Overview

Auto Memory Search automatically searches the Quack Brain (Second Brain SQLite database) before each query to Claude, injecting relevant context into the system prompt.

This enables Claude to leverage your knowledge graph without you having to explicitly ask it to "search my memories" or "check the brain".

## How It Works

```
User message
    ↓
Extract keywords (remove stop words)
    ↓
FTS5 search on Brain SQLite
    ↓
Format results as context
    ↓
Inject in systemPrompt.append
    ↓
Send to Claude
```

## Features

- **Automatic**: No manual trigger needed - works on every query
- **Fast**: Uses FTS5 (Full-Text Search) for sub-100ms latency
- **Relevant**: Only injects context when matching memories are found
- **Graceful**: Continues without error if Brain DB doesn't exist or search fails
- **Configurable**: Can be disabled per-agent via `autoMemorySearch: false`

## Configuration

### Enable/Disable (Frontend)

In `AgentChatSettings`:

```typescript
interface AgentChatSettings {
  // ... other settings
  autoMemorySearch?: boolean; // Default: true
}
```

### Default Behavior

- **Default: Enabled** (`true`)
- **Max memories**: 5 results per search
- **Min keyword length**: 3 characters
- **Max keywords**: 8 keywords searched

## Files

| File | Purpose |
|------|---------|
| `src-tauri/node-sdk/memory-prompt-hook.js` | Main hook logic (keyword extraction, FTS search, formatting) |
| `src-tauri/node-sdk/stream-claude.js` | Integration point (imports and calls the hook) |
| `src-tauri/src/claude_cli.rs` | Rust backend (passes `autoMemorySearchEnabled` to Node.js) |
| `src/types.ts` | TypeScript types (`AgentChatSettings.autoMemorySearch`) |

## Keyword Extraction

The hook extracts meaningful keywords from the user prompt by:

1. Tokenizing the prompt (split by whitespace)
2. Converting to lowercase
3. Filtering out:
   - Stop words (English and Italian)
   - Words shorter than 3 characters
   - Pure numbers
   - Common generic terms (file, code, function, etc.)
4. Deduplicating
5. Limiting to 8 keywords max

### Stop Words

Includes common words in:
- **English**: the, a, an, is, was, are, etc.
- **Italian**: il, la, lo, le, un, una, per, etc.
- **Generic tech terms**: file, code, function, create, make, etc.

## FTS Search

The hook uses SQLite FTS5 full-text search:

```sql
SELECT e.id, e.name, e.entity_type, rank
FROM entities e
JOIN entities_fts fts ON e.rowid = fts.rowid
WHERE entities_fts MATCH 'keyword1 OR keyword2 OR keyword3'
ORDER BY rank
LIMIT 5
```

## Context Injection

When memories are found, they're formatted and appended to the system prompt:

```markdown
## Relevant Knowledge from Second Brain

The following memories may be relevant to this conversation:

### jwt_auth_pattern (pattern)
- Use RS256 algorithm
- Store refresh token in httpOnly cookie

### react_hooks (pattern)
- Use custom hooks for reusable logic

---
```

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Brain DB doesn't exist | Skip search, no error, continue normally |
| No results found | Skip injection, continue normally |
| Database error | Catch, log, continue without memory context |
| Empty/stopwords-only prompt | Skip search |
| Too many results | Limited to 5 memories |

## Testing

Tests are located in `src/tests/memoryPromptHook.test.ts`:

```bash
npm test -- src/tests/memoryPromptHook.test.ts
```

Test coverage:
- Keyword extraction
- Stop word filtering
- Memory context formatting
- Edge cases (special chars, newlines, mixed case)

## UI Components

### MemoryIndicator (Badge/Chip)

A colorful expandable badge that appears below user messages when memories were used:

- **Location**: Below user messages in chat
- **Features**:
  - Shows count of memories used (e.g., "🧠 3 memories")
  - Click to expand/collapse details
  - Shows keywords extracted from prompt
  - Lists memory names, types, and observations
  - Shows search duration

**File**: `src/components/MemoryIndicator.tsx`

### MemorySearchIcon (Input Bar)

Brain icon for the input bar that shows memory search status:

- **States**:
  - `idle`: Dim gray (memory search enabled, no results)
  - `searching`: Pulsing animation
  - `active`: Glowing purple with badge count
  - `disabled`: Grayed out

**File**: `src/components/MemorySearchIcon.tsx`

### Event Type

A new event type `memory_context` is emitted by the backend when memories are found:

```typescript
interface ClaudeMemoryContextEvent {
  type: 'memory_context';
  memories: Array<{
    name: string;
    type: string;
    projectId?: string;
    observations: string[];
  }>;
  keywords: string[];
  durationMs: number;
  count: number;
}
```

## Logging

Debug logs are emitted to stderr:

```
[MemoryHook] Keywords: authentication, jwt, tokens
[MemoryHook] FTS query: "authentication OR jwt OR tokens"
[MemoryHook] Found 3 relevant memories
[MemoryHook] Injected 3 memories in 45ms
```

## Performance

- Target latency: < 100ms
- FTS5 search: ~10-30ms for typical queries
- No impact if Brain DB doesn't exist (immediate skip)

## Future Enhancements

- [x] UI indicator (badge/chip) showing memories used
- [x] Brain icon in input bar with status
- [ ] Semantic search using embeddings (vector similarity)
- [ ] Project-scoped memory filtering
- [ ] Memory relevance scoring improvements
- [ ] UI toggle in agent settings panel
