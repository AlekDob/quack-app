# Phase 2: Migration System - Implementation Guide

## Critical: This Phase Can Break Things!
This phase modifies how terminals are loaded. Test thoroughly before committing. Have a backup plan.

## 1. Migration Function Implementation

### Location: Add after AgentChat storage functions (around line 200)

```typescript
// ============================================
// Migration System
// ============================================

interface MigrationResult {
  agentChats: AgentChat[];
  migratedTerminals: TerminalInfo[];
  migrationLog: string[];
}

const migrateTerminalsToAgentChats = async (
  terminals: TerminalInfo[]
): Promise<MigrationResult> => {
  const log: string[] = [];
  log.push(`Starting migration for ${terminals.length} terminals`);

  // Check if migration is needed
  const needsMigration = terminals.some((t) => !t.agentChatId);
  if (!needsMigration) {
    log.push('No migration needed - all terminals have agentChatId');
    return {
      agentChats: await loadAgentChatsFromStorage(),
      migratedTerminals: terminals,
      migrationLog: log,
    };
  }

  log.push('Migration needed - creating AgentChats');

  // Group terminals by cwd
  const cwdGroups = new Map<string, TerminalInfo[]>();
  const orphanedTerminals: TerminalInfo[] = [];

  for (const terminal of terminals) {
    if (!terminal.cwd || terminal.cwd === '') {
      orphanedTerminals.push(terminal);
      log.push(`Terminal "${terminal.label}" has no cwd - will use home directory`);
    } else {
      const normalizedCwd = terminal.cwd.replace(/\\/g, '/').toLowerCase();
      if (!cwdGroups.has(normalizedCwd)) {
        cwdGroups.set(normalizedCwd, []);
      }
      cwdGroups.get(normalizedCwd)!.push(terminal);
    }
  }

  // Create AgentChats for each unique cwd
  const newAgentChats: AgentChat[] = [];
  const migratedTerminals: TerminalInfo[] = [];

  // Handle grouped terminals
  for (const [cwd, groupTerminals] of cwdGroups) {
    const dirName = cwd.split('/').filter(Boolean).pop() || 'Workspace';
    const agentChat: AgentChat = {
      id: crypto.randomUUID(),
      name: `${dirName}`,
      color: COLORS[newAgentChats.length % COLORS.length],
      cwd: groupTerminals[0].cwd, // Use original cwd (with proper case)
      createdAt: Date.now() - (cwdGroups.size - newAgentChats.length), // Older chats first
    };

    newAgentChats.push(agentChat);
    log.push(`Created AgentChat "${agentChat.name}" for ${groupTerminals.length} terminals`);

    // Update terminals with agentChatId
    for (const terminal of groupTerminals) {
      migratedTerminals.push({
        ...terminal,
        agentChatId: agentChat.id,
      });
    }
  }

  // Handle orphaned terminals (no cwd)
  if (orphanedTerminals.length > 0) {
    const homeDir = await invoke<string>('get_home_dir').catch(() => '/');
    const orphanChat: AgentChat = {
      id: crypto.randomUUID(),
      name: 'Default Workspace',
      color: COLORS[newAgentChats.length % COLORS.length],
      cwd: homeDir,
      createdAt: Date.now(),
    };

    newAgentChats.push(orphanChat);
    log.push(`Created default AgentChat for ${orphanedTerminals.length} orphaned terminals`);

    for (const terminal of orphanedTerminals) {
      migratedTerminals.push({
        ...terminal,
        agentChatId: orphanChat.id,
        cwd: homeDir, // Fix missing cwd
      });
    }
  }

  // Sort AgentChats by creation time (oldest first)
  newAgentChats.sort((a, b) => a.createdAt - b.createdAt);

  log.push(`Migration complete: ${newAgentChats.length} AgentChats created`);

  // Save migrated data
  await saveAgentChatsToStorage(newAgentChats);
  await saveTerminalsToStorage(migratedTerminals);

  // Mark migration as complete
  const store = await Store.load("quack-agent-chats.json");
  await store.set('migrationCompleted', true);
  await store.set('migrationDate', Date.now());
  await store.save();

  return {
    agentChats: newAgentChats,
    migratedTerminals,
    migrationLog: log,
  };
};

// Check if migration has been completed
const isMigrationCompleted = async (): Promise<boolean> => {
  try {
    const store = await Store.load("quack-agent-chats.json");
    return (await store.get<boolean>('migrationCompleted')) ?? false;
  } catch {
    return false;
  }
};
```

## 2. Modify loadTerminals Function

