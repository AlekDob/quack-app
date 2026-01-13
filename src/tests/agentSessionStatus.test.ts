/**
 * Agent Session Status Tests
 *
 * Tests for status derivation logic in Sessions-First Architecture.
 * Verifies that session status is derived correctly based on:
 * - Message count (0 messages = 'todo', 1+ messages = 'in_progress')
 * - Manual completion (markDone sets 'done' permanently)
 *
 * @module agentSessionStatus.test
 */

import { describe, it, expect } from 'vitest';

// Session type definition
interface Session {
  id: string;
  agentId: string;
  status: 'todo' | 'in_progress' | 'done';
  messageCount: number;
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
}

/**
 * Derive session status based on current state
 * This is the core logic that determines session status
 */
function deriveSessionStatus(session: Session): Session['status'] {
  // Rule 1: If explicitly marked done, stay done
  if (session.status === 'done') {
    return 'done';
  }

  // Rule 2: If has messages, it's in progress
  if (session.messageCount > 0) {
    return 'in_progress';
  }

  // Rule 3: Default is todo (no messages yet)
  return 'todo';
}

/**
 * Helper function to add a message and update status
 */
function addMessage(session: Session): Session {
  const messageCount = session.messageCount + 1;
  const status = deriveSessionStatus({ ...session, messageCount });

  return {
    ...session,
    messageCount,
    status,
    // Set startedAt on first message
    startedAt: messageCount === 1 ? Date.now() : session.startedAt,
  };
}

/**
 * Helper function to mark session as done
 */
function markSessionDone(session: Session): Session {
  return {
    ...session,
    status: 'done',
    completedAt: Date.now(),
  };
}

describe('Agent Session Status - Status Derivation', () => {
  it('should derive status as "todo" for session with 0 messages', () => {
    const session: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'todo',
      messageCount: 0,
      createdAt: Date.now(),
    };

    const status = deriveSessionStatus(session);

    expect(status).toBe('todo');
  });

  it('should derive status as "in_progress" for session with 1 message', () => {
    const session: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'todo',
      messageCount: 1,
      createdAt: Date.now(),
    };

    const status = deriveSessionStatus(session);

    expect(status).toBe('in_progress');
  });

  it('should derive status as "in_progress" for session with multiple messages', () => {
    const session: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'in_progress',
      messageCount: 10,
      createdAt: Date.now(),
    };

    const status = deriveSessionStatus(session);

    expect(status).toBe('in_progress');
  });

  it('should keep status as "done" even with more messages', () => {
    const session: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'done',
      messageCount: 5,
      createdAt: Date.now(),
      completedAt: Date.now(),
    };

    const status = deriveSessionStatus(session);

    expect(status).toBe('done');
  });

  it('should keep status as "done" even with 0 messages', () => {
    const session: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'done',
      messageCount: 0,
      createdAt: Date.now(),
      completedAt: Date.now(),
    };

    const status = deriveSessionStatus(session);

    expect(status).toBe('done');
  });
});

describe('Agent Session Status - Lifecycle Transitions', () => {
  it('should transition from "todo" to "in_progress" on first message', () => {
    let session: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'todo',
      messageCount: 0,
      createdAt: Date.now(),
    };

    expect(session.status).toBe('todo');

    // Add first message
    session = addMessage(session);

    expect(session.status).toBe('in_progress');
    expect(session.messageCount).toBe(1);
    expect(session.startedAt).toBeDefined();
  });

  it('should remain "in_progress" with additional messages', () => {
    let session: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'in_progress',
      messageCount: 1,
      createdAt: Date.now(),
      startedAt: Date.now(),
    };

    const startedAt = session.startedAt;

    // Add more messages
    session = addMessage(session);
    session = addMessage(session);
    session = addMessage(session);

    expect(session.status).toBe('in_progress');
    expect(session.messageCount).toBe(4);
    expect(session.startedAt).toBe(startedAt); // Should not change
  });

  it('should transition to "done" when explicitly marked', () => {
    let session: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'in_progress',
      messageCount: 5,
      createdAt: Date.now(),
      startedAt: Date.now(),
    };

    session = markSessionDone(session);

    expect(session.status).toBe('done');
    expect(session.completedAt).toBeDefined();
  });

  it('should NOT auto-revert from "done" to "in_progress"', () => {
    let session: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'done',
      messageCount: 5,
      createdAt: Date.now(),
      completedAt: Date.now(),
    };

    // Try to add more messages - status should remain 'done'
    const originalCompletedAt = session.completedAt;
    session = addMessage(session);
    session = addMessage(session);

    expect(session.status).toBe('done');
    expect(session.messageCount).toBe(7); // Count increases
    expect(session.completedAt).toBe(originalCompletedAt); // Timestamp unchanged
  });
});

