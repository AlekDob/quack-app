/**
 * Write lock to prevent race conditions between local writes and file watcher reloads.
 * When a write operation is in progress, the polling hook should skip reloads.
 *
 * Brain: fix-automation-session-title-missing
 * Extracted to avoid circular dependency between sessionStore and unifiedAgentStorage.
 */
export const sessionWriteLock = {
  /** Timestamp of last write operation */
  lastWriteAt: 0,
  /** Debounce period in ms - ignore file watcher events for this duration after a write */
  DEBOUNCE_MS: 500,

  /** Mark that a write operation just happened */
  markWrite() {
    this.lastWriteAt = Date.now();
    console.log('[sessionWriteLock] Write marked at', this.lastWriteAt);
  },

  /** Check if we should skip a reload (within debounce period of last write) */
  shouldSkipReload(): boolean {
    const elapsed = Date.now() - this.lastWriteAt;
    const skip = elapsed < this.DEBOUNCE_MS;
    if (skip) {
      console.log(`[sessionWriteLock] Skipping reload (${elapsed}ms since last write, debounce: ${this.DEBOUNCE_MS}ms)`);
    }
    return skip;
  }
};
