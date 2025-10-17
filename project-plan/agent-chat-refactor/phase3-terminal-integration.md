# Phase 3: Terminal Creation Integration - Implementation Guide

## Overview
This phase integrates AgentChat with terminal creation flows. Every new terminal must belong to an AgentChat.

## 1. Update handleConfirmNewTerminal

### Location: Replace existing handleConfirmNewTerminal (around line 1810)

```typescript
const handleConfirmNewTerminal = useCallback(async () => {
  if (!tauriAvailable || creatingTerminal) {
    return;
  }

  const trimmedName = newTerminalName.trim();
  const trimmedPath = newTerminalPath.trim();

  if (!trimmedName) {
    setNewTerminalError("Enter a terminal name.");
    return;
  }

  if (!trimmedPath) {
    setNewTerminalError("Select working directory.");
    return;
  }

  setCreatingTerminal(true);
  setNewTerminalError(null);

  try {
    // Find or create AgentChat for this cwd
    const agentChat = findOrCreateAgentChatForCwd(trimmedPath);
    console.log(`Terminal will be created in AgentChat: ${agentChat.name}`);

    // Create the terminal with AgentChat association
    const terminal = await invoke<TerminalInfo>("create_terminal", {
      label: trimmedName,
      color: newTerminalColor,
      cwd: trimmedPath,
    });

    // Add agentChatId to terminal
    const terminalWithChat: TerminalInfo = {
      ...terminal,
      agentChatId: agentChat.id,
    };

    // Update state
    setTerminals((prev) => [...prev, terminalWithChat]);
    setActiveTerminalId(terminal.id);

    // Set this AgentChat as active
    setActiveAgentChatId(agentChat.id);

    // Show success with AgentChat info
    toast.success(`Terminal created in ${agentChat.name}`, {
      description: `${trimmedName} is ready`,
      duration: 3000,
    });

    // Close modal and reset
    setShowNewTerminalModal(false);
    setNewTerminalName("");
    setNewTerminalPath(explorerPath || "");
    setNewTerminalColor(COLORS[Math.floor(Math.random() * COLORS.length)]);

    // If this was an edit, clear the editing state
    if (editingTerminal) {
      setEditingTerminal(null);
    }
  } catch (error) {
    console.error("Error creating terminal:", error);
    setNewTerminalError(
      error instanceof Error ? error.message : "Failed to create terminal"
    );
    toast.error("Failed to create terminal");
  } finally {
    setCreatingTerminal(false);
  }
}, [
  tauriAvailable,
  creatingTerminal,
  newTerminalName,
  newTerminalPath,
  newTerminalColor,
  editingTerminal,
  explorerPath,
  findOrCreateAgentChatForCwd,
  setActiveAgentChatId,
]);
```

## 2. Update handleQuickCreateTerminal

### Location: Replace existing handleQuickCreateTerminal (around line 1904)

