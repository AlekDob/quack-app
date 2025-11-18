# Claude SDK Integration - Technical Documentation 🔧

## Overview
This document contains technical decisions, implementation details, and architectural considerations for integrating Claude's conversational AI into Quack-App.

## Key Architectural Decisions

### 1. UI/UX Architecture Decision: Tab System (Initial) → Split View (Future)

**Decision**: Start with a tab-based interface, add split view as an enhancement

**Rationale**:
- **Simplicity First**: Tab system is easier to implement and test
- **User Familiarity**: Users know how to work with tabs
- **Performance**: Less complex rendering, better performance initially
- **Progressive Enhancement**: Can add split view based on user feedback

**Implementation**:
```tsx
// Tab system in App.tsx
enum ViewMode {
  Terminal = 'terminal',
  Chat = 'chat',
  Split = 'split' // Future enhancement
}
```

### 2. API Key Management: Tauri Keyring Plugin

**Decision**: Use tauri-plugin-keyring for secure API key storage

**Rationale**:
- **Native Security**: Uses OS keychain (macOS Keychain, Windows Credential Store, Linux Secret Service)
- **No Plain Text**: Never store API keys in config files or environment variables
- **User Control**: Users can manage keys through OS interfaces

**Implementation**:
```rust
// src-tauri/src/chat/keychain.rs
use tauri_plugin_keyring::{Entry, Error};

pub async fn store_api_key(key: &str) -> Result<(), Error> {
    let entry = Entry::new("quack-app", "claude-api-key")?;
    entry.set_password(key)?;
    Ok(())
}

pub async fn retrieve_api_key() -> Result<String, Error> {
    let entry = Entry::new("quack-app", "claude-api-key")?;
    entry.get_password()
}
```

### 3. Message Streaming: Server-Sent Events (SSE)

**Decision**: Use SSE for real-time streaming responses

**Rationale**:
- **Native Support**: Claude API supports SSE out of the box
- **Efficient**: Lower overhead than WebSockets for one-way communication
- **Graceful Degradation**: Can fall back to polling if needed

**Implementation**:
```typescript
// src/services/claude-client.ts
async function* streamMessage(prompt: string): AsyncGenerator<string> {
    const stream = await anthropic.messages.create({
        model: 'claude-3-sonnet-20240229',
        messages: [{ role: 'user', content: prompt }],
        stream: true,
        max_tokens: 4096
    });

    for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta') {
            yield chunk.delta.text;
        }
    }
}
```

### 4. Tool Use Integration: Sandboxed Execution

**Decision**: Execute commands through existing terminal infrastructure with safety layers

**Rationale**:
- **Reuse Existing Code**: Leverage existing PTY management
- **Security**: Add confirmation dialogs for destructive operations
- **Auditability**: Log all AI-initiated commands

**Safety Levels**:
1. **Safe** (auto-execute): `ls`, `pwd`, `cat`, read-only operations
2. **Caution** (user confirm): `git`, `npm install`, file modifications
3. **Dangerous** (explicit confirm): `rm -rf`, `sudo`, system changes

**Implementation**:
```typescript
// src/services/tool-executor.ts
interface ToolExecution {
    tool: 'terminal_command' | 'file_operation' | 'git_operation';
    params: Record<string, any>;
    safetyLevel: 'safe' | 'caution' | 'dangerous';
}

async function executeTool(execution: ToolExecution): Promise<any> {
    if (execution.safetyLevel !== 'safe') {
        const confirmed = await confirmDialog(execution);
        if (!confirmed) throw new Error('User cancelled operation');
    }

    // Route to appropriate handler
    switch (execution.tool) {
        case 'terminal_command':
            return executeInTerminal(execution.params.command);
        // ... other cases
    }
}
```

### 5. State Management: React Context + IndexedDB

**Decision**: Use React Context for active state, IndexedDB for persistence

**Rationale**:
- **Performance**: Context is fast for active conversations
- **Persistence**: IndexedDB handles large conversation history
- **Simplicity**: No need for complex state management libraries

**Implementation**:
```typescript
// src/contexts/ChatContext.tsx
interface ChatState {
    conversations: Conversation[];
    activeConversation: string | null;
    streaming: boolean;
    streamBuffer: string;
}

const ChatContext = createContext<ChatState>(...);

// Persistence layer
class ConversationStore {
    private db: IDBDatabase;

    async saveConversation(conv: Conversation) {
        const tx = this.db.transaction(['conversations'], 'readwrite');
        await tx.objectStore('conversations').put(conv);
    }

    async loadConversations(): Promise<Conversation[]> {
        // Load from IndexedDB
    }
}
```

### 6. Performance Optimization: Virtual Scrolling

**Decision**: Use @tanstack/react-virtual for message lists

**Rationale**:
- **Scalability**: Handle thousands of messages without lag
- **Memory Efficiency**: Only render visible messages
- **Smooth Experience**: Maintain 60fps even with rich content

**Implementation**:
```typescript
// src/components/MessageList.tsx
import { useVirtualizer } from '@tanstack/react-virtual';

function MessageList({ messages }: { messages: Message[] }) {
    const virtualizer = useVirtualizer({
        count: messages.length,
        getScrollElement: () => scrollRef.current,
        estimateSize: () => 100, // Estimated message height
        overscan: 5
    });

    return (
        <div ref={scrollRef} className="message-list">
            {virtualizer.getVirtualItems().map(virtualItem => (
                <Message
                    key={virtualItem.key}
                    message={messages[virtualItem.index]}
                    style={{
                        transform: `translateY(${virtualItem.start}px)`
                    }}
                />
            ))}
        </div>
    );
}
```

