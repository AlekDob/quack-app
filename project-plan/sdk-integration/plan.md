# Claude SDK Integration - Detailed Implementation Plan 🦆

*Created by Mike - Project Manager*
*Date: 2025-10-11*
*Status: Planning Phase*

---

## Executive Summary

This plan details the integration of **Claude Agent SDK** (`@anthropic-ai/claude-agent-sdk`) and **Anthropic SDK** (`@anthropic-ai/sdk`) into quack-app. The goal is to create advanced AI-powered features while maintaining the existing Claude Code CLI shell integration for development workflow notifications.

### Key Insight: Best of Both Worlds Approach
- **Keep existing**: Claude Code CLI + HTTP hooks (works great for dev workflow status)
- **Add new**: SDK-based AI features (chat panel, AI assistant, advanced tools)
- **No conflicts**: Two systems serve different purposes and complement each other

---

## 📊 Current State Analysis

### What's Already Built

#### 1. Terminal Infrastructure (Robust ✅)
- **Location**: `src/App.tsx`, `src/components/TerminalView.tsx`, `src-tauri/src/terminal.rs`
- **Features**:
  - Multiple PTY-backed terminals with xterm.js
  - Smart auto-scroll system (anti-flickering)
  - Status management (busy/idle/attention)
  - Terminal metadata (label, color, cwd)
  - Storage persistence via `tauri-plugin-store`

#### 2. Claude Code CLI Integration (Working ✅)
- **Location**: `src-tauri/src/lib.rs` (HTTP endpoint), `src/hooks/useClaudeChat.ts`
- **Implementation**:
  ```rust
  // HTTP endpoint at http://127.0.0.1:6768/terminal/status
  // Payload: {"id": "Terminal Name", "status": "busy"|"idle", "notify"?: false}
  ```
- **Features**:
  - External hooks update terminal status
  - Desktop notifications with "quack" sound
  - Status badges in sidebar (IN ESECUZIONE / PRONTO)
  - Pulse animation for background terminals

#### 3. Chat UI Foundation (Basic ✅)
- **Location**: `src/components/ChatView.tsx`, `src/components/ChatMessage.tsx`, `src/components/ChatInput.tsx`
- **Status**: Basic chat UI exists but uses Claude Code CLI (`check_claude_cli_available`, `send_message_via_cli`)
- **Gap**: No SDK integration, no streaming, no tool use

#### 4. SDKs Installed (Ready ✅)
```json
"@anthropic-ai/claude-agent-sdk": "^0.1.13",
"@anthropic-ai/sdk": "^0.65.0"
```
- **Status**: Installed but NOT used in codebase yet
- **Opportunity**: Ready to integrate without dependency conflicts

### What's Missing

1. **SDK Usage**: No actual SDK code in the codebase
2. **Streaming**: Chat uses CLI, not streaming API
3. **Tool Use**: No custom tools defined
4. **Agent SDK Features**: No usage of agent-sdk's advanced capabilities
5. **API Key Management**: No secure storage for SDK API keys (CLI handles auth differently)

---

## 🎯 Implementation Plan: 4-6 Phases (Specification Mode)

### Phase 1: SDK Foundation & Authentication Strategy (1-2 days) [UPDATED 2025-10-11]

**Duration**: 1-2 days
**Dependencies**: None
**Owner**: John (Backend Architect)

#### 🚨 CRITICAL DISCOVERY: REUSE EXISTING CLI CREDENTIALS!
**We don't need custom OAuth or separate API keys!** The Claude Code CLI credentials from `claude login` can be reused for the Agent SDK.

#### Objectives
- [ ] ~~Replace Claude CLI calls with direct SDK usage~~ **UPDATED**: Reuse CLI credentials for SDK
- [ ] ~~Implement secure API key storage~~ **UPDATED**: Use existing `claude_auth.rs::get_claude_credentials()`
- [ ] Remove custom OAuth flow (`claude_oauth.rs`) - it's unnecessary complexity
- [ ] Integrate Agent SDK with CLI session credentials
- [ ] Set up error handling and rate limiting infrastructure

#### Deliverables

**1. REFACTORED Authentication Flow**
```rust
// REMOVE: src-tauri/src/claude_oauth.rs (custom OAuth - not needed!)
// KEEP: src-tauri/src/claude_auth.rs (reads CLI credentials)
// MODIFY: src-tauri/src/claude_agent.rs to use CLI credentials

// In claude_agent.rs, modify send_message_with_agent():
pub async fn send_message_with_agent(
    prompt: String,
    images: Option<Vec<ImageAttachment>>,
    options: Option<AgentOptions>,
    // REMOVE: access_token parameter
) -> Result<AgentResponse, String> {
    // Get credentials from CLI storage
    let credentials = claude_auth::get_claude_credentials()?;
    let token = credentials.token; // Use CLI session key
    // ... rest of implementation
}
```

