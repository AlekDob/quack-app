/**
 * Session Recovery Utilities
 *
 * Provides validation and recovery mechanisms to prevent session loss
 * when SDK fails or crashes during message sending.
 */

import { toast } from 'sonner';

/**
 * Validate prompt before sending to SDK
 * Prevents common issues that cause SDK crashes
 */
export function validatePrompt(prompt: string): { valid: boolean; reason?: string } {
  const trimmed = prompt.trim();

  // Too short
  if (trimmed.length < 2) {
    return {
      valid: false,
      reason: 'Prompt is too short. Please provide more detail.',
    };
  }

  // Vague patterns that trigger Carmelo/prompt improvement agents
  const vaguePatterns = [
    { pattern: /^make it better$/i, name: '"make it better"' },
    { pattern: /^fix (it|this)$/i, name: '"fix it/this"' },
    { pattern: /^improve$/i, name: '"improve"' },
    { pattern: /^update$/i, name: '"update"' },
    { pattern: /^change$/i, name: '"change"' },
    { pattern: /^help$/i, name: '"help"' },
  ];

  for (const { pattern, name } of vaguePatterns) {
    if (pattern.test(trimmed)) {
      return {
        valid: false,
        reason: `Prompt ${name} is too vague. Please be more specific about what you want to achieve.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Save session backup to localStorage
 * Used as fallback when SDK session fails
 */
export function saveSessionBackup(sessionId: string, messages: any[]): void {
  try {
    const backup = {
      sessionId,
      messages,
      timestamp: Date.now(),
    };
    localStorage.setItem(`session_backup_${sessionId}`, JSON.stringify(backup));
    console.log(`[SessionRecovery] Backup saved for session ${sessionId}`);
  } catch (error) {
    console.error('[SessionRecovery] Failed to save backup:', error);
  }
}

/**
 * Load session backup from localStorage
 * Returns null if no backup exists or backup is corrupted
 */
export function loadSessionBackup(sessionId: string): { messages: any[]; timestamp: number } | null {
  try {
    const backupJson = localStorage.getItem(`session_backup_${sessionId}`);
    if (!backupJson) return null;

    const backup = JSON.parse(backupJson);

    // Verify backup structure
    if (!backup.sessionId || !Array.isArray(backup.messages) || !backup.timestamp) {
      console.warn('[SessionRecovery] Invalid backup structure');
      return null;
    }

    // Check if backup is too old (> 24 hours)
    const age = Date.now() - backup.timestamp;
    if (age > 24 * 60 * 60 * 1000) {
      console.warn('[SessionRecovery] Backup is too old, ignoring');
      return null;
    }

    return {
      messages: backup.messages,
      timestamp: backup.timestamp,
    };
  } catch (error) {
    console.error('[SessionRecovery] Failed to load backup:', error);
    return null;
  }
}

/**
 * Clear session backup after successful recovery
 */
export function clearSessionBackup(sessionId: string): void {
  try {
    localStorage.removeItem(`session_backup_${sessionId}`);
    console.log(`[SessionRecovery] Backup cleared for session ${sessionId}`);
  } catch (error) {
    console.error('[SessionRecovery] Failed to clear backup:', error);
  }
}

/**
 * Show recovery dialog to user
 * Returns user's choice: 'recover' | 'restart' | 'cancel'
 */
export async function showRecoveryDialog(
  sessionId: string,
  messageCount: number
): Promise<'recover' | 'restart' | 'cancel'> {
  return new Promise((resolve) => {
    const confirmed = window.confirm(
      `Session recovery available!\n\n` +
      `Found ${messageCount} messages from a previous session.\n\n` +
      `Click OK to recover the session, or Cancel to start fresh.`
    );

    if (confirmed) {
      toast.success('Session recovered from local backup!');
      resolve('recover');
    } else {
      toast.info('Starting fresh session');
      resolve('restart');
    }
  });
}

/**
 * Clean up old backups (older than 7 days)
 * Should be called periodically (e.g., on app startup)
 */
export function cleanupOldBackups(): void {
  try {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const keys = Object.keys(localStorage);
    let cleaned = 0;

    for (const key of keys) {
      if (key.startsWith('session_backup_')) {
        try {
          const backupJson = localStorage.getItem(key);
          if (backupJson) {
            const backup = JSON.parse(backupJson);
            if (backup.timestamp < sevenDaysAgo) {
              localStorage.removeItem(key);
              cleaned++;
            }
          }
        } catch {
          // Invalid backup, remove it
          localStorage.removeItem(key);
          cleaned++;
        }
      }
    }

    if (cleaned > 0) {
      console.log(`[SessionRecovery] Cleaned up ${cleaned} old backups`);
    }
  } catch (error) {
    console.error('[SessionRecovery] Failed to cleanup old backups:', error);
  }
}
