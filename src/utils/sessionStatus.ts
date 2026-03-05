/**
 * Shared session status utilities
 *
 * Extracted from AgentSessionItem for reuse in TaskHubItem.
 */

/**
 * Get status dot color based on activity state
 * Priority: Awaiting > Working > Ready > Empty
 * - Purple: awaiting response (has pending question)
 * - Yellow/Orange: working (loading)
 * - Green: ready (agent responded, waiting for user)
 * - Gray: no conversation (empty)
 */
export function getActivityDotColor(
  hasPendingQuestion: boolean,
  isLoading: boolean,
  hasUnread: boolean,
  isEmpty: boolean,
): string {
  if (hasPendingQuestion) return '#a855f7'; // Purple - awaiting user response (HIGHEST PRIORITY)
  if (isLoading) return '#f59e0b'; // Yellow/Orange - working
  if (hasUnread) return '#22c55e'; // Green - ready (agent responded)
  if (isEmpty) return '#6b7280'; // Gray - no conversation
  return '#6b7280'; // Default gray
}

/**
 * Get time indicator color based on how recently the session was updated
 * - Green: < 5 minutes ago (very recent)
 * - Yellow: 5-30 minutes ago (recent)
 * - Gray: > 30 minutes ago (older)
 */
export function getTimeColor(updatedAt: number | undefined): string {
  if (!updatedAt) return 'rgba(255, 255, 255, 0.45)'; // Default gray

  const now = Date.now();
  const diffMs = now - updatedAt;
  const diffMinutes = diffMs / (1000 * 60);

  if (diffMinutes < 5) {
    return '#22c55e'; // Green - very recent
  } else if (diffMinutes < 30) {
    return '#f59e0b'; // Yellow - recent
  } else {
    return 'rgba(255, 255, 255, 0.45)'; // Gray - older
  }
}

/**
 * Get CSS class for the status dot animation
 */
export function getDotClassName(
  hasPendingQuestion: boolean,
  isLoading: boolean,
  hasUnreadMessages: boolean,
): string {
  if (hasPendingQuestion) return 'session-dot awaiting';
  if (isLoading) return 'session-dot working';
  if (hasUnreadMessages) return 'session-dot ready';
  return 'session-dot';
}