**2. Authentication Strategy**
- **Primary**: Reuse Claude Code CLI credentials from `~/.claude/.credentials.json` or macOS Keychain
- **How it works**: User runs `claude login` once, app reads those credentials
- **No OAuth needed**: Remove the entire OAuth flow from `claude_oauth.rs`
- **Fallback**: Optional API key input for users without CLI

**⚠️ IMPORTANT DISCOVERY: Claude Max Subscription Compatibility**
- **Finding**: Claude SDK/Code WORKS with existing Claude Max login - NO separate API billing needed!
- **Confirmed**: Working with Max 5x subscription (community verified)
- **Critical Fix**: If authentication issues occur with Claude Max:
  ```bash
  # Force unset any existing API keys that might conflict
  unset ANTHROPIC_API_KEY
  # Then test SDK in text-only mode
  claude -p hello
  ```
- **Implementation Note**: The SDK can authenticate via Claude Max session tokens, not just API keys
- **Source**: Reddit r/ClaudeAI community testing (2025-10-11)
- **Impact**: Users with Claude Max don't need separate API billing - huge cost saver!

**3. Updated Hook: `src/hooks/useClaudeChat.ts`**
- Remove Claude CLI dependency (`check_claude_cli_available`, `send_message_via_cli`)
- Add SDK-based message sending via Tauri invoke
- Support BOTH authentication methods:
  - Claude Max session authentication (automatic via SDK)
  - Traditional API key authentication (for enterprise users)
- Implement basic streaming foundation (Phase 2 will enhance)

#### Files to Create/Modify [UPDATED]
- **DELETE**: `src-tauri/src/claude_oauth.rs` (remove custom OAuth entirely)
- **KEEP**: `src-tauri/src/claude_auth.rs` (already reads CLI credentials perfectly!)
- **MODIFY**: `src-tauri/src/claude_agent.rs` (remove access_token param, use CLI creds)
- **MODIFY**: `src-tauri/src/lib.rs` (remove OAuth commands, simplify)
- **MODIFY**: `src/hooks/useClaudeChat.ts` (use Agent SDK with CLI auth)
- **MODIFY**: `src/components/AgentOptionsPanel.tsx` (remove OAuth UI, show CLI auth status)

#### Testing Strategy
- [ ] API key can be saved and retrieved securely
- [ ] SDK initializes correctly with valid key
- [ ] Invalid keys produce clear error messages
- [ ] Basic non-streaming message works
- [ ] Rate limiting prevents API abuse
- [ ] **Claude Max Authentication Testing**:
  - [ ] Test SDK with Claude Max login (no API key)
  - [ ] Test fallback to API key when Max auth fails
  - [ ] Verify `unset ANTHROPIC_API_KEY` fix resolves conflicts
  - [ ] Test both authentication methods can coexist
  - [ ] Document auth method in UI (Max vs API key)

#### Risks & Mitigation
- **Risk**: Tauri keychain complexity
  - *Mitigation*: Use `tauri-plugin-store` with encryption as simpler alternative
- **Risk**: SDK TypeScript/Rust type mismatches
  - *Mitigation*: Use `serde` with strict typing, thorough testing

#### Rollback Plan
- Keep Claude CLI integration intact as fallback
- Feature flag in `useClaudeChat.ts`: `USE_SDK` vs `USE_CLI`
- Revert to CLI if SDK has critical issues

---

### Phase 2: Streaming & Real-time Chat (1-2 days)

**Duration**: 1-2 days
**Dependencies**: Phase 1 completed
**Owners**: John (Backend) + Julie (Frontend)

#### Objectives
- [ ] Implement true streaming responses using Anthropic SDK
- [ ] Add typing indicators and loading states to chat UI
- [ ] Create abort/cancel functionality for long-running responses
- [ ] Implement message retry on failure
- [ ] Add connection status indicator

#### Deliverables

**1. Streaming Backend: `src-tauri/src/claude_sdk/streaming.rs`**
```rust
// Tauri event-based streaming
// Emits "chat-stream-chunk" events to frontend
pub async fn stream_message(prompt: String, conversation_id: String) -> Result<()>
pub fn cancel_stream(conversation_id: String) -> Result<()>
```

**2. Enhanced Frontend Hook: `src/hooks/useClaudeChat.ts`**
```typescript
// Add streaming handlers
const streamMessage = async (content: string) => {
  const unlisten = await listen<{ chunk: string }>('chat-stream-chunk', (event) => {
    // Update message in real-time
  });

  await invoke('stream_claude_message', { prompt: content });
};
```