describe('Agent Session Status - Edge Cases', () => {
  it('should handle marking a "todo" session as done without messages', () => {
    let session: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'todo',
      messageCount: 0,
      createdAt: Date.now(),
    };

    session = markSessionDone(session);

    expect(session.status).toBe('done');
    expect(session.messageCount).toBe(0);
    expect(session.completedAt).toBeDefined();
  });

  it('should handle rapid status checks', () => {
    const session: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'in_progress',
      messageCount: 3,
      createdAt: Date.now(),
    };

    // Call derive multiple times - should be deterministic
    const status1 = deriveSessionStatus(session);
    const status2 = deriveSessionStatus(session);
    const status3 = deriveSessionStatus(session);

    expect(status1).toBe('in_progress');
    expect(status2).toBe('in_progress');
    expect(status3).toBe('in_progress');
  });

  it('should handle boundary at messageCount = 0 vs 1', () => {
    const session0: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'todo',
      messageCount: 0,
      createdAt: Date.now(),
    };

    const session1: Session = {
      ...session0,
      messageCount: 1,
    };

    expect(deriveSessionStatus(session0)).toBe('todo');
    expect(deriveSessionStatus(session1)).toBe('in_progress');
  });
});

describe('Agent Session Status - Real-World Scenarios', () => {
  it('should handle typical task flow: create -> work -> complete', () => {
    // 1. Session created
    let session: Session = {
      id: 'session-1',
      agentId: 'agent-hiroshi',
      status: 'todo',
      messageCount: 0,
      createdAt: Date.now(),
    };

    expect(deriveSessionStatus(session)).toBe('todo');

    // 2. User sends first message
    session = addMessage(session);
    expect(deriveSessionStatus(session)).toBe('in_progress');

    // 3. Agent responds (adds message)
    session = addMessage(session);
    expect(deriveSessionStatus(session)).toBe('in_progress');

    // 4. User sends another message
    session = addMessage(session);
    expect(deriveSessionStatus(session)).toBe('in_progress');

    // 5. Task completed - mark as done
    session = markSessionDone(session);
    expect(deriveSessionStatus(session)).toBe('done');

    // 6. Even if more messages arrive (e.g., follow-up), stays done
    session = addMessage(session);
    expect(deriveSessionStatus(session)).toBe('done');
  });

  it('should handle abandoned session (created but never used)', () => {
    const session: Session = {
      id: 'session-abandoned',
      agentId: 'agent-kaori',
      status: 'todo',
      messageCount: 0,
      createdAt: Date.now() - 1000 * 60 * 60, // 1 hour ago
    };

    // Session stays in 'todo' if never used
    expect(deriveSessionStatus(session)).toBe('todo');
  });

  it('should handle quick completion (single message then done)', () => {
    let session: Session = {
      id: 'session-quick',
      agentId: 'agent-magnus',
      status: 'todo',
      messageCount: 0,
      createdAt: Date.now(),
    };

    // Add one message
    session = addMessage(session);
    expect(deriveSessionStatus(session)).toBe('in_progress');

    // Immediately mark as done
    session = markSessionDone(session);
    expect(deriveSessionStatus(session)).toBe('done');
    expect(session.messageCount).toBe(1);
  });

  it('should handle multiple agents with different session states', () => {
    const hiroshiSession: Session = {
      id: 'session-hiroshi',
      agentId: 'agent-hiroshi',
      status: 'todo',
      messageCount: 0,
      createdAt: Date.now(),
    };

    const kaoriSession: Session = {
      id: 'session-kaori',
      agentId: 'agent-kaori',
      status: 'in_progress',
      messageCount: 3,
      createdAt: Date.now(),
      startedAt: Date.now(),
    };

    const magnusSession: Session = {
      id: 'session-magnus',
      agentId: 'agent-magnus',
      status: 'done',
      messageCount: 10,
      createdAt: Date.now() - 1000 * 60 * 30, // 30 min ago
      completedAt: Date.now() - 1000 * 60 * 5, // Completed 5 min ago
    };

    // Each agent has independent status
    expect(deriveSessionStatus(hiroshiSession)).toBe('todo');
    expect(deriveSessionStatus(kaoriSession)).toBe('in_progress');
    expect(deriveSessionStatus(magnusSession)).toBe('done');
  });
});

