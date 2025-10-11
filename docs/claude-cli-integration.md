# Claude CLI Integration

## Overview

Quack App integrates with **Claude Code CLI** to provide seamless AI chat functionality directly within the terminal application. This integration allows users to interact with Claude without needing to manage API keys or OAuth tokens manually—it leverages your existing Claude Code CLI authentication.

## Why Claude CLI?

Instead of implementing complex OAuth flows or requiring users to manually copy API keys, we discovered that Claude Code CLI can be invoked directly via shell commands. This approach offers several advantages:

- ✅ **Zero Configuration**: If you're already logged into Claude Code CLI (`claude auth login`), it "just works"
- ✅ **No API Key Management**: No need to store or rotate API keys
- ✅ **Session Continuity**: Maintains conversation context automatically
- ✅ **Cost Tracking**: Returns detailed usage metrics (tokens, cache hits, costs)
- ✅ **Simplified Authentication**: Uses the same authentication you use for Claude Code

## Architecture

### Backend (Rust + Tauri)

The integration is implemented in `src-tauri/src/claude_cli.rs` with two main Tauri commands:

#### 1. `check_claude_cli_available`

```rust
#[tauri::command]
pub fn check_claude_cli_available() -> Result<bool, String>
```

Verifies that Claude CLI is installed and accessible by running:
```bash
claude --version
```

Returns `true` if the command succeeds, `false` otherwise.

#### 2. `send_message_via_cli` (Async)

```rust
#[tauri::command]
pub async fn send_message_via_cli(prompt: String) -> Result<ClaudeCliResponse, String>
```

Sends a message to Claude by spawning an async process:

```bash
claude --print --dangerously-skip-permissions --output-format json --model sonnet
```

**Command Breakdown:**
- `--print`: Return the result directly to stdout instead of interactive mode
- `--dangerously-skip-permissions`: Skip file system permission prompts (we control the input)
- `--output-format json`: Return structured JSON response
- `--model sonnet`: Use Claude Sonnet 4.5 model

The prompt is passed via stdin, and the response is parsed as JSON:

```rust
pub struct ClaudeCliResponse {
    pub result: String,              // Claude's response text
    pub session_id: String,          // Session identifier for continuity
    pub total_cost_usd: f64,         // Total cost in USD
    pub usage: Usage,                // Token usage breakdown
}

pub struct Usage {
    pub input_tokens: u32,
    pub output_tokens: u32,
    pub cache_read_input_tokens: u32,
    pub cache_creation_input_tokens: u32,
}
```

**Async Implementation:**

The command uses `tokio::process::Command` to run asynchronously, preventing UI blocking:

```rust
let mut child = Command::new("claude")
    .arg("--print")
    .arg("--dangerously-skip-permissions")
    .arg("--output-format")
    .arg("json")
    .arg("--model")
    .arg("sonnet")
    .stdin(Stdio::piped())
    .stdout(Stdio::piped())
    .stderr(Stdio::piped())
    .spawn()
    .map_err(|e| format!("Failed to spawn claude command: {}", e))?;

// Write prompt to stdin asynchronously
{
    let stdin = child.stdin.as_mut()
        .ok_or("Failed to open stdin".to_string())?;
    stdin.write_all(prompt.as_bytes()).await
        .map_err(|e| format!("Failed to write to stdin: {}", e))?;
}

// Wait for command to complete asynchronously
let output = child.wait_with_output().await
    .map_err(|e| format!("Failed to wait for claude command: {}", e))?;
```

**Dependencies:**

In `Cargo.toml`:
```toml
tokio = { version = "1", features = ["rt-multi-thread", "macros", "net", "process", "io-util"] }
anyhow = "1.0"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
```

### Frontend (React + TypeScript)

#### Hook: `useClaudeChat`

Located in `src/hooks/useClaudeChat.ts`, this custom hook manages the chat state and communication with the Rust backend.

**Initialization:**

```typescript
const initialize = useCallback(async () => {
  try {
    const available = await invoke<boolean>('check_claude_cli_available');

    if (available) {
      setIsConfigured(true);
      setError(null);
      return true;
    } else {
      setIsConfigured(false);
      setError('Claude CLI is not available. Please install and authenticate.');
      return false;
    }
  } catch (err) {
    console.error('Failed to check Claude CLI:', err);
    setIsConfigured(false);
    setError(err instanceof Error ? err.message : 'Failed to check Claude CLI');
    return false;
  }
}, []);
```