**3. UI Enhancements: `src/components/ChatMessage.tsx`**
- Typing indicator animation (animated dots)
- Streaming text animation (smooth character reveal)
- Cancel button during streaming
- Message status badges (sending, streaming, complete, error)

**4. Connection Status: `src/components/ChatView.tsx`**
- Connection indicator in toolbar
- Retry button for failed messages
- Offline queue for messages

#### Files to Create/Modify
- **New**: `src-tauri/src/claude_sdk/streaming.rs` (streaming logic)
- **Modify**: `src-tauri/src/lib.rs` (add stream commands)
- **Modify**: `src/hooks/useClaudeChat.ts` (add streaming methods)
- **Modify**: `src/components/ChatMessage.tsx` (streaming UI)
- **Modify**: `src/components/ChatInput.tsx` (cancel button)
- **Modify**: `src/components/ChatView.tsx` (connection status)

#### Testing Strategy
- [ ] Streaming displays smoothly without UI freezing
- [ ] Cancel works mid-stream without memory leaks
- [ ] Network interruptions handled gracefully
- [ ] Long responses (10k+ tokens) don't cause performance issues
- [ ] Multiple concurrent streams handled correctly

#### Risks & Mitigation
- **Risk**: UI freezing during heavy streaming
  - *Mitigation*: Use requestAnimationFrame for UI updates, batch chunks
- **Risk**: Memory leaks from unclosed streams
  - *Mitigation*: Careful cleanup in useEffect, abort controllers

#### Rollback Plan
- Fall back to non-streaming (Phase 1 implementation)
- Disable streaming via feature flag
- Keep all Phase 1 functionality intact

---

### Phase 3: Advanced Agent SDK Features (2 days)

**Duration**: 2 days
**Dependencies**: Phase 2 completed
**Owners**: John (Backend) + Julie (Frontend)

#### Objectives
- [ ] Integrate Claude Agent SDK's thinking/tool-use capabilities
- [ ] Create custom tools for terminal operations
- [ ] Implement tool execution with safety confirmations
- [ ] Add thinking toggle for exposing Claude's reasoning
- [ ] Create tool approval workflow

#### Deliverables

**1. Tool Definitions: `src-tauri/src/claude_sdk/tools.rs`**
```rust
// Custom tools for terminal operations
pub struct TerminalExecuteTool;
pub struct FileReadTool;
pub struct FileWriteTool;
pub struct GitOperationTool;
pub struct DirectoryListTool;

// Tool execution with sandbox
pub async fn execute_tool(tool_name: String, params: Value) -> Result<ToolResult>
```

**2. Tool Approval UI: `src/components/ToolApprovalModal.tsx`**
- Modal for confirming destructive operations
- Display tool name, parameters, impact
- Approve/Deny/Always Allow options
- Safety warnings for dangerous commands

**3. Thinking Display: `src/components/ThinkingPanel.tsx`**
- Collapsible panel showing Claude's reasoning
- Toggle in chat settings
- Syntax highlighting for structured thinking
- Copy thinking to clipboard

**4. Agent SDK Integration: `src-tauri/src/claude_sdk/agent.rs`**
```rust
use anthropic_sdk::agent::{Agent, Tool, ThinkingMode};

pub async fn create_agent(tools: Vec<Tool>) -> Agent;
pub async fn agent_chat(agent: &Agent, message: String) -> Result<Response>;
```

#### Files to Create/Modify
- **New**: `src-tauri/src/claude_sdk/tools.rs` (tool definitions)
- **New**: `src-tauri/src/claude_sdk/agent.rs` (agent SDK wrapper)
- **New**: `src/components/ToolApprovalModal.tsx` (approval UI)
- **New**: `src/components/ThinkingPanel.tsx` (thinking display)
- **Modify**: `src/hooks/useClaudeChat.ts` (tool use handlers)
- **Modify**: `src/types.ts` (add Tool, Thinking types)

#### Testing Strategy
- [ ] Tools execute correctly with valid parameters
- [ ] Approval modal prevents dangerous operations
- [ ] Thinking toggle works without breaking chat
- [ ] Tool execution updates terminal state properly
- [ ] File operations respect permissions and safety checks

#### Risks & Mitigation
- **Risk**: Security vulnerabilities from tool execution
  - *Mitigation*: Sandbox all executions, require confirmations, audit logs
- **Risk**: Tool conflicts with existing terminal operations
  - *Mitigation*: Queue commands, ensure sequential execution

#### Rollback Plan
- Disable tool use entirely (agent SDK optional feature)
- Keep chat functionality without tools
- Feature flag: `ENABLE_TOOLS`

---

### Phase 4: Terminal Integration & Context Awareness (1-2 days)

