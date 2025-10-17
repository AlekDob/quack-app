# Phase 1: Foundation & State Management - Implementation Guide

## Quick Start
This phase creates the core AgentChat management system without affecting existing terminal functionality. It's purely additive - no breaking changes.

## 1. Add Handler Functions to App.tsx

### Location: After line 170 (after activeAgentChat memo)

```typescript
// ============================================
// AgentChat Management Handlers
// ============================================

const handleCreateAgentChat = useCallback(
  (name: string, cwd: string, color?: string): AgentChat => {
    const newChat: AgentChat = {
      id: crypto.randomUUID(),
      name,
      color: color || COLORS[agentChats.length % COLORS.length],
      cwd,
      createdAt: Date.now(),
    };

    setAgentChats((prev) => [...prev, newChat]);
    return newChat;
  },
  [agentChats.length]
);

const handleDeleteAgentChat = useCallback(
  async (agentChatId: string): Promise<void> => {
    // First, close all terminals belonging to this AgentChat
    const terminalsToClose = terminals.filter(
      (t) => t.agentChatId === agentChatId
    );

    for (const terminal of terminalsToClose) {
      await handleCloseTerminal(terminal.id);
    }

    // Remove the AgentChat
    setAgentChats((prev) => prev.filter((chat) => chat.id !== agentChatId));

    // Update active chat if needed
    if (activeAgentChatId === agentChatId) {
      const remaining = agentChats.filter((c) => c.id !== agentChatId);
      setActiveAgentChatId(remaining.length > 0 ? remaining[0].id : null);
    }
  },
  [activeAgentChatId, agentChats, terminals, handleCloseTerminal]
);

const handleSelectAgentChat = useCallback(
  (agentChatId: string | null): void => {
    setActiveAgentChatId(agentChatId);

    // Optionally activate first terminal in the AgentChat
    if (agentChatId) {
      const chatTerminals = terminals.filter(
        (t) => t.agentChatId === agentChatId
      );
      if (chatTerminals.length > 0 && !chatTerminals.some((t) => t.id === activeTerminalId)) {
        setActiveTerminalId(chatTerminals[0].id);
      }
    }
  },
  [terminals, activeTerminalId]
);

const handleUpdateAgentChat = useCallback(
  (agentChatId: string, updates: Partial<Omit<AgentChat, 'id'>>): void => {
    setAgentChats((prev) =>
      prev.map((chat) =>
        chat.id === agentChatId ? { ...chat, ...updates } : chat
      )
    );
  },
  []
);

const findOrCreateAgentChatForCwd = useCallback(
  (cwd: string): AgentChat => {
    // Check if AgentChat exists for this cwd
    const existing = agentChats.find((chat) => chat.cwd === cwd);
    if (existing) {
      return existing;
    }

    // Create new AgentChat
    const dirName = cwd.split('/').filter(Boolean).pop() || 'Terminal';
    const name = `Workspace: ${dirName}`;
    return handleCreateAgentChat(name, cwd);
  },
  [agentChats, handleCreateAgentChat]
);
```

## 2. Add Persistence Functions

### Location: After line 128 (after loadTerminalsFromStorage)

```typescript
// ============================================
// AgentChat Storage Functions
// ============================================

const AGENT_CHATS_KEY = "agentChats";
const ACTIVE_AGENT_CHAT_KEY = "activeAgentChat";
const MIGRATION_VERSION_KEY = "migrationVersion";
const CURRENT_MIGRATION_VERSION = 1;

const saveAgentChatsToStorage = async (chats: AgentChat[]): Promise<void> => {
  try {
    const store = await Store.load("quack-agent-chats.json");
    await store.set(AGENT_CHATS_KEY, chats);
    await store.set(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION);
    await store.save();
    console.log(`Saved ${chats.length} AgentChats to storage`);
  } catch (error) {
    console.error("Failed to save AgentChats:", error);
    toast.error("Failed to save workspace configuration");
  }
};

const loadAgentChatsFromStorage = async (): Promise<AgentChat[]> => {
  try {
    const store = await Store.load("quack-agent-chats.json");
    const stored = await store.get<AgentChat[]>(AGENT_CHATS_KEY);
    const version = await store.get<number>(MIGRATION_VERSION_KEY);

    if (stored && version === CURRENT_MIGRATION_VERSION) {
      console.log(`Loaded ${stored.length} AgentChats from storage`);
      return stored;
    }

    return [];
  } catch (error) {
    console.warn("Unable to load AgentChats:", error);
    return [];
  }
};

const saveActiveAgentChatToStorage = async (id: string | null): Promise<void> => {
  try {
    const store = await Store.load("quack-agent-chats.json");
    if (id) {
      await store.set(ACTIVE_AGENT_CHAT_KEY, id);
    } else {
      await store.delete(ACTIVE_AGENT_CHAT_KEY);
    }
    await store.save();
  } catch (error) {
    console.error("Failed to save active AgentChat:", error);
  }
};

const loadActiveAgentChatFromStorage = async (): Promise<string | null> => {
  try {
    const store = await Store.load("quack-agent-chats.json");
    return await store.get<string>(ACTIVE_AGENT_CHAT_KEY) ?? null;
  } catch (error) {
    console.warn("Unable to load active AgentChat:", error);
    return null;
  }
};
```

