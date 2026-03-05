/**
 * Session Cleanup Utility
 *
 * Automatically removes old completed sessions to prevent storage bloat.
 * Only deletes sessions with status "done" that are older than maxAgeDays.
 *
 * @module sessionCleanup
 */

import type { AgentSession } from '../types';

/**
 * Storage statistics for session data
 */
interface SessionStorageStats {
  totalSessions: number;
  oldSessions: number;
  estimatedSize: number;
}

/**
 * Calculate age of a session in days from current time
 */
const getSessionAgeDays = (completedAt: number | undefined): number => {
  if (!completedAt) return 0;
  const ageMs = Date.now() - completedAt;
  return Math.floor(ageMs / (1000 * 60 * 60 * 24));
};

/**
 * Estimate storage size of a session object in bytes
 */
const estimateSessionSize = (session: AgentSession): number => {
  // Rough estimate: JSON string length
  return JSON.stringify(session).length;
};

/**
 * Get statistics about session storage
 *
 * @param sessions - Array of all sessions
 * @param maxAgeDays - Age threshold in days
 * @returns Storage statistics
 */
export const getSessionStorageStats = (
  sessions: AgentSession[],
  maxAgeDays: number = 30
): SessionStorageStats => {
  const oldSessions = sessions.filter(
    (s) => s.status === 'done' && getSessionAgeDays(s.completedAt) > maxAgeDays
  );

  const estimatedSize = sessions.reduce(
    (total, session) => total + estimateSessionSize(session),
    0
  );

  return {
    totalSessions: sessions.length,
    oldSessions: oldSessions.length,
    estimatedSize,
  };
};

/**
 * Filter out old completed sessions
 *
 * Removes sessions that meet ALL criteria:
 * - status is "done"
 * - completedAt is older than maxAgeDays
 *
 * Sessions with status "todo" or "in_progress" are NEVER deleted,
 * regardless of age.
 *
 * @param sessions - Array of all sessions
 * @param maxAgeDays - Age threshold in days (default: 30)
 * @returns Filtered array without old completed sessions
 */
export const cleanupOldSessions = (
  sessions: AgentSession[],
  maxAgeDays: number = 30
): {
  cleanedSessions: AgentSession[];
  deletedCount: number;
  deletedIds: string[];
} => {
  const now = Date.now();
  const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;

  const deletedIds: string[] = [];

  const cleanedSessions = sessions.filter((session) => {
    // Never delete sessions that are not completed
    if (session.status !== 'done') {
      return true;
    }

    // Never delete if completedAt is missing
    if (!session.completedAt) {
      return true;
    }

    // Calculate age
    const ageMs = now - session.completedAt;

    // Delete if older than threshold
    if (ageMs > maxAgeMs) {
      deletedIds.push(session.id);
      return false;
    }

    return true;
  });

  return {
    cleanedSessions,
    deletedCount: deletedIds.length,
    deletedIds,
  };
};
