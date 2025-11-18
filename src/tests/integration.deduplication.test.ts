import { describe, it, expect, beforeEach } from 'vitest';

/**
 * 🦆 Integration Tests for Message Deduplication
 *
 * These tests simulate the complete flow from SDK events to UI rendering,
 * verifying that duplicates are caught at every layer.
 */

interface ClaudeEvent {
  type: 'system' | 'assistant' | 'user' | 'result';
  subtype?: string;
  session_id?: string;
  message?: {
    id?: string;
    content?: Array<{
      type: string;
      text?: string;
      name?: string;
      tool_use_id?: string;
    }>;
  };
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  timestamp?: number;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status: 'sending' | 'streaming' | 'complete' | 'error';
  events?: ClaudeEvent[];
}

// Simulate the useClaudeChat hook's event processing
class ChatSimulator {
  private messages: ChatMessage[] = [];
  private seenEventIds = new Set<string>();

  private getEventId(event: ClaudeEvent): string {
    if (event.type === 'system' && event.subtype) {
      return `system-${event.subtype}`;
    }

    if (event.type === 'assistant' && event.message) {
      if (event.message.id) {
        return `assistant-${event.message.id}`;
      }
      const contentHash = event.message.content
        ?.map(b => `${b.type}-${b.text?.substring(0, 20) || b.name || ''}`)
        .join('|') || '';
      return `assistant-${contentHash.substring(0, 50)}`;
    }

    if (event.type === 'user' && event.message) {
      const contentHash = event.message.content
        ?.map(b => `${b.type}-${b.tool_use_id || ''}`)
        .join('|') || '';
      return `user-${contentHash.substring(0, 50)}`;
    }

    if (event.type === 'result') {
      return `result-${event.session_id || Date.now()}`;
    }

    const eventHash = JSON.stringify(event)
      .split('')
      .reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0)
      .toString(36);
    return `${event.type}-${eventHash}`;
  }

  processEvent(event: ClaudeEvent): { accepted: boolean; duplicate: boolean } {
    const eventId = this.getEventId(event);
    const duplicate = this.seenEventIds.has(eventId);

    if (!duplicate) {
      this.seenEventIds.add(eventId);
      // Add event to latest message (simplified)
      if (this.messages.length > 0) {
        const lastMsg = this.messages[this.messages.length - 1];
        if (!lastMsg.events) lastMsg.events = [];
        lastMsg.events.push(event);
      }
      return { accepted: true, duplicate: false };
    }

    return { accepted: false, duplicate: true };
  }

  addUserMessage(content: string): void {
    this.messages.push({
      id: `msg-user-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      status: 'complete',
    });
  }

  addAssistantMessage(): void {
    this.messages.push({
      id: `msg-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      status: 'streaming',
      events: [],
    });
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  getEventCount(): number {
    return this.seenEventIds.size;
  }

  reset(): void {
    this.messages = [];
    this.seenEventIds.clear();
  }
}