**Sending Messages:**

```typescript
const sendMessage = useCallback(async (content: string) => {
  if (!content.trim() || isLoading) return;

  // Build context from conversation history
  let prompt = content;
  if (conversationHistory.current.length > 0) {
    const history = conversationHistory.current
      .map((msg) => `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`)
      .join('\n\n');
    prompt = `${history}\n\nUser: ${content}`;
  }

  // Add user message immediately
  const userMessage: ChatMessage = {
    id: generateId(),
    role: 'user',
    content,
    timestamp: Date.now(),
    status: 'complete',
  };

  setMessages((prev) => [...prev, userMessage]);
  conversationHistory.current.push({ role: 'user', content });
  setIsLoading(true);

  // Add placeholder assistant message
  const assistantMessageId = generateId();
  setMessages((prev) => [
    ...prev,
    {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'sending',
    },
  ]);

  try {
    // Call Claude CLI asynchronously
    const response = await invoke<ClaudeCliResponse>('send_message_via_cli', { prompt });

    // Update assistant message with response
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: response.result,
              status: 'complete' as const,
            }
          : msg
      )
    );

    conversationHistory.current.push({ role: 'assistant', content: response.result });
  } catch (err) {
    console.error('Failed to send message:', err);

    // Update assistant message with error
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === assistantMessageId
          ? {
              ...msg,
              content: '',
              status: 'error' as const,
              error: err instanceof Error ? err.message : 'Failed to send message',
            }
          : msg
      )
    );
  } finally {
    setIsLoading(false);
  }
}, [isLoading, error, initialize, isConfigured]);
```

#### UI Components

**1. ChatView** (`src/components/ChatView.tsx`)

Main chat interface with:
- Header showing "Claude Chat" with duck icon 🦆
- Status indicator (pulsing orange when thinking, green when ready)
- Message list with auto-scroll
- Input field for user messages

**2. MessageList** (`src/components/MessageList.tsx`)

Displays the conversation with:
- Auto-scrolling to latest messages
- Empty state with duck emoji when no messages
- **Skeleton loader** when Claude is thinking

**3. SkeletonMessage** (`src/components/SkeletonMessage.tsx`)

Animated loading state that appears while waiting for Claude's response:
- Duck avatar with pulse animation
- Shimmer effect on placeholder text lines
- Three lines of varying widths to simulate a message
- Smooth fade-in animation

**4. ChatMessage** (`src/components/ChatMessage.tsx`)

Individual message bubble component with:
- User/Assistant avatar (👤 / 🦆)
- Timestamp
- Message content
- Error display if message failed
- Tool call indicators (for future extensions)

#### Settings UI

**ClaudeAuthSettings** (`src/components/ClaudeAuthSettings.tsx`)

Displays Claude CLI status with:
- Real-time availability check
- Green badge: "✓ Claude Code CLI is available"
- Red badge: "⚠️ Claude Code CLI not available" with installation instructions

```tsx
<div className="auth-section cli-status-section">
  <div className="section-header">
    <h3>Claude Code CLI Status</h3>
    {cliAvailable !== null && (
      <div className={`status-badge ${cliAvailable ? 'status-success' : 'status-error'}`}>
        <span className="status-dot" />
        {cliAvailable ? 'Available' : 'Not Available'}
      </div>
    )}
  </div>
  {cliAvailable ? (
    <div className="auth-info">
      <p className="info-text">
        ✓ Claude Code CLI is installed and authenticated.
        The chat will use your CLI credentials automatically.
      </p>
    </div>
  ) : (
    <div className="auth-info warning-info">
      <p className="info-text">
        ⚠️ Claude Code CLI is not available or not authenticated.
        <br />
        To enable chat features, please:
        <ol>
          <li>Install Claude Code CLI: <code>npm install -g claude-code</code></li>
          <li>Login with your account: <code>claude auth login</code></li>
        </ol>
      </p>
    </div>
  )}
</div>
```

## Performance Optimizations

### Async/Await Architecture

The integration uses **async/await** throughout to prevent UI blocking:

1. **Rust Backend**: `tokio::process::Command` runs Claude CLI asynchronously
   - Main thread remains responsive
   - No freezing or stuttering during API calls
   - Concurrent command execution possible

2. **React Frontend**: All Tauri `invoke` calls use async/await
   - Non-blocking UI updates
   - Smooth animations during loading
   - Responsive user interactions

### Visual Feedback

