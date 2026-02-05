---
type: bug
project: quack-app
created: 2026-01-10
migrated: true
---

# bug-task-chat-messages-delayed

RECURRING BUG: Task chat messages don't appear immediately when switching between tasks assigned to the same agent. Messages only appear AFTER sending a new message.

## ROOT CAUSE ANALYSIS

The bug has a TIMING + STATE DERIVATION issue:

### THE FLOW (from App.tsx openTaskTab, line 7579-7731):

1. **IMMEDIATE UI UPDATE (line 7613-7616)**
   - setActiveId(actualAgentId) - switches visible agent
   - setActiveTabId('chat') - switches to chat tab
   - BUT: activeTaskPerAgent NOT YET UPDATED

2. **PARALLEL OPERATIONS (line 7625-7665)**
   - Promise.all() runs 3 async operations:
     - loadDirectory(projectPath)
     - Load task messages from Tauri Store: store.get('chat-${task.id}')
     - Save previous task messages

3. **PROCESS LOADED DATA (line 7674-7714)**
   - If messages loaded, calls setChatSessions(prev => { ... newSessions.set(task.id, messages) })
   - CRITICAL: This setState is async, completes on next render

4. **SEQUENTIAL DEPENDENT (line 7720-7728)**
   - ensureListenerReady(task.id) - pre-creates listener
   - THEN setActiveTaskPerAgent(prev => { ... newMap.set(actualAgentId, task.id) })
   
### WHY MESSAGES DON'T APPEAR:

**The derivation chain** (from App.tsx line 595 and 3400-3404):
```
activeTaskPerAgent.get(activeId) -> activeTaskId
activeTaskId -> chatSessions.get(activeTaskId) -> activeTaskMessages
activeTaskMessages passed to ChatView
```

**Race condition window**:
- activeTaskPerAgent is updated in STEP 4 (line 7726)
- But chatSessions was updated in STEP 3 (line 7680)
- React renders when activeTaskPerAgent changes
- If React sees new activeTaskId BEFORE chatSessions[taskId] is populated, component mounts with empty messages

**Key Problem**: The ChatView has a key (line 9674):
```jsx
key={isTaskChat ? `task-${activeTaskId}` : (activeId ?? 'no-agent')}
```

When key changes (taskId changes), React UNMOUNTS old ChatView and MOUNTS new one. If new task's messages aren't in chatSessions yet, the new component sees empty array.

### WHY SENDING A MESSAGE FIXES IT:

When user sends a message:
- sendMessageForTargetAgent() (line 2456) is called
- Line 2533: `const currentMessages = chatSessions.get(targetAgentId) ?? []`
- This retrieves whatever messages ARE in chatSessions
- Then line 2545-2549: Adds user message and calls setChatSessions
- Forces full component re-render
- This time, chatSessions DEFINITELY has the messages (they were loaded in openTaskTab, just not visible yet)

### THE ACTUAL ISSUE:

The problem is likely in **how React batches state updates** and the **timing between two setState calls**:

1. Line 7678-7682: `setChatSessions(prev => newSessions.set(task.id, messages))`
2. Line 7724-7728: `setActiveTaskPerAgent(prev => newMap.set(actualAgentId, task.id))`

Both are updater functions on Maps. When activeTaskPerAgent changes, React re-renders.

**React's behavior**: If both setState calls happen in the SAME synchronous batch, React batches them. But if there's an await in between, the batching breaks.

Looking at line 7720: `await ensureListenerReady(task.id)` - this AWAIT is between the two setState calls!

This means:
1. setChatSessions call is queued
2. Listener setup AWAITS (async operation)
3. During the await, React may render with old state
4. THEN setActiveTaskPerAgent is called
5. React re-renders again with new activeTaskPerAgent
6. But chatSessions might still be showing old data from render #1

### SECONDARY ISSUE: Component Key and Re-mount

When activeTaskPerAgent changes, the ChatView key changes from `task-${oldTaskId}` to `task-${newTaskId}`.

