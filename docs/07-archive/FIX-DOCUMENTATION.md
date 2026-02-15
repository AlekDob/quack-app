# Quack App Bug Fixes Documentation

## Date: October 23, 2025
## Fixed by: John - Backend Architect 🦆

---

## Problem #1: DMG Visual Glitch - .VolumeIcon.icns Visible

### Issue Description
After building the DMG file with `npm run tauri:build`, the file `.VolumeIcon.icns` was visible in the DMG window, even after running the `fix-dmg.sh` script.

### Root Cause Analysis
1. The original `fix-dmg.sh` script only used `SetFile -a V` which sets the invisible attribute but may not work on all macOS versions
2. The script didn't use all available methods to hide files
3. Finder may cache the view and not update immediately

### Solution Implemented
Created an enhanced script `fix-dmg-enhanced.sh` that:
1. Uses THREE methods to hide files:
   - `SetFile -a V` (for older macOS compatibility)
   - `chflags hidden` (for newer macOS)
   - Extended attributes via `xattr` (for maximum compatibility)
2. Hides ALL system files (.VolumeIcon.icns, .background, .DS_Store, .fseventsd, .Trashes)
3. Forces Finder to refresh the view with AppleScript
4. Provides debug information if files are still visible

### How to Use
```bash
# After building the DMG
npm run tauri:build

# Run the enhanced fix script
./fix-dmg-enhanced.sh

# Or specify a DMG path
./fix-dmg-enhanced.sh path/to/your.dmg
```

### If Problem Persists
1. Check if your Finder shows hidden files: `defaults read com.apple.finder AppleShowAllFiles`
2. Eject and remount the DMG to clear Finder cache
3. The icon might be recreated by Tauri - ensure you run the fix AFTER the build completes

---

## Problem #2: Multiple Chat Sessions Blocking Each Other (CRITICAL)

### Issue Description
When opening 2 or more chat sessions in Quack and sending messages simultaneously, one of the chats would completely freeze after a while.

### Root Cause Analysis
The bug was in `src/services/claudeSDK.ts`:
1. The Claude Agent SDK's `query()` function appears to use a singleton or shared resource internally
2. When multiple chat sessions called `streamClaudeMessage()` simultaneously, they shared the same stream
3. This caused race conditions where events from one chat would interfere with another
4. The SDK doesn't properly isolate concurrent sessions

### Solution Implemented

#### 1. Session Isolation in claudeSDK.ts
- Added a global `activeStreams` Map to track active streams per session
- Each session gets its own `AbortController` for proper cleanup
- Before starting a new stream for a session, we cancel any existing stream for that session
- Combined abort signals (`AbortSignal.any`) to handle both user aborts and session aborts

#### 2. Unique Stream IDs in useClaudeChat.ts
- Generate unique `streamId` for each chat message: `chat-${timestamp}-${random}`
- Pass this streamId to `streamClaudeMessage()` to ensure proper isolation

#### 3. Enhanced Error Handling
- Better abort detection and cleanup
- Proper session cleanup in the `finally` block
- Added utility functions: `abortAllStreams()` and `getActiveStreamCount()`

### Code Changes

**src/services/claudeSDK.ts:**
```typescript
// Added session tracking
const activeStreams = new Map<string, AbortController>();

// In streamClaudeMessage function:
const sessionKey = options.sessionId || streamId;

// Cancel existing stream for this session
const existingController = activeStreams.get(sessionKey);
if (existingController) {
  existingController.abort();
  activeStreams.delete(sessionKey);
}

// Create new controller for this session
const sessionAbortController = new AbortController();
activeStreams.set(sessionKey, sessionAbortController);
```

**src/hooks/useClaudeChat.ts:**
```typescript
// Generate unique stream ID for each message
const streamId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Pass it to streamClaudeMessage
const stream = streamClaudeMessage(content, {
  ...options,
  streamId, // Unique per message
});
```

### Testing Instructions
1. Open Quack app
2. Create 2 or more terminal sessions
3. Open chat in each terminal (AI Assistant)
4. Send messages simultaneously in both chats
5. Verify both chats continue to work without blocking
6. Check console logs for proper session isolation

### Debug Commands
Open browser console and look for:
- `[claudeSDK:stream-xxx] Starting stream for session: xxx`
- `[claudeSDK:stream-xxx] Cancelling existing stream for session: xxx`
- `[claudeSDK:stream-xxx] Stream ended after Xms for session: xxx`

---

## Implementation Summary

### Files Modified
1. `/src/services/claudeSDK.ts` - Added session isolation and stream management
2. `/src/hooks/useClaudeChat.ts` - Added unique stream IDs per message

### Files Created
1. `/fix-dmg-enhanced.sh` - Enhanced DMG fixing script with multiple hiding methods
2. `/FIX-DOCUMENTATION.md` - This documentation file

### Performance Impact
- Minimal - the session tracking adds negligible overhead
- Actually improves performance by preventing stream conflicts
- Proper cleanup prevents memory leaks from orphaned streams

### Backward Compatibility
- Fully backward compatible
- Existing single-chat usage unaffected
- Session IDs properly managed for resume functionality

---

## Verification Steps

### For DMG Fix:
```bash
# Build and fix
npm run tauri:build && ./fix-dmg-enhanced.sh

# Mount the DMG
open src-tauri/target/release/bundle/dmg/Quack_*.dmg

# Verify no .VolumeIcon.icns is visible
```

### For Chat Fix:
1. Open multiple terminals in Quack
2. Start AI chat in each
3. Send "Tell me a story" in all chats simultaneously
4. All should respond without blocking

---

## Notes
- The chat blocking issue was CRITICAL as it broke core functionality
- The DMG issue was cosmetic but important for distribution
- Both fixes are production-ready

Quack quack! 🦆 Problems solved!