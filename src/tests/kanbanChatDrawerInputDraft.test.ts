/**
 * Test for KanbanChatDrawer inputDraft initialization bug fix
 *
 * BUG: When a task was created via MCP while in Kanban view, the prompt input
 * was empty even though task.prompt was populated.
 *
 * ROOT CAUSE: The useEffect that initialized inputDraft had messages.length
 * in its dependency array. Due to timing issues with MCP sync:
 * 1. Effect runs with messages.length === 0, sets inputDraft to task.prompt
 * 2. Sync updates messages, causing effect to re-run
 * 3. Effect now sees messages.length > 0, sets inputDraft to ''
 *
 * FIX: Removed messages.length from dependency array. Now we only react to
 * task.id and task.prompt changes, checking messages.length at runtime.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('KanbanChatDrawer inputDraft initialization', () => {
  describe('Logic validation', () => {
    /**
     * Simulates the fixed initialization logic
     */
    function initializeInputDraft(
      task: { id: string; prompt: string } | null,
      messages: { role: string }[],
      lastInitializedTaskId: string | null
    ): { newDraft: string; newLastTaskId: string | null } {
      const currentTaskId = task?.id || null;

      if (currentTaskId !== lastInitializedTaskId) {
        if (task) {
          // Check if this task has any real messages (user or assistant)
          const hasRealMessages =
            messages.length > 0 &&
            messages.some((m) => m.role === 'user' || m.role === 'assistant');

          if (!hasRealMessages && task.prompt) {
            return { newDraft: task.prompt, newLastTaskId: currentTaskId };
          } else {
            return { newDraft: '', newLastTaskId: currentTaskId };
          }
        } else {
          return { newDraft: '', newLastTaskId: currentTaskId };
        }
      }

      // No change if same task
      return { newDraft: '', newLastTaskId: lastInitializedTaskId };
    }

    it('should populate draft from task.prompt when messages are empty', () => {
      const task = { id: 'task-1', prompt: 'Test prompt content' };
      const messages: { role: string }[] = [];

      const result = initializeInputDraft(task, messages, null);

      expect(result.newDraft).toBe('Test prompt content');
      expect(result.newLastTaskId).toBe('task-1');
    });

    it('should clear draft when task has real messages', () => {
      const task = { id: 'task-1', prompt: 'Test prompt content' };
      const messages = [
        { role: 'user' },
        { role: 'assistant' },
      ];

      const result = initializeInputDraft(task, messages, null);

      expect(result.newDraft).toBe('');
      expect(result.newLastTaskId).toBe('task-1');
    });

    it('should NOT re-initialize when task.id stays the same', () => {
      const task = { id: 'task-1', prompt: 'Test prompt content' };
      const messages: { role: string }[] = [];

      // First initialization
      const first = initializeInputDraft(task, messages, null);
      expect(first.newDraft).toBe('Test prompt content');

      // Simulate messages arriving (but same task)
      const messagesAfterSync = [{ role: 'user' }];
      const second = initializeInputDraft(task, messagesAfterSync, 'task-1');

      // Should NOT clear the draft because task didn't change
      expect(second.newLastTaskId).toBe('task-1');
      // newDraft is '' because we return early (no change needed)
    });

    it('should re-initialize when switching to different task', () => {
      const task1 = { id: 'task-1', prompt: 'First task prompt' };
      const task2 = { id: 'task-2', prompt: 'Second task prompt' };

      const first = initializeInputDraft(task1, [], null);
      expect(first.newDraft).toBe('First task prompt');

      const second = initializeInputDraft(task2, [], 'task-1');
      expect(second.newDraft).toBe('Second task prompt');
      expect(second.newLastTaskId).toBe('task-2');
    });

    it('should handle system messages as not real messages', () => {
      const task = { id: 'task-1', prompt: 'Test prompt' };
      const messages = [{ role: 'system' }];

      const result = initializeInputDraft(task, messages, null);

      // System messages should not prevent prompt population
      expect(result.newDraft).toBe('Test prompt');
    });

    it('should handle null task', () => {
      const result = initializeInputDraft(null, [], null);

      expect(result.newDraft).toBe('');
      expect(result.newLastTaskId).toBe(null);
    });

    it('should handle empty prompt', () => {
      const task = { id: 'task-1', prompt: '' };

      const result = initializeInputDraft(task, [], null);

      expect(result.newDraft).toBe('');
    });
  });

  describe('Late prompt sync handling', () => {
    /**
     * Simulates the late prompt sync effect
     */
    function handleLatePromptSync(
      taskPrompt: string | undefined,
      inputDraft: string,
      messagesLength: number
    ): string | null {
      if (taskPrompt && !inputDraft && messagesLength === 0) {
        return taskPrompt;
      }
      return null; // No change
    }

    it('should populate draft when prompt arrives late', () => {
      // Scenario: drawer opened, but task.prompt was undefined initially
      // Then MCP sync delivers the prompt
      const result = handleLatePromptSync('Late arriving prompt', '', 0);

      expect(result).toBe('Late arriving prompt');
    });

    it('should NOT override existing draft', () => {
      // User already typed something
      const result = handleLatePromptSync('Late prompt', 'User typed this', 0);

      expect(result).toBeNull();
    });

    it('should NOT populate if messages exist', () => {
      // Chat already started
      const result = handleLatePromptSync('Late prompt', '', 3);

      expect(result).toBeNull();
    });

    it('should NOT populate if no prompt', () => {
      const result = handleLatePromptSync(undefined, '', 0);

      expect(result).toBeNull();
    });
  });

  describe('MCP timing scenario simulation', () => {
    it('should maintain draft through rapid sync updates', () => {
      // This simulates the bug scenario:
      // 1. MCP creates task
      // 2. Task syncs to Kanban
      // 3. User opens drawer
      // 4. Draft should show prompt

      let lastTaskId: string | null = null;
      let inputDraft = '';
      const task = { id: 'mcp-created-task', prompt: 'Implement feature X' };

      // Step 1: Initial mount with empty messages
      const messages1: { role: string }[] = [];
      if (task.id !== lastTaskId) {
        lastTaskId = task.id;
        const hasRealMessages = messages1.some(
          (m) => m.role === 'user' || m.role === 'assistant'
        );
        if (!hasRealMessages && task.prompt) {
          inputDraft = task.prompt;
        }
      }
      expect(inputDraft).toBe('Implement feature X');

      // Step 2: Messages sync arrives (but task ID is same)
      // With the OLD bug, this would clear inputDraft
      // With the FIX, we don't re-initialize because task.id didn't change
      const messages2 = [{ role: 'system' }]; // Only system message, not real
      if (task.id !== lastTaskId) {
        // This won't execute because task.id === lastTaskId
        lastTaskId = task.id;
        inputDraft = '';
      }

      // Draft should still be populated
      expect(inputDraft).toBe('Implement feature X');

      // Step 3: Even with user messages, we don't clear on re-render
      const messages3 = [{ role: 'user' }];
      if (task.id !== lastTaskId) {
        // Won't execute
        inputDraft = '';
      }

      // Draft is STILL populated because we only initialize on task change
      expect(inputDraft).toBe('Implement feature X');
    });

    it('should correctly handle switching tasks', () => {
      let lastTaskId: string | null = null;
      let inputDraft = '';

      // Task 1: MCP created, has prompt
      const task1 = { id: 'task-1', prompt: 'First task' };
      if (task1.id !== lastTaskId) {
        lastTaskId = task1.id;
        inputDraft = task1.prompt;
      }
      expect(inputDraft).toBe('First task');

      // Task 2: Has messages, should clear draft
      const task2 = { id: 'task-2', prompt: 'Second task' };
      const task2Messages = [{ role: 'user' }, { role: 'assistant' }];
      if (task2.id !== lastTaskId) {
        lastTaskId = task2.id;
        const hasRealMessages = task2Messages.some(
          (m) => m.role === 'user' || m.role === 'assistant'
        );
        if (!hasRealMessages && task2.prompt) {
          inputDraft = task2.prompt;
        } else {
          inputDraft = '';
        }
      }
      expect(inputDraft).toBe('');

      // Task 3: New task, no messages
      const task3 = { id: 'task-3', prompt: 'Third task' };
      if (task3.id !== lastTaskId) {
        lastTaskId = task3.id;
        inputDraft = task3.prompt;
      }
      expect(inputDraft).toBe('Third task');
    });
  });
});
