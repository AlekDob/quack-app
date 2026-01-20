/**
 * Session Cleanup Tests
 *
 * Verify that old session cleanup works correctly and respects status filters
 */

import { describe, it, expect } from 'vitest';
import { cleanupOldSessions, getSessionStorageStats } from './sessionCleanup';
import type { AgentSession } from '../types';

describe('sessionCleanup', () => {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const fortyDaysAgo = now - 40 * 24 * 60 * 60 * 1000;
  const twentyDaysAgo = now - 20 * 24 * 60 * 60 * 1000;

  const mockSession = (id: string, status: 'todo' | 'in_progress' | 'done', completedAt?: number): AgentSession => ({
    id,
    title: `Session ${id}`,
    agentId: 'agent-1',
    projectPath: '/test/path',
    projectName: 'test-project',
    status,
    createdAt: now,
    updatedAt: now,
    completedAt,
    messageCount: 10,
  });

  describe('cleanupOldSessions', () => {
    it('should delete sessions with status=done older than 30 days', () => {
      const sessions: AgentSession[] = [
        mockSession('old-done', 'done', fortyDaysAgo),
        mockSession('recent-done', 'done', twentyDaysAgo),
        mockSession('todo', 'todo'),
        mockSession('in-progress', 'in_progress'),
      ];

      const result = cleanupOldSessions(sessions, 30);

      expect(result.deletedCount).toBe(1);
      expect(result.deletedIds).toEqual(['old-done']);
      expect(result.cleanedSessions).toHaveLength(3);
      expect(result.cleanedSessions.map(s => s.id)).toEqual([
        'recent-done',
        'todo',
        'in-progress',
      ]);
    });

    it('should NOT delete sessions with status=todo regardless of age', () => {
      const sessions: AgentSession[] = [
        mockSession('old-todo', 'todo', fortyDaysAgo),
        mockSession('recent-todo', 'todo', twentyDaysAgo),
      ];

      const result = cleanupOldSessions(sessions, 30);

      expect(result.deletedCount).toBe(0);
      expect(result.cleanedSessions).toHaveLength(2);
    });

    it('should NOT delete sessions with status=in_progress regardless of age', () => {
      const sessions: AgentSession[] = [
        mockSession('old-in-progress', 'in_progress', fortyDaysAgo),
        mockSession('recent-in-progress', 'in_progress', twentyDaysAgo),
      ];

      const result = cleanupOldSessions(sessions, 30);

      expect(result.deletedCount).toBe(0);
      expect(result.cleanedSessions).toHaveLength(2);
    });

    it('should NOT delete sessions with status=done but missing completedAt', () => {
      const sessions: AgentSession[] = [
        mockSession('done-no-date', 'done', undefined),
      ];

      const result = cleanupOldSessions(sessions, 30);

      expect(result.deletedCount).toBe(0);
      expect(result.cleanedSessions).toHaveLength(1);
    });

    it('should allow custom maxAgeDays parameter', () => {
      const tenDaysAgo = now - 10 * 24 * 60 * 60 * 1000;
      const twentyDaysAgo = now - 20 * 24 * 60 * 60 * 1000;

      const sessions: AgentSession[] = [
        mockSession('very-old', 'done', twentyDaysAgo),
        mockSession('somewhat-old', 'done', tenDaysAgo),
      ];

      // Delete sessions older than 15 days
      const result = cleanupOldSessions(sessions, 15);

      expect(result.deletedCount).toBe(1);
      expect(result.deletedIds).toEqual(['very-old']);
    });

    it('should handle empty session array', () => {
      const result = cleanupOldSessions([], 30);

      expect(result.deletedCount).toBe(0);
      expect(result.deletedIds).toEqual([]);
      expect(result.cleanedSessions).toEqual([]);
    });

    it('should handle all sessions being old and done', () => {
      const sessions: AgentSession[] = [
        mockSession('old-1', 'done', fortyDaysAgo),
        mockSession('old-2', 'done', fortyDaysAgo),
        mockSession('old-3', 'done', fortyDaysAgo),
      ];

      const result = cleanupOldSessions(sessions, 30);

      expect(result.deletedCount).toBe(3);
      expect(result.cleanedSessions).toHaveLength(0);
    });
  });

  describe('getSessionStorageStats', () => {
    it('should calculate correct statistics', () => {
      const sessions: AgentSession[] = [
        mockSession('old-done', 'done', fortyDaysAgo),
        mockSession('recent-done', 'done', twentyDaysAgo),
        mockSession('todo', 'todo'),
      ];

      const stats = getSessionStorageStats(sessions, 30);

      expect(stats.totalSessions).toBe(3);
      expect(stats.oldSessions).toBe(1); // Only old-done
      expect(stats.estimatedSize).toBeGreaterThan(0);
    });

    it('should count only done sessions as old', () => {
      const sessions: AgentSession[] = [
        mockSession('old-done', 'done', fortyDaysAgo),
        mockSession('old-todo', 'todo', fortyDaysAgo),
        mockSession('old-in-progress', 'in_progress', fortyDaysAgo),
      ];

      const stats = getSessionStorageStats(sessions, 30);

      expect(stats.oldSessions).toBe(1); // Only old-done
    });

    it('should estimate storage size', () => {
      const sessions: AgentSession[] = [
        mockSession('session-1', 'done', twentyDaysAgo),
        mockSession('session-2', 'todo'),
      ];

      const stats = getSessionStorageStats(sessions, 30);

      // Estimated size should be roughly the JSON string length
      const expectedSize = JSON.stringify(sessions).length;
      expect(stats.estimatedSize).toBeCloseTo(expectedSize, -1);
    });
  });
});
