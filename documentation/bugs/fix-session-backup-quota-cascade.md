---
type: bug_fix
project: quack-app
created: 2026-04-20
last_verified: 2026-04-20
tags: [session-recovery, quota, localStorage, PiP-mode, performance]
---
# Fix: SessionRecovery quota cascade and ModelService console spam

## Problem

When a user reopens a Picture-in-Picture (PiP) mode session or restores from session backup, Quack attempts to save accumulated message backups to localStorage. Two cascading issues occur:

### 1. localStorage QuotaExceededError

**Trigger**: In PiP mode, sessions accumulate many messages without pruning. On session restore/retry, `saveSessionBackup()` is called in a retry loop (modelService + session recovery). If messages exceed localStorage quota (~5-10MB per origin, varies by browser):
- `localStorage.setItem()` throws `QuotaExceededError`
- Exception is caught but no eviction logic exists
- Retry loop spins, user sees stalled UI

**Impact**: Session restore fails silently. User cannot recover the session and must restart.

### 2. ModelService console spam (secondary cascade)

When Supabase is unreachable (as often happens during session restore):
- `getModels()` → fallback path → `console.warn('[ModelService] Using emergency fallback...')`
- This warning is called from hot paths: every select dropdown (settings), every settings read, every model lookup
- In a rendering loop or with many concurrent operations, console is flooded with 100s of duplicate warnings per second
- Developers can't see real errors in DevTools. Performance degrades (console i/o is expensive)

**Root cause**: No deduplication flag. Each call to `getModels()` with `remoteModels === undefined` logs independently.

## Solution

### 1. SessionRecovery: Quota-aware backup with LRU eviction

Add constants at module top (before `validatePrompt()`):

```typescript
const MAX_BACKUPS = 100;                    // Max session backups in localStorage
const MAX_MESSAGES_PER_BACKUP = 500;        // Max messages stored per session
```

Modify `saveSessionBackup()` to implement quota management:

```typescript
export function saveSessionBackup(sessionId: string, messages: ChatMessage[]): void {
  try {
    // Cap messages per backup to reduce size
    const cappedMessages = messages.slice(-MAX_MESSAGES_PER_BACKUP);
    
    const backup = {
      sessionId,
      messages: cappedMessages,
      timestamp: Date.now(),
    };
    
    const key = `session_backup_${sessionId}`;
    const value = JSON.stringify(backup);
    
    try {
      localStorage.setItem(key, value);
      console.log(`[SessionRecovery] Backup saved for session ${sessionId} (${cappedMessages.length} messages)`);
    } catch (quotaError) {
      // QuotaExceededError: evict oldest backup via LRU, retry once
      if ((quotaError as Error).name === 'QuotaExceededError') {
        console.warn('[SessionRecovery] localStorage quota exceeded, evicting oldest backup...');
        evictOldestBackup();
        try {
          localStorage.setItem(key, value);
          console.log(`[SessionRecovery] Backup saved after eviction`);
        } catch (retryError) {
          console.error('[SessionRecovery] Backup failed even after eviction:', retryError);
        }
      } else {
        throw quotaError;
      }
    }
  } catch (error) {
    console.error('[SessionRecovery] Failed to save backup:', error);
  }
}

/**
 * Find and remove the oldest session backup (LRU eviction).
 * Scans all session_backup_* keys, compares timestamps, removes the oldest.
 */
function evictOldestBackup(): void {
  try {
    const keys = Object.keys(localStorage);
    let oldestKey: string | null = null;
    let oldestTimestamp = Infinity;

    for (const key of keys) {
      if (key.startsWith('session_backup_')) {
        const backupJson = localStorage.getItem(key);
        if (backupJson) {
          try {
            const backup = JSON.parse(backupJson);
            if (backup.timestamp < oldestTimestamp) {
              oldestTimestamp = backup.timestamp;
              oldestKey = key;
            }
          } catch {
            // Corrupted backup, remove it
            localStorage.removeItem(key);
          }
        }
      }
    }

    if (oldestKey) {
      localStorage.removeItem(oldestKey);
      console.log(`[SessionRecovery] Evicted oldest backup: ${oldestKey}`);
    }
  } catch (error) {
    console.error('[SessionRecovery] Failed to evict backup:', error);
  }
}
```

### 2. ModelService: Dedup fallback warning

Add module-scoped flag + export reset function (Brain breadcrumb marks the section):

```typescript
// Brain: fix-session-backup-quota-cascade
/**
 * Module-scoped flag: the fallback warning is called from many hot render paths
 * (every select dropdown, every settings read). Without dedup it spams the
 * console into oblivion when Supabase is unreachable. Log once per session.
 */
let emergencyFallbackWarned = false;

/**
 * Reset the fallback warning dedup flag. Call after a successful remote
 * models fetch so a later disconnect gets logged again.
 */
export function resetEmergencyFallbackWarning(): void {
  emergencyFallbackWarned = false;
}
```

In `getModels()`, guard the warning:

```typescript
export function getModels(remoteModels?: ModelConfig[]): ModelConfig[] {
  const models = remoteModels?.filter(m => m.isActive);
  if (models && models.length > 0) {
    const sorted = [...models].sort((a, b) => a.sortOrder - b.sortOrder);
    return sorted;
  }
  // Emergency fallback - Supabase unreachable. Warn once per session to avoid
  // flooding the console from hot render paths.
  if (!emergencyFallbackWarned) {
    emergencyFallbackWarned = true;
    console.warn('[ModelService] Using emergency fallback - Supabase models not available');
  }
  return EMERGENCY_FALLBACK;
}
```

Call `resetEmergencyFallbackWarning()` after a successful remote models fetch (in the component/hook that calls `useModelsConfig()` or similar).

## Key Insights

1. **Quota is a feature constraint**: localStorage is shared across all tabs. Backing up 500+ messages can easily exceed quota. Capping per-session and implementing LRU makes backup recovery viable at scale.

2. **Hot path spam is insidious**: A single console.warn in a hot function (called 100x/render cycle) can tank performance and make debugging impossible. Module-scoped dedup flags are cheap insurance.

3. **PiP is the trigger**: Picture-in-Picture sessions run detached from main window, accumulate more messages, and often encounter stale Supabase connections. This is the primary condition that exposes both quota and console spam issues.

## Related Files

| File | Role |
|------|------|
| `src/utils/sessionRecovery.ts` | `MAX_BACKUPS`, `MAX_MESSAGES_PER_BACKUP`, `evictOldestBackup()`, quota-aware `saveSessionBackup()` |
| `src/services/modelService.ts` | `emergencyFallbackWarned` flag, `resetEmergencyFallbackWarning()` export, guarded warning in `getModels()` |
| `src/components/settings/useModelsConfig.ts` (or equiv) | Call `resetEmergencyFallbackWarning()` after successful fetch |