### Location: Find and replace the existing loadTerminals function (around line 1550)

```typescript
const loadTerminals = useCallback(async () => {
  if (!tauriAvailable) {
    return;
  }

  setLoadingTerminals(true);

  try {
    // Load saved terminals first
    const savedMetadata = await loadTerminalsFromStorage();

    if (savedMetadata.length > 0) {
      console.log(`Found ${savedMetadata.length} saved terminals`);

      // Recreate terminals from saved metadata
      const recreated: TerminalInfo[] = [];
      for (const metadata of savedMetadata) {
        try {
          const terminal = await invoke<TerminalInfo>("create_terminal", {
            label: metadata.label,
            color: metadata.color,
            cwd: metadata.cwd,
          });

          // Preserve agentChatId if it exists
          if ('agentChatId' in metadata) {
            terminal.agentChatId = (metadata as any).agentChatId;
          }

          recreated.push(terminal);
          console.log(`Recreated terminal: ${terminal.label}`);
        } catch (error) {
          console.error(`Failed to recreate terminal ${metadata.label}:`, error);
          toast.error(`Failed to restore terminal: ${metadata.label}`);
        }
      }

      // Check if migration is needed
      const migrationCompleted = await isMigrationCompleted();

      if (!migrationCompleted && recreated.length > 0) {
        console.log('Starting terminal migration to AgentChats...');

        // Show migration toast
        toast.info('Migrating terminals to new workspace system...', {
          duration: 5000,
        });

        // Run migration
        const migrationResult = await migrateTerminalsToAgentChats(recreated);

        // Log migration results
        console.group('Migration Results');
        migrationResult.migrationLog.forEach(log => console.log(log));
        console.groupEnd();

        // Update state with migrated data
        setTerminals(migrationResult.migratedTerminals);
        setAgentChats(migrationResult.agentChats);

        // Set first AgentChat as active if none selected
        if (migrationResult.agentChats.length > 0 && !activeAgentChatId) {
          setActiveAgentChatId(migrationResult.agentChats[0].id);
        }

        // Show success toast
        toast.success(`Migration complete! Created ${migrationResult.agentChats.length} workspaces`, {
          description: 'Your terminals have been organized into workspaces',
          duration: 5000,
        });
      } else {
        // No migration needed - just load normally
        setTerminals(recreated);

        // Load existing AgentChats
        const existingChats = await loadAgentChatsFromStorage();
        if (existingChats.length > 0) {
          setAgentChats(existingChats);

          // Load active AgentChat
          const activeId = await loadActiveAgentChatFromStorage();
          if (activeId && existingChats.some(c => c.id === activeId)) {
            setActiveAgentChatId(activeId);
          }
        }
      }

      // Set first terminal as active if we have any
      if (recreated.length > 0) {
        setActiveTerminalId(recreated[0].id);
      }
    } else {
      console.log('No saved terminals found');

      // Load any existing AgentChats even if no terminals
      const existingChats = await loadAgentChatsFromStorage();
      if (existingChats.length > 0) {
        setAgentChats(existingChats);
        const activeId = await loadActiveAgentChatFromStorage();
        if (activeId && existingChats.some(c => c.id === activeId)) {
          setActiveAgentChatId(activeId);
        }
      }
    }
  } catch (error) {
    console.error('Error loading terminals:', error);
    toast.error('Failed to load terminals');
  } finally {
    setLoadingTerminals(false);
  }
}, [tauriAvailable, activeAgentChatId]);
```

## 3. Update saveTerminalsToStorage

### Location: Replace existing saveTerminalsToStorage function

```typescript
const saveTerminalsToStorage = async (terminals: TerminalInfo[]) => {
  try {
    const store = await Store.load("quack-terminals.json");

    // Save with agentChatId included
    const metadata = terminals.map((t) => ({
      label: t.label,
      color: t.color,
      cwd: t.cwd,
      agentChatId: t.agentChatId, // Include agentChatId
    }));

    await store.set(STORAGE_KEY, metadata);
    await store.save();
    console.log(`Saved ${metadata.length} terminals with AgentChat associations`);
  } catch (error) {
    console.error("Unable to save terminals", error);
  }
};
```

## 4. Add Rust Backend Support (Optional but Recommended)

### Location: src-tauri/src/fs.rs - Add helper command

```rust
#[tauri::command]
pub fn get_home_dir() -> Result<String, String> {
    dirs::home_dir()
        .and_then(|path| path.to_str().map(String::from))
        .ok_or_else(|| "Could not determine home directory".to_string())
}
```

