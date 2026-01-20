/**
 * Tests for session message limit protection
 */
import { describe, it, expect } from 'vitest';
import { shouldArchiveSession } from '../stores/sessionStore';
import type { AgentSession } from '../types';

describe('Session Message Limit', () => {
  const createMockSession = (messageCount: number): AgentSession => ({
    id: 'test-session',
    title: 'Test Session',
    agentId: 'test-agent',
    projectPath: '/test/path',
    projectName: 'test-project',
    status: 'in_progress',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount,
  });

  describe('shouldArchiveSession', () => {
    it('should return false for sessions under the limit', () => {
      const session = createMockSession(500);
      expect(shouldArchiveSession(session)).toBe(false);
    });

    it('should return false for sessions exactly at the limit', () => {
      const session = createMockSession(1000);
      expect(shouldArchiveSession(session)).toBe(false);
    });

    it('should return true for sessions over the limit', () => {
      const session = createMockSession(1001);
      expect(shouldArchiveSession(session)).toBe(true);
    });

    it('should return true for sessions far exceeding the limit', () => {
      const session = createMockSession(5000);
      expect(shouldArchiveSession(session)).toBe(true);
    });

    it('should return false for new sessions with zero messages', () => {
      const session = createMockSession(0);
      expect(shouldArchiveSession(session)).toBe(false);
    });
  });
});