React UNMOUNTS the old ChatView and MOUNTS a NEW one.

The NEW ChatView reads from chatSessions at mount time. If this happens BEFORE chatSessions is updated, it gets empty messages.

### THE SENDING MESSAGE FIX:

When user sends a message:
1. Both setState calls (messages + loading) happen in SAME synchronous block
2. React batches them together
3. Component re-renders with both new messages AND loading state
4. Messages appear!

This works because sendMessageForTargetAgent doesn't have an async await between the two updates.

[2026-01-10] **KEY CODE LOCATIONS**:\n\n1. **openTaskTab** (App.tsx:7579-7731)\n   - Where task switching happens\n   - State updates: setChatSessions (line 7678), setActiveTaskPerAgent (line 7724)\n   - await ensureListenerReady between them (line 7720) - BREAKS BATCHING\n\n2. **State derivation** (App.tsx:595, 3400-3404)\n   - activeTaskId = activeTaskPerAgent.get(activeId)\n   - activeTaskMessages = chatSessions.get(activeTaskId) ?? []\n   - memoized, depends on both activeTaskId AND chatSessions\n\n3. **ChatView rendering** (App.tsx:9664-9800)\n   - key={isTaskChat ? `task-${activeTaskId}` : (activeId ?? 'no-agent')} (line 9674)\n   - messages={isTaskChat ? activeTaskMessages : currentAgentMessages} (line 9675)\n   - When activeTaskId changes, component remounts with new key\n\n4. **sendMessageForTargetAgent** (App.tsx:2456-2767)\n   - Line 2533: `const currentMessages = chatSessions.get(targetAgentId) ?? []`\n   - Line 2545-2549: setChatSessions (same sync block, no await between)\n   - This is why messages appear after sending - both updates batched together"

[2026-01-10] **HYPOTHESIS FOR ROOT CAUSE**:\n\nThe issue is the `await ensureListenerReady(task.id)` call at line 7720 in openTaskTab.\n\nSequence:\n1. setChatSessions called (line 7678) - queued in React batch\n2. await ensureListenerReady (line 7720) - BREAKS BATCHING WINDOW\n   - This is an async operation that suspends execution\n   - React may start rendering with current state\n3. During await, if React renders:\n   - activeTaskPerAgent is STILL OLD (not updated yet)\n   - chatSessions MAY have new messages (setState queued before await)\n   - But activeTaskId derived from old activeTaskPerAgent, so no re-render needed yet\n4. After await, setActiveTaskPerAgent (line 7724)\n5. React re-renders with:\n   - NEW activeTaskId (from new activeTaskPerAgent)\n   - NEW activeTaskMessages derivation triggers\n   - ChatView KEY CHANGES - component UNMOUNTS and REMOUNTS\n   - NEW ChatView instance reads from chatSessions\n   - But if there's timing issue, might still see empty\n\n**The fix sending messages demonstrates**: When both updates happen synchronously with no await between, React batches them and they work correctly."

[2026-01-10] **PROPOSED SOLUTIONS**:\n\n**Option 1: Reorder to ensure atomic update** (RECOMMENDED)\n- Move ensureListenerReady to AFTER setActiveTaskPerAgent\n- Ensure both state updates (chatSessions + activeTaskPerAgent) are in same batch\n- Then call ensureListenerReady without breaking React batching\n\n**Option 2: Combine state updates into single callback**\n- Create custom hook that updates both maps atomically\n- Prevents React from rendering between updates\n- More complex but guarantees no intermediate renders\n\n**Option 3: Use unstable_batchedUpdates from React 18**\n- Explicitly batch the updates\n- Work around the await issue\n- Already using React 19 so should have better batching\n\n**Option 4: Check if messages loaded before changing activeTaskPerAgent**\n- Verify chatSessions actually has the task's messages before updating activeTaskPerAgent\n- Add defensive check to prevent premature activation\n\n**Option 5: Delay re-render until both updates complete**\n- Use useTransition hook to group updates\n- Show loading state while waiting\n- More UX-friendly, shows something is happening"
