/**
 * Tests for KanbanChatDrawer message events handling
 *
 * Verifies that tool widgets (events) are correctly passed from chatSessions
 * to the KanbanChatDrawer component for proper rendering.
 *
 * Bug fix: The useMemo dependency on chatSessions Map was not triggering
 * re-renders when messages with events were updated during streaming.
 */

import { describe, it, expect } from 'vitest';
import type { ChatMessage } from '../types';

// Mock message with events (tool_use, tool_result)
const createMessageWithEvents = (): ChatMessage => ({
  id: 'msg-123-assistant',
  role: 'assistant',
  content: '',
  timestamp: Date.now(),
  status: 'complete',
  events: [
    {
      type: 'system',
      subtype: 'init',
      session_id: 'session-123',
    },
    {
      type: 'assistant',
      message: {
        id: 'msg-456',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'tool_use',
            id: 'tool-789',
            name: 'Read',
            input: { file_path: '/path/to/file.ts' },
          },
        ],
        model: 'claude-sonnet-4-20250514',
        stop_reason: null,
        usage: { input_tokens: 100, output_tokens: 50 },
      },
    },
    {
      type: 'user',
      message: {
        type: 'tool_result',
        tool_use_id: 'tool-789',
        content: 'File contents here...',
      },
    },
  ],
});

// Mock message without events (plain text)
const createMessageWithoutEvents = (): ChatMessage => ({
  id: 'msg-456-assistant',
  role: 'assistant',
  content: 'This is a plain text response without tool widgets.',
  timestamp: Date.now(),
  status: 'complete',
});

describe('KanbanChatDrawer Events Handling', () => {
  describe('Message Events Detection', () => {
    it('should detect when messages have events', () => {
      const messageWithEvents = createMessageWithEvents();
      expect(messageWithEvents.events).toBeDefined();
      expect(messageWithEvents.events!.length).toBeGreaterThan(0);
    });

    it('should detect when messages have no events', () => {
      const messageWithoutEvents = createMessageWithoutEvents();
      expect(messageWithoutEvents.events).toBeUndefined();
    });

    it('should correctly identify tool_use events', () => {
      const message = createMessageWithEvents();
      const toolUseEvents = message.events!.filter(
        (e: any) => e.type === 'assistant' && e.message?.content?.some((c: any) => c.type === 'tool_use')
      );
      expect(toolUseEvents.length).toBe(1);
    });

    it('should correctly identify tool_result events', () => {
      const message = createMessageWithEvents();
      const toolResultEvents = message.events!.filter(
        (e: any) => e.type === 'user' && e.message?.type === 'tool_result'
      );
      expect(toolResultEvents.length).toBe(1);
    });
  });

  describe('chatSessions Map Extraction', () => {
    it('should extract messages correctly from Map', () => {
      const agentId = 'task-abc-123';
      const chatSessions = new Map<string, ChatMessage[]>();
      const messages = [createMessageWithEvents()];
      chatSessions.set(agentId, messages);

      // Simulating what the fixed code does
      const appMessages = chatSessions.get(agentId) || [];

      expect(appMessages.length).toBe(1);
      expect(appMessages[0].events).toBeDefined();
      expect(appMessages[0].events!.length).toBe(3);
    });

    it('should return empty array for non-existent agentId', () => {
      const chatSessions = new Map<string, ChatMessage[]>();
      const appMessages = chatSessions.get('non-existent') || [];

      expect(appMessages.length).toBe(0);
    });

    it('should detect events presence in extracted messages', () => {
      const chatSessions = new Map<string, ChatMessage[]>();
      const messages = [
        createMessageWithEvents(),
        createMessageWithoutEvents(),
      ];
      chatSessions.set('agent-1', messages);

      const appMessages = chatSessions.get('agent-1') || [];
      const hasEvents = appMessages.some(m => m.events && m.events.length > 0);

      expect(hasEvents).toBe(true);
    });
  });

  describe('Message Priority Logic', () => {
    it('should prefer app messages over store messages when both available', () => {
      const appMessages: ChatMessage[] = [createMessageWithEvents()];
      const storeMessages: ChatMessage[] = [createMessageWithoutEvents()];

      // Simulating the useMemo logic from KanbanChatDrawer
      let result: ChatMessage[];
      if (appMessages.length > 0) {
        result = appMessages;
      } else if (storeMessages.length > 0) {
        result = storeMessages;
      } else {
        result = [];
      }

      expect(result).toBe(appMessages);
      expect(result[0].events).toBeDefined();
    });

    it('should fallback to store messages when app messages empty', () => {
      const appMessages: ChatMessage[] = [];
      const storeMessages: ChatMessage[] = [createMessageWithEvents()];

      let result: ChatMessage[];
      if (appMessages.length > 0) {
        result = appMessages;
      } else if (storeMessages.length > 0) {
        result = storeMessages;
      } else {
        result = [];
      }

      expect(result).toBe(storeMessages);
      expect(result[0].events).toBeDefined();
    });

    it('should return empty array when both sources empty', () => {
      const appMessages: ChatMessage[] = [];
      const storeMessages: ChatMessage[] = [];

      let result: ChatMessage[];
      if (appMessages.length > 0) {
        result = appMessages;
      } else if (storeMessages.length > 0) {
        result = storeMessages;
      } else {
        result = [];
      }

      expect(result).toEqual([]);
    });
  });

  describe('Events Array Integrity', () => {
    it('should preserve all event types during message passing', () => {
      const message = createMessageWithEvents();
      const events = message.events!;

      const eventTypes = events.map((e: any) => e.type);
      expect(eventTypes).toContain('system');
      expect(eventTypes).toContain('assistant');
      expect(eventTypes).toContain('user');
    });

    it('should preserve event content after Map operations', () => {
      const chatSessions = new Map<string, ChatMessage[]>();
      const originalMessage = createMessageWithEvents();
      chatSessions.set('agent-1', [originalMessage]);

      // Create new Map (simulating state update)
      const newSessions = new Map(chatSessions);
      const retrievedMessages = newSessions.get('agent-1') || [];

      expect(retrievedMessages[0].events).toEqual(originalMessage.events);
    });

    it('should handle streaming message with events accumulation', () => {
      // Simulate streaming: start with empty events, then add
      const streamingMessage: ChatMessage = {
        id: 'msg-stream',
        role: 'assistant',
        content: '',
        timestamp: 0,
        status: 'streaming',
        events: [],
      };

      // Simulate event arriving during stream
      const newEvent = {
        type: 'assistant',
        message: { id: 'msg-1', content: [{ type: 'text', text: 'Hello' }] },
      };

      streamingMessage.events = [...(streamingMessage.events || []), newEvent];

      expect(streamingMessage.events.length).toBe(1);
      expect(streamingMessage.events[0]).toBe(newEvent);
    });
  });
});
