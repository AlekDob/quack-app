# Tool Visualization Test

## How to Test

To test the new tool visualization UI, you can inject mock tool calls into a chat message.

### Example: Mock Tool Calls

Add this to a message in `App.tsx` for testing:

```typescript
const mockMessage: ChatMessage = {
  id: 'test-1',
  role: 'assistant',
  content: 'I found the ChatMessage component and updated the styles.',
  timestamp: Date.now(),
  status: 'complete',
  toolCalls: [
    {
      id: 'tool-1',
      name: 'Read',
      input: { file_path: '/path/to/ChatMessage.tsx' },
      status: 'completed',
      result: `1→import { memo } from 'react'; 2→import type { ChatMessage as ChatMessageType } from '../types';`,
      timestamp: Date.now() - 3000,
    },
    {
      id: 'tool-2',
      name: 'Edit',
      input: {
        file_path: '/path/to/ChatMessage.css',
        old_string: '.chat-message-tools { margin-top: 12px; }',
        new_string: '.chat-message-tools { margin-top: 8px; }'
      },
      status: 'completed',
      diff: {
        fileName: 'ChatMessage.css',
        lines: [
          { type: 'unchanged', content: '.chat-message-tools {', lineNumber: 192 },
          { type: 'removed', content: '  margin-top: 12px;', lineNumber: 193 },
          { type: 'added', content: '  margin-top: 8px;', lineNumber: 193 },
          { type: 'unchanged', content: '  display: flex;', lineNumber: 194 },
          { type: 'removed', content: '  flex-wrap: wrap;', lineNumber: 195 },
          { type: 'added', content: '  flex-direction: column;', lineNumber: 195 },
          { type: 'unchanged', content: '  gap: 8px;', lineNumber: 196 },
          { type: 'unchanged', content: '}', lineNumber: 197 },
        ]
      },
      timestamp: Date.now() - 2000,
    },
    {
      id: 'tool-3',
      name: 'Grep',
      input: { pattern: 'streaming|process|status', output_mode: 'files_with_matches' },
      status: 'completed',
      result: 'Found 22 files /Users/alekdob/Desktop/Dev/Personal/quack-app/src/components/ChatMessage.css /Users/a...',
      timestamp: Date.now() - 1000,
    },
    {
      id: 'tool-4',
      name: 'Bash',
      input: { command: 'npm run build' },
      status: 'running',
      result: 'Building application...',
      timestamp: Date.now(),
    }
  ]
};
```

### Visual Features

✅ **Completed Tools**: Green checkmark, green border
🟡 **Running Tools**: Yellow dot, orange border with pulse animation
🔴 **Error Tools**: Red dot, red border

### Collapsible Results

- Click on any tool card to expand/collapse the full result
- Results are truncated to 120 characters in preview
- Full code is shown in monospace font when expanded

### Diff Visualization (NEW!)

**For Edit/Write tools**, the component now shows a beautiful diff viewer:

- ✅ **Red lines** for removed code with `-` marker
- ✅ **Green lines** for added code with `+` marker
- ✅ **Gray lines** for unchanged context
- ✅ **Line numbers** on the left
- ✅ **File name** header with icon
- ✅ **Scrollable** for long diffs
- ✅ **Monospace font** for code readability

The title changes from "Tool Result" to "Changes" when a diff is available!

### Icons

- 📖 Read
- ✏️ Edit/Write
- 💻 Bash/Shell
- 🔍 Grep/Search
- 📁 Glob
- 🌐 WebFetch/WebSearch
- 🔧 Default (other tools)

## Integration with Backend

To get real tool data from Claude CLI, the backend needs to:

1. Parse Claude CLI output for tool use events
2. Emit Tauri events for each tool (start/complete/error)
3. Frontend listens to events and updates message.toolCalls in real-time

See `IMPLEMENTATION_PLAN.md` for full backend integration details.