**Duration**: 1-2 days
**Dependencies**: Phase 3 completed
**Owners**: John (Backend) + Julie (Frontend)

#### Objectives
- [ ] Inject terminal context into chat conversations (cwd, recent commands, git status)
- [ ] Execute commands from chat in active terminal
- [ ] Display command output in chat
- [ ] Integrate with file explorer for context
- [ ] Add project-aware conversations (per-terminal chat history)

#### Deliverables

**1. Context Builder: `src/services/claude-context.ts`**
```typescript
interface TerminalContext {
  cwd: string;
  recentCommands: string[];
  gitBranch: string;
  gitStatus: GitStatusSummary;
  openFiles: string[];
  activeTerminal: TerminalInfo;
}

export function buildContextPrompt(context: TerminalContext): string;
```

**2. Command Execution: `src/services/tool-executor.ts`**
```typescript
// Execute commands suggested by Claude in active terminal
export async function executeInTerminal(
  terminalId: string,
  command: string
): Promise<{ output: string; exitCode: number }>;
```

**3. Output Display: `src/components/CommandOutputBlock.tsx`**
- Display terminal output in chat messages
- Syntax highlighting for output
- Copy output button
- Link to terminal that ran the command

**4. Project Context: `src-tauri/src/claude_sdk/context.rs`**
```rust
// Gather project context for AI conversations
pub async fn get_project_context(terminal_id: String) -> Result<ProjectContext>
pub async fn get_git_context(cwd: String) -> Result<GitContext>
pub async fn get_file_tree(path: String) -> Result<FileTree>
```

#### Files to Create/Modify
- **New**: `src/services/claude-context.ts` (context building)
- **New**: `src/services/tool-executor.ts` (command execution)
- **New**: `src/components/CommandOutputBlock.tsx` (output display)
- **New**: `src-tauri/src/claude_sdk/context.rs` (context gathering)
- **Modify**: `src/App.tsx` (pass context to chat)
- **Modify**: `src/hooks/useClaudeChat.ts` (inject context)

#### Testing Strategy
- [ ] Context accurately reflects terminal state
- [ ] Commands execute in correct terminal
- [ ] Output captured and displayed correctly
- [ ] Git status updates reflected in context
- [ ] File tree navigation works from chat

#### Risks & Mitigation
- **Risk**: Context too large, token limits exceeded
  - *Mitigation*: Context windowing, summarization, selective inclusion
- **Risk**: Command execution conflicts with user input
  - *Mitigation*: Queue system, clear visual indicators

#### Rollback Plan
- Disable context injection (chat works without context)
- Manual command execution (copy/paste instead of auto-execute)
- Feature flag: `ENABLE_CONTEXT_INJECTION`

---

### Phase 5: Enhanced Chat UI & UX Polish (1-2 days)

**Duration**: 1-2 days
**Dependencies**: Phase 4 completed
**Owner**: Julie (UI/UX Designer)

#### Objectives
- [ ] Improve markdown rendering with syntax highlighting
- [ ] Add code block copy buttons and language detection
- [ ] Implement virtual scrolling for performance
- [ ] Add chat history search and filtering
- [ ] Create conversation management (new, delete, archive)
- [ ] Polish animations and transitions

#### Deliverables

**1. Enhanced Markdown: `src/components/MessageList.tsx`**
```typescript
// Rich markdown with:
// - Syntax highlighting (react-syntax-highlighter)
// - Copy buttons on code blocks
// - Inline diffs for file changes
// - Tables, lists, links
```

**2. Virtual Scrolling**
- Use `@tanstack/react-virtual` for performance with 100+ messages
- Smooth scrolling with keyboard navigation
- Jump to message functionality

**3. Conversation Management: `src/components/ChatToolbar.tsx`**
- New conversation button
- Conversation list dropdown
- Delete/archive conversations
- Search conversations

**4. Visual Polish**
- Smooth message fade-in animations
- Loading skeleton for streaming
- Error states with retry options
- Success/failure indicators for tool use

#### Files to Create/Modify
- **Modify**: `src/components/MessageList.tsx` (virtual scrolling, markdown)
- **Modify**: `src/components/ChatToolbar.tsx` (conversation management)
- **Modify**: `src/components/ChatMessage.tsx` (animations, polish)
- **New**: `src/components/ConversationPicker.tsx` (conversation selector)
- **Modify**: `src/components/ChatView.css` (animations, transitions)

#### Testing Strategy
- [ ] Virtual scrolling smooth with 1000+ messages
- [ ] Code blocks render correctly in all languages
- [ ] Copy buttons work reliably
- [ ] Conversation switching preserves state
- [ ] Animations don't cause performance issues