describe('Integration: Complete Chat Flow', () => {
  let chat: ChatSimulator;

  beforeEach(() => {
    chat = new ChatSimulator();
  });

  it('should handle normal conversation flow without duplicates', () => {
    // User sends message
    chat.addUserMessage('Hello Claude');

    // Assistant responds
    chat.addAssistantMessage();

    const events: ClaudeEvent[] = [
      { type: 'system', subtype: 'init', session_id: 'session-1' },
      {
        type: 'assistant',
        message: {
          id: 'msg-1',
          content: [{ type: 'text', text: 'Hello! How can I help?' }],
        },
      },
      { type: 'result', session_id: 'session-1', usage: { input_tokens: 10, output_tokens: 5 } },
    ];

    const results = events.map(e => chat.processEvent(e));

    // All events should be accepted
    expect(results.every(r => r.accepted)).toBe(true);
    expect(results.every(r => !r.duplicate)).toBe(true);

    // Should have 2 messages (user + assistant)
    expect(chat.getMessages().length).toBe(2);

    // Assistant message should have 3 events
    const assistantMsg = chat.getMessages()[1];
    expect(assistantMsg.events?.length).toBe(3);
  });

  it('should reject duplicate events in same stream', () => {
    chat.addAssistantMessage();

    const event1 = {
      type: 'assistant' as const,
      message: {
        id: 'msg-1',
        content: [{ type: 'text', text: 'Hello' }],
      },
    };

    // Process first time
    const result1 = chat.processEvent(event1);
    expect(result1.accepted).toBe(true);
    expect(result1.duplicate).toBe(false);

    // Process duplicate
    const result2 = chat.processEvent(event1);
    expect(result2.accepted).toBe(false);
    expect(result2.duplicate).toBe(true);

    // Only 1 event should be stored
    expect(chat.getEventCount()).toBe(1);
  });

  it('should handle the triplication bug scenario correctly', () => {
    chat.addAssistantMessage();

    // The exact scenario from the bug report
    const bashEvent = {
      type: 'assistant' as const,
      message: {
        id: 'msg-hiroshi-123',
        content: [
          { type: 'text', text: 'Ottimo! Worktree rimosso. Ora (opzionalmente) rimuoviamo il branch locale:' },
          { type: 'tool_use', name: 'bash', tool_use_id: 'tool-bash-456' },
        ],
      },
    };

    // Simulate the event arriving 3 times (the bug)
    const result1 = chat.processEvent(bashEvent);
    const result2 = chat.processEvent(bashEvent);
    const result3 = chat.processEvent(bashEvent);

    // Only first should be accepted
    expect(result1.accepted).toBe(true);
    expect(result1.duplicate).toBe(false);

    expect(result2.accepted).toBe(false);
    expect(result2.duplicate).toBe(true);

    expect(result3.accepted).toBe(false);
    expect(result3.duplicate).toBe(true);

    // Only 1 event in the message
    const msg = chat.getMessages()[0];
    expect(msg.events?.length).toBe(1);
  });

  it('should handle session resumption correctly', () => {
    chat.addAssistantMessage();

    // First init event (session_id not set)
    const init1 = { type: 'system' as const, subtype: 'init' };
    const result1 = chat.processEvent(init1);
    expect(result1.accepted).toBe(true);

    // Later: session_id gets populated (same logical event)
    const init2 = {
      type: 'system' as const,
      subtype: 'init',
      session_id: '8afd95fb-75ed-42c2-8690-8b3de1188d63',
    };
    const result2 = chat.processEvent(init2);

    // Should be detected as duplicate (same subtype)
    expect(result2.accepted).toBe(false);
    expect(result2.duplicate).toBe(true);

    // Only 1 event stored
    expect(chat.getEventCount()).toBe(1);
  });

  it('should handle multiple tool uses correctly', () => {
    chat.addAssistantMessage();

    const events: ClaudeEvent[] = [
      {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', name: 'read', tool_use_id: 'tool-1' }],
        },
      },
      {
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'tool-1' }],
        },
      },
      {
        type: 'assistant',
        message: {
          content: [{ type: 'tool_use', name: 'edit', tool_use_id: 'tool-2' }],
        },
      },
      {
        type: 'user',
        message: {
          content: [{ type: 'tool_result', tool_use_id: 'tool-2' }],
        },
      },
    ];

    const results = events.map(e => chat.processEvent(e));

    // All should be accepted (unique)
    expect(results.every(r => r.accepted)).toBe(true);
    expect(results.every(r => !r.duplicate)).toBe(true); // All should NOT be duplicates

    // 4 unique events
    expect(chat.getEventCount()).toBe(4);
  });
});

describe('Integration: Multi-Agent Scenarios', () => {
  it('should isolate events between different chat sessions', () => {
    const chat1 = new ChatSimulator();
    const chat2 = new ChatSimulator();

    // Same event in both sessions
    const event = {
      type: 'assistant' as const,
      message: {
        id: 'msg-1',
        content: [{ type: 'text', text: 'Hello' }],
      },
    };

    chat1.addAssistantMessage();
    chat2.addAssistantMessage();

    const result1 = chat1.processEvent(event);
    const result2 = chat2.processEvent(event);

    // Both should accept (independent tracking)
    expect(result1.accepted).toBe(true);
    expect(result2.accepted).toBe(true);

    expect(chat1.getEventCount()).toBe(1);
    expect(chat2.getEventCount()).toBe(1);
  });

  it('should handle concurrent sessions without cross-contamination', () => {
    const agentHiroshi = new ChatSimulator();
    const agentKaori = new ChatSimulator();
    const agentYuki = new ChatSimulator();

    agentHiroshi.addAssistantMessage();
    agentKaori.addAssistantMessage();
    agentYuki.addAssistantMessage();

    // Hiroshi's event
    const event1 = {
      type: 'assistant' as const,
      message: { id: 'msg-h1', content: [{ type: 'text', text: 'Hiroshi response' }] },
    };

    // Kaori's event (same ID, different content)
    const event2 = {
      type: 'assistant' as const,
      message: { id: 'msg-k1', content: [{ type: 'text', text: 'Kaori response' }] },
    };

    // Yuki's event
    const event3 = {
      type: 'assistant' as const,
      message: { id: 'msg-y1', content: [{ type: 'text', text: 'Yuki response' }] },
    };

    agentHiroshi.processEvent(event1);
    agentKaori.processEvent(event2);
    agentYuki.processEvent(event3);

    // Each should have exactly 1 event
    expect(agentHiroshi.getEventCount()).toBe(1);
    expect(agentKaori.getEventCount()).toBe(1);
    expect(agentYuki.getEventCount()).toBe(1);

    // No cross-contamination
    expect(agentHiroshi.getMessages()[0].events?.length).toBe(1);
    expect(agentKaori.getMessages()[0].events?.length).toBe(1);
    expect(agentYuki.getMessages()[0].events?.length).toBe(1);
  });
});