describe('Agent Session Status - Status Consistency', () => {
  it('should ensure status is always consistent with messageCount', () => {
    const testCases: Array<{
      messageCount: number;
      currentStatus: Session['status'];
      expectedStatus: Session['status'];
    }> = [
      { messageCount: 0, currentStatus: 'todo', expectedStatus: 'todo' },
      { messageCount: 1, currentStatus: 'todo', expectedStatus: 'in_progress' },
      { messageCount: 5, currentStatus: 'in_progress', expectedStatus: 'in_progress' },
      { messageCount: 0, currentStatus: 'done', expectedStatus: 'done' },
      { messageCount: 10, currentStatus: 'done', expectedStatus: 'done' },
    ];

    testCases.forEach(({ messageCount, currentStatus, expectedStatus }) => {
      const session: Session = {
        id: `session-${messageCount}`,
        agentId: 'agent-1',
        status: currentStatus,
        messageCount,
        createdAt: Date.now(),
      };

      const derivedStatus = deriveSessionStatus(session);

      expect(derivedStatus).toBe(
        expectedStatus
      );
    });
  });

  it('should handle status conflicts consistently', () => {
    // Scenario: session marked 'todo' but has messages
    // (shouldn't happen in practice, but testing consistency)
    const inconsistentSession: Session = {
      id: 'session-conflict',
      agentId: 'agent-1',
      status: 'todo', // Incorrect state
      messageCount: 5, // Has messages
      createdAt: Date.now(),
    };

    const correctedStatus = deriveSessionStatus(inconsistentSession);

    // Should correct to 'in_progress' based on messageCount
    expect(correctedStatus).toBe('in_progress');
  });
});

describe('Agent Session Status - Performance', () => {
  it('should handle large messageCount efficiently', () => {
    const session: Session = {
      id: 'session-many-messages',
      agentId: 'agent-1',
      status: 'in_progress',
      messageCount: 10000, // Very large conversation
      createdAt: Date.now(),
    };

    const startTime = performance.now();
    const status = deriveSessionStatus(session);
    const endTime = performance.now();

    expect(status).toBe('in_progress');
    expect(endTime - startTime).toBeLessThan(1); // Should be instant (<1ms)
  });

  it('should handle rapid successive status derivations', () => {
    const session: Session = {
      id: 'session-rapid',
      agentId: 'agent-1',
      status: 'in_progress',
      messageCount: 5,
      createdAt: Date.now(),
    };

    const iterations = 1000;
    const startTime = performance.now();

    for (let i = 0; i < iterations; i++) {
      deriveSessionStatus(session);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    expect(totalTime).toBeLessThan(100); // 1000 calls in <100ms
  });
});

describe('Agent Session Status - Immutability', () => {
  it('should not mutate original session when adding messages', () => {
    const original: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'todo',
      messageCount: 0,
      createdAt: Date.now(),
    };

    const originalCopy = { ...original };

    // Add message returns new session
    const updated = addMessage(original);

    // Original should be unchanged
    expect(original).toEqual(originalCopy);
    expect(original.messageCount).toBe(0);
    expect(original.status).toBe('todo');

    // Updated should have changes
    expect(updated.messageCount).toBe(1);
    expect(updated.status).toBe('in_progress');
  });

  it('should not mutate original session when marking done', () => {
    const original: Session = {
      id: 'session-1',
      agentId: 'agent-1',
      status: 'in_progress',
      messageCount: 5,
      createdAt: Date.now(),
    };

    const originalCopy = { ...original };

    // Mark done returns new session
    const updated = markSessionDone(original);

    // Original should be unchanged
    expect(original).toEqual(originalCopy);
    expect(original.status).toBe('in_progress');
    expect(original.completedAt).toBeUndefined();

    // Updated should have changes
    expect(updated.status).toBe('done');
    expect(updated.completedAt).toBeDefined();
  });
});