### Don't forget to register in src-tauri/src/lib.rs:
```rust
.invoke_handler(tauri::generate_handler![
    // ... existing handlers
    fs::get_home_dir,
])
```

## 5. Testing the Migration

### Test Scenario 1: Fresh Migration
1. Delete `quack-agent-chats.json` from app data directory
2. Keep existing `quack-terminals.json` with terminals
3. Start app
4. Verify migration toast appears
5. Check that AgentChats are created
6. Verify terminals are grouped correctly

### Test Scenario 2: Already Migrated
1. Start app with migration already complete
2. Verify no migration happens
3. Check terminals load with correct agentChatId
4. Verify AgentChats persist

### Test Scenario 3: Edge Cases
```javascript
// Add these test terminals before migration:
const testTerminals = [
  { label: "Terminal 1", cwd: "/Users/test/project-a", color: "#ff0000" },
  { label: "Terminal 2", cwd: "/Users/test/project-a", color: "#00ff00" }, // Same cwd
  { label: "Terminal 3", cwd: "/Users/test/project-b", color: "#0000ff" },
  { label: "Terminal 4", cwd: "", color: "#ffff00" }, // No cwd
  { label: "Terminal 5", cwd: "C:\\Windows\\Path", color: "#ff00ff" }, // Windows path
];
```

## 6. Verification Console Commands

```javascript
// Check migration status
const checkMigration = async () => {
  const store = await window.__TAURI__.store.Store.load("quack-agent-chats.json");
  console.log('Migration completed:', await store.get('migrationCompleted'));
  console.log('Migration date:', new Date(await store.get('migrationDate')));
  console.log('AgentChats:', await store.get('agentChats'));
};

// Verify terminal associations
const checkTerminals = async () => {
  const store = await window.__TAURI__.store.Store.load("quack-terminals.json");
  const terminals = await store.get('terminals');
  console.table(terminals.map(t => ({
    label: t.label,
    cwd: t.cwd,
    agentChatId: t.agentChatId
  })));
};

// Force re-migration (testing only!)
const forceMigration = async () => {
  const store = await window.__TAURI__.store.Store.load("quack-agent-chats.json");
  await store.delete('migrationCompleted');
  await store.save();
  console.log('Migration flag cleared - reload app to trigger migration');
};
```

## Expected Results After Phase 2

✅ **What Should Work:**
- Automatic migration on first load
- Terminals grouped by cwd into AgentChats
- Migration only happens once
- Orphaned terminals handled gracefully
- Storage contains both terminals and AgentChats
- Console shows migration logs

⚠️ **What Might Break:**
- Terminals with invalid paths
- Very long path names
- Network drives
- Symbolic links

❌ **What Won't Work Yet:**
- UI doesn't show AgentChats
- Can't create new terminals with AgentChat
- Can't switch between AgentChats

## Rollback Procedure

If migration fails catastrophically:

1. **Immediate Rollback:**
```bash
# Revert the loadTerminals changes
git checkout -- src/App.tsx

# Clear migration data
rm ~/Library/Application\ Support/com.quack.app/quack-agent-chats.json
```

2. **Restore Original Terminal Loading:**
Keep a backup of the original `loadTerminals` function and restore it if needed.

3. **Feature Flag Alternative:**
```typescript
const ENABLE_AGENT_CHAT_MIGRATION = false; // Emergency kill switch

if (ENABLE_AGENT_CHAT_MIGRATION) {
  // Migration code
} else {
  // Original loading code
}
```

## Common Issues & Solutions

### Issue: Migration runs every time
**Solution**: Check that `migrationCompleted` flag is being saved correctly.

### Issue: Terminals disappear after migration
**Solution**: Check console for errors in terminal recreation. Verify agentChatId is preserved.

### Issue: Duplicate AgentChats created
**Solution**: Ensure migration only runs once. Check for existing AgentChats before creating.

### Issue: Windows path handling
**Solution**: Normalize paths with forward slashes before grouping.

## Next Steps

✅ After successful Phase 2:
1. Test all edge cases
2. Verify data integrity
3. Commit: "feat: implement AgentChat migration system"
4. Move to Phase 3: Terminal Creation Integration

⚠️ DO NOT PROCEED if:
- Migration loses any terminals
- Storage corruption occurs
- Terminals can't be recreated

---

*Mike's Note: This is the scary phase. Migration can go wrong in so many creative ways. Test it with 1 terminal. Test it with 50. Test it with weird paths. Test it twice. Then test it again. Because the only thing worse than a bug is a data-loss bug. And yes, I'm paranoid - that's why my projects don't lose user data.*