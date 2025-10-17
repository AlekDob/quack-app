# Testing Scenarios - AgentChat Refactor

## Testing Philosophy
*"Test like a user who's had 3 coffees and is clicking everything as fast as possible."* - Mike

Each phase must be tested independently AND in combination. Don't skip tests because "it works on my machine."

## Pre-Testing Checklist

### Environment Setup
- [ ] Backup existing `quack-terminals.json` and `quack-agent-chats.json`
- [ ] Clear browser console
- [ ] Enable verbose logging: `localStorage.setItem('DEBUG', 'true')`
- [ ] Open DevTools Network tab to monitor Tauri commands
- [ ] Have test data ready (multiple terminals with different cwds)

### Test Data Generator
```javascript
// Run this to create test terminals before migration
const createTestTerminals = () => {
  const testData = [
    { label: "Frontend Dev", cwd: "/Users/test/my-app/frontend", color: "#f28c52" },
    { label: "Backend API", cwd: "/Users/test/my-app/backend", color: "#4dd4b3" },
    { label: "Frontend Tests", cwd: "/Users/test/my-app/frontend", color: "#ffb26f" },
    { label: "Database", cwd: "/Users/test/my-app/backend", color: "#8fa6ff" },
    { label: "Docs", cwd: "/Users/test/my-app/docs", color: "#f77aa6" },
    { label: "Scripts", cwd: "/Users/test/scripts", color: "#ffd166" },
    { label: "Temp Work", cwd: "", color: "#f2a57b" }, // No cwd
    { label: "Downloads", cwd: "/Users/test/Downloads", color: "#f28c52" },
  ];

  // Save to storage for migration testing
  console.log('Test terminals to create:', testData);
  return testData;
};
```

---

## Phase 1 Tests: State Management

### Test 1.1: Handler Functions Work
```javascript
// Test in console after implementing Phase 1

// Test create
const testChat = window.handleCreateAgentChat('Test Workspace', '/tmp/test');
console.assert(testChat.id, 'AgentChat should have ID');
console.assert(testChat.name === 'Test Workspace', 'Name should match');

// Test update
window.handleUpdateAgentChat(testChat.id, { name: 'Updated Name' });
console.assert(window.agentChats.find(c => c.id === testChat.id).name === 'Updated Name');

// Test select
window.handleSelectAgentChat(testChat.id);
console.assert(window.activeAgentChatId === testChat.id);

// Test delete (careful - will delete terminals)
// window.handleDeleteAgentChat(testChat.id);
```

### Test 1.2: Persistence Works
```javascript
// Test storage after creating AgentChats

// Create and wait for auto-save
window.handleCreateAgentChat('Persistent Test', '/tmp/persist');

// Check storage after 2 seconds (debounce delay)
setTimeout(async () => {
  const store = await window.__TAURI__.store.Store.load("quack-agent-chats.json");
  const saved = await store.get('agentChats');
  console.assert(saved.length > 0, 'AgentChats should be saved');
  console.log('Saved AgentChats:', saved);
}, 2000);
```

### Test 1.3: No Side Effects
- Create new terminal normally - should still work
- Close terminal - should not crash
- Navigate file explorer - should work
- Check Git panel - should load

**Expected**: Everything works as before, new code doesn't interfere

---

## Phase 2 Tests: Migration System

### Test 2.1: Fresh Migration
1. **Setup**: Delete `quack-agent-chats.json`, keep `quack-terminals.json` with test data
2. **Action**: Start app
3. **Verify**:
   - Migration toast appears
   - Console shows migration logs
   - AgentChats created (one per unique cwd)
   - Terminals have agentChatId assigned
   - Storage contains migration flag

```javascript
// Verification commands
const verifyMigration = async () => {
  // Check terminals
  console.log('Terminals with agentChatId:',
    window.terminals.filter(t => t.agentChatId).length,
    '/', window.terminals.length
  );

  // Check AgentChats
  console.log('AgentChats created:', window.agentChats.length);

  // Check grouping
  const groups = {};
  window.terminals.forEach(t => {
    const chat = window.agentChats.find(c => c.id === t.agentChatId);
    if (chat) {
      groups[chat.name] = groups[chat.name] || [];
      groups[chat.name].push(t.label);
    }
  });
  console.table(groups);

  // Check migration flag
  const store = await window.__TAURI__.store.Store.load("quack-agent-chats.json");
  console.log('Migration completed:', await store.get('migrationCompleted'));
};
```

### Test 2.2: Idempotent Migration
1. **Setup**: Migration already complete from Test 2.1
2. **Action**: Restart app
3. **Verify**:
   - No migration toast
   - Same number of AgentChats
   - No duplicate AgentChats
   - Terminals maintain agentChatId

