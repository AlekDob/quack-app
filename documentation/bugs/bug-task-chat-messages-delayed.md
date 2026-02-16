---
type: bug
created: 2026-01-10
tags: [react, state-management, race-condition, batching]
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

### PROPOSED SOLUTIONS:

**Option 1: Reorder to ensure atomic update** (RECOMMENDED)
- Move ensureListenerReady to AFTER setActiveTaskPerAgent
- Ensure both state updates (chatSessions + activeTaskPerAgent) are in same batch
- Then call ensureListenerReady without breaking React batching

**Option 2: Combine state updates into single callback**
- Create custom hook that updates both maps atomically
- Prevents React from rendering between updates
- More complex but guarantees no intermediate renders

### KEY PATTERN:

**MAI mettere await tra setState correlati che devono essere batchati insieme** (Never put await between correlated setState calls that must be batched together)
