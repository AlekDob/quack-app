# Agent Reset Mechanism

This document describes how the "Reset Agent" feature works in Quack and why it was designed this way.

## Problem Statement

When using the Claude Agent SDK, sessions are identified by a combination of:
1. **Agent ID** - A unique identifier for the agent (e.g., `terminal-abc123`)
2. **Session ID** - A unique identifier for the conversation session (e.g., `session-xyz789`)

The SDK maintains internal state including:
- Conversation history
- Context compaction summaries (created when context window fills up)
- Cached system prompts and tool definitions

### The Context Compaction Issue

When the context window approaches its limit (~200k tokens), Claude Agent SDK automatically:
1. Creates a summary of the conversation
2. Starts a new session with this summary as the initial context
3. Passes the summary in a `<system-reminder>` block

**Problem**: Even if Quack deleted the session file and cleared the session ID, the SDK's context compaction mechanism could still carry over the summary to new sessions if the same agent ID was used.

This meant that clicking "Reset Agent" didn't give users a truly fresh start - they would still see remnants of the previous conversation in the system context.

## Solution: UUID Regeneration

The solution is elegantly simple: **generate a completely new UUID for the agent when resetting**.

Since the SDK associates sessions with the agent ID, a new agent ID means:
- No connection to previous sessions
- No context compaction summaries carried over
- A completely fresh context window
- Stamina (context usage) back to 100%

### How It Works

When a user clicks "Reset Agent" from the context menu:

```typescript
const handleResetTerminal = useCallback(async (terminal: TerminalInfo) => {
  const oldId = terminal.id;
  const newId = crypto.randomUUID();  // Generate fresh UUID
  const sessionId = chatSessionIds.get(oldId);

  // 1. Abort any active stream
  if (sessionId) {
    abortSessionStream(sessionId);
  }

  // 2. Clean up old session in backend (optional - for disk cleanup)
  if (sessionId && tauriAvailable) {
    await invoke('reset_agent_session', { agentId: oldId, sessionId });
  }

  // 3. Update terminal with NEW ID (preserves personality, label, color, etc.)
  setTerminals(prev => prev.map(t =>
    t.id === oldId ? { ...t, id: newId, sessionId: undefined } : t
  ));

  // 4. Clear all state mappings keyed by oldId
  setChatSessions(prev => { /* delete oldId */ });
  setChatSessionIds(prev => { /* delete oldId */ });
  setChatTokensMap(prev => { /* delete oldId */ });
  setAgentChats(prev => prev.filter(chat => chat.id !== oldId));

  // 5. Update activeId if this was the active agent
  setActiveId(prevActiveId => prevActiveId === oldId ? newId : prevActiveId);
});
```

## What Gets Preserved

When resetting an agent, the following are **preserved**:
- Agent name/label
- Color
- Working directory (cwd)
- Avatar
- Personality configuration
- Position in the sidebar

## What Gets Reset

- Agent ID (new UUID)
- Session ID (cleared, SDK creates new one on first message)
- Chat history (cleared)
- Token usage / Stamina (back to 100%)
- Resume message flag
- All cached state

## Benefits

1. **True Fresh Start**: No leftover context from previous sessions
2. **Preserved Configuration**: User doesn't lose their agent setup
3. **History Preservation**: Old session files remain on disk in `~/.claude/projects/` if needed for reference
4. **Simple Implementation**: Uses standard UUID generation, no complex session management

## Technical Details

### Files Involved

- **`src/App.tsx`**: `handleResetTerminal` function (~line 4480)
- **`src-tauri/src/sessions.rs`**: `reset_agent_session` command (backend cleanup)

### State Maps Updated

| State | Key | Action |
|-------|-----|--------|
| `terminals` | `id` | Changed from `oldId` to `newId` |
| `chatSessions` | `agentId` | Entry deleted |
| `chatSessionIds` | `agentId` | Entry deleted |
| `chatTokensMap` | `agentId` | Entry deleted |
| `agentChats` | `id` | Entry removed |
| `usageSessions` | `session_id` | Entries filtered out |
| `activeId` | - | Updated if this was active |
| `resumeMessageShownRef` | `agentId` | Deleted for both old and new |

### Console Logging

When reset is triggered, you'll see logs like:

```
[Reset Agent] Starting reset for "Mike"
  Old ID: abc123-def456-...
  New ID: xyz789-uvw012-...
  Old Session: session-qwe456...
Backend cleanup complete for old agent abc123-def456-...
[Reset Agent] Complete! "Mike" now has fresh ID: xyz789-uvw012-...
```

## Alternative Approaches Considered

### 1. Aggressive Session Cleanup
Delete session files from `~/.claude/projects/` directory.

**Rejected because**:
- Users might want to access old sessions for reference
- File system operations can fail
- Doesn't address in-memory SDK state

### 2. SDK-Level Reset API
Use a hypothetical `sdk.resetSession()` method.

**Rejected because**:
- No such API exists in Claude Agent SDK
- Would require SDK modifications

### 3. "Duplicate and Delete" Pattern
Create a new agent, copy config, delete old one.

**Rejected because**:
- More complex state management
- Race conditions possible
- UUID regeneration is simpler and equally effective

## Related Documentation

- [Architecture Overview](../01-architecture.md) - System architecture
- [Claude SDK Integration](../04-build-setup/claude-sdk-integration.md) - SDK integration details
- [Session Management](../05-features/token-counter-implementation.md) - Token and session tracking