### Test 2.3: Edge Cases

#### Empty cwd Terminal
```javascript
// Before migration, create terminal with no cwd
const orphan = { label: "Orphan", cwd: "", color: "#ff0000" };
// After migration, verify it's in "Default Workspace"
```

#### Same cwd Multiple Terminals
```javascript
// Create 5 terminals with same cwd
// After migration, all 5 should be in same AgentChat
```

#### Windows Path
```javascript
// Terminal with Windows path: "C:\\Users\\test\\project"
// Should normalize and group correctly
```

#### Very Long Path
```javascript
// Path with 200+ characters
// Should handle without truncation
```

---

## Phase 3 Tests: Terminal Creation

### Test 3.1: Modal Creation
```javascript
// Test sequence for modal creation

// 1. New directory = New AgentChat
async function testNewDirectory() {
  // Open modal, select /tmp/new-project
  // Create terminal "New Project Term"
  // Verify: New AgentChat created for /tmp/new-project
  console.assert(window.agentChats.some(c => c.cwd === '/tmp/new-project'));
}

// 2. Existing directory = Existing AgentChat
async function testExistingDirectory() {
  const before = window.agentChats.length;
  // Open modal, select existing AgentChat's cwd
  // Create terminal
  const after = window.agentChats.length;
  console.assert(before === after, 'Should not create new AgentChat');
}
```

### Test 3.2: Quick Create
```javascript
// Test quick create scenarios

// 1. With active AgentChat
window.handleSelectAgentChat(window.agentChats[0].id);
// Press Cmd+T
// Verify: Terminal created in active AgentChat

// 2. Without active AgentChat
window.handleSelectAgentChat(null);
// Press Cmd+T
// Verify: Terminal created in sensible default

// 3. Rapid creation
for (let i = 0; i < 5; i++) {
  // Press Cmd+T quickly
}
// Verify: All 5 terminals created correctly
```

### Test 3.3: Terminal Deletion
```javascript
// Test deletion scenarios

// 1. Delete middle terminal
const chat = window.agentChats[0];
const chatTerminals = window.terminals.filter(t => t.agentChatId === chat.id);
if (chatTerminals.length > 2) {
  window.handleCloseTerminal(chatTerminals[1].id);
  // Verify: Terminal removed, others intact
}

// 2. Delete last terminal in AgentChat
// Verify behavior based on implementation choice

// 3. Delete during creation
// Start creating terminal, immediately close it
// Verify: No orphaned data
```

---

## Phase 4 Tests: UI Integration (Future)

### Test 4.1: Sidebar Display
- [ ] AgentChats shown as collapsible sections
- [ ] Terminal count badge correct
- [ ] Active AgentChat highlighted
- [ ] Terminals nested under correct AgentChat

### Test 4.2: Interactions
- [ ] Click AgentChat to select
- [ ] Click terminal to activate
- [ ] Drag terminal between AgentChats
- [ ] Right-click context menu works

### Test 4.3: Keyboard Navigation
- [ ] Cmd+1-9 switches AgentChats
- [ ] Arrow keys navigate within AgentChat
- [ ] Tab cycles through terminals

---

## Performance Tests

### Load Test
```javascript
// Create many terminals and AgentChats
async function loadTest() {
  console.time('Create 50 terminals');

  for (let i = 0; i < 10; i++) {
    const chat = window.handleCreateAgentChat(`Project ${i}`, `/tmp/project-${i}`);

    for (let j = 0; j < 5; j++) {
      // Create terminal in this chat
      // ...
    }
  }

  console.timeEnd('Create 50 terminals');

  // Measure render time
  performance.mark('render-start');
  // Trigger re-render
  performance.mark('render-end');
  performance.measure('render', 'render-start', 'render-end');
}
```

### Memory Test
```javascript
// Monitor memory usage
const memoryTest = () => {
  if (performance.memory) {
    const before = performance.memory.usedJSHeapSize;

    // Create 100 terminals
    // ...

    const after = performance.memory.usedJSHeapSize;
    const increase = ((after - before) / 1024 / 1024).toFixed(2);
    console.log(`Memory increase: ${increase} MB`);
  }
};
```

---

## Regression Tests

### Critical Paths That Must Not Break
1. **Terminal Creation**: User can always create a terminal
2. **Terminal Switching**: Clicking terminals switches correctly
3. **Terminal Output**: Data flows from PTY to screen
4. **File Explorer**: Still syncs with terminal cwd
5. **Git Integration**: Still shows correct repo status
6. **Keyboard Shortcuts**: Cmd+T, Cmd+W still work