#### Risks & Mitigation
- **Risk**: Virtual scrolling breaks message positioning
  - *Mitigation*: Thorough testing with edge cases, scroll anchoring
- **Risk**: Too many animations hurt performance
  - *Mitigation*: Use CSS animations, reduce motion preference

#### Rollback Plan
- Disable virtual scrolling (standard scrolling)
- Simplified markdown rendering
- Remove animations if performance issues

---

### Phase 6: Testing, Documentation & Refinement (1 day)

**Duration**: 1 day
**Dependencies**: Phase 5 completed
**Owners**: Mike (Documentation), John (Testing), Julie (Refinement)

#### Objectives
- [ ] Write comprehensive documentation
- [ ] Create integration tests for all features
- [ ] Performance benchmarking and optimization
- [ ] User acceptance testing
- [ ] Bug fixes and polish

#### Deliverables

**1. Documentation: `docs/claude-sdk-integration.md`**
- Architecture overview
- API reference
- Tool creation guide
- Troubleshooting guide
- Security best practices

**2. Testing Suite**
```typescript
// Integration tests
describe('Claude SDK Integration', () => {
  test('streaming chat works', async () => {});
  test('tool execution is safe', async () => {});
  test('context injection accurate', async () => {});
  test('API key management secure', async () => {});
});
```

**3. Performance Benchmarks**
- Streaming latency: < 100ms for first token
- Message rendering: < 16ms per frame
- Memory usage: < 50MB increase
- Tool execution: < 500ms average

**4. User Guide: `docs/user-guide.md`**
- How to set up API key
- Basic chat usage
- Advanced features (tools, thinking)
- Tips and tricks
- FAQ

#### Files to Create/Modify
- **New**: `docs/claude-sdk-integration.md` (technical docs)
- **New**: `docs/user-guide.md` (user-facing docs)
- **New**: `__tests__/claude-sdk.test.ts` (integration tests)
- **New**: `__tests__/streaming.test.ts` (streaming tests)
- **Modify**: `README.md` (add SDK section)

#### Testing Strategy
- [ ] All integration tests pass
- [ ] Performance benchmarks met
- [ ] User guide validated with real users
- [ ] No regressions in existing features
- [ ] Security audit passed

#### Risks & Mitigation
- **Risk**: Testing reveals critical bugs
  - *Mitigation*: Time buffer for fixes, prioritize critical path
- **Risk**: Documentation incomplete
  - *Mitigation*: Focus on most important features first

#### Rollback Plan
- If critical bugs found: delay release, fix in hotfix
- If performance issues: optimize or scale back features

---

## 🔗 Integration with Existing Systems

### Coexistence Strategy: SDK + CLI

**Claude Code CLI Integration (Keep ✅)**
- **Purpose**: Development workflow status notifications
- **Use Cases**:
  - Hook scripts update terminal status (UserPromptSubmit → busy, PostToolUse → idle)
  - Desktop notifications when background terminals finish
  - "Quack" sound for attention grabbing
- **Location**: `src-tauri/src/lib.rs` HTTP endpoint (port 6768)
- **Why Keep**: Works perfectly for its purpose, zero conflicts with SDK

**Claude SDK Integration (Add 🆕)**
- **Purpose**: AI chat, tool use, advanced AI features
- **Use Cases**:
  - Chat panel for AI conversations
  - AI assistant for command suggestions
  - Automatic error analysis
  - Code generation and refactoring
- **Location**: New `src-tauri/src/claude_sdk/` module
- **Why Add**: Unlocks advanced AI capabilities CLI can't provide

**No Conflicts**:
- CLI = External process notifying app about status
- SDK = App proactively using AI for features
- Both use different APIs, different purposes, no overlap

---

## 🎨 UI/UX Design Decisions

### Layout: Tab System (Chosen ✅)

**Current Implementation**: Already exists!
- `src/App.tsx` line 263: `const [activeTab, setActiveTab] = useState<'terminal' | 'chat'>('terminal');`
- Toolbar buttons toggle between Terminal and Chat views
- Clean separation, familiar UX

**Enhancement Opportunities**:
1. Add split view option (chat + terminal side-by-side)
2. Picture-in-picture chat (floating mini-chat)
3. Chat in drawer (like git drawer)

### Visual Theme

**Inherit Existing Styles**:
- Dark theme with glass morphism
- Orange accent colors (COLORS array in App.tsx)
- Liquid design language
- Custom scrollbars

**Chat-Specific Styles**:
- User messages: Right-aligned, accent color background
- Assistant messages: Left-aligned, darker background
- Code blocks: Monaco editor theme (already used in app)
- Thinking: Collapsible, subtle background

---

## 📦 Dependencies & Environment