```typescript
const handleQuickCreateTerminal = useCallback(async () => {
  if (!tauriAvailable || creatingTerminal) {
    return;
  }

  setCreatingTerminal(true);

  try {
    // Determine which AgentChat to use
    let targetAgentChat: AgentChat | null = null;
    let targetCwd: string;

    if (activeAgentChatId && activeAgentChat) {
      // Use active AgentChat
      targetAgentChat = activeAgentChat;
      targetCwd = activeAgentChat.cwd;
      console.log(`Quick create in active AgentChat: ${targetAgentChat.name}`);
    } else if (activeTerminal?.agentChatId) {
      // Use current terminal's AgentChat
      const terminalChat = agentChats.find(
        (c) => c.id === activeTerminal.agentChatId
      );
      if (terminalChat) {
        targetAgentChat = terminalChat;
        targetCwd = terminalChat.cwd;
        console.log(`Quick create in terminal's AgentChat: ${terminalChat.name}`);
      }
    }

    // Fallback: create in home directory with new AgentChat
    if (!targetAgentChat) {
      const homeCwd = await invoke<string>("get_home_dir").catch(() =>
        explorerPath || "/"
      );
      targetCwd = homeCwd;
      targetAgentChat = findOrCreateAgentChatForCwd(targetCwd);
      console.log(`Quick create in new AgentChat: ${targetAgentChat.name}`);
    }

    // Generate automatic name
    const terminalNumbers = terminals
      .filter((t) => t.agentChatId === targetAgentChat!.id)
      .map((t) => {
        const match = t.label.match(/^Terminal (\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter((n) => n > 0);

    const nextNumber = terminalNumbers.length > 0
      ? Math.max(...terminalNumbers) + 1
      : terminals.filter(t => t.agentChatId === targetAgentChat!.id).length + 1;

    const label = `Terminal ${nextNumber}`;
    const color = COLORS[terminals.length % COLORS.length];

    // Create the terminal
    const terminal = await invoke<TerminalInfo>("create_terminal", {
      label,
      color,
      cwd: targetCwd!,
    });

    // Add agentChatId
    const terminalWithChat: TerminalInfo = {
      ...terminal,
      agentChatId: targetAgentChat!.id,
    };

    // Update state
    setTerminals((prev) => [...prev, terminalWithChat]);
    setActiveTerminalId(terminal.id);
    setActiveAgentChatId(targetAgentChat!.id);

    toast(`New terminal in ${targetAgentChat!.name}`, {
      description: label,
      duration: 2000,
    });
  } catch (error) {
    console.error("Error creating terminal:", error);
    toast.error("Failed to create terminal");
  } finally {
    setCreatingTerminal(false);
  }
}, [
  tauriAvailable,
  creatingTerminal,
  terminals,
  activeAgentChatId,
  activeAgentChat,
  activeTerminal,
  agentChats,
  explorerPath,
  findOrCreateAgentChatForCwd,
]);
```

## 3. Update handleCloseTerminal

### Location: Update existing handleCloseTerminal (around line 1750)

```typescript
const handleCloseTerminal = useCallback(
  async (id: string) => {
    const terminal = terminals.find((t) => t.id === id);
    if (!terminal) return;

    try {
      // Kill the terminal process
      await invoke("kill_terminal", { id });

      // Remove from state
      setTerminals((prev) => {
        const updated = prev.filter((t) => t.id !== id);

        // Check if this was the last terminal in its AgentChat
        if (terminal.agentChatId) {
          const remainingInChat = updated.filter(
            (t) => t.agentChatId === terminal.agentChatId
          );

          if (remainingInChat.length === 0) {
            // Option 1: Delete empty AgentChat automatically
            // handleDeleteAgentChat(terminal.agentChatId);

            // Option 2: Keep empty AgentChat (recommended)
            console.log(`AgentChat ${terminal.agentChatId} is now empty`);

            // Option 3: Ask user
            // toast(`Workspace is empty`, {
            //   description: 'Delete empty workspace?',
            //   action: {
            //     label: 'Delete',
            //     onClick: () => handleDeleteAgentChat(terminal.agentChatId!)
            //   }
            // });
          }
        }

        return updated;
      });

      // Update active terminal if needed
      if (activeTerminalId === id) {
        const remaining = terminals.filter((t) => t.id !== id);

        // Try to activate another terminal in the same AgentChat
        const sameChat = remaining.filter(
          (t) => t.agentChatId === terminal.agentChatId
        );

        if (sameChat.length > 0) {
          setActiveTerminalId(sameChat[0].id);
        } else if (remaining.length > 0) {
          setActiveTerminalId(remaining[0].id);
        } else {
          setActiveTerminalId(null);
        }
      }

      toast.success(`Closed ${terminal.label}`);
    } catch (error) {
      console.error("Error closing terminal:", error);
      toast.error(`Failed to close ${terminal.label}`);
    }
  },
  [terminals, activeTerminalId]
);
```

## 4. Add AgentChat Quick Actions

### Location: Add new helper functions after handlers (around line 250)

```typescript
// ============================================
// AgentChat Quick Actions
// ============================================

const handleDuplicateAgentChat = useCallback(
  async (agentChatId: string): Promise<void> => {
    const sourceChat = agentChats.find((c) => c.id === agentChatId);
    if (!sourceChat) return;

    // Create new AgentChat with same cwd
    const newChat = handleCreateAgentChat(
      `${sourceChat.name} (Copy)`,
      sourceChat.cwd,
      sourceChat.color
    );

    // Get terminals from source chat
    const sourceTerminals = terminals.filter(
      (t) => t.agentChatId === agentChatId
    );

    // Create copies of all terminals
    for (const terminal of sourceTerminals) {
      try {
        const newTerminal = await invoke<TerminalInfo>("create_terminal", {
          label: terminal.label,
          color: terminal.color,
          cwd: terminal.cwd,
        });

        const terminalWithChat: TerminalInfo = {
          ...newTerminal,
          agentChatId: newChat.id,
        };

        setTerminals((prev) => [...prev, terminalWithChat]);
      } catch (error) {
        console.error(`Failed to duplicate terminal ${terminal.label}:`, error);
      }
    }

    // Activate the new AgentChat
    setActiveAgentChatId(newChat.id);

    toast.success(`Duplicated workspace: ${newChat.name}`, {
      description: `${sourceTerminals.length} terminals copied`,
    });
  },
  [agentChats, terminals, handleCreateAgentChat]
);

const handleCloseAllTerminalsInAgentChat = useCallback(
  async (agentChatId: string): Promise<void> => {
    const chatTerminals = terminals.filter(
      (t) => t.agentChatId === agentChatId
    );

    if (chatTerminals.length === 0) return;

    // Confirm action
    if (!confirm(`Close all ${chatTerminals.length} terminals in this workspace?`)) {
      return;
    }

    for (const terminal of chatTerminals) {
      await handleCloseTerminal(terminal.id);
    }

    toast.success(`Closed ${chatTerminals.length} terminals`);
  },
  [terminals, handleCloseTerminal]
);

const handleRestartAllTerminalsInAgentChat = useCallback(
  async (agentChatId: string): Promise<void> => {
    const chatTerminals = terminals.filter(
      (t) => t.agentChatId === agentChatId
    );

    for (const terminal of chatTerminals) {
      try {
        // Send clear + reset command
        await invoke("write_to_terminal", {
          id: terminal.id,
          data: "\x1b[2J\x1b[H", // Clear screen
        });

        await invoke("write_to_terminal", {
          id: terminal.id,
          data: "clear\r", // Clear command
        });

        console.log(`Restarted terminal: ${terminal.label}`);
      } catch (error) {
        console.error(`Failed to restart terminal ${terminal.label}:`, error);
      }
    }

    toast.success(`Restarted ${chatTerminals.length} terminals`);
  },
  [terminals]
);
```

## 5. Testing the Integration

### Test Cases

#### Test 1: Create Terminal with Modal
```javascript
// 1. Open new terminal modal
// 2. Select a directory that doesn't have an AgentChat
// 3. Create terminal
// Expected: New AgentChat created, terminal assigned to it

// 2. Open new terminal modal again
// 3. Select same directory
// 4. Create another terminal
// Expected: Terminal added to existing AgentChat
```

#### Test 2: Quick Create Terminal
```javascript
// 1. Select an AgentChat
// 2. Press quick create button (Cmd+T)
// Expected: Terminal created in selected AgentChat

// 3. Deselect AgentChat (click empty area)
// 4. Press quick create
// Expected: Terminal created in new or default AgentChat
```

#### Test 3: Terminal Deletion
```javascript
// 1. Create AgentChat with 3 terminals
// 2. Close one terminal
// Expected: Terminal removed, AgentChat remains

// 3. Close remaining terminals
// Expected: AgentChat becomes empty (decide on behavior)
```

#### Test 4: AgentChat Duplication
```javascript
// 1. Create AgentChat with 2 terminals
// 2. Duplicate AgentChat
// Expected: New AgentChat with copied terminals
```

### Console Verification

```javascript
// Verify terminal assignments
const verifyAssignments = () => {
  const terminalsWithChat = window.terminals.filter(t => t.agentChatId);
  const terminalsWithoutChat = window.terminals.filter(t => !t.agentChatId);

  console.log(`Assigned: ${terminalsWithChat.length}`);
  console.log(`Orphaned: ${terminalsWithoutChat.length}`);

  if (terminalsWithoutChat.length > 0) {
    console.warn('Orphaned terminals:', terminalsWithoutChat);
  }

  // Group by AgentChat
  const groups = {};
  terminalsWithChat.forEach(t => {
    groups[t.agentChatId] = groups[t.agentChatId] || [];
    groups[t.agentChatId].push(t.label);
  });

  console.table(groups);
};

// Test AgentChat operations
const testOperations = async () => {
  // Find an AgentChat with terminals
  const chat = window.agentChats[0];
  if (!chat) {
    console.error('No AgentChats available');
    return;
  }

  console.log('Testing with AgentChat:', chat.name);

  // Test quick actions
  console.log('Terminals in chat:',
    window.terminals.filter(t => t.agentChatId === chat.id).length
  );
};
```

## Expected Results After Phase 3

✅ **What Should Work:**
- New terminals always get agentChatId
- Quick create uses smart defaults
- Terminal deletion handles AgentChat state
- AgentChat quick actions (duplicate, close all)
- Consistent state management

⚠️ **Potential Issues:**
- Race conditions during quick create
- AgentChat selection edge cases
- Empty AgentChat handling

❌ **What Won't Work Yet:**
- UI doesn't show AgentChats (Phase 4)
- Can't visually manage AgentChats
- No drag & drop between AgentChats

## Common Issues & Solutions

### Issue: Terminal created without agentChatId
**Solution**: Ensure findOrCreateAgentChatForCwd is always called.

### Issue: Quick create uses wrong AgentChat
**Solution**: Check activeAgentChatId state is properly maintained.

### Issue: Duplicate terminals in same AgentChat
**Solution**: Add duplicate detection before creating.

### Issue: AgentChat deletion cascades incorrectly
**Solution**: Verify handleDeleteAgentChat properly cleans up terminals.

## Integration Points to Update Later

After Phase 3, these components need updates:
1. **TerminalSidebar** - Show AgentChat groups (Phase 4)
2. **FileExplorer** - Sync with active AgentChat cwd
3. **GitPanel** - Show AgentChat's repo status
4. **AIAssistant** - Use AgentChat context
5. **Keyboard shortcuts** - Cmd+1-9 for AgentChats

## Next Steps

✅ After successful Phase 3:
1. Verify all terminal creation flows work
2. Test edge cases thoroughly
3. Commit: "feat: integrate AgentChat with terminal creation"
4. Move to Phase 4: UI Integration

⚠️ DO NOT PROCEED if:
- Terminals can be created without agentChatId
- Quick create doesn't work reliably
- Terminal deletion causes crashes

---

*Mike's Note: This is where the rubber meets the road. Users will interact with this every day, so it needs to be bulletproof. The quick create especially - that's muscle memory for power users. Break that, and you'll never hear the end of it. Test it tired. Test it fast. Test it like you're trying to break it. Because users will.*