### Automated Regression Suite
```javascript
const regressionSuite = async () => {
  const tests = {
    'Create Terminal': async () => {
      const before = window.terminals.length;
      await window.handleQuickCreateTerminal();
      return window.terminals.length === before + 1;
    },

    'Switch Terminal': () => {
      if (window.terminals.length < 2) return false;
      const first = window.terminals[0].id;
      const second = window.terminals[1].id;
      window.setActiveTerminalId(second);
      return window.activeTerminalId === second;
    },

    'Close Terminal': async () => {
      if (window.terminals.length === 0) return false;
      const before = window.terminals.length;
      await window.handleCloseTerminal(window.terminals[0].id);
      return window.terminals.length === before - 1;
    },

    'Storage Works': async () => {
      const store = await window.__TAURI__.store.Store.load("quack-terminals.json");
      await store.set('test', 'value');
      const value = await store.get('test');
      await store.delete('test');
      return value === 'value';
    }
  };

  console.log('Running regression tests...');
  for (const [name, test] of Object.entries(tests)) {
    try {
      const passed = await test();
      console.log(`✅ ${name}: ${passed ? 'PASS' : 'FAIL'}`);
    } catch (error) {
      console.log(`❌ ${name}: ERROR`, error.message);
    }
  }
};
```

---

## User Acceptance Tests

### Scenario 1: New User Experience
1. Fresh install, no existing data
2. Create first terminal → AgentChat auto-created
3. Create second terminal in same directory → Added to same AgentChat
4. Create terminal in different directory → New AgentChat
5. **Success**: User understands workspace concept without documentation

### Scenario 2: Power User Workflow
1. User with 20+ terminals across 5 projects
2. Migration completes in < 3 seconds
3. All terminals correctly grouped
4. Can quickly switch between workspaces
5. Can create 10 terminals rapidly without lag
6. **Success**: No workflow disruption

### Scenario 3: Edge Case User
1. User with terminals on network drives
2. User with symbolic links in paths
3. User with very long terminal names
4. User with 100+ terminals
5. **Success**: Everything still works

---

## Rollback Test

### Emergency Rollback Procedure
```bash
# 1. Stop the app
pkill Quack

# 2. Revert code changes
cd /Users/alekdob/Desktop/Dev/Personal/quack-app
git stash  # Save current changes
git checkout main  # Or last known good commit

# 3. Clear migration data
rm ~/Library/Application\ Support/com.quack.app/quack-agent-chats.json

# 4. Restart app
npm run tauri:dev

# 5. Verify terminals load without AgentChats
```

### Rollback Verification
- [ ] Terminals load correctly
- [ ] No AgentChat references
- [ ] Can create new terminals
- [ ] Storage not corrupted

---

## Bug Report Template

When you find a bug, document it properly:

```markdown
### Bug: [Short Description]

**Phase**: [1/2/3/4]
**Severity**: [Critical/High/Medium/Low]
**Reproducible**: [Always/Sometimes/Once]

**Steps to Reproduce**:
1.
2.
3.

**Expected Behavior**:

**Actual Behavior**:

**Console Errors**:
```

**Relevant Code**:
```

**Potential Fix**:

**Workaround**:
```

---

## Sign-Off Checklist

Before declaring any phase complete:

### Phase 1 ✅
- [ ] All handler functions tested
- [ ] Storage persistence verified
- [ ] No TypeScript errors
- [ ] No console errors
- [ ] No performance regression
- [ ] Code reviewed

### Phase 2 ✅
- [ ] Migration works for 0, 1, 10, 50 terminals
- [ ] Migration is idempotent
- [ ] Edge cases handled
- [ ] No data loss
- [ ] Rollback tested
- [ ] Migration time < 5 seconds for 50 terminals

### Phase 3 ✅
- [ ] Terminal creation always assigns agentChatId
- [ ] Quick create uses correct defaults
- [ ] Terminal deletion handles edge cases
- [ ] No orphaned terminals
- [ ] All integrations updated
- [ ] User workflow not disrupted

### Phase 4 ✅
- [ ] UI displays AgentChat hierarchy correctly
- [ ] All interactions smooth
- [ ] Keyboard navigation works
- [ ] Visual design approved
- [ ] Accessibility verified
- [ ] Documentation updated

---

*Mike's Final Note: Testing is not optional. It's not "nice to have." It's the difference between shipping a feature and shipping a bug that ruins someone's day. Test angry. Test tired. Test like your worst user. Because somewhere out there, someone is going to do exactly what you didn't test, and then we'll all be debugging on a Saturday. Don't be that developer.*

**Remember**: If you're not sure it works, it doesn't work. Test it again.