### NPM Packages (Add)
```json
{
  "react-markdown": "^9.0.0",
  "remark-gfm": "^4.0.0",
  "react-syntax-highlighter": "^15.5.0",
  "@tanstack/react-virtual": "^3.0.0"
}
```

### Rust Crates (Add to `src-tauri/Cargo.toml`)
```toml
[dependencies]
# Already have:
# tauri = { version = "2.0", features = ["...", "http-all"] }
# portable-pty = "0.8"
# tauri-plugin-dialog = "2.0"
# tauri-plugin-notification = "2.0"
# tauri-plugin-store = "2.0"

# Add:
reqwest = { version = "0.11", features = ["json", "stream"] }
tokio-stream = "0.1"
serde_json = "1.0"
async-trait = "0.1"
```

### Environment Setup

**API Key Storage & Authentication Methods**:

**Method 1: Claude Max Subscription (Preferred for Individual Users)**
- SDK automatically uses Claude Max session authentication
- No separate API billing required - confirmed working with Max 5x
- If issues arise, run: `unset ANTHROPIC_API_KEY` to clear conflicts
- Test with: `claude -p hello` to verify authentication

**Method 2: Traditional API Keys (Enterprise/Advanced Users)**
- Use existing `tauri-plugin-store` (already in Cargo.toml)
- Encrypt keys in `~/.quack-app/claude-api.json`
- Settings panel: `src/components/ClaudeAuthSettings.tsx` (already exists!)

**Authentication Priority**:
1. Check for Claude Max session first (automatic)
2. Fall back to API key if Max not available
3. Show clear status in UI about which method is active

**No New Plugins Required**: Everything we need is already installed! 🎉

---

## 🧪 Testing Strategy

### Unit Tests (Backend)
```rust
#[cfg(test)]
mod tests {
    #[test]
    fn test_api_key_storage() {
        // Test keychain save/load
    }

    #[test]
    fn test_rate_limiting() {
        // Test rate limiter prevents abuse
    }

    #[test]
    fn test_tool_execution_safety() {
        // Test dangerous commands blocked
    }
}
```

### Integration Tests (Frontend)
```typescript
describe('Claude SDK Integration', () => {
  test('sends message and receives response', async () => {
    const { result } = renderHook(() => useClaudeChat());
    await result.current.sendMessage('Hello');
    expect(result.current.messages).toHaveLength(2);
  });

  test('streaming updates message in real-time', async () => {
    // Test streaming behavior
  });

  test('tool execution requires approval', async () => {
    // Test approval modal appears
  });
});
```

### Performance Benchmarks
- **First Token Latency**: < 100ms (streaming)
- **Message Render Time**: < 16ms (60fps)
- **Memory Usage**: < 50MB increase with 100 messages
- **Tool Execution**: < 500ms average

### Security Audits
- [ ] API keys never logged or exposed
- [ ] Tool execution sandboxed
- [ ] User confirmation for dangerous operations
- [ ] Rate limiting prevents API abuse
- [ ] Input sanitization prevents injection

---

## 🚨 Risk Assessment & Mitigation

### High Priority Risks

**1. API Rate Limiting**
- **Impact**: Service interruption, poor UX
- **Probability**: Medium (depends on usage patterns)
- **Mitigation**:
  - Implement exponential backoff
  - Local caching of responses
  - Usage tracking and warnings
  - Graceful degradation (disable features if rate limited)

**2. Security Vulnerabilities (Tool Use)**
- **Impact**: System compromise, data loss
- **Probability**: Low (with proper safeguards)
- **Mitigation**:
  - Sandbox all tool executions
  - Require user confirmation for destructive operations
  - Audit logging of all tool executions
  - Whitelist of allowed tools
  - Input validation and sanitization

**3. Performance Degradation**
- **Impact**: Poor user experience, app slowdown
- **Probability**: Medium (with heavy usage)
- **Mitigation**:
  - Virtual scrolling for long conversations
  - Lazy loading of message history
  - Web Workers for heavy processing
  - Debouncing and throttling
  - Memory leak prevention

### Medium Priority Risks

**1. SDK Breaking Changes**
- **Impact**: App breaks on SDK updates
- **Probability**: Low (but possible)
- **Mitigation**:
  - Pin SDK versions
  - Test updates in staging
  - Wrapper abstraction layer
  - Fallback to CLI if SDK fails

**2. Large Context Handling**
- **Impact**: Memory issues, slow responses, high costs
- **Probability**: Medium (with long conversations)
- **Mitigation**:
  - Context windowing (keep last N messages)
  - Summarization of old messages
  - Token counting and warnings
  - Conversation splitting

