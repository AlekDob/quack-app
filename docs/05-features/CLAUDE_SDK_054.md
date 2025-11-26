# Claude Agent SDK 0.1.54 Integration

**Last Updated**: 2025-11-26
**SDK Version**: 0.1.54
**Status**: Implemented

---

## Overview

Quack integrates Claude Agent SDK 0.1.54 for AI-powered chat functionality. This document covers the key features and their implementation in Quack.

### Key Features

| Feature | Status | Description |
|---------|--------|-------------|
| Effort Parameter | Implemented | Quality vs speed/cost tradeoff |
| Extended Thinking | Implemented | Deep reasoning with visible thought process |
| Structured Outputs | Implemented | JSON schema-based responses (beta) |
| Subagent Invocation | Implemented | Delegate tasks via @mention |
| Visual Feedback | Implemented | Badges, thinking blocks, droid widgets |

---

## 1. Effort Parameter

Controls the quality vs speed/cost tradeoff for responses.

### Levels

| Level | Icon | Description | Use Case |
|-------|------|-------------|----------|
| `low` | `>` | Fast responses, lower cost | Quick questions, simple tasks |
| `medium` | `>>` | Balanced (default) | Most use cases |
| `high` | `>>>` | Higher quality, more thorough | Complex analysis, important decisions |

### Implementation

**UI Component**: `ChatSettingsMenu.tsx`
```typescript
const effortOptions = [
  { value: 'low', label: 'Low', icon: '>', description: 'Faster, lower cost' },
  { value: 'medium', label: 'Medium', icon: '>>', description: 'Balanced (default)' },
  { value: 'high', label: 'High', icon: '>>>', description: 'Higher quality' },
];
```

**State Management**: `settingsStore.ts`
```typescript
effort: 'medium' as EffortLevel,
setClaudeEffort: (effort) => set({ effort }),
```

**Backend**: `stream-claude.js`
```javascript
if (effort) {
  options.effort = effort;
}
```

### Visual Indicator

Messages display an effort badge (e.g., `[>>]`) showing which level was used.

---

## 2. Extended Thinking

Enables Claude to show its reasoning process before responding.

### Thinking Modes

| Mode | Description |
|------|-------------|
| `auto` | SDK decides when to use thinking |
| `on` | Always show thinking |
| `off` | Never use thinking |

### Implementation

**Component**: `ThinkingBlock.tsx`
- Collapsible block showing Claude's thought process
- Purple styling to distinguish from regular content
- Click to expand/collapse

**Type Definition**: `types.ts`
```typescript
export interface ClaudeContentBlock {
  type: 'text' | 'tool_use' | 'thinking';
  thinking?: string;
  // ...
}
```

**Rust Backend**: `claude_cli.rs`
```rust
ContentBlock::Thinking {
    thinking: String,
}
```

### Visual Indicator

- Badge: `[TH+]` when thinking mode is enabled
- Thinking blocks appear in purple with expand/collapse functionality

---

## 3. Structured Outputs (Beta)

Force responses to follow a JSON schema.

### Usage

```typescript
const options = {
  outputFormat: {
    type: 'json_schema',
    json_schema: {
      name: 'my_response',
      schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          items: { type: 'array', items: { type: 'string' } }
        }
      }
    }
  }
};
```

### Implementation

Passed directly to SDK via `stream-claude.js`:
```javascript
if (outputFormat) {
  options.outputFormat = outputFormat;
}
```

---

## 4. Subagent/Droid Invocation

Delegate tasks to specialized agents using @mention syntax.

### How It Works

1. **User types**: `@droid-name do something`
2. **SDK recognizes**: The @mention and finds matching agent
3. **Task tool invoked**: SDK uses `Task` tool to delegate
4. **Droid executes**: Specialized agent handles the task
5. **Response returns**: Result merged into conversation

### Architecture

```
User Input (@droid-name)
         |
         v
    Claude SDK
         |
    [recognizes @mention]
         |
         v
    Task Tool (tool_use)
    - name: "Task"
    - input.subagent_type: "droid-name"
         |
         v
    Subagent Execution
         |
         v
    Response to User
```

### Implementation

**Loading Droids**: `App.tsx`
```typescript
// Load droids when working directory changes
useEffect(() => {
  const workingDir = activeTerminal?.cwd || explorerPath;
  if (!workingDir) return;

  loadAvailableDroids(workingDir).then(setAvailableDroids);
}, [activeTerminal?.cwd, explorerPath]);
```

**Passing to SDK**: `App.tsx`
```typescript
agents: availableDroids.map(droid => ({
  name: droid.id.replace('global-', ''),
  description: droid.description,
  model: 'sonnet',
  filePath: droid.path,
})),
```

**Droid Sources**:
- Project: `.claude/agents/*.md`
- Global: `~/.claude/agents/*.md`

