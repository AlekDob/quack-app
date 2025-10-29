# Quack Agents Architecture

**Expert skill for understanding how Quack Agents work internally**

## Overview

Quack has a unique agent system where "agents" are actually **terminals with special properties**. This skill explains the complete architecture to avoid confusion.

## Key Concept: Agents ARE Terminals

The most important thing to understand:

```
🦆 AGENTS = TERMINALS with agent-like names and colors
```

When you see "Agent Casey", "Quack Agent", "Agent Sam" in the sidebar under "ACTIVE AGENTS", these are **NOT** separate AgentChat entities. They are **Terminal instances** that happen to have agent names.

## Architecture Breakdown

### 1. Terminal System (`terminals` state)

```typescript
const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
const [activeId, setActiveId] = useState<string | null>(null);

const activeTerminal = useMemo(
  () => terminals.find((terminal) => terminal.id === activeId) ?? null,
  [activeId, terminals]
);
```

**Each terminal has:**
- `id`: Unique UUID
- `label`: Display name (e.g., "Agent Casey", "Quack Agent")
- `color`: Color badge (e.g., "#f28c52", "#4dd4b3")
- `cwd`: Current working directory
- `status`: "busy" or "idle"
- PTY process backing

### 2. AgentChats (Separate System - NOT Used for Sidebar Agents)

```typescript
const [agentChats, setAgentChats] = useState<AgentChat[]>([]);
const [activeAgentChatId, setActiveAgentChatId] = useState<string | null>(null);
```

**AgentChats are for:**
- Future feature: Multiple chat sessions
- Workspace organization
- Currently **NOT** connected to the sidebar agents

**⚠️ IMPORTANT:** The agents in the sidebar are **NOT** AgentChats. They are terminals.

### 3. Active Agent Detection

When you click on an agent in the sidebar (e.g., "Agent Sam"):

```typescript
// This changes:
setActiveId(terminal.id);

// Which updates:
activeTerminal = terminals.find(t => t.id === activeId);
```

### 4. Tab System Integration

The "Chat" tab in the top bar updates based on `activeTerminal`:

```typescript
useEffect(() => {
  setTabs((prevTabs) => {
    const chatTab = prevTabs.find(t => t.id === 'chat');

    if (activeTerminal) {
      // Update tab with terminal's label and color
      chatTab.label = activeTerminal.label;  // "Agent Sam"
      chatTab.color = activeTerminal.color;  // "#f28c52"
    } else {
      chatTab.label = 'Chat';
      chatTab.color = undefined;
    }

    return updatedTabs;
  });
}, [activeTerminal]);
```

## How Agent Creation Works

When you click "New" button to create an agent:

1. **NewTerminalModal opens** with agent name input
2. User enters name like "Agent Casey"
3. User picks a color (orange, green, etc.)
4. `handleCreateTerminal` is called
5. **A new Terminal is created** via Rust backend:
   ```typescript
   const id = await invoke<string>("create_terminal", {
     label: "Agent Casey",
     color: "#f28c52",
     cwd: "/path/to/project"
   });
   ```
6. Terminal is added to `terminals` array
7. Terminal appears in sidebar under "ACTIVE AGENTS"

**Log confirmation:**
```
Created terminal "Agent Casey" with cwd="..."
```

## Sidebar Rendering

The sidebar groups terminals by `cwd` (working directory):

```typescript
const cwdGroups = useMemo(() => {
  // Group terminals by their working directory
  return groupTerminalsByCwd(terminals);
}, [terminals]);
```

Each group shows:
- **Header**: Working directory path (e.g., `~/Personal/quack-app`)
- **Terminals**: List of terminals in that directory
  - Color badge (●)
  - Terminal label ("Agent Casey")
  - Status indicator (✓ for idle, spinner for busy)

## Chat System Integration

When an agent (terminal) is active:

1. **Chat messages** are associated with that terminal's session
2. **Claude SDK** uses the terminal's `cwd` as working directory
3. **Messages history** is stored per-terminal via `chatSessions` state:
   ```typescript
   const [chatSessions, setChatSessions] = useState<
     Map<string, ChatSession>
   >(new Map());
   ```

## Common Confusion Points

### ❌ Wrong Understanding
- "Agents are separate AgentChat entities"
- "Clicking an agent calls `onSelectAgentChat`"
- "AgentChats in the sidebar"

### ✅ Correct Understanding
- "Agents are terminals with agent names"
- "Clicking an agent changes `activeId` (terminal selection)"
- "Terminals are grouped in the sidebar"

## Code Locations

### Terminal Management
- **State**: `App.tsx` line ~300
- **Creation**: `handleCreateTerminal` in `App.tsx`
- **Sidebar rendering**: `TerminalSidebar.tsx`
- **Backend**: `src-tauri/src/terminal.rs`

### Tab System
- **Tab update logic**: `App.tsx` line ~3640
- **Tab rendering**: `TabBar.tsx`
- **Color indicator CSS**: `TabBar.css` (`.tab-color-indicator`)

### Chat Integration
- **Chat sessions**: `chatSessions` Map in `App.tsx`
- **Message sending**: `sendMessageForAgent` function
- **Chat view**: `ChatView.tsx`

## Best Practices for Development

### When Working with Agents:

1. **Always think "terminal"** - Don't confuse with AgentChats
2. **Use `activeTerminal`** - Not `activeAgentChat` for sidebar agents
3. **Check `activeId`** - This is what changes when clicking agents
4. **Terminal label = Agent name** - The label field is the display name

### When Debugging:

```typescript
// Log current active terminal
console.log('Active terminal:', activeTerminal);

// Check all terminals
console.log('All terminals:', terminals);

// Verify active ID
console.log('Active ID:', activeId);
```

### When Adding Features:

- ✅ Need to update tab based on agent? → Use `activeTerminal`
- ✅ Need to show agent color? → Use `activeTerminal.color`
- ✅ Need agent's working directory? → Use `activeTerminal.cwd`
- ❌ Don't look for agent in `agentChats` array (they're not there!)

## Future Architecture Notes

The `agentChats` system exists for future features:
- Multiple concurrent chat sessions
- Chat history management
- Workspace-based chat organization

But currently, the **sidebar agents = terminals** system is what's actively used.

## Summary

```
Sidebar "Agents" → Terminals with agent names
Active Agent → activeTerminal (currently selected terminal)
Tab Update → Based on activeTerminal.label and activeTerminal.color
Chat Messages → Stored per terminal ID in chatSessions Map
```

**Remember: When you see an "agent" in the sidebar, it's just a terminal with a fancy name! 🦆**

---

*This skill prevents the "agents vs terminals" confusion that caused the tab update issue.*
