import { describe, it, expect } from 'vitest';

/**
 * 🦆 Event Deduplication Tests
 *
 * These tests verify that our event deduplication logic works correctly
 * to prevent duplicate messages in the chat UI.
 */

// Helper function to generate event ID (extracted from useClaudeChat.ts)
function getEventId(event: any): string {
  // For system events: use subtype only (session_id might not be set yet)
  if (event.type === 'system' && 'subtype' in event) {
    return `system-${event.subtype}`;
  }

  // For assistant events: use message.id if available, otherwise hash content
  if (event.type === 'assistant' && 'message' in event) {
    if (event.message?.id) {
      return `assistant-${event.message.id}`;
    }
    // Fallback: hash the content blocks to detect duplicates
    const contentHash = event.message?.content
      ?.map((b: any) => `${b.type}-${b.text?.substring(0, 20) || b.name || ''}`)
      .join('|') || '';
    return `assistant-${contentHash.substring(0, 50)}`;
  }

  // For user events: hash the tool results content
  if (event.type === 'user' && 'message' in event) {
    const contentHash = event.message?.content
      ?.map((b: any) => `${b.type}-${b.tool_use_id || ''}`)
      .join('|') || '';
    return `user-${contentHash.substring(0, 50)}`;
  }

  // For result events: use session_id if available, otherwise timestamp
  if (event.type === 'result') {
    return `result-${event.session_id || Date.now()}`;
  }

  // Fallback: hash the entire event object
  const eventHash = JSON.stringify(event)
    .split('')
    .reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0)
    .toString(36);
  return `${event.type}-${eventHash}`;
}

describe('Event Deduplication - Event ID Generation', () => {
  it('should generate stable IDs for system events', () => {
    const event1 = {
      type: 'system',
      subtype: 'init',
      session_id: 'session-123',
      timestamp: 1000,
    };

    const event2 = {
      type: 'system',
      subtype: 'init',
      session_id: 'session-456', // Different session ID
      timestamp: 2000, // Different timestamp
    };

    // Same subtype should generate same ID (stable!)
    expect(getEventId(event1)).toBe('system-init');
    expect(getEventId(event2)).toBe('system-init');
    expect(getEventId(event1)).toBe(getEventId(event2));
  });

  it('should generate unique IDs for different system event subtypes', () => {
    const initEvent = { type: 'system', subtype: 'init' };
    const completeEvent = { type: 'system', subtype: 'complete' };

    expect(getEventId(initEvent)).not.toBe(getEventId(completeEvent));
    expect(getEventId(initEvent)).toBe('system-init');
    expect(getEventId(completeEvent)).toBe('system-complete');
  });

  it('should use message.id for assistant events when available', () => {
    const event = {
      type: 'assistant',
      message: {
        id: 'msg-abc123',
        content: [{ type: 'text', text: 'Hello world' }],
      },
    };

    expect(getEventId(event)).toBe('assistant-msg-abc123');
  });

  it('should use content hash for assistant events without message.id', () => {
    const event1 = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Hello world this is a test message' },
        ],
      },
    };

    const event2 = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: 'Hello world this is a test message' },
        ],
      },
    };

    // Same content should generate same hash
    const id1 = getEventId(event1);
    const id2 = getEventId(event2);

    expect(id1).toBe(id2);
    expect(id1).toContain('assistant-');
  });

  it('should generate different IDs for different assistant content', () => {
    const event1 = {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'Message A' }],
      },
    };

    const event2 = {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: 'Message B' }],
      },
    };

    expect(getEventId(event1)).not.toBe(getEventId(event2));
  });

  it('should handle tool_use blocks in assistant events', () => {
    const event = {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', name: 'bash', id: 'tool-123' },
        ],
      },
    };

    const id = getEventId(event);
    expect(id).toContain('assistant-');
    expect(id).toContain('tool_use-bash');
  });

  it('should use tool_use_id for user events', () => {
    const event1 = {
      type: 'user',
      message: {
        content: [
          { type: 'tool_result', tool_use_id: 'tool-123' },
        ],
      },
    };

    const event2 = {
      type: 'user',
      message: {
        content: [
          { type: 'tool_result', tool_use_id: 'tool-123' },
        ],
      },
    };

    // Same tool_use_id should generate same hash
    expect(getEventId(event1)).toBe(getEventId(event2));
  });

  it('should use session_id for result events', () => {
    const event1 = {
      type: 'result',
      session_id: 'session-abc',
      usage: { input_tokens: 100, output_tokens: 50 },
    };

    const event2 = {
      type: 'result',
      session_id: 'session-abc',
      usage: { input_tokens: 200, output_tokens: 100 }, // Different usage
    };

    // Same session_id should generate same ID
    expect(getEventId(event1)).toBe('result-session-abc');
    expect(getEventId(event2)).toBe('result-session-abc');
    expect(getEventId(event1)).toBe(getEventId(event2));
  });
});

