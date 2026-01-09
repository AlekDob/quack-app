/**
 * Agent Chat Persistence Tests
 *
 * Tests for automatic persistence and restoration of agent chat sessions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  saveAgentSessionId,
  getAgentSessionId,
  loadAllAgentSessions,
  saveAgentMessages,
  loadAgentMessages,
  deleteAgentData,
  clearAllAgentData,
} from '../services/agentChatPersistence';
import type { ChatMessage } from '../types';

// Mock Tauri Store with proper test isolation
const mockStores = new Map<string, Map<string, any>>();

vi.mock('@tauri-apps/plugin-store', () => {
  return {
    Store: {
      load: vi.fn((storeName: string) => {
        if (!mockStores.has(storeName)) {
          mockStores.set(storeName, new Map<string, any>());
        }
        const mockStore = mockStores.get(storeName)!;

        return Promise.resolve({
          get: vi.fn((key: string) => Promise.resolve(mockStore.get(key))),
          set: vi.fn((key: string, value: any) => {
            mockStore.set(key, value);
            return Promise.resolve();
          }),
          delete: vi.fn((key: string) => {
            mockStore.delete(key);
            return Promise.resolve();
          }),
          save: vi.fn(() => Promise.resolve()),
          clear: vi.fn(() => {
            mockStore.clear();
            return Promise.resolve();
          }),
        });
      }),
    },
  };
});

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Agent Chat Persistence', () => {
  const testAgentId = 'test-agent-123';
  const testSessionId = 'claude-session-abc';

  beforeEach(() => {
    // Clear all data before each test
    vi.clearAllMocks();
    mockStores.clear(); // Clear all mock stores for test isolation
  });

  describe('Session ID Persistence', () => {
    it('should save and retrieve sessionId for an agent', async () => {
      await saveAgentSessionId(testAgentId, testSessionId);
      const retrievedSessionId = await getAgentSessionId(testAgentId);

      expect(retrievedSessionId).toBe(testSessionId);
    });

    it('should return undefined for non-existent agent', async () => {
      const sessionId = await getAgentSessionId('non-existent-agent');
      expect(sessionId).toBeUndefined();
    });

    it('should load all agent sessions', async () => {
      await saveAgentSessionId('agent-1', 'session-1');
      await saveAgentSessionId('agent-2', 'session-2');
      await saveAgentSessionId('agent-3', 'session-3');

      const allSessions = await loadAllAgentSessions();

      expect(allSessions.size).toBe(3);
      expect(allSessions.get('agent-1')).toBe('session-1');
      expect(allSessions.get('agent-2')).toBe('session-2');
      expect(allSessions.get('agent-3')).toBe('session-3');
    });

    it('should overwrite sessionId for existing agent', async () => {
      await saveAgentSessionId(testAgentId, 'old-session');
      await saveAgentSessionId(testAgentId, 'new-session');

      const retrievedSessionId = await getAgentSessionId(testAgentId);
      expect(retrievedSessionId).toBe('new-session');
    });
  });

  describe('Message Persistence', () => {
    const testMessages: ChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello Claude',
        timestamp: Date.now() - 2000,
        status: 'complete',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hello! How can I help you?',
        timestamp: Date.now() - 1000,
        status: 'complete',
      },
      {
        id: 'msg-3',
        role: 'user',
        content: 'What is the weather?',
        timestamp: Date.now(),
        status: 'complete',
      },
    ];

    it('should save and load messages for an agent', async () => {
      await saveAgentMessages(testAgentId, testSessionId, testMessages);
      const loaded = await loadAgentMessages(testAgentId);

      expect(loaded).not.toBeNull();
      expect(loaded?.agentId).toBe(testAgentId);
      expect(loaded?.sessionId).toBe(testSessionId);
      expect(loaded?.messages).toHaveLength(3);
      expect(loaded?.messages[0].content).toBe('Hello Claude');
      expect(loaded?.messages[1].role).toBe('assistant');
    });

    it('should return null for non-existent agent messages', async () => {
      const loaded = await loadAgentMessages('non-existent-agent');
      expect(loaded).toBeNull();
    });

    it('should handle empty message arrays', async () => {
      await saveAgentMessages(testAgentId, testSessionId, []);
      const loaded = await loadAgentMessages(testAgentId);

      expect(loaded?.messages).toHaveLength(0);
    });

    it('should update messages when saving again', async () => {
      await saveAgentMessages(testAgentId, testSessionId, [testMessages[0]]);

      let loaded = await loadAgentMessages(testAgentId);
      expect(loaded?.messages).toHaveLength(1);

      await saveAgentMessages(testAgentId, testSessionId, testMessages);
      loaded = await loadAgentMessages(testAgentId);
      expect(loaded?.messages).toHaveLength(3);
    });

    it('should preserve message order', async () => {
      const messagesWithTimestamps: ChatMessage[] = [
        { id: '1', role: 'user', content: 'First', timestamp: 100, status: 'complete' },
        { id: '2', role: 'assistant', content: 'Second', timestamp: 200, status: 'complete' },
        { id: '3', role: 'user', content: 'Third', timestamp: 300, status: 'complete' },
      ];

      await saveAgentMessages(testAgentId, testSessionId, messagesWithTimestamps);
      const loaded = await loadAgentMessages(testAgentId);

      expect(loaded?.messages[0].content).toBe('First');
      expect(loaded?.messages[1].content).toBe('Second');
      expect(loaded?.messages[2].content).toBe('Third');
    });
  });

  describe('Data Deletion', () => {
    it('should delete all data for an agent', async () => {
      await saveAgentSessionId(testAgentId, testSessionId);
      await saveAgentMessages(testAgentId, testSessionId, [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
          timestamp: Date.now(),
          status: 'complete',
        },
      ]);

      await deleteAgentData(testAgentId);

      const sessionId = await getAgentSessionId(testAgentId);
      const messages = await loadAgentMessages(testAgentId);

      expect(sessionId).toBeUndefined();
      expect(messages).toBeNull();
    });

    it('should not affect other agents when deleting one', async () => {
      await saveAgentSessionId('agent-1', 'session-1');
      await saveAgentSessionId('agent-2', 'session-2');

      await deleteAgentData('agent-1');

      const session1 = await getAgentSessionId('agent-1');
      const session2 = await getAgentSessionId('agent-2');

      expect(session1).toBeUndefined();
      expect(session2).toBe('session-2');
    });
  });

  describe('Clear All Data', () => {
    it('should clear all agent data', async () => {
      await saveAgentSessionId('agent-1', 'session-1');
      await saveAgentSessionId('agent-2', 'session-2');
      await saveAgentMessages('agent-1', 'session-1', [
        {
          id: 'msg-1',
          role: 'user',
          content: 'Test',
          timestamp: Date.now(),
          status: 'complete',
        },
      ]);

      await clearAllAgentData();

      const sessions = await loadAllAgentSessions();
      const messages = await loadAgentMessages('agent-1');

      expect(sessions.size).toBe(0);
      expect(messages).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    it('should handle special characters in agentId', async () => {
      const specialAgentId = 'agent-with-special-chars-!@#$%';
      await saveAgentSessionId(specialAgentId, testSessionId);

      const retrieved = await getAgentSessionId(specialAgentId);
      expect(retrieved).toBe(testSessionId);
    });

    it('should handle very long message content', async () => {
      const longContent = 'a'.repeat(10000);
      const longMessage: ChatMessage = {
        id: 'msg-long',
        role: 'assistant',
        content: longContent,
        timestamp: Date.now(),
        status: 'complete',
      };

      await saveAgentMessages(testAgentId, testSessionId, [longMessage]);
      const loaded = await loadAgentMessages(testAgentId);

      expect(loaded?.messages[0].content).toBe(longContent);
    });

    it('should handle messages with system role', async () => {
      const systemMessage: ChatMessage = {
        id: 'msg-system',
        role: 'system',
        content: 'System notification',
        timestamp: Date.now(),
        status: 'complete',
      };

      await saveAgentMessages(testAgentId, testSessionId, [systemMessage]);
      const loaded = await loadAgentMessages(testAgentId);

      expect(loaded?.messages[0].role).toBe('system');
    });
  });

  describe('Integration Scenario', () => {
    it('should handle complete agent lifecycle', async () => {
      // 1. Create agent and save sessionId
      await saveAgentSessionId(testAgentId, testSessionId);

      // 2. Send first message
      const msg1: ChatMessage = {
        id: 'msg-1',
        role: 'user',
        content: 'Hello',
        timestamp: Date.now(),
        status: 'complete',
      };
      await saveAgentMessages(testAgentId, testSessionId, [msg1]);

      // 3. Send second message (append to existing)
      const msg2: ChatMessage = {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hi there!',
        timestamp: Date.now(),
        status: 'complete',
      };
      await saveAgentMessages(testAgentId, testSessionId, [msg1, msg2]);

      // 4. Simulate app restart - load everything back
      const loadedSessionId = await getAgentSessionId(testAgentId);
      const loadedMessages = await loadAgentMessages(testAgentId);

      expect(loadedSessionId).toBe(testSessionId);
      expect(loadedMessages?.messages).toHaveLength(2);
      expect(loadedMessages?.messages[0].content).toBe('Hello');
      expect(loadedMessages?.messages[1].content).toBe('Hi there!');

      // 5. Delete agent
      await deleteAgentData(testAgentId);

      const deletedSessionId = await getAgentSessionId(testAgentId);
      const deletedMessages = await loadAgentMessages(testAgentId);

      expect(deletedSessionId).toBeUndefined();
      expect(deletedMessages).toBeNull();
    });
  });
});