## 3. Add Auto-Save Effects

### Location: After existing useEffect hooks (around line 800)

```typescript
// Auto-save AgentChats when they change
useEffect(() => {
  if (!tauriAvailable) return;

  const saveDebounced = debounce(() => {
    if (agentChats.length > 0) {
      void saveAgentChatsToStorage(agentChats);
    }
  }, 1000);

  saveDebounced();

  return () => {
    saveDebounced.cancel();
  };
}, [agentChats, tauriAvailable]);

// Auto-save active AgentChat when it changes
useEffect(() => {
  if (!tauriAvailable) return;

  void saveActiveAgentChatToStorage(activeAgentChatId);
}, [activeAgentChatId, tauriAvailable]);
```

## 4. Add Helper Utility (debounce)

### Location: At top of file, after other utility functions (around line 100)

```typescript
// Debounce utility for auto-save
function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let timeout: NodeJS.Timeout | null = null;

  const debounced = (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };

  debounced.cancel = () => {
    if (timeout) clearTimeout(timeout);
  };

  return debounced as T & { cancel: () => void };
}
```

## 5. Testing the Implementation

### Manual Test Script
Add this temporary test component to verify everything works:

```typescript
// Temporary test component - add at line 2800 (in JSX return)
{process.env.NODE_ENV === 'development' && (
  <div style={{
    position: 'fixed',
    bottom: 20,
    right: 20,
    background: 'black',
    padding: 10,
    borderRadius: 8,
    zIndex: 9999
  }}>
    <button onClick={() => {
      const chat = handleCreateAgentChat(
        'Test Workspace',
        '/tmp/test',
        '#ff0000'
      );
      console.log('Created AgentChat:', chat);
    }}>
      Test Create AgentChat
    </button>
    <button onClick={() => {
      console.log('Current AgentChats:', agentChats);
      console.log('Active AgentChat:', activeAgentChat);
    }}>
      Log State
    </button>
  </div>
)}
```

### Console Tests to Run

```javascript
// Run these in browser console after implementing Phase 1:

// Test 1: Create AgentChat
const testCreate = () => {
  window.testAgentChat = {
    id: crypto.randomUUID(),
    name: 'Test Workspace',
    color: '#00ff00',
    cwd: '/Users/test',
    createdAt: Date.now()
  };
  console.log('Created:', window.testAgentChat);
};

// Test 2: Verify storage
const testStorage = async () => {
  const store = await window.__TAURI__.store.Store.load("quack-agent-chats.json");
  const chats = await store.get("agentChats");
  console.log('Stored AgentChats:', chats);
};

// Test 3: Check no terminal impact
const testTerminals = () => {
  const terminals = document.querySelectorAll('[data-terminal-id]');
  console.log('Terminals still working:', terminals.length);
};
```

## Expected Results After Phase 1

✅ **What Should Work:**
- Handler functions available but not yet used
- Storage functions ready but no data migrated
- No visible UI changes
- All existing terminal functionality intact
- Console shows AgentChat operations when tested

❌ **What Won't Work Yet:**
- UI doesn't show AgentChats
- Terminals don't have agentChatId assigned
- No automatic migration
- No integration with terminal creation

## Verification Checklist

- [ ] App starts without errors
- [ ] Can create terminals normally
- [ ] No TypeScript errors
- [ ] Storage functions don't throw errors
- [ ] Test buttons work (if added)
- [ ] Console.log shows correct AgentChat structure
- [ ] No performance degradation

## Common Issues & Solutions

### Issue: TypeScript errors about missing handleCloseTerminal
**Solution**: Make sure handleCloseTerminal is defined before AgentChat handlers, or remove it from dependencies temporarily.

### Issue: Storage not persisting
**Solution**: Check that tauri-plugin-store is properly configured and the store files are being created in the app data directory.

### Issue: Circular dependency warnings
**Solution**: Review the useCallback dependencies and remove any that create cycles.

## Next Steps
Once Phase 1 is verified working:
1. Commit the changes: "feat: add AgentChat state management foundation"
2. Move to Phase 2: Migration System
3. Do NOT proceed if any tests fail - fix first!

---

*Mike's Note: This phase is intentionally conservative. We're adding new code without touching existing functionality. If something breaks here, it's a sign we need to be even MORE careful in the later phases. Test everything twice, commit once.*