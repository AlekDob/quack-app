# 🦆 Verification Guide - Message Duplication Fix

**Goal**: Verify that the message duplication bug is completely fixed in the live application.

---

## 🔧 Prerequisites

1. **Build the app** with the fix:
   ```bash
   npm run tauri dev
   ```

2. **Open DevTools Console** (View → Developer → JavaScript Console)

3. **Enable verbose logging** (to see deduplication in action)

---

## ✅ Test Scenarios

### Test 1: Basic Conversation (Baseline)
**Expected**: ✅ No duplicates, smooth flow

**Steps**:
1. Open Agent Hiroshi (or any agent)
2. Send message: "Hello, can you help me with git?"
3. Wait for response
4. Send follow-up: "Show me git status"
5. Wait for response with tool usage

**Verify**:
- [ ] Each message appears **exactly once** in the UI
- [ ] Tool calls (bash, read, etc.) appear **once** per execution
- [ ] Console shows: `✅ New unique event added` (green checkmarks)
- [ ] **NO** console warnings: `🦆 DUPLICATE DETECTED`

**Expected Console Output**:
```
[useClaudeChat] ✅ New unique event added - ID: system-init Type: system Total: 1
[useClaudeChat] ✅ New unique event added - ID: assistant-msg-abc123 Type: assistant Total: 2
[useClaudeChat] ✅ New unique event added - ID: result-session-xyz Type: result Total: 3
```

---

### Test 2: Session Resumption (Critical Test)
**Expected**: ✅ No duplicates when resuming

**Steps**:
1. Start conversation with Agent Hiroshi
2. Send 2-3 messages
3. **Close the app** (⌘Q or File → Quit)
4. **Reopen the app**
5. Continue the conversation with the same agent
6. Send a new message

**Verify**:
- [ ] Previous messages loaded correctly
- [ ] New messages appear **once**
- [ ] Console shows: `📜 Continuing previous conversation...` (if session resumed)
- [ ] **NO** duplicate messages from history
- [ ] **NO** console warnings: `🦆 DUPLICATE DETECTED`

**Expected Console Output**:
```
[useClaudeChat] Captured session ID: 8afd95fb-75ed-42c2-8690-8b3de1188d63
[useClaudeChat] ✅ New unique event added - ID: system-init Type: system Total: 1
```

**Critical**: If you see duplicate `system-init` events, the bug is back! ❌

---

### Test 3: Heavy Tool Usage (Stress Test)
**Expected**: ✅ No duplicates despite multiple tool calls

**Steps**:
1. Send message: "Create a new file called test.md with some content, then read it back to me"
2. Wait for Agent to execute:
   - Write tool (creates file)
   - Read tool (reads file back)
3. Check UI for duplicates

**Verify**:
- [ ] Each tool call appears **once**:
   - ✅ Write test.md (once)
   - ✅ Read test.md (once)
- [ ] File path appears **once** in the response
- [ ] Console shows distinct event IDs for each tool

**Expected Console Output**:
```
[useClaudeChat] ✅ New unique event added - ID: assistant-tool_use-write Type: assistant Total: 2
[useClaudeChat] ✅ New unique event added - ID: user-tool_result-tool-123 Type: user Total: 3
[useClaudeChat] ✅ New unique event added - ID: assistant-tool_use-read Type: assistant Total: 4
[useClaudeChat] ✅ New unique event added - ID: user-tool_result-tool-456 Type: user Total: 5
```

---

### Test 4: Multi-Agent Concurrency
**Expected**: ✅ No cross-contamination between agents

**Steps**:
1. Open **3 agent tabs** (e.g., Hiroshi, Kaori, Yuki)
2. Send messages to each agent **concurrently**:
   - Hiroshi: "Show me git log"
   - Kaori: "List files in current directory"
   - Yuki: "What's the weather like?"
3. Switch between tabs rapidly

**Verify**:
- [ ] Each agent's messages appear **only in their tab**
- [ ] No messages from Hiroshi appear in Kaori's tab (and vice versa)
- [ ] Console shows different stream IDs for each agent
- [ ] **NO** cross-contamination of events

**Expected Console Output** (each agent gets unique stream ID):
```
[claudeSDK:stream-123] Starting stream for session: stream-123 (resuming: new)
[claudeSDK:stream-456] Starting stream for session: stream-456 (resuming: new)
[claudeSDK:stream-789] Starting stream for session: stream-789 (resuming: new)
```

---

### Test 5: Long Conversation (Performance)
**Expected**: ✅ No duplicates, no performance degradation

**Steps**:
1. Have a **long conversation** (10+ message exchanges)
2. Include various tool uses (git, file operations, bash commands)
3. Monitor console and UI performance

**Verify**:
- [ ] Messages appear **once** throughout entire conversation
- [ ] Performance remains smooth (no lag when scrolling)
- [ ] Event counter grows **linearly** (not exponentially)
- [ ] Console shows: `Total unique events so far: <number>` increasing steadily

**Expected Behavior**:
- After 10 exchanges (~30 events):
  ```
  [useClaudeChat] Total unique events so far: 30
  ```
- After 20 exchanges (~60 events):
  ```
  [useClaudeChat] Total unique events so far: 60
  ```

**❌ BAD** (indicates bug):
- Event count jumps: `30 → 90 → 270` (exponential = duplicates!)

---

### Test 6: The Exact Bug Scenario (Reproduction)
**Expected**: ✅ Bug should NOT reproduce

**Steps**:
1. Send message: "Remove the worktree and delete the branch"
2. Wait for Agent Hiroshi's response (same as screenshot)
3. Look for the **exact message** from the bug report:
   ```
   "Ottimo! Worktree rimosso. Ora (opzionalmente) rimuoviamo il branch locale:"
   ```
4. Check if bash tool call appears multiple times

**Verify**:
- [ ] Message text appears **exactly once**
- [ ] Bash command appears **exactly once**
- [ ] **NO** triplication (not 2x or 3x)
- [ ] Console shows deduplication working if needed

**If you see duplicates**: The bug is back! Check console for details.

---

## 🔍 Debugging Checklist

If you encounter duplicates, check these in order:

### 1. Check Console for Duplicate Warnings
```
[useClaudeChat] 🦆 DUPLICATE DETECTED IN APP LAYER - Event ID: <id> Type: <type>
```

**If present**: Good! Deduplication is catching them. But why are duplicates arriving from SDK?

### 2. Check Session Key Stability
```
[claudeSDK:stream-xxx] Starting stream for session: stream-xxx (resuming: <session_id>)
```

**Verify**: The `session:` value should **always be the same** (stream-xxx) throughout the stream.

**❌ BAD** (indicates bug return):
```
[claudeSDK:stream-123] session: stream-123  ← Good
[claudeSDK:stream-123] session: session-abc ← BAD! Key changed!
```

### 3. Check Event IDs
```
[useClaudeChat] ✅ New unique event added - ID: assistant-msg-abc123 Type: assistant Total: 5
```

**Verify**: Same logical event should generate **same ID** every time.

**Test manually**:
```javascript
// In console
const event1 = { type: 'system', subtype: 'init', session_id: 'session-1' };
const event2 = { type: 'system', subtype: 'init', session_id: 'session-2' };

// Both should generate: "system-init"
console.log(getEventId(event1)); // system-init
console.log(getEventId(event2)); // system-init (same!)
```

### 4. Check for Multiple Stream Instances
**Symptom**: Events arriving from different streams

```bash
# Count active streams
grep "Starting stream" console.log | wc -l
```

**Expected**: 1 stream per agent chat session
**❌ BAD**: Multiple streams for same session (indicates stream leak)

---

## 📊 Success Metrics

After completing all tests, verify:

- [ ] **Zero visual duplicates** in UI
- [ ] **Zero duplicate warnings** in console (or very rare if SDK sends duplicates)
- [ ] **Linear event growth** (Total: 1 → 2 → 3 → ... not 1 → 3 → 9 → ...)
- [ ] **Stable session keys** (always use streamId)
- [ ] **Performance acceptable** (<500ms for long conversations)
- [ ] **Multi-agent isolation** (no cross-contamination)

---

## 🚨 Failure Scenarios

### Scenario A: Duplicates Still Appear
**Symptoms**:
- Messages appear 2-3x in UI
- Tool calls duplicated

**Diagnosis**:
1. Check console for `🦆 DUPLICATE DETECTED` - if **absent**, deduplication not working
2. Check event IDs - if **different for same event**, ID generation broken
3. Check session key - if **changing mid-stream**, session key fix reverted

**Fix**: Re-review `claudeSDK.ts` and `useClaudeChat.ts` changes

### Scenario B: Performance Degradation
**Symptoms**:
- App lags during long conversations
- Event counter grows exponentially

**Diagnosis**:
1. Check event count - if `Total: 1 → 3 → 9 → 27`, duplicates are accumulating
2. Check memory usage - if growing fast, event cleanup not working

**Fix**: Verify cleanup timeout in `claudeSDK.ts:390-393`

### Scenario C: Cross-Contamination
**Symptoms**:
- Agent A's messages appear in Agent B's tab
- Events from different sessions mixed

**Diagnosis**:
1. Check stream IDs - if **same for different agents**, stream isolation broken
2. Check `seenEventIds` Map - if **sharing keys**, isolation broken

**Fix**: Verify `sessionKey = streamId` in `claudeSDK.ts:150`

---

## 🎯 Final Verification

**Before marking as RESOLVED**:

1. ✅ All 6 test scenarios passed
2. ✅ Console shows clean logs (no unexpected warnings)
3. ✅ Performance is acceptable
4. ✅ Automated tests still passing (`npm test`)
5. ✅ Manual testing confirms fix

**If ALL ✅ above**: The bug is **FIXED** and ready for production! 🦆

**If ANY ❌ above**: Review the relevant section and re-test.

---

## 📝 Report Template

Use this template to report your findings:

```markdown
## Verification Report - Message Duplication Fix

**Date**: <DATE>
**Tester**: <YOUR NAME>
**Environment**: macOS <VERSION>, Quack v0.1.3

### Test Results:
- [ ] Test 1: Basic Conversation - PASS/FAIL
- [ ] Test 2: Session Resumption - PASS/FAIL
- [ ] Test 3: Heavy Tool Usage - PASS/FAIL
- [ ] Test 4: Multi-Agent Concurrency - PASS/FAIL
- [ ] Test 5: Long Conversation - PASS/FAIL
- [ ] Test 6: Bug Reproduction - PASS/FAIL

### Issues Found:
<DESCRIBE ANY ISSUES OR "NONE">

### Console Warnings:
<PASTE RELEVANT CONSOLE OUTPUT OR "NONE">

### Overall Status:
✅ VERIFIED / ❌ ISSUES FOUND

### Notes:
<ANY ADDITIONAL OBSERVATIONS>
```

---

**Good luck with verification!** 🦆

Remember: If you find ANY duplicates, the fix is incomplete. The goal is **ZERO duplicates** in all scenarios.
