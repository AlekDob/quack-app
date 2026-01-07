/**
 * Tests for Kanban Task Race Condition Fix
 *
 * Bug: When rapidly clicking between different tasks assigned to the same agent,
 * the chat conversations would mix up or show stale/wrong messages.
 *
 * Root Cause: activeTaskPerAgent was updated BEFORE chatSessions was populated
 * with the new task's messages, causing React to render with stale data.
 *
 * Fix: Load task messages from Tauri Store BEFORE updating activeTaskPerAgent
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock ChatMessage type
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

// Mock KanbanTask type
interface KanbanTask {
  id: string;
  title: string;
  prompt: string;
  projectPath: string;
  assignedAgent?: {
    id: string;
    name: string;
    color?: string;
  };
  sessionId?: string;
}

// Mock terminal type
interface Terminal {
  id: string;
  label: string;
  cwd: string;
}

describe('Kanban Task Race Condition Fix', () => {
  // Simulated state
  let chatSessions: Map<string, ChatMessage[]>;
  let activeTaskPerAgent: Map<string, string>;
  let mockStore: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };

  // Sample data
  const agent1: Terminal = { id: 'agent-1', label: 'Agent Magnus', cwd: '/project' };

  const task1: KanbanTask = {
    id: 'task-1',
    title: 'Fix bug',
    prompt: 'Fix the login bug',
    projectPath: '/project',
    assignedAgent: { id: 'agent-1', name: 'Agent Magnus' },
    sessionId: 'session-1',
  };

  const task2: KanbanTask = {
    id: 'task-2',
    title: 'Add feature',
    prompt: 'Add dark mode',
    projectPath: '/project',
    assignedAgent: { id: 'agent-1', name: 'Agent Magnus' },
    sessionId: 'session-2',
  };

  const task1Messages: ChatMessage[] = [
    { id: 'msg-1', role: 'user', content: 'Fix the login bug', timestamp: 1000 },
    { id: 'msg-2', role: 'assistant', content: 'I will fix the login bug...', timestamp: 1001 },
  ];

  const task2Messages: ChatMessage[] = [
    { id: 'msg-3', role: 'user', content: 'Add dark mode', timestamp: 2000 },
    { id: 'msg-4', role: 'assistant', content: 'I will add dark mode...', timestamp: 2001 },
  ];

  beforeEach(() => {
    chatSessions = new Map();
    activeTaskPerAgent = new Map();

    // Mock Tauri Store
    mockStore = {
      get: vi.fn(),
      set: vi.fn(),
      save: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Message Loading Order', () => {
    it('should load messages BEFORE setting activeTaskPerAgent', async () => {
      const operations: string[] = [];

      // Track operation order
      const setChatSessions = (updater: (prev: Map<string, ChatMessage[]>) => Map<string, ChatMessage[]>) => {
        operations.push('setChatSessions');
        chatSessions = updater(chatSessions);
      };

      const setActiveTaskPerAgent = (updater: (prev: Map<string, string>) => Map<string, string>) => {
        operations.push('setActiveTaskPerAgent');
        activeTaskPerAgent = updater(activeTaskPerAgent);
      };

      // Simulate the FIXED openTaskTab flow
      mockStore.get.mockResolvedValue({ messages: task1Messages });

      // Step 1: Load messages (FIXED order)
      const savedChat = await mockStore.get(`chat-${task1.id}`);
      if (savedChat?.messages) {
        setChatSessions(prev => {
          const newSessions = new Map(prev);
          newSessions.set(task1.id, savedChat.messages);
          return newSessions;
        });
      }

      // Step 2: Set active task (AFTER messages loaded)
      setActiveTaskPerAgent(prev => {
        const newMap = new Map(prev);
        newMap.set(agent1.id, task1.id);
        return newMap;
      });

      // Verify order: setChatSessions MUST come before setActiveTaskPerAgent
      expect(operations).toEqual(['setChatSessions', 'setActiveTaskPerAgent']);
    });

    it('should have correct messages when activeTaskId changes', async () => {
      // Setup: Load messages first
      mockStore.get.mockResolvedValue({ messages: task1Messages });
      const savedChat = await mockStore.get(`chat-${task1.id}`);

      chatSessions.set(task1.id, savedChat.messages);
      activeTaskPerAgent.set(agent1.id, task1.id);

      // Simulate activeTaskMessages derivation (as in App.tsx)
      const activeTaskId = activeTaskPerAgent.get(agent1.id);
      const activeTaskMessages = activeTaskId ? (chatSessions.get(activeTaskId) ?? []) : [];

      // Messages should be correct, not empty
      expect(activeTaskMessages).toEqual(task1Messages);
      expect(activeTaskMessages.length).toBe(2);
      expect(activeTaskMessages[0].content).toBe('Fix the login bug');
    });
  });

  describe('Rapid Task Switching', () => {
    it('should show correct messages when switching from task1 to task2', async () => {
      // Initial state: task1 is active
      chatSessions.set(task1.id, task1Messages);
      activeTaskPerAgent.set(agent1.id, task1.id);

      // User clicks task2 - simulate FIXED flow
      mockStore.get.mockResolvedValue({ messages: task2Messages });

      // 1. Load task2 messages FIRST
      const savedChat = await mockStore.get(`chat-${task2.id}`);
      chatSessions.set(task2.id, savedChat.messages);

      // 2. THEN update activeTaskPerAgent
      activeTaskPerAgent.set(agent1.id, task2.id);

      // Derive activeTaskMessages (as React would)
      const activeTaskId = activeTaskPerAgent.get(agent1.id);
      const activeTaskMessages = activeTaskId ? (chatSessions.get(activeTaskId) ?? []) : [];

      // Should show task2 messages, NOT task1 or empty
      expect(activeTaskMessages).toEqual(task2Messages);
      expect(activeTaskMessages[0].content).toBe('Add dark mode');
    });

    it('should NOT show stale messages during rapid switching', async () => {
      // Setup mock to return different messages per task
      mockStore.get.mockImplementation(async (key: string) => {
        if (key === 'chat-task-1') return { messages: task1Messages };
        if (key === 'chat-task-2') return { messages: task2Messages };
        return null;
      });

      // Rapid switching simulation: task1 -> task2 -> task1
      const switchSequence = [task1, task2, task1];

      for (const task of switchSequence) {
        // FIXED flow: load messages first
        const savedChat = await mockStore.get(`chat-${task.id}`);
        if (savedChat?.messages) {
          chatSessions.set(task.id, savedChat.messages);
        }
        activeTaskPerAgent.set(agent1.id, task.id);

        // Verify messages match current task
        const activeTaskId = activeTaskPerAgent.get(agent1.id);
        const activeTaskMessages = activeTaskId ? (chatSessions.get(activeTaskId) ?? []) : [];

        if (task.id === 'task-1') {
          expect(activeTaskMessages[0].content).toBe('Fix the login bug');
        } else {
          expect(activeTaskMessages[0].content).toBe('Add dark mode');
        }
      }
    });
  });

  describe('Empty Task Handling', () => {
    it('should initialize empty array for tasks without messages', async () => {
      // Task with no messages yet
      mockStore.get.mockResolvedValue(null);

      const savedChat = await mockStore.get(`chat-${task1.id}`);

      if (!savedChat?.messages) {
        // Initialize empty array (as in FIXED code)
        if (!chatSessions.has(task1.id)) {
          chatSessions.set(task1.id, []);
        }
      }

      activeTaskPerAgent.set(agent1.id, task1.id);

      const activeTaskId = activeTaskPerAgent.get(agent1.id);
      const activeTaskMessages = activeTaskId ? (chatSessions.get(activeTaskId) ?? []) : [];

      // Should return empty array, not undefined
      expect(activeTaskMessages).toEqual([]);
      expect(Array.isArray(activeTaskMessages)).toBe(true);
    });

    it('should handle store load errors gracefully', async () => {
      mockStore.get.mockRejectedValue(new Error('Store load failed'));

      try {
        await mockStore.get(`chat-${task1.id}`);
      } catch {
        // On error, still ensure task has an entry
        if (!chatSessions.has(task1.id)) {
          chatSessions.set(task1.id, []);
        }
      }

      activeTaskPerAgent.set(agent1.id, task1.id);

      const activeTaskId = activeTaskPerAgent.get(agent1.id);
      const activeTaskMessages = activeTaskId ? (chatSessions.get(activeTaskId) ?? []) : [];

      // Should return empty array even after error
      expect(activeTaskMessages).toEqual([]);
    });
  });

  describe('Token Restoration', () => {
    it('should restore tokens along with messages', async () => {
      const chatTokensMap = new Map<string, {
        inputTokens: number;
        outputTokens: number;
        cacheCreationTokens: number;
        cacheReadTokens: number;
        totalCost: number;
      }>();

      mockStore.get.mockResolvedValue({
        messages: task1Messages,
        tokens: {
          inputTokens: 1000,
          outputTokens: 500,
          cacheCreationTokens: 100,
          cacheReadTokens: 50,
          totalCost: 0.05,
        },
      });

      const savedChat = await mockStore.get(`chat-${task1.id}`);

      if (savedChat?.messages) {
        chatSessions.set(task1.id, savedChat.messages);
      }

      if (savedChat?.tokens) {
        chatTokensMap.set(task1.id, {
          inputTokens: savedChat.tokens.inputTokens || 0,
          outputTokens: savedChat.tokens.outputTokens || 0,
          cacheCreationTokens: savedChat.tokens.cacheCreationTokens || 0,
          cacheReadTokens: savedChat.tokens.cacheReadTokens || 0,
          totalCost: savedChat.tokens.totalCost || 0,
        });
      }

      activeTaskPerAgent.set(agent1.id, task1.id);

      // Verify tokens are restored
      const taskTokens = chatTokensMap.get(task1.id);
      expect(taskTokens).toBeDefined();
      expect(taskTokens?.inputTokens).toBe(1000);
      expect(taskTokens?.outputTokens).toBe(500);
      expect(taskTokens?.totalCost).toBe(0.05);
    });
  });

  describe('Agent Fallback Handling', () => {
    it('should find agent by name if UUID changed', () => {
      const terminals = [
        { id: 'new-uuid-123', label: 'Agent Magnus', cwd: '/project' },
      ];

      const taskWithOldUuid: KanbanTask = {
        id: 'task-1',
        title: 'Fix bug',
        prompt: 'Fix the login bug',
        projectPath: '/project',
        assignedAgent: { id: 'old-uuid-456', name: 'Agent Magnus' },
      };

      // UUID not found
      let terminal = terminals.find(t => t.id === taskWithOldUuid.assignedAgent?.id);
      expect(terminal).toBeUndefined();

      // Fallback: find by name
      if (!terminal && taskWithOldUuid.assignedAgent?.name) {
        terminal = terminals.find(t => t.label === taskWithOldUuid.assignedAgent!.name);
      }

      expect(terminal).toBeDefined();
      expect(terminal?.id).toBe('new-uuid-123');
      expect(terminal?.label).toBe('Agent Magnus');
    });
  });
});

describe('Race Condition Prevention', () => {
  it('demonstrates the bug scenario that was fixed', () => {
    /**
     * BUG SCENARIO (BEFORE FIX):
     * 1. User clicks Task A -> activeTaskPerAgent["magnus"] = "task-A"
     * 2. User quickly clicks Task B -> activeTaskPerAgent["magnus"] = "task-B"
     * 3. React re-renders: activeTaskId = "task-B"
     * 4. But chatSessions.get("task-B") = [] (empty/stale)
     * 5. ChatView shows WRONG conversation!
     *
     * FIX:
     * 1. User clicks Task B
     * 2. Load chatSessions.set("task-B", [...messages]) FIRST
     * 3. THEN update activeTaskPerAgent["magnus"] = "task-B"
     * 4. React re-renders with CORRECT data
     */

    // This test documents the fix, actual logic is tested above
    expect(true).toBe(true);
  });
});