**3. Network Reliability**
- **Impact**: Lost messages, broken streams
- **Probability**: Medium (depends on user's network)
- **Mitigation**:
  - Retry logic with exponential backoff
  - Offline message queue
  - Connection status indicator
  - Graceful error messages

---

## 🔄 Rollback Plan

### Phase-by-Phase Rollback

**Phase 6 Issues** → Delay release, fix bugs
**Phase 5 Issues** → Use basic UI without polish
**Phase 4 Issues** → Chat works without terminal context
**Phase 3 Issues** → Disable tool use, chat-only mode
**Phase 2 Issues** → Non-streaming responses (Phase 1)
**Phase 1 Issues** → Keep Claude CLI integration, remove SDK

### Emergency Rollback Procedure

```bash
# 1. Identify problematic commit
git log --oneline

# 2. Create rollback branch
git checkout -b rollback/sdk-integration

# 3. Revert commits
git revert <commit-hash>

# 4. Test rollback
npm run tauri:build

# 5. If working, merge to main
git checkout main
git merge rollback/sdk-integration
```

### Feature Flags

Add to `src-tauri/capabilities/default.json`:
```json
{
  "identifier": "claude-sdk-features",
  "permissions": {
    "allow": [
      "enable_sdk_chat",
      "enable_streaming",
      "enable_tool_use",
      "enable_context_injection"
    ]
  }
}
```

Can disable individual features without removing code.

---

## ✅ Success Criteria

### Must-Have (MVP)
- [ ] Chat interface loads without impacting terminal performance
- [ ] Messages send and receive successfully via SDK
- [ ] API key stored securely and never exposed
- [ ] User can switch between chat and terminal seamlessly
- [ ] All existing features remain fully functional
- [ ] Basic error handling and retry logic

### Should-Have (Full Release)
- [ ] Streaming responses work smoothly
- [ ] Tool use executes commands safely with confirmations
- [ ] Context injection provides relevant project information
- [ ] Conversation history persists across sessions
- [ ] Markdown rendering with syntax highlighting
- [ ] Performance benchmarks met

### Nice-to-Have (Future Enhancements)
- [ ] Split view (chat + terminal side-by-side)
- [ ] Voice input for chat
- [ ] Export conversations
- [ ] Custom tool creation UI
- [ ] Multi-modal support (images, files)

---

## 📅 Timeline & Milestones

### Total Estimated Time: 6-8 days

**Week 1: Foundation & Core Features (4-5 days)**
- Day 1-2: Phase 1 (SDK Foundation)
- Day 3-4: Phase 2 (Streaming)
- Day 5: Phase 3 start (Agent SDK)

**Week 2: Advanced Features & Polish (2-3 days)**
- Day 6: Phase 3 finish + Phase 4 (Terminal Integration)
- Day 7: Phase 5 (UI/UX Polish)
- Day 8: Phase 6 (Testing, Docs)

### Milestones

- **M1** (End of Phase 1): Basic chat works with SDK
- **M2** (End of Phase 2): Streaming chat smooth and responsive
- **M3** (End of Phase 3): Tool use functional with safety checks
- **M4** (End of Phase 4): Terminal integration complete
- **M5** (End of Phase 5): UI polished and delightful
- **M6** (End of Phase 6): Production ready, documented, tested

---

## 👥 Team Assignments

### Phase 1: SDK Foundation
- **Lead**: John (Backend Architect)
- **Support**: Mike (Documentation)
- **Deliverable**: Working SDK integration with API key management

### Phase 2: Streaming
- **Lead**: John (Backend - streaming logic)
- **Lead**: Julie (Frontend - UI updates)
- **Deliverable**: Real-time streaming chat

### Phase 3: Agent SDK & Tools
- **Lead**: John (Backend - tools implementation)
- **Lead**: Julie (Frontend - approval UI)
- **Deliverable**: Safe tool execution with user approval

### Phase 4: Terminal Integration
- **Lead**: John (Backend - context gathering)
- **Support**: Julie (Frontend - context display)
- **Deliverable**: Context-aware conversations

### Phase 5: UI/UX Polish
- **Lead**: Julie (UI/UX Designer)
- **Support**: John (Performance optimization)
- **Deliverable**: Beautiful, performant chat UI

### Phase 6: Testing & Docs
- **Lead**: Mike (Documentation)
- **Support**: John (Testing), Julie (Bug fixes)
- **Deliverable**: Production-ready release

---

## 📚 Resources & References

### Documentation
- [Anthropic SDK Docs](https://docs.anthropic.com/claude/reference/getting-started-with-the-api)
- [Claude Agent SDK](https://github.com/anthropics/anthropic-sdk-typescript)
- [Tauri Plugin Store](https://github.com/tauri-apps/tauri-plugin-store)
- [React Markdown](https://github.com/remarkjs/react-markdown)

### Design References
- [Conare.ai](https://conare.ai) - Chat UI inspiration
- [Warp Terminal](https://warp.dev) - Terminal + AI integration
- [GitHub Copilot Chat](https://github.com/features/copilot) - Tool use patterns

### Internal Resources
- `project-plan/claude-sdk-integration/summary.md` (original planning doc)
- `docs/techstack.md` (Tauri best practices)
- `CLAUDE.md` (project context and patterns)

---

## 🚀 Next Actions

### Immediate (Today)
1. ✅ Create this plan document
2. ⏳ Share with Jack for approval
3. ⏳ Get confirmation to proceed

### Phase 1 Kickoff (Once Approved)
1. **John**: Start Rust module `claude_sdk/mod.rs`
2. **John**: Implement API key storage
3. **Julie**: Update `ClaudeAuthSettings.tsx` for API key input
4. **Mike**: Update diary with plan progress

### Coordination
- **Daily standups**: Update `diary/YYYY-MM-DD.md`
- **Blockers**: Report to Jack immediately
- **Questions**: Use this plan as reference, ask Jack if unclear

---

## 📝 Appendix: Code Structure

### Proposed File Structure

```
quack-app/
├── src/
│   ├── components/
│   │   ├── ChatView.tsx                 ✅ Exists, needs SDK integration
│   │   ├── ChatMessage.tsx              ✅ Exists, enhance with streaming
│   │   ├── ChatInput.tsx                ✅ Exists, add cancel button
│   │   ├── MessageList.tsx              ✅ Exists, add virtual scrolling
│   │   ├── SkeletonMessage.tsx          ✅ Exists, use for loading
│   │   ├── ClaudeAuthSettings.tsx       ✅ Exists, add API key input
│   │   ├── ToolApprovalModal.tsx        🆕 New - tool approval UI
│   │   ├── ThinkingPanel.tsx            🆕 New - thinking display
│   │   ├── CommandOutputBlock.tsx       🆕 New - output in chat
│   │   └── ConversationPicker.tsx       🆕 New - conversation selector
│   ├── hooks/
│   │   ├── useClaudeChat.ts             ✅ Exists, replace CLI with SDK
│   │   └── useToolApproval.ts           🆕 New - tool approval logic
│   ├── services/
│   │   ├── claude-context.ts            🆕 New - context building
│   │   └── tool-executor.ts             🆕 New - command execution
│   └── types.ts                         ⚙️ Modify - add Tool, Thinking types
├── src-tauri/
│   └── src/
│       ├── lib.rs                       ⚙️ Modify - add claude_sdk module
│       ├── claude_sdk/                  🆕 New module
│       │   ├── mod.rs                   🆕 Module entry point
│       │   ├── api_client.rs            🆕 SDK wrapper
│       │   ├── keychain.rs              🆕 API key storage
│       │   ├── streaming.rs             🆕 Streaming logic
│       │   ├── tools.rs                 🆕 Tool definitions
│       │   ├── agent.rs                 🆕 Agent SDK wrapper
│       │   ├── context.rs               🆕 Context gathering
│       │   └── types.rs                 🆕 Shared types
│       └── terminal.rs                  ✅ Keep existing, minor updates
├── docs/
│   ├── claude-sdk-integration.md        🆕 New - technical docs
│   └── user-guide.md                    🆕 New - user guide
└── __tests__/
    ├── claude-sdk.test.ts               🆕 New - integration tests
    └── streaming.test.ts                🆕 New - streaming tests
```

**Legend**:
- ✅ Already exists, needs modification
- 🆕 New file to create
- ⚙️ Minor modification needed

---

## 🎯 Final Notes

### Why This Will Work

1. **Clear Separation**: SDK features complement existing CLI integration (no conflicts)
2. **Incremental**: Each phase builds on previous, easy rollback
3. **Existing Foundation**: Chat UI and SDKs already installed (80% ready)
4. **Proven Architecture**: Follows patterns already established in quack-app
5. **Safety First**: Tool use heavily sandboxed and confirmed

### Key Principles

- **Don't Break Terminal**: Terminal functionality is sacred, never compromise
- **Security First**: API keys, tool execution, all sandboxed and safe
- **Performance Matters**: 60fps chat, instant terminal, no compromises
- **User Control**: Always ask before dangerous operations
- **Best of Both Worlds**: Keep CLI hooks (work great), add SDK features (unlock potential)

---

*🦆 Quack quack! This plan is comprehensive, actionable, and ready for implementation. Let's build something amazing! Ready to start when Jack gives the go-ahead!*

**Status**: ✅ Planning Complete, Awaiting Approval
**Created by**: Mike (Project Manager)
**Date**: 2025-10-11
**Next Step**: Jack reviews and approves → Phase 1 kickoff
