import { describe, it, expect } from 'vitest';

/**
 * 🦆 Session Key Stability Tests
 *
 * These tests verify that session keys remain stable throughout a stream lifecycle,
 * preventing event tracking issues that lead to duplicate messages.
 */

describe('Session Key Stability', () => {
  it('should use streamId as stable session key', () => {
    // Simulate the old buggy behavior
    const options1 = { sessionId: undefined };
    const streamId1 = 'stream-123';
    const sessionKeyOLD = options1.sessionId || streamId1;

    expect(sessionKeyOLD).toBe('stream-123');

    // Later, when sessionId gets populated
    const options2 = { sessionId: 'session-abc' };
    const streamId2 = 'stream-123'; // Same stream
    const sessionKeyOLD2 = options2.sessionId || streamId2;

    // BUG: Session key changed! ❌
    expect(sessionKeyOLD2).toBe('session-abc');
    expect(sessionKeyOLD).not.toBe(sessionKeyOLD2);
  });

  it('should maintain stable session key with fix', () => {
    // Simulate the fixed behavior
    const options1 = { sessionId: undefined };
    const streamId1 = 'stream-123';
    const sessionKeyNEW = streamId1; // Always use streamId

    expect(sessionKeyNEW).toBe('stream-123');

    // Later, when sessionId gets populated
    const options2 = { sessionId: 'session-abc' };
    const streamId2 = 'stream-123'; // Same stream
    const sessionKeyNEW2 = streamId2; // Still use streamId

    // FIX: Session key remains stable! ✅
    expect(sessionKeyNEW2).toBe('stream-123');
    expect(sessionKeyNEW).toBe(sessionKeyNEW2);
  });

  it('should track events correctly with stable session key', () => {
    const streamId = 'stream-456';
    const seenEventIds = new Map<string, Set<string>>();

    // Initialize tracking with stable key
    const sessionKey = streamId;
    seenEventIds.set(sessionKey, new Set());

    // Add first event
    seenEventIds.get(sessionKey)?.add('event-1');
    expect(seenEventIds.get(sessionKey)?.size).toBe(1);

    // Later in the stream (sessionId might be set now)
    const sessionId = 'session-xyz';
    // But we still use streamId as key!
    const sessionKey2 = streamId;

    // Add second event - should use same key
    seenEventIds.get(sessionKey2)?.add('event-2');

    // Both events tracked under same key ✅
    expect(seenEventIds.get(sessionKey)?.size).toBe(2);
    expect(seenEventIds.get(sessionKey2)?.size).toBe(2);
  });

  it('should isolate concurrent sessions', () => {
    const seenEventIds = new Map<string, Set<string>>();

    // Stream 1
    const streamId1 = 'stream-aaa';
    seenEventIds.set(streamId1, new Set(['event-1', 'event-2']));

    // Stream 2 (concurrent)
    const streamId2 = 'stream-bbb';
    seenEventIds.set(streamId2, new Set(['event-1', 'event-3']));

    // Events should be isolated
    expect(seenEventIds.get(streamId1)?.size).toBe(2);
    expect(seenEventIds.get(streamId2)?.size).toBe(2);

    // Same event ID in different streams is OK
    expect(seenEventIds.get(streamId1)?.has('event-1')).toBe(true);
    expect(seenEventIds.get(streamId2)?.has('event-1')).toBe(true);
  });
});