### Visual Feedback

When a droid is invoked, a widget appears:
```
+------------------------------------------+
| [Avatar] Droid: droid-name               |
| Description of what the droid does... [O]|
+------------------------------------------+
```

The spinner (`[O]`) indicates the droid is processing.

---

## 5. Visual Feedback System

### Message Settings Badges

Component: `MessageSettingsBadges.tsx`

Displays colored badges on assistant messages:

| Badge | Color | Meaning |
|-------|-------|---------|
| `[OPUS]` | Purple | Using Opus model |
| `[SONNET]` | Blue | Using Sonnet model |
| `[HAIKU]` | Green | Using Haiku model |
| `[>]` | Orange | Low effort |
| `[>>]` | Yellow | Medium effort |
| `[>>>]` | Red | High effort |
| `[TH+]` | Purple | Thinking mode enabled |

### Thinking Blocks

Component: `ThinkingBlock.tsx`

Collapsible sections showing Claude's reasoning:
- Default: Collapsed
- Click header to expand/collapse
- Purple border and background
- Monospace font for readability

### Droid Widgets

Rendered in: `StreamMessage.tsx`

Shows when Task tool invokes a subagent:
- Avatar of the droid
- Name and description
- Spinner while processing

---

## Event Flow

### Rust Backend Events

The Rust backend (`claude_cli.rs`) handles these event types:

```rust
pub enum ClaudeEvent {
    System { ... },      // Session init
    Assistant { ... },   // Messages with content blocks
    User { ... },        // User messages
    Result { ... },      // Final result with usage
    Agent { ... },       // Subagent start/stop (NEW)
    Complete { ... },    // Stream finished (NEW)
}

pub enum ContentBlock {
    Text { text },
    ToolUse { id, name, input },
    Thinking { thinking },      // NEW
    Other(Value),               // Fallback
}
```

### Frontend Event Handling

Events flow through:
1. `claude-event:{agentId}` - Tauri event listener in App.tsx
2. `ChatMessage.events[]` - Stored on message
3. `StreamMessage.tsx` - Renders events including droid widgets

---

## Files Modified

### Frontend
- `src/App.tsx` - Droid loading, SDK options
- `src/stores/settingsStore.ts` - Effort setting
- `src/types.ts` - Type definitions
- `src/components/ChatSettingsMenu.tsx` - Effort dropdown
- `src/components/ThinkingBlock.tsx` - Thinking display (NEW)
- `src/components/MessageSettingsBadges.tsx` - Badges (NEW)
- `src/components/ChatMessage.tsx` - Badge integration
- `src/components/StreamMessage.tsx` - Event rendering
- `src/services/claudeSDK.ts` - Event conversion

### Backend (Rust)
- `src-tauri/src/claude_cli.rs` - Event types, parsing, logging

### Backend (Node.js)
- `src-tauri/node-sdk/stream-claude.js` - SDK options, debug logging

---

## Debugging

### Enable Debug Logs

Backend logs are visible in Tauri dev console:

```
[SDK] Captured session ID: xxx
[SDK] 📝 Assistant event with N content blocks
[SDK]   Block 0: Text (...)
[SDK]   Block 1: 🎯 Task TOOL_USE - subagent: droid-name
[SDK] 🤖 Agent event: action=start, name=droid-name
[SDK] ✅ Stream complete event received
```

### Frontend Console

```
[Droids] Loading available droids for: /path
[Droids] Loaded N droids: [droid1, droid2]
[StreamMessage] Assistant message content blocks: [...]
[StreamMessage] Task tool detected! subagent: droid-name
```

---

## Testing

### Manual Testing

1. **Effort Parameter**
   - Open chat settings menu
   - Change effort level
   - Send message
   - Verify badge shows correct effort icon

2. **Extended Thinking**
   - Enable thinking mode in settings
   - Send complex question
   - Verify `[TH+]` badge appears
   - Verify thinking block is visible (if present)

3. **Droid Invocation**
   - Type `@droid-name some task`
   - Verify droid widget appears with spinner
   - Verify response comes from droid

### Verify Droid Loading

Check console for:
```
[Droids] Loaded N droids: [droid1, droid2, ...]
```

If no droids loaded, check:
- `.claude/agents/` exists in project
- `~/.claude/agents/` exists globally
- Files have `.md` extension

---

## Known Limitations

1. **Model field for droids**: Currently defaults to 'sonnet' - droids don't have model preference in their metadata
2. **Structured outputs**: Beta feature, may have edge cases
3. **Thinking blocks**: Not all responses include thinking even when enabled (SDK decides)

---

## Related Documentation

- `MCP_CONFIGURATION.md` - MCP server setup
- `token-counter-implementation.md` - Usage tracking
- [Claude Agent SDK Docs](https://docs.anthropic.com/claude-code/sdk)