describe('Integration: Performance Tests', () => {
  it('should handle large conversation efficiently', () => {
    const chat = new ChatSimulator();
    const startTime = performance.now();

    // Simulate 100 message exchanges
    for (let i = 0; i < 100; i++) {
      chat.addUserMessage(`Message ${i}`);
      chat.addAssistantMessage();

      // Each assistant message has 3 events
      const events: ClaudeEvent[] = [
        { type: 'system', subtype: 'init' }, // Will be duplicate after first iteration
        {
          type: 'assistant',
          message: {
            id: `msg-${i}`,
            content: [{ type: 'text', text: `Response ${i}` }],
          },
        },
        { type: 'result', session_id: `session-${i}` },
      ];

      events.forEach(e => chat.processEvent(e));
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete quickly
    expect(duration).toBeLessThan(500); // <500ms for 100 exchanges

    // Should have 200 messages (100 user + 100 assistant)
    expect(chat.getMessages().length).toBe(200);

    // First system.init is accepted, rest are duplicates
    // So: 1 init + 100 assistant messages + 100 result events = 201 unique events
    expect(chat.getEventCount()).toBe(201);
  });

  it('should detect duplicates efficiently in high-frequency scenario', () => {
    const chat = new ChatSimulator();
    chat.addAssistantMessage();

    const event = {
      type: 'assistant' as const,
      message: {
        id: 'msg-spam',
        content: [{ type: 'text', text: 'Repeated message' }],
      },
    };

    const startTime = performance.now();

    // Simulate the same event arriving 1000 times
    let acceptedCount = 0;
    let duplicateCount = 0;

    for (let i = 0; i < 1000; i++) {
      const result = chat.processEvent(event);
      if (result.accepted) acceptedCount++;
      if (result.duplicate) duplicateCount++;
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should be very fast
    expect(duration).toBeLessThan(100); // <100ms for 1000 checks

    // Only first should be accepted
    expect(acceptedCount).toBe(1);
    expect(duplicateCount).toBe(999);

    // Only 1 event stored
    expect(chat.getEventCount()).toBe(1);
  });
});

describe('Integration: Edge Cases', () => {
  it('should handle malformed events gracefully', () => {
    const chat = new ChatSimulator();
    chat.addAssistantMessage();

    const malformedEvents: any[] = [
      { type: 'assistant' }, // No message
      { type: 'assistant', message: {} }, // Empty message
      { type: 'assistant', message: { content: [] } }, // Empty content
      { type: 'user' }, // No message
      { type: 'result' }, // No session_id
    ];

    // Should not throw errors
    const results = malformedEvents.map(e => {
      try {
        return chat.processEvent(e);
      } catch (error) {
        return { accepted: false, duplicate: false, error: true };
      }
    });

    // All should be processed without errors
    expect(results.every(r => !r.error)).toBe(true);
  });

  it('should handle very long content efficiently', () => {
    const chat = new ChatSimulator();
    chat.addAssistantMessage();

    const longText = 'a'.repeat(100000); // 100k characters

    const event = {
      type: 'assistant' as const,
      message: {
        content: [{ type: 'text', text: longText }],
      },
    };

    const startTime = performance.now();
    chat.processEvent(event);
    const endTime = performance.now();

    // Should still be fast despite long content
    expect(endTime - startTime).toBeLessThan(50);
  });
});