describe('Event Deduplication - Duplicate Detection', () => {
  it('should detect duplicate events in a stream', () => {
    const seenEventIds = new Set<string>();

    const events = [
      { type: 'system', subtype: 'init', session_id: 'session-1' },
      { type: 'assistant', message: { id: 'msg-1', content: [] } },
      { type: 'system', subtype: 'init', session_id: 'session-1' }, // DUPLICATE!
      { type: 'assistant', message: { id: 'msg-2', content: [] } },
      { type: 'assistant', message: { id: 'msg-1', content: [] } }, // DUPLICATE!
    ];

    const uniqueEvents: any[] = [];
    const duplicates: any[] = [];

    for (const event of events) {
      const eventId = getEventId(event);

      if (seenEventIds.has(eventId)) {
        duplicates.push(event);
      } else {
        seenEventIds.add(eventId);
        uniqueEvents.push(event);
      }
    }

    expect(uniqueEvents.length).toBe(3); // init, msg-1, msg-2
    expect(duplicates.length).toBe(2); // duplicate init, duplicate msg-1
  });

  it('should handle multiple concurrent sessions without cross-contamination', () => {
    // Session 1
    const session1Events = new Set<string>();
    const event1a = { type: 'system', subtype: 'init' };
    const event1b = { type: 'assistant', message: { id: 'msg-1' } };

    session1Events.add(getEventId(event1a));
    session1Events.add(getEventId(event1b));

    // Session 2 (independent)
    const session2Events = new Set<string>();
    const event2a = { type: 'system', subtype: 'init' }; // Same subtype as session1
    const event2b = { type: 'assistant', message: { id: 'msg-1' } }; // Same ID as session1

    session2Events.add(getEventId(event2a));
    session2Events.add(getEventId(event2b));

    // Both sessions should track the same event IDs independently
    expect(session1Events.size).toBe(2);
    expect(session2Events.size).toBe(2);

    // Event IDs should be identical (content-based)
    expect(getEventId(event1a)).toBe(getEventId(event2a));
    expect(getEventId(event1b)).toBe(getEventId(event2b));
  });
});

describe('Event Deduplication - Real-World Scenarios', () => {
  it('should handle the triplication bug scenario', () => {
    const seenEventIds = new Set<string>();

    // Simulating the bug: same message arrives 3 times
    const bashToolUse = {
      type: 'assistant',
      message: {
        id: 'msg-hiroshi-123',
        content: [
          { type: 'text', text: 'Ottimo! Worktree rimosso. Ora (opzionalmente) rimuoviamo il branch locale:' },
          { type: 'tool_use', name: 'bash', id: 'tool-bash-456', input: { command: 'git branch -d feature/test-review' } },
        ],
      },
    };

    const uniqueEvents: any[] = [];

    // Simulate 3 arrivals of the same event
    for (let i = 0; i < 3; i++) {
      const eventId = getEventId(bashToolUse);

      if (!seenEventIds.has(eventId)) {
        seenEventIds.add(eventId);
        uniqueEvents.push(bashToolUse);
      }
    }

    // Should only have 1 unique event despite 3 arrivals
    expect(uniqueEvents.length).toBe(1);
    expect(seenEventIds.size).toBe(1);
  });

  it('should handle session resumption scenario', () => {
    const seenEventIds = new Set<string>();

    // Initial session
    const initEvent1 = {
      type: 'system',
      subtype: 'init',
      session_id: undefined, // Not set yet
    };

    seenEventIds.add(getEventId(initEvent1));

    // Session ID arrives later (but it's the same logical event)
    const initEvent2 = {
      type: 'system',
      subtype: 'init',
      session_id: '8afd95fb-75ed-42c2-8690-8b3de1188d63', // Now set
    };

    const eventId2 = getEventId(initEvent2);
    const isDuplicate = seenEventIds.has(eventId2);

    // Should be detected as duplicate (stable ID based on subtype only)
    expect(isDuplicate).toBe(true);
    expect(getEventId(initEvent1)).toBe(getEventId(initEvent2));
  });

  it('should handle multiple tool uses in sequence', () => {
    const seenEventIds = new Set<string>();

    const events = [
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'read', id: 'tool-1' },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'tool-1', content: 'file content' },
          ],
        },
      },
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'edit', id: 'tool-2' },
          ],
        },
      },
      {
        type: 'user',
        message: {
          content: [
            { type: 'tool_result', tool_use_id: 'tool-2', content: 'edited' },
          ],
        },
      },
    ];

    const uniqueEvents: any[] = [];

    for (const event of events) {
      const eventId = getEventId(event);

      if (!seenEventIds.has(eventId)) {
        seenEventIds.add(eventId);
        uniqueEvents.push(event);
      }
    }

    // All 4 events should be unique
    expect(uniqueEvents.length).toBe(4);
    expect(seenEventIds.size).toBe(4);
  });
});

describe('Event Deduplication - Edge Cases', () => {
  it('should handle events with missing fields', () => {
    const event1 = { type: 'assistant', message: {} };
    const event2 = { type: 'assistant' };

    // Should not throw errors
    expect(() => getEventId(event1)).not.toThrow();
    expect(() => getEventId(event2)).not.toThrow();
  });

  it('should handle null and undefined values', () => {
    const event = {
      type: 'assistant',
      message: {
        content: [
          { type: 'text', text: null },
          { type: 'tool_use', name: undefined },
        ],
      },
    };

    expect(() => getEventId(event)).not.toThrow();
  });

  it('should handle empty content arrays', () => {
    const event = {
      type: 'assistant',
      message: {
        content: [],
      },
    };

    const id = getEventId(event);
    expect(id).toContain('assistant-');
  });

  it('should handle very long text content', () => {
    const longText = 'a'.repeat(10000);
    const event = {
      type: 'assistant',
      message: {
        content: [{ type: 'text', text: longText }],
      },
    };

    const id = getEventId(event);
    expect(id).toContain('assistant-');
    expect(id.length).toBeLessThan(100); // Hash should be compact
  });
});
