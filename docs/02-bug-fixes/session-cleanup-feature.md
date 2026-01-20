# Session Auto-Cleanup Feature

**Date:** 2026-01-17
**Status:** Completed
**Impact:** Performance improvement, storage optimization

## Summary

Implemented automatic cleanup for old SDK sessions to prevent storage bloat. The system now automatically removes sessions older than 30 days that have status "done" on app startup.

## Implementation

### Files Created

1. **`src/utils/sessionCleanup.ts`** - Core cleanup utility
   - `cleanupOldSessions(sessions, maxAgeDays)` - Filters out old completed sessions
   - `getSessionStorageStats(sessions, maxAgeDays)` - Returns storage statistics
   - Respects session status: only deletes sessions with status "done"

2. **`src/utils/sessionCleanup.test.ts`** - Test suite (10 tests)
   - Verifies cleanup logic respects status filters
   - Tests edge cases (missing completedAt, empty arrays, etc.)
   - All tests passing

### Files Modified

1. **`src/App.tsx`**
   - Added import for `cleanupOldSessions`
   - Integrated cleanup into bootstrap function (4 locations)
   - Cleanup runs immediately after sessions are loaded
   - Shows toast notification when sessions are cleaned up

## Behavior

### What Gets Deleted

Sessions are deleted if ALL of the following are true:
- Status is `"done"`
- `completedAt` timestamp exists
- Age is greater than `maxAgeDays` (default: 30 days)

### What is Protected

Sessions are NEVER deleted if:
- Status is `"todo"` (regardless of age)
- Status is `"in_progress"` (regardless of age)
- Status is `"done"` but `completedAt` is missing
- Age is less than or equal to `maxAgeDays`

### User Experience

On app startup:
1. Sessions are loaded from storage
2. Cleanup runs automatically
3. If sessions are deleted:
   - Console logs the count and IDs
   - Toast notification: "Cleaned up N old session(s)"
   - Description: "Removed sessions completed more than 30 days ago"
4. If no cleanup needed:
   - Console log: "[Session Cleanup] No old sessions to clean up"
   - No toast shown

## Configuration

The cleanup age threshold is hardcoded to **30 days** in App.tsx. To modify:

```typescript
const { cleanedSessions, deletedCount, deletedIds } = cleanupOldSessions(
  sessionsBeforeCleanup,
  30  // Change this value to adjust threshold
);
```

## Testing

Run tests with:
```bash
npm test -- sessionCleanup.test.ts
```

**Test Coverage:**
- 10 tests, all passing
- Covers status filtering, age calculation, edge cases
- Verifies stats calculation

## Performance Impact

- **Minimal**: Cleanup runs once on app startup
- **Non-blocking**: Executes during bootstrap phase
- **Safe**: Only deletes data that meets strict criteria

## Future Enhancements

Potential improvements (not implemented):
1. Make `maxAgeDays` configurable in settings
2. Add manual "Clean Old Sessions" button in settings
3. Show storage stats before/after cleanup
4. Archive sessions instead of deleting (export to JSON)
5. Cleanup Claude SDK session files from disk (not just Quack metadata)

## Code Locations

| File | Lines | Description |
|------|-------|-------------|
| `src/utils/sessionCleanup.ts` | 1-117 | Core utility functions |
| `src/utils/sessionCleanup.test.ts` | 1-195 | Test suite |
| `src/App.tsx` | 140 | Import statement |
| `src/App.tsx` | 6071-6090 | Cleanup integration (branch 1) |
| `src/App.tsx` | 6130-6149 | Cleanup integration (branch 2) |
| `src/App.tsx` | 6255-6274 | Cleanup integration (branch 3) |
| `src/App.tsx` | 6313-6332 | Cleanup integration (branch 4) |

## Related Issues

This feature addresses storage bloat from accumulating completed sessions over time. It's particularly useful for power users who create many sessions daily.
