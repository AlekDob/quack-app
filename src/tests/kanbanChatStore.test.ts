/**
 * Tests for useKanbanChatStore hook
 *
 * Verifies that the hook correctly reads FULL messages from Tauri Store
 * instead of truncated sync data.
 *
 * @module kanbanChatStore.test
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { ChatMessage } from '../types';

// Mock implementations - defined at module level before vi.mock
const mockStoreGet = vi.fn();
const mockStoreSet = vi.fn();
const mockStoreSave = vi.fn();
const mockStoreDelete = vi.fn();

const mockListeners = new Map<string, (event: { payload: unknown }) => void>();

// Mock Tauri Store - must be before imports that use it
vi.mock('@tauri-apps/plugin-store', () => ({
  Store: {
    load: vi.fn().mockImplementation(() =>
      Promise.resolve({
        get: mockStoreGet,
        set: mockStoreSet,
        save: mockStoreSave,
        delete: mockStoreDelete,
      })
    ),
  },
}));

// Mock Tauri events
vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockImplementation((eventName: string, callback: (event: { payload: unknown }) => void) => {
    mockListeners.set(eventName, callback);
    return Promise.resolve(() => {
      mockListeners.delete(eventName);
    });
  }),
  emit: vi.fn(),
}));

// Import after mocks are set up
import { useKanbanChatStore } from '../hooks/useKanbanChatStore';

// Sample test data
const createTestMessage = (id: string, content: string, role: 'user' | 'assistant' = 'assistant'): ChatMessage => ({
  id,
  role,
  content,
  timestamp: Date.now(),
  status: 'complete' as const,
});

const LONG_CONTENT = `
# Implementation Plan

## Overview
This is a detailed implementation plan that exceeds 200 characters.
It includes multiple sections, code examples, and technical details.

## Code Example
\`\`\`typescript
function example() {
  return 'This is a code block that would be truncated in sync';
}
\`\`\`

## Next Steps
1. First step with details
2. Second step with more information
3. Third step completing the plan

This content would normally be truncated to 200 chars in the sync mechanism.
`;

describe('useKanbanChatStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Loading', () => {
    it('should load complete messages from store without truncation', async () => {
      const fullMessages: ChatMessage[] = [
        createTestMessage('msg-1', 'User question about implementation'),
        createTestMessage('msg-2', LONG_CONTENT),
      ];

      mockStoreGet.mockResolvedValue({
        messages: fullMessages,
        tokens: { inputTokens: 100, outputTokens: 500 },
        timestamp: Date.now(),
      });

      const { result } = renderHook(() => useKanbanChatStore('test-agent-id'));

      await waitFor(() => {
        expect(result.current.messages.length).toBe(2);
      });

      // Verify content is NOT truncated
      const lastMessage = result.current.messages[1];
      expect(lastMessage.content).toBe(LONG_CONTENT);
      expect(lastMessage.content.length).toBeGreaterThan(200);
      expect(lastMessage.content).not.toContain('...');
    });

    it('should preserve all messages (not just last 5)', async () => {
      // Create 10 messages - sync would only keep last 5
      const manyMessages: ChatMessage[] = Array.from({ length: 10 }, (_, i) =>
        createTestMessage(`msg-${i}`, `Message content ${i}`, i % 2 === 0 ? 'user' : 'assistant')
      );

      mockStoreGet.mockResolvedValue({
        messages: manyMessages,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() => useKanbanChatStore('test-agent-id'));

      await waitFor(() => {
        expect(result.current.messages.length).toBe(10);
      });

      // Verify ALL messages are present
      expect(result.current.messages[0].id).toBe('msg-0');
      expect(result.current.messages[9].id).toBe('msg-9');
    });

    it('should return empty array for null agentId', async () => {
      const { result } = renderHook(() => useKanbanChatStore(null));

      expect(result.current.messages).toEqual([]);
      expect(result.current.tokens).toBeNull();
      expect(mockStoreGet).not.toHaveBeenCalled();
    });

    it('should return empty array when store has no data', async () => {
      mockStoreGet.mockResolvedValue(null);

      const { result } = renderHook(() => useKanbanChatStore('empty-agent'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.messages).toEqual([]);
    });
  });

  describe('Token Data', () => {
    it('should load token data from store', async () => {
      const tokens = {
        inputTokens: 1500,
        outputTokens: 3000,
        cacheCreationTokens: 100,
        cacheReadTokens: 50,
        totalCost: 0.05,
      };

      mockStoreGet.mockResolvedValue({
        messages: [createTestMessage('msg-1', 'Test')],
        tokens,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() => useKanbanChatStore('test-agent'));

      await waitFor(() => {
        expect(result.current.tokens).not.toBeNull();
      });

      expect(result.current.tokens).toEqual(tokens);
    });
  });

  describe('Reload on Sync Event', () => {
    it('should reload messages when sync event is received', async () => {
      const initialMessages = [createTestMessage('msg-1', 'Initial')];
      const updatedMessages = [
        createTestMessage('msg-1', 'Initial'),
        createTestMessage('msg-2', 'New message after sync'),
      ];

      // First load
      mockStoreGet.mockResolvedValueOnce({
        messages: initialMessages,
        timestamp: Date.now(),
      });

      const { result } = renderHook(() => useKanbanChatStore('sync-test-agent'));

      await waitFor(() => {
        expect(result.current.messages.length).toBe(1);
      });

      // Update store and trigger sync event
      mockStoreGet.mockResolvedValueOnce({
        messages: updatedMessages,
        timestamp: Date.now(),
      });

      // Simulate sync event
      const syncListener = mockListeners.get('kanban:chat-state-sync');
      expect(syncListener).toBeDefined();

      await act(async () => {
        syncListener?.({ payload: {} });
        // Wait for async reload
        await new Promise(resolve => setTimeout(resolve, 50));
      });

      await waitFor(() => {
        expect(result.current.messages.length).toBe(2);
      });
    });
  });

  describe('Agent ID Changes', () => {
    it('should reload messages when agentId changes', async () => {
      const agent1Messages = [createTestMessage('agent1-msg', 'Agent 1 content')];
      const agent2Messages = [createTestMessage('agent2-msg', 'Agent 2 content')];

      mockStoreGet
        .mockResolvedValueOnce({ messages: agent1Messages, timestamp: Date.now() })
        .mockResolvedValueOnce({ messages: agent2Messages, timestamp: Date.now() });

      const { result, rerender } = renderHook(
        ({ agentId }) => useKanbanChatStore(agentId),
        { initialProps: { agentId: 'agent-1' as string | null } }
      );

      await waitFor(() => {
        expect(result.current.messages[0]?.id).toBe('agent1-msg');
      });

      // Change agent
      rerender({ agentId: 'agent-2' });

      await waitFor(() => {
        expect(result.current.messages[0]?.id).toBe('agent2-msg');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle store load errors gracefully', async () => {
      mockStoreGet.mockRejectedValue(new Error('Store access failed'));

      const { result } = renderHook(() => useKanbanChatStore('error-agent'));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.messages).toEqual([]);
      expect(result.current.error).toBe('Store access failed');
    });
  });

  describe('Manual Reload', () => {
    it('should provide reload function that refreshes messages', async () => {
      const initialMessages = [createTestMessage('msg-1', 'Initial')];
      const refreshedMessages = [
        createTestMessage('msg-1', 'Initial'),
        createTestMessage('msg-2', 'Added after manual reload'),
      ];

      mockStoreGet
        .mockResolvedValueOnce({ messages: initialMessages, timestamp: Date.now() })
        .mockResolvedValueOnce({ messages: refreshedMessages, timestamp: Date.now() });

      const { result } = renderHook(() => useKanbanChatStore('reload-test'));

      await waitFor(() => {
        expect(result.current.messages.length).toBe(1);
      });

      // Call reload
      await act(async () => {
        await result.current.reload();
      });

      await waitFor(() => {
        expect(result.current.messages.length).toBe(2);
      });
    });
  });
});

describe('KanbanChatDrawer Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListeners.clear();
  });

  it('should display complete message content (not truncated)', async () => {
    // This test verifies the fix for the bug where messages were truncated
    // to 200 chars with "..." appended

    const fullContent = LONG_CONTENT;

    mockStoreGet.mockResolvedValue({
      messages: [
        createTestMessage('user-1', 'Implement the feature', 'user'),
        createTestMessage('assistant-1', fullContent),
      ],
      timestamp: Date.now(),
    });

    const { result } = renderHook(() => useKanbanChatStore('drawer-test'));

    await waitFor(() => {
      expect(result.current.messages.length).toBe(2);
    });

    const assistantMessage = result.current.messages[1];

    // Key assertions for the bug fix:
    // 1. Content should be complete (not truncated)
    expect(assistantMessage.content).toBe(fullContent);

    // 2. Content should be longer than 200 chars (sync limit)
    expect(assistantMessage.content.length).toBeGreaterThan(200);

    // 3. Content should NOT end with "..." (truncation indicator)
    expect(assistantMessage.content).not.toMatch(/\.\.\.$/);

    // 4. All sections should be present
    expect(assistantMessage.content).toContain('# Implementation Plan');
    expect(assistantMessage.content).toContain('## Code Example');
    expect(assistantMessage.content).toContain('## Next Steps');
    expect(assistantMessage.content).toContain('function example()');
  });
});