To enhance perceived performance:

- **Skeleton Loader**: Shows animated placeholder while waiting for response
  - Shimmer gradient effect (200% background sweep)
  - Pulsing duck avatar
  - Fade-in animation (300ms)

- **Status Indicator**: Real-time visual feedback
  - Green dot: Ready to receive messages
  - Pulsing orange dot: Claude is thinking
  - Color animation on status text with animated dots

- **Auto-Scroll**: Smooth scrolling to latest messages
  - Triggers on new messages
  - Preserves scroll position when user scrolls up

## Usage

### Prerequisites

1. Install Claude Code CLI:
```bash
npm install -g claude-code
```

2. Authenticate:
```bash
claude auth login
```

3. Verify installation:
```bash
claude --version
```

### In Quack App

1. **Open Settings**: Click the settings icon in the sidebar
2. **Check Status**: Navigate to "Claude Auth" section
3. **Verify CLI**: Should show green "Available" badge
4. **Start Chatting**: Open the chat view and start asking Claude questions!

### Example Conversation

```
You: How do I add a new terminal tab?

Claude: To add a new terminal tab in Quack App, you can:

1. Click the "Nuovo terminale" button in the sidebar
2. A modal will appear where you can:
   - Enter a name for your terminal session
   - Choose a working directory using the Finder dialog
   - Select an accent color for the tab

The new terminal will be created and automatically activated!
```

## Troubleshooting

### "Claude CLI is not available"

**Cause**: CLI not installed or not in PATH

**Solution**:
```bash
# Install globally
npm install -g claude-code

# Verify installation
which claude
# Should output: /usr/local/bin/claude or similar
```

### "Not authenticated"

**Cause**: User not logged into Claude Code

**Solution**:
```bash
claude auth login
```

Follow the browser authentication flow.

### Messages fail with "command not found"

**Cause**: CLI not accessible from Tauri's environment

**Solution**:
- Ensure Claude CLI is in your system PATH
- Try running from terminal: `echo $PATH | grep claude`
- On macOS, you may need to restart the app after installing CLI

### App freezes when sending messages (SOLVED)

**Previous Issue**: App would freeze during API calls

**Solution Implemented**:
- Converted to async architecture with `tokio::process::Command`
- Added skeleton loader for visual feedback
- Improved status indicators with animations

## Future Enhancements

### Potential Features

1. **Streaming Responses**: Implement real-time token streaming
   - Would require capturing stdout as it arrives
   - Update message content incrementally
   - Better UX for long responses

2. **Cost Tracking**: Display usage statistics
   - Already receiving cost data in responses
   - Could add persistent storage
   - Show total costs per session/day/month

3. **Model Selection**: Allow users to choose models
   - Currently hardcoded to `sonnet`
   - Could add UI selector for `opus`, `haiku`, etc.

4. **Session Management**: Save and restore conversations
   - Use `session_id` from responses
   - Persist to local storage
   - Resume previous conversations

5. **Multi-Modal Support**: Add image/file attachments
   - Claude CLI supports file inputs
   - Could integrate with file explorer
   - Send code snippets or screenshots

## Technical Details

### Command Flags Reference

| Flag | Purpose |
|------|---------|
| `--print` | Output mode: return result to stdout (non-interactive) |
| `--dangerously-skip-permissions` | Skip permission prompts for file system access |
| `--output-format json` | Return structured JSON instead of plain text |
| `--model sonnet` | Use Claude Sonnet 4.5 model |

### Response Schema

```typescript
interface ClaudeCliResponse {
  result: string;              // Claude's response text
  session_id: string;          // Unique session identifier
  total_cost_usd: number;      // Total cost in USD for this request
  usage: {
    input_tokens: number;      // Input prompt tokens
    output_tokens: number;     // Generated response tokens
    cache_read_input_tokens: number;    // Tokens read from cache
    cache_creation_input_tokens: number; // Tokens written to cache
  };
}
```

### Error Handling

The integration includes comprehensive error handling:

**Rust Side:**
- Command spawn failures
- Stdin write errors
- Process exit codes
- JSON parsing errors

**TypeScript Side:**
- CLI availability checks
- Network/IPC failures
- Response validation
- User-friendly error messages

## Credits

This integration was inspired by [Conare](https://github.com/conare), which demonstrated that Claude Code CLI can be called directly via shell commands without complex OAuth flows.

---

**Quack quack!** 🦆 Built with love by Quack Agency.
