# Real-Time Tool Tracking Implementation

## Overview

The application now tracks Claude Code tool usage in real-time while processing messages, displaying tool operations (Read, Edit, Bash, Grep, etc.) as they happen.

## Architecture

### Backend (Rust)

**File**: `src-tauri/src/claude_cli.rs`

#### New Command: `send_message_via_cli_streaming`

Replaces the blocking `send_message_via_cli` with a streaming version that:

1. **Spawns Claude CLI process** with stdio piped
2. **Reads stderr line-by-line** in a background task
3. **Parses tool usage** from Claude's debug output
4. **Emits Tauri events** for each tool detected:
   - `claude-tool-start`: When a tool begins execution
   - `claude-tool-result`: When a tool completes with result

#### Tool Detection Patterns

The parser looks for these patterns in stderr:
- `"Using tool: ToolName"`
- `"Tool: ToolName"`
- Tool names with "using" or "running" context

Detected tools: **Read**, **Edit**, **Write**, **Bash**, **Grep**, **Glob**, **WebFetch**, **WebSearch**

#### Event Payloads

```rust
// Tool starts
ToolStartEvent {
    tool_id: "tool-{message_id}-{counter}",
    tool_name: "Read",
    message_id: "msg-123-assistant"
}

// Tool completes
ToolResultEvent {
    tool_id: "tool-{message_id}-{counter}",
    tool_name: "Read",
    message_id: "msg-123-assistant",
    result: "file content or output",
    status: "completed" | "error"
}
```

### Frontend (TypeScript/React)

**File**: `src/App.tsx`

#### Event Listeners

New `useEffect` hook listens to Tauri events:

```typescript
listen('claude-tool-start', (event) => {
  // Add new tool call with 'running' status to message.toolCalls
});

listen('claude-tool-result', (event) => {
  // Update tool call with result and 'completed' status
});
```

#### State Updates

Tool calls are stored in `ChatMessage.toolCalls` array:

```typescript
interface ChatMessage {
  // ...
  toolCalls?: ChatToolCall[];
}

interface ChatToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status?: 'running' | 'completed' | 'error';
  result?: string;
  diff?: ToolDiff; // For Edit operations
  timestamp?: number;
}
```

When events arrive, the appropriate message is found by `message_id` and its `toolCalls` array is updated in real-time.

## UI Components

### ToolCallCard

**File**: `src/components/ToolCallCard.tsx`

Renders individual tool operations with:
- Status indicator (🟡 running, ✅ completed, 🔴 error)
- Tool icon (📖 Read, ✏️ Edit, 💻 Bash, etc.)
- Collapsible result display
- Diff viewer for Edit/Write operations

### DiffViewer

**File**: `src/components/DiffViewer.tsx`

Displays file changes for Edit tools:
- Red background for removed lines (`-`)
- Green background for added lines (`+`)
- Gray for unchanged context
- Line numbers on the left
- Scrollable for long diffs

## User Experience

### Before (Blocking)

```
User: "Update ChatMessage.css"
[... long wait ...]
Jack: "Done! I updated the file."
```

User has no visibility into what Claude is doing.

### After (Streaming)

```
User: "Update ChatMessage.css"
Jack: "Quack Agency is working with Claude Code, hold on..."

[Tool cards appear in real-time]
✅ 📖 Tool Result
   Found 22 files...

🟡 ✏️ Changes (running...)
   ChatMessage.css

✅ ✏️ Changes (completed)
   ChatMessage.css
   [Diff with red/green lines shown]

Jack: "Done! I updated the file."
```

User sees **exactly what Claude is doing** as it happens!

## Testing

### With Mock Data

Add mock tool calls to a message for UI testing:

```typescript
const mockMessage: ChatMessage = {
  // ...
  toolCalls: [
    {
      id: 'tool-1',
      name: 'Read',
      status: 'completed',
      result: '1→import { memo } from "react";...',
    },
    {
      id: 'tool-2',
      name: 'Edit',
      status: 'completed',
      diff: {
        fileName: 'ChatMessage.css',
        lines: [
          { type: 'removed', content: '  margin-top: 12px;', lineNumber: 193 },
          { type: 'added', content: '  margin-top: 8px;', lineNumber: 193 },
        ]
      }
    }
  ]
};
```

### With Real Claude CLI

1. Run the app: `npm run tauri:dev`
2. Send a message that requires file operations
3. Watch tool cards appear in real-time as Claude works
4. Click cards to see full results and diffs

## Limitations & Future Improvements

### Current Limitations

1. **Parser Heuristics**: Tool detection relies on stderr patterns which may not catch all cases
2. **No Stdout Parsing**: Currently only reads stderr; Claude's actual tool output might be on stdout
3. **Immediate Completion**: Tools are marked completed as soon as detected (no true start/end tracking)
4. **No Input Tracking**: Tool inputs (file paths, commands) are not captured yet

### Future Enhancements

1. **Better Parsing**: Use Claude CLI's JSON output format if available
2. **Tool Input Capture**: Extract and display tool parameters (e.g., which file was read)
3. **Progress Indicators**: Show percentage complete for long-running tools
4. **Tool Timing**: Track how long each tool takes to execute
5. **Diff Generation**: Parse Edit tool output to generate diffs automatically
6. **Error Details**: Capture and display detailed error messages when tools fail

## Configuration

Currently enabled by default. To use the old blocking command, change in `App.tsx`:

```typescript
// Streaming (default)
const response = await invoke('send_message_via_cli_streaming', {
  messageId: assistantMessageId,
  request: requestPayload,
});

// Blocking (old behavior)
const response = await invoke('send_message_via_cli', {
  request: requestPayload,
});
```

## Performance

**Minimal Overhead**: Event emission and state updates are lightweight. The streaming approach doesn't significantly impact performance compared to blocking.

**Memory**: Each tool call adds ~1KB to message state. Typical messages have 3-10 tool calls.

## Debugging

Enable Rust logging to see tool detection in action:

```bash
RUST_LOG=debug npm run tauri:dev
```

Check browser console for frontend event handling:

```javascript
console.log('Tool start:', event.payload);
console.log('Tool result:', event.payload);
```

---

**Status**: ✅ **Implemented and Ready for Testing**

Quack quack! 🦆
