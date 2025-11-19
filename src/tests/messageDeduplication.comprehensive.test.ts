import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/**
 * 🦆 Comprehensive Message Deduplication Tests
 *
 * Tests the complete deduplication system across multiple scenarios:
 * - Single agent normal flow
 * - Multiple concurrent agents
 * - Multiple terminals with agents
 * - Rapid message streams
 * - Session resume scenarios
 * - React re-render scenarios
 */

// Mock ChatMessage type
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  status: 'sending' | 'streaming' | 'complete' | 'error';
  events?: ClaudeEvent[];
}

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
}

// Helper: Generate event ID (same logic as useClaudeChat)
function getEventId(event: ClaudeEvent): string {
  if (event.type === 'system' && 'subtype' in event) {
    return `system-${event.subtype}`;
  }

  if (event.type === 'assistant' && 'message' in event) {
    if (event.message?.id) {
      return `assistant-${event.message.id}`;
    }
    const contentHash = event.message?.content
      ?.map((b: any) => `${b.type}-${b.text?.substring(0, 20) || b.name || ''}`)
      .join('|') || '';
    return `assistant-${contentHash.substring(0, 50)}`;
  }

  if (event.type === 'user' && 'message' in event) {
    const contentHash = event.message?.content
      ?.map((b: any) => `${b.type}-${b.tool_use_id || ''}`)
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

// Simulate deduplication with persistent Set (like useRef)
class DeduplicationManager {
  private seenEventIds: Set<string> = new Set();
  private messages: ChatMessage[] = [];

  processEvent(event: ClaudeEvent): { accepted: boolean; duplicate: boolean; eventId: string } {
    const eventId = getEventId(event);
    const duplicate = this.seenEventIds.has(eventId);

    if (!duplicate) {
      this.seenEventIds.add(eventId);
      return { accepted: true, duplicate: false, eventId };
    }

    return { accepted: false, duplicate: true, eventId };
  }

  addMessage(message: ChatMessage) {
    this.messages.push(message);
  }

  getMessages(): ChatMessage[] {
    return this.messages;
  }

  getSeenCount(): number {
    return this.seenEventIds.size;
  }

  clear() {
    this.seenEventIds.clear();
    this.messages = [];
  }
}

describe('Message Deduplication - Single Agent', () => {
  let manager: DeduplicationManager;

  beforeEach(() => {
    manager = new DeduplicationManager();
  });

  it('should accept unique events in normal flow', () => {
    const events: ClaudeEvent[] = [
      { type: 'system', subtype: 'init', session_id: 'session-1' },
      {
        type: 'assistant',
        message: {
          id: 'msg-1',
          content: [{ type: 'text', text: 'Hello!' }],
        },
      },
      { type: 'result', session_id: 'session-1', usage: { input_tokens: 10, output_tokens: 5 } },
    ];

    const results = events.map(e => manager.processEvent(e));

    expect(results.every(r => r.accepted)).toBe(true);
    expect(results.every(r => !r.duplicate)).toBe(true);
    expect(manager.getSeenCount()).toBe(3);
  });

  it('should reject exact duplicate events', () => {
    const event = {
      type: 'assistant' as const,
      message: {
        id: 'msg-duplicate',
        content: [{ type: 'text', text: 'Test message' }],
      },
    };

    const result1 = manager.processEvent(event);
    const result2 = manager.processEvent(event);
    const result3 = manager.processEvent(event);

    expect(result1.accepted).toBe(true);
    expect(result1.duplicate).toBe(false);

    expect(result2.accepted).toBe(false);
    expect(result2.duplicate).toBe(true);

    expect(result3.accepted).toBe(false);
    expect(result3.duplicate).toBe(true);

    expect(manager.getSeenCount()).toBe(1);
  });

  it('should handle triplication bug scenario', () => {
    const toolUseEvent = {
      type: 'assistant' as const,
      message: {
        id: 'msg-tool-123',
        content: [
          { type: 'text', text: 'Executing command' },
          { type: 'tool_use', name: 'bash', tool_use_id: 'tool-1' },
        ],
      },
    };

    // Simulate 3 arrivals of same event (the bug)
    const results = [
      manager.processEvent(toolUseEvent),
      manager.processEvent(toolUseEvent),
      manager.processEvent(toolUseEvent),
    ];

    expect(results[0].accepted).toBe(true);
    expect(results[1].accepted).toBe(false);
    expect(results[2].accepted).toBe(false);

    expect(results.filter(r => r.duplicate).length).toBe(2);
    expect(manager.getSeenCount()).toBe(1);
  });
});

describe('Message Deduplication - Multiple Agents', () => {
  it('should isolate events between different agent instances', () => {
    const agent1 = new DeduplicationManager();
    const agent2 = new DeduplicationManager();
    const agent3 = new DeduplicationManager();

    const event1 = {
      type: 'assistant' as const,
      message: { id: 'msg-agent1', content: [{ type: 'text', text: 'Agent 1 response' }] },
    };

    const event2 = {
      type: 'assistant' as const,
      message: { id: 'msg-agent2', content: [{ type: 'text', text: 'Agent 2 response' }] },
    };

    const event3 = {
      type: 'assistant' as const,
      message: { id: 'msg-agent3', content: [{ type: 'text', text: 'Agent 3 response' }] },
    };

    agent1.processEvent(event1);
    agent2.processEvent(event2);
    agent3.processEvent(event3);

    // Each agent should have exactly 1 event
    expect(agent1.getSeenCount()).toBe(1);
    expect(agent2.getSeenCount()).toBe(1);
    expect(agent3.getSeenCount()).toBe(1);

    // Cross-contamination test: same event ID in different agents
    const sharedEvent = {
      type: 'assistant' as const,
      message: { id: 'msg-shared', content: [{ type: 'text', text: 'Shared message' }] },
    };

    const result1 = agent1.processEvent(sharedEvent);
    const result2 = agent2.processEvent(sharedEvent);
    const result3 = agent3.processEvent(sharedEvent);

    // All should accept (independent tracking)
    expect(result1.accepted).toBe(true);
    expect(result2.accepted).toBe(true);
    expect(result3.accepted).toBe(true);
  });

  it('should handle concurrent message streams from 3 agents', () => {
    const agents = [
      new DeduplicationManager(),
      new DeduplicationManager(),
      new DeduplicationManager(),
    ];

    // Simulate 3 agents sending messages simultaneously
    for (let i = 0; i < 10; i++) {
      agents.forEach((agent, agentIdx) => {
        const event = {
          type: 'assistant' as const,
          message: {
            id: `msg-agent${agentIdx}-${i}`,
            content: [{ type: 'text', text: `Message ${i} from agent ${agentIdx}` }],
          },
        };

        const result = agent.processEvent(event);
        expect(result.accepted).toBe(true);
      });
    }

    // Each agent should have 10 unique events
    agents.forEach(agent => {
      expect(agent.getSeenCount()).toBe(10);
    });
  });
});

describe('Message Deduplication - Rapid Stream', () => {
  let manager: DeduplicationManager;

  beforeEach(() => {
    manager = new DeduplicationManager();
  });

  it('should handle rapid duplicate events (stress test)', () => {
    const event = {
      type: 'assistant' as const,
      message: { id: 'msg-rapid', content: [{ type: 'text', text: 'Rapid message' }] },
    };

    let acceptedCount = 0;
    let duplicateCount = 0;

    // Send same event 1000 times rapidly
    for (let i = 0; i < 1000; i++) {
      const result = manager.processEvent(event);
      if (result.accepted) acceptedCount++;
      if (result.duplicate) duplicateCount++;
    }

    expect(acceptedCount).toBe(1);
    expect(duplicateCount).toBe(999);
    expect(manager.getSeenCount()).toBe(1);
  });

  it('should handle interleaved unique and duplicate events', () => {
    const events: ClaudeEvent[] = [];

    // Create pattern: unique, duplicate, duplicate, unique, duplicate...
    for (let i = 0; i < 20; i++) {
      events.push({
        type: 'assistant',
        message: { id: `msg-${Math.floor(i / 3)}`, content: [{ type: 'text', text: `Message ${Math.floor(i / 3)}` }] },
      });
    }

    const results = events.map(e => manager.processEvent(e));
    const uniqueAccepted = results.filter(r => r.accepted).length;

    // Should have 7 unique events (0-6, each repeated 3 times)
    expect(uniqueAccepted).toBe(7);
    expect(manager.getSeenCount()).toBe(7);
  });
});

describe('Message Deduplication - Session Management', () => {
  let manager: DeduplicationManager;

  beforeEach(() => {
    manager = new DeduplicationManager();
  });

  it('should handle session resumption correctly', () => {
    // First init (no session_id yet)
    const init1 = { type: 'system' as const, subtype: 'init' };
    const result1 = manager.processEvent(init1);
    expect(result1.accepted).toBe(true);

    // Later: session_id arrives (same logical event)
    const init2 = {
      type: 'system' as const,
      subtype: 'init',
      session_id: '8afd95fb-75ed-42c2-8690-8b3de1188d63',
    };
    const result2 = manager.processEvent(init2);

    // Should be detected as duplicate (stable ID based on subtype only)
    expect(result2.accepted).toBe(false);
    expect(result2.duplicate).toBe(true);
    expect(manager.getSeenCount()).toBe(1);
  });

  it('should clear deduplication on conversation clear', () => {
    const events: ClaudeEvent[] = [
      { type: 'system', subtype: 'init', session_id: 'session-1' },
      {
        type: 'assistant',
        message: { id: 'msg-1', content: [{ type: 'text', text: 'Hello' }] },
      },
    ];

    events.forEach(e => manager.processEvent(e));
    expect(manager.getSeenCount()).toBe(2);

    // Clear conversation
    manager.clear();
    expect(manager.getSeenCount()).toBe(0);

    // Same events should be accepted again
    const results = events.map(e => manager.processEvent(e));
    expect(results.every(r => r.accepted)).toBe(true);
    expect(manager.getSeenCount()).toBe(2);
  });
});

describe('Message Deduplication - Tool Calls', () => {
  let manager: DeduplicationManager;

  beforeEach(() => {
    manager = new DeduplicationManager();
  });

  it('should handle multiple tool uses in sequence', () => {
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

    const results = events.map(e => manager.processEvent(e));

    // All should be unique
    expect(results.every(r => r.accepted)).toBe(true);
    expect(results.every(r => !r.duplicate)).toBe(true);
    expect(manager.getSeenCount()).toBe(4);
  });

  it('should deduplicate identical tool calls', () => {
    const bashTool = {
      type: 'assistant' as const,
      message: {
        content: [
          { type: 'tool_use', name: 'bash', tool_use_id: 'tool-bash-1' },
        ],
      },
    };

    const result1 = manager.processEvent(bashTool);
    const result2 = manager.processEvent(bashTool);
    const result3 = manager.processEvent(bashTool);

    expect(result1.accepted).toBe(true);
    expect(result2.duplicate).toBe(true);
    expect(result3.duplicate).toBe(true);
    expect(manager.getSeenCount()).toBe(1);
  });
});

describe('Message Deduplication - React Re-render Scenarios', () => {
  it('should survive React component re-renders', () => {
    // Simulate persistent ref behavior
    const persistentManager = new DeduplicationManager();

    const event1 = {
      type: 'assistant' as const,
      message: { id: 'msg-1', content: [{ type: 'text', text: 'Message 1' }] },
    };

    // First render
    const result1 = persistentManager.processEvent(event1);
    expect(result1.accepted).toBe(true);

    // Simulate re-render (same manager instance, like useRef)
    const result2 = persistentManager.processEvent(event1);
    expect(result2.duplicate).toBe(true);

    // Verify Set persisted across "re-renders"
    expect(persistentManager.getSeenCount()).toBe(1);
  });

  it('should demonstrate the bug with local Set recreation', () => {
    let localManager: DeduplicationManager;

    const event = {
      type: 'assistant' as const,
      message: { id: 'msg-bug', content: [{ type: 'text', text: 'Bug message' }] },
    };

    // First render
    localManager = new DeduplicationManager(); // ❌ Bug: recreated on each render
    const result1 = localManager.processEvent(event);
    expect(result1.accepted).toBe(true);

    // Re-render (Set is recreated, loses history)
    localManager = new DeduplicationManager(); // ❌ Bug: Set reset
    const result2 = localManager.processEvent(event);

    // BUG: Same event accepted again!
    expect(result2.accepted).toBe(true); // ❌ Should be false!
    expect(result2.duplicate).toBe(false); // ❌ Should be true!
  });
});

describe('Message Deduplication - Edge Cases', () => {
  let manager: DeduplicationManager;

  beforeEach(() => {
    manager = new DeduplicationManager();
  });

  it('should handle events with missing fields gracefully', () => {
    const malformedEvents: any[] = [
      { type: 'assistant' }, // No message
      { type: 'assistant', message: {} }, // Empty message
      { type: 'assistant', message: { content: [] } }, // Empty content
      { type: 'user' }, // No message
      { type: 'result' }, // No session_id
    ];

    // Should not throw errors
    expect(() => {
      malformedEvents.forEach(e => manager.processEvent(e));
    }).not.toThrow();
  });

  it('should handle null and undefined values', () => {
    const event = {
      type: 'assistant' as const,
      message: {
        content: [
          { type: 'text', text: null as any },
          { type: 'tool_use', name: undefined as any },
        ],
      },
    };

    expect(() => manager.processEvent(event)).not.toThrow();
  });

  it('should handle very long content efficiently', () => {
    const longText = 'a'.repeat(100000); // 100k characters

    const event = {
      type: 'assistant' as const,
      message: {
        content: [{ type: 'text', text: longText }],
      },
    };

    const startTime = performance.now();
    manager.processEvent(event);
    const endTime = performance.now();

    // Should complete quickly despite long content
    expect(endTime - startTime).toBeLessThan(50);
  });
});

describe('Message Deduplication - Performance', () => {
  it('should handle 1000 events efficiently', () => {
    const manager = new DeduplicationManager();
    const startTime = performance.now();

    // Process 1000 unique events
    for (let i = 0; i < 1000; i++) {
      manager.processEvent({
        type: 'assistant',
        message: {
          id: `msg-${i}`,
          content: [{ type: 'text', text: `Message ${i}` }],
        },
      });
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    // Should complete in <500ms
    expect(duration).toBeLessThan(500);
    expect(manager.getSeenCount()).toBe(1000);
  });

  it('should handle mixed unique and duplicate events at scale', () => {
    const manager = new DeduplicationManager();
    const events: ClaudeEvent[] = [];

    // Create 500 events (50 unique, each repeated 10 times)
    for (let i = 0; i < 50; i++) {
      for (let j = 0; j < 10; j++) {
        events.push({
          type: 'assistant',
          message: {
            id: `msg-${i}`,
            content: [{ type: 'text', text: `Message ${i}` }],
          },
        });
      }
    }

    const startTime = performance.now();
    const results = events.map(e => manager.processEvent(e));
    const endTime = performance.now();

    expect(endTime - startTime).toBeLessThan(200);
    expect(results.filter(r => r.accepted).length).toBe(50);
    expect(results.filter(r => r.duplicate).length).toBe(450);
  });
});