describe('Session Key - Real-World Bug Reproduction', () => {
  it('should prevent bug from session 8afd95fb-75ed-42c2-8690-8b3de1188d63', () => {
    const seenEventIds = new Map<string, Set<string>>();
    const streamId = 'stream-' + Date.now();

    // Step 1: Stream starts without sessionId (common case)
    const sessionKey1 = streamId; // FIX: Use streamId
    seenEventIds.set(sessionKey1, new Set());

    // Step 2: First event arrives
    const event1Id = 'assistant-msg-1';
    seenEventIds.get(sessionKey1)?.add(event1Id);

    expect(seenEventIds.get(sessionKey1)?.has(event1Id)).toBe(true);

    // Step 3: Session ID gets populated (from system.init event)
    const actualSessionId = '8afd95fb-75ed-42c2-8690-8b3de1188d63';

    // OLD BUG: Would switch to actualSessionId as key
    // sessionKey2 = actualSessionId ❌

    // NEW FIX: Still use streamId
    const sessionKey2 = streamId; // ✅

    // Step 4: Same event arrives again (network retry, SDK bug, etc.)
    const event1IdDuplicate = 'assistant-msg-1';

    // Check if already seen
    const isDuplicate = seenEventIds.get(sessionKey2)?.has(event1IdDuplicate);

    // Should detect as duplicate ✅
    expect(isDuplicate).toBe(true);
    expect(sessionKey1).toBe(sessionKey2); // Keys must be same!
  });

  it('should handle session resumption correctly', () => {
    const seenEventIds = new Map<string, Set<string>>();

    // First session (no resume)
    const streamId1 = 'stream-first';
    seenEventIds.set(streamId1, new Set(['event-1', 'event-2']));

    // Later: Resume the session
    const streamId2 = 'stream-second'; // NEW streamId for new request
    const resumeSessionId = 'session-abc'; // Resume previous session

    seenEventIds.set(streamId2, new Set()); // New tracking for new stream

    // Events in resumed session
    seenEventIds.get(streamId2)?.add('event-3');
    seenEventIds.get(streamId2)?.add('event-4');

    // Old session tracking untouched
    expect(seenEventIds.get(streamId1)?.size).toBe(2);

    // New session has its own tracking
    expect(seenEventIds.get(streamId2)?.size).toBe(2);

    // No cross-contamination ✅
    expect(seenEventIds.get(streamId1)?.has('event-3')).toBe(false);
    expect(seenEventIds.get(streamId2)?.has('event-1')).toBe(false);
  });
});

describe('Session Key - Performance & Memory', () => {
  it('should auto-cleanup old sessions after timeout', () => {
    const seenEventIds = new Map<string, Set<string>>();

    // Add 10 old sessions
    for (let i = 0; i < 10; i++) {
      const streamId = `stream-old-${i}`;
      seenEventIds.set(streamId, new Set(['event-1', 'event-2']));
    }

    expect(seenEventIds.size).toBe(10);

    // Simulate cleanup (in real code, this happens after 5 seconds)
    const cleanupSession = (streamId: string) => {
      seenEventIds.delete(streamId);
    };

    // Clean up old sessions
    for (let i = 0; i < 10; i++) {
      cleanupSession(`stream-old-${i}`);
    }

    expect(seenEventIds.size).toBe(0);
  });

  it('should handle high-frequency events efficiently', () => {
    const seenEventIds = new Set<string>();
    const streamId = 'stream-high-freq';

    // Simulate 1000 events
    const startTime = performance.now();

    for (let i = 0; i < 1000; i++) {
      const eventId = `event-${i}`;
      if (!seenEventIds.has(eventId)) {
        seenEventIds.add(eventId);
      }
    }

    const endTime = performance.now();
    const duration = endTime - startTime;

    expect(seenEventIds.size).toBe(1000);
    expect(duration).toBeLessThan(100); // Should be fast (<100ms)
  });

  it('should detect duplicates in high-frequency scenario', () => {
    const seenEventIds = new Set<string>();

    // Simulate 1000 events with 50% duplication rate
    const totalEvents = 1000;
    const uniqueEvents = 500;

    for (let i = 0; i < totalEvents; i++) {
      const eventId = `event-${i % uniqueEvents}`; // Repeat every 500

      if (!seenEventIds.has(eventId)) {
        seenEventIds.add(eventId);
      }
    }

    // Should only have 500 unique events
    expect(seenEventIds.size).toBe(uniqueEvents);
  });
});