## Integration Points

### Terminal Integration
```typescript
// Existing terminal receives commands from chat
invoke('execute_in_terminal', {
    terminalId: activeTerminal,
    command: suggestedCommand,
    source: 'claude-chat'
});
```

### File System Integration
```typescript
// Chat can read/write files through existing Tauri commands
const fileContent = await invoke('read_file', { path });
// Process with Claude
const updatedContent = await processWithClaude(fileContent);
await invoke('write_file', { path, content: updatedContent });
```

### Git Integration
```typescript
// Leverage existing git panel
await invoke('git_status');
await invoke('git_commit', { message: claudeSuggestedMessage });
```

## API Design

### Rust Commands (Tauri)
```rust
#[tauri::command]
async fn chat_send_message(
    message: String,
    conversation_id: Option<String>
) -> Result<String, String> {
    // Send to Claude API
}

#[tauri::command]
async fn chat_stream_message(
    message: String,
    conversation_id: Option<String>
) -> Result<impl Stream<Item = String>, String> {
    // Stream from Claude API
}

#[tauri::command]
async fn chat_execute_tool(
    tool: ToolExecution
) -> Result<serde_json::Value, String> {
    // Execute tool safely
}
```

### TypeScript API
```typescript
// High-level API for components
class ClaudeChat {
    async sendMessage(content: string): Promise<Message>;
    async* streamMessage(content: string): AsyncGenerator<string>;
    async executeToolUse(tool: ToolCall): Promise<ToolResult>;
    async saveConversation(): Promise<void>;
    async loadConversation(id: string): Promise<Conversation>;
}
```

## Error Handling Strategy

### API Errors
- **Rate Limits**: Exponential backoff with user notification
- **Network Errors**: Retry with fallback to offline mode
- **Auth Errors**: Prompt for new API key

### Tool Execution Errors
- **Command Failures**: Display error in chat, suggest fixes
- **Permission Denied**: Request elevated permissions
- **File Not Found**: Suggest alternatives

### UI Errors
- **Streaming Interruption**: Save partial response, offer retry
- **Memory Issues**: Clear old messages, implement pagination

## Security Considerations

### API Key Security
- Never log API keys
- Encrypt in memory when possible
- Clear from memory after use
- Rotate keys regularly (remind users)

### Command Execution Security
- Whitelist safe commands
- Sandbox all executions
- Log all operations
- Implement rate limiting
- Never execute without user consent for destructive operations

### Content Security
- Sanitize markdown rendering
- Prevent XSS in message display
- Validate all tool parameters
- Escape shell commands properly

## Performance Benchmarks

### Target Metrics
- **Initial Load**: < 500ms
- **Message Send**: < 100ms (before streaming starts)
- **Streaming Start**: < 1s
- **Character Display**: 60fps during streaming
- **Memory Usage**: < 200MB for 1000 messages
- **CPU Usage**: < 5% idle, < 30% streaming

### Optimization Techniques
- Lazy load conversation history
- Virtual scroll for messages
- Debounce UI updates during streaming
- Use Web Workers for heavy processing
- Implement message pagination

## Testing Strategy

### Unit Tests
```typescript
// Example test structure
describe('ClaudeChat', () => {
    it('should handle streaming responses', async () => {
        const messages = [];
        for await (const chunk of chat.streamMessage('test')) {
            messages.push(chunk);
        }
        expect(messages.length).toBeGreaterThan(0);
    });
});
```

### Integration Tests
```rust
#[cfg(test)]
mod tests {
    #[tokio::test]
    async fn test_api_key_storage() {
        let key = "test-key";
        store_api_key(key).await.unwrap();
        let retrieved = retrieve_api_key().await.unwrap();
        assert_eq!(key, retrieved);
    }
}
```

### E2E Tests
- Full conversation flow
- Tool execution with real terminal
- Error recovery scenarios
- Performance under load

## Migration Strategy

### Phase 1: Feature Flag
```typescript
const CLAUDE_CHAT_ENABLED = import.meta.env.VITE_CLAUDE_CHAT === 'true';
```

### Phase 2: Gradual Rollout
- Internal testing
- Beta users (10%)
- Full rollout (100%)

### Phase 3: Deprecation Path
- Maintain backward compatibility
- Provide migration tools
- Document breaking changes

## Monitoring & Analytics

### Metrics to Track
- API usage (requests, tokens)
- Error rates by type
- Performance metrics (response time, streaming speed)
- Feature adoption (chat vs terminal usage)
- Tool execution frequency

### Implementation
```typescript
// Analytics wrapper
function trackChatMetric(event: string, data: any) {
    if (analyticsEnabled) {
        analytics.track(event, {
            ...data,
            timestamp: Date.now(),
            sessionId: getSessionId()
        });
    }
}
```

## Future Enhancements

### Near Term (v1.1)
- Split view layout
- Conversation search
- Custom system prompts
- Export conversations

### Medium Term (v1.2)
- Multi-model support (GPT-4, Gemini)
- Plugin system for custom tools
- Collaborative sessions
- Voice input/output

### Long Term (v2.0)
- Local LLM support
- Custom fine-tuned models
- Advanced context management
- AI agent workflows

---
*Technical documentation by Mike - Project Manager*
*Last Updated: 2025-10-10*
*Version: 1.0*