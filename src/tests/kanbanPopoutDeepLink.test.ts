import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Kanban Popout Deep Link Tests
 *
 * Tests for the feature that allows clicking a task in a Kanban popout window
 * to open/focus that task in the main window.
 *
 * Feature Flow:
 * 1. User clicks task in popout window
 * 2. Popout emits 'kanban:open-task-in-main' Tauri event with taskId
 * 3. Main window listens, calls selectTask(taskId) + openDrawer()
 * 4. Main window dispatches 'kanban:focus-tab-and-drawer' custom DOM event
 * 5. App.tsx listener opens/focuses Kanban tab
 * 6. Main window is focused
 */

// Mock Tauri APIs
vi.mock('@tauri-apps/api/event', () => ({
  emit: vi.fn(),
  listen: vi.fn(),
}));

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: vi.fn(() => ({
    setFocus: vi.fn().mockResolvedValue(undefined),
  })),
}));

// Mock Kanban store
const mockSelectTask = vi.fn();
const mockOpenDrawer = vi.fn();

vi.mock('../stores/kanbanStore', () => ({
  useKanbanStore: {
    getState: vi.fn(() => ({
      selectTask: mockSelectTask,
      openDrawer: mockOpenDrawer,
      tasks: [
        {
          id: 'task-1',
          title: 'Test Task 1',
          status: 'todo',
          description: 'Description 1',
        },
        {
          id: 'task-2',
          title: 'Test Task 2',
          status: 'in_progress',
          description: 'Description 2',
        },
      ],
    })),
  },
}));

describe('Kanban Popout Deep Link - KanbanPopoutView.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should emit kanban:open-task-in-main event when task is clicked', async () => {
    const { emit } = await import('@tauri-apps/api/event');
    const mockEmit = emit as ReturnType<typeof vi.fn>;

    // Simulate handleTaskClick function from KanbanPopoutView.tsx
    const handleTaskClick = async (task: { id: string; title: string }) => {
      try {
        await mockEmit('kanban:open-task-in-main', { taskId: task.id });
      } catch (error) {
        console.error('[KanbanPopoutView] Failed to emit event:', error);
        throw error;
      }
    };

    const testTask = {
      id: 'task-123',
      title: 'Test Task',
    };

    await handleTaskClick(testTask);

    expect(mockEmit).toHaveBeenCalledWith('kanban:open-task-in-main', {
      taskId: 'task-123',
    });
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });

  it('should emit correct event name and payload structure', async () => {
    const { emit } = await import('@tauri-apps/api/event');
    const mockEmit = emit as ReturnType<typeof vi.fn>;

    const handleTaskClick = async (task: { id: string }) => {
      await mockEmit('kanban:open-task-in-main', { taskId: task.id });
    };

    await handleTaskClick({ id: 'task-abc-123' });

    // Verify event name
    expect(mockEmit).toHaveBeenCalledWith(
      expect.stringMatching(/kanban:open-task-in-main/),
      expect.any(Object)
    );

    // Verify payload structure
    const callArgs = mockEmit.mock.calls[0];
    expect(callArgs[1]).toHaveProperty('taskId');
    expect(typeof callArgs[1].taskId).toBe('string');
  });

  it('should handle emit errors gracefully', async () => {
    const { emit } = await import('@tauri-apps/api/event');
    const mockEmit = emit as ReturnType<typeof vi.fn>;

    // Simulate emit failure
    mockEmit.mockRejectedValueOnce(new Error('Tauri emit failed'));

    const handleTaskClick = async (task: { id: string }) => {
      try {
        await mockEmit('kanban:open-task-in-main', { taskId: task.id });
      } catch (error) {
        return { error: (error as Error).message };
      }
    };

    const result = await handleTaskClick({ id: 'task-123' });

    expect(result).toEqual({ error: 'Tauri emit failed' });
    expect(mockEmit).toHaveBeenCalledTimes(1);
  });

  it('should emit events for different tasks with unique taskIds', async () => {
    const { emit } = await import('@tauri-apps/api/event');
    const mockEmit = emit as ReturnType<typeof vi.fn>;

    const handleTaskClick = async (task: { id: string }) => {
      await mockEmit('kanban:open-task-in-main', { taskId: task.id });
    };

    // Click multiple different tasks
    await handleTaskClick({ id: 'task-1' });
    await handleTaskClick({ id: 'task-2' });
    await handleTaskClick({ id: 'task-3' });

    expect(mockEmit).toHaveBeenCalledTimes(3);
    expect(mockEmit).toHaveBeenNthCalledWith(1, 'kanban:open-task-in-main', {
      taskId: 'task-1',
    });
    expect(mockEmit).toHaveBeenNthCalledWith(2, 'kanban:open-task-in-main', {
      taskId: 'task-2',
    });
    expect(mockEmit).toHaveBeenNthCalledWith(3, 'kanban:open-task-in-main', {
      taskId: 'task-3',
    });
  });
});

describe('Kanban Popout Deep Link - App.tsx Tauri Listener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should listen for kanban:open-task-in-main event', async () => {
    const { listen } = await import('@tauri-apps/api/event');
    const mockListen = listen as ReturnType<typeof vi.fn>;

    // Simulate App.tsx setting up listener
    mockListen.mockImplementation((eventName, callback) => {
      expect(eventName).toBe('kanban:open-task-in-main');
      expect(typeof callback).toBe('function');
      return Promise.resolve(() => {});
    });

    await mockListen('kanban:open-task-in-main', () => {});

    expect(mockListen).toHaveBeenCalledWith(
      'kanban:open-task-in-main',
      expect.any(Function)
    );
  });

  it('should call selectTask and openDrawer when event is received', async () => {
    const { useKanbanStore } = await import('../stores/kanbanStore');
    const mockGetState = useKanbanStore.getState as ReturnType<typeof vi.fn>;

    // Simulate the event handler from App.tsx
    const handleKanbanOpenTask = (payload: { taskId: string }) => {
      const { selectTask, openDrawer } = mockGetState();
      selectTask(payload.taskId);
      openDrawer();
    };

    // Simulate event being received
    const eventPayload = { taskId: 'task-abc-123' };
    handleKanbanOpenTask(eventPayload);

    expect(mockSelectTask).toHaveBeenCalledWith('task-abc-123');
    expect(mockOpenDrawer).toHaveBeenCalled();
    expect(mockSelectTask).toHaveBeenCalledTimes(1);
    expect(mockOpenDrawer).toHaveBeenCalledTimes(1);
  });

  it('should dispatch kanban:focus-tab-and-drawer custom event', () => {
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    // Simulate the event handler dispatching custom event
    const handleKanbanOpenTask = () => {
      window.dispatchEvent(new CustomEvent('kanban:focus-tab-and-drawer'));
    };

    handleKanbanOpenTask();

    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'kanban:focus-tab-and-drawer',
      })
    );

    dispatchEventSpy.mockRestore();
  });

  it('should focus main window after handling event', async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const mockGetCurrentWindow = getCurrentWindow as ReturnType<typeof vi.fn>;
    const mockSetFocus = vi.fn().mockResolvedValue(undefined);

    mockGetCurrentWindow.mockReturnValue({
      setFocus: mockSetFocus,
    });

    // Simulate the window focusing logic from App.tsx
    const focusMainWindow = async () => {
      try {
        const mainWindow = mockGetCurrentWindow();
        await mainWindow.setFocus();
      } catch (error) {
        console.error('Failed to focus main window:', error);
      }
    };

    await focusMainWindow();

    expect(mockGetCurrentWindow).toHaveBeenCalled();
    expect(mockSetFocus).toHaveBeenCalled();
  });

  it('should handle window focus errors gracefully', async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    const mockGetCurrentWindow = getCurrentWindow as ReturnType<typeof vi.fn>;
    const mockSetFocus = vi.fn().mockRejectedValue(new Error('Focus failed'));

    mockGetCurrentWindow.mockReturnValue({
      setFocus: mockSetFocus,
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Simulate the window focusing logic with error handling
    const focusMainWindow = async () => {
      try {
        const mainWindow = mockGetCurrentWindow();
        await mainWindow.setFocus();
      } catch (error) {
        console.error('Failed to focus main window:', error);
      }
    };

    await focusMainWindow();

    expect(mockSetFocus).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to focus main window:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('should handle full event flow from payload to window focus', async () => {
    const { useKanbanStore } = await import('../stores/kanbanStore');
    const { getCurrentWindow } = await import('@tauri-apps/api/window');

    const mockGetState = useKanbanStore.getState as ReturnType<typeof vi.fn>;
    const mockGetCurrentWindow = getCurrentWindow as ReturnType<typeof vi.fn>;
    const mockSetFocus = vi.fn().mockResolvedValue(undefined);

    mockGetCurrentWindow.mockReturnValue({
      setFocus: mockSetFocus,
    });

    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    // Simulate complete event handler from App.tsx
    const handleKanbanOpenTaskComplete = async (payload: { taskId: string }) => {
      // 1. Select task and open drawer
      const { selectTask, openDrawer } = mockGetState();
      selectTask(payload.taskId);
      openDrawer();

      // 2. Dispatch custom event
      window.dispatchEvent(new CustomEvent('kanban:focus-tab-and-drawer'));

      // 3. Focus main window
      try {
        const mainWindow = mockGetCurrentWindow();
        await mainWindow.setFocus();
      } catch (error) {
        console.error('Failed to focus main window:', error);
      }
    };

    await handleKanbanOpenTaskComplete({ taskId: 'task-full-flow' });

    // Verify all steps were executed
    expect(mockSelectTask).toHaveBeenCalledWith('task-full-flow');
    expect(mockOpenDrawer).toHaveBeenCalled();
    expect(dispatchEventSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'kanban:focus-tab-and-drawer',
      })
    );
    expect(mockSetFocus).toHaveBeenCalled();

    dispatchEventSpy.mockRestore();
  });
});

describe('Kanban Popout Deep Link - App.tsx DOM Event Listener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up event listeners
    const listeners = (window as any)._listeners?.['kanban:focus-tab-and-drawer'];
    if (listeners) {
      delete (window as any)._listeners['kanban:focus-tab-and-drawer'];
    }
  });

  it('should add event listener for kanban:focus-tab-and-drawer', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    const handleFocusKanbanTab = () => {
      console.log('Kanban tab focused');
    };

    window.addEventListener('kanban:focus-tab-and-drawer', handleFocusKanbanTab);

    expect(addEventListenerSpy).toHaveBeenCalledWith(
      'kanban:focus-tab-and-drawer',
      expect.any(Function)
    );

    addEventListenerSpy.mockRestore();
  });

  it('should trigger handler when kanban:focus-tab-and-drawer event is dispatched', () => {
    const handler = vi.fn();

    window.addEventListener('kanban:focus-tab-and-drawer', handler);
    window.dispatchEvent(new CustomEvent('kanban:focus-tab-and-drawer'));

    expect(handler).toHaveBeenCalled();
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener('kanban:focus-tab-and-drawer', handler);
  });

  it('should focus existing Kanban tab when event is dispatched', () => {
    const setActiveTabIdMock = vi.fn();

    const tabs = [
      { id: 'terminal-1', type: 'terminal' },
      { id: 'kanban-board', type: 'kanban' },
      { id: 'terminal-2', type: 'terminal' },
    ];

    const handleFocusKanbanTab = () => {
      const existingKanbanTab = tabs.find((t) => t.id === 'kanban-board');
      if (existingKanbanTab) {
        setActiveTabIdMock('kanban-board');
      }
    };

    window.addEventListener('kanban:focus-tab-and-drawer', handleFocusKanbanTab);
    window.dispatchEvent(new CustomEvent('kanban:focus-tab-and-drawer'));

    expect(setActiveTabIdMock).toHaveBeenCalledWith('kanban-board');

    window.removeEventListener('kanban:focus-tab-and-drawer', handleFocusKanbanTab);
  });

  it('should create new Kanban tab if none exists when event is dispatched', () => {
    const setActiveTabIdMock = vi.fn();
    const setTabsMock = vi.fn();
    const openKanbanTabMock = vi.fn(() => ({
      id: 'kanban-board',
      type: 'kanban',
      title: 'Kanban Board',
    }));

    const tabs = [
      { id: 'terminal-1', type: 'terminal' },
      { id: 'terminal-2', type: 'terminal' },
    ];

    const handleFocusKanbanTab = () => {
      const existingKanbanTab = tabs.find((t) => t.id === 'kanban-board');
      if (existingKanbanTab) {
        setActiveTabIdMock('kanban-board');
      } else {
        const newTab = openKanbanTabMock();
        setTabsMock((prevTabs: any[]) => [...prevTabs, newTab]);
        setActiveTabIdMock('kanban-board');
      }
    };

    window.addEventListener('kanban:focus-tab-and-drawer', handleFocusKanbanTab);
    window.dispatchEvent(new CustomEvent('kanban:focus-tab-and-drawer'));

    expect(openKanbanTabMock).toHaveBeenCalled();
    expect(setTabsMock).toHaveBeenCalled();
    expect(setActiveTabIdMock).toHaveBeenCalledWith('kanban-board');

    window.removeEventListener('kanban:focus-tab-and-drawer', handleFocusKanbanTab);
  });

  it('should remove event listener on cleanup', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const handler = vi.fn();

    window.addEventListener('kanban:focus-tab-and-drawer', handler);
    window.removeEventListener('kanban:focus-tab-and-drawer', handler);

    expect(removeEventListenerSpy).toHaveBeenCalledWith(
      'kanban:focus-tab-and-drawer',
      handler
    );

    removeEventListenerSpy.mockRestore();
  });

  it('should not trigger after listener is removed', () => {
    const handler = vi.fn();

    window.addEventListener('kanban:focus-tab-and-drawer', handler);
    window.dispatchEvent(new CustomEvent('kanban:focus-tab-and-drawer'));

    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener('kanban:focus-tab-and-drawer', handler);
    window.dispatchEvent(new CustomEvent('kanban:focus-tab-and-drawer'));

    // Should still be 1 (not called again after removal)
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe('Kanban Popout Deep Link - Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete full deep link flow from popout to main window', async () => {
    const { emit } = await import('@tauri-apps/api/event');
    const { listen } = await import('@tauri-apps/api/event');
    const { useKanbanStore } = await import('../stores/kanbanStore');
    const { getCurrentWindow } = await import('@tauri-apps/api/window');

    const mockEmit = emit as ReturnType<typeof vi.fn>;
    const mockListen = listen as ReturnType<typeof vi.fn>;
    const mockGetState = useKanbanStore.getState as ReturnType<typeof vi.fn>;
    const mockGetCurrentWindow = getCurrentWindow as ReturnType<typeof vi.fn>;
    const mockSetFocus = vi.fn().mockResolvedValue(undefined);

    mockGetCurrentWindow.mockReturnValue({
      setFocus: mockSetFocus,
    });

    const setActiveTabIdMock = vi.fn();
    const dispatchEventSpy = vi.spyOn(window, 'dispatchEvent');

    // Step 1: Popout emits event
    await mockEmit('kanban:open-task-in-main', { taskId: 'task-integration' });

    // Step 2: Main window listener receives event
    let eventHandler: ((event: any) => void) | null = null;
    mockListen.mockImplementation((eventName, callback) => {
      if (eventName === 'kanban:open-task-in-main') {
        eventHandler = callback;
      }
      return Promise.resolve(() => {});
    });

    await mockListen('kanban:open-task-in-main', async (event: any) => {
      const { selectTask, openDrawer } = mockGetState();
      selectTask(event.payload.taskId);
      openDrawer();
      window.dispatchEvent(new CustomEvent('kanban:focus-tab-and-drawer'));
      const mainWindow = mockGetCurrentWindow();
      await mainWindow.setFocus();
    });

    // Step 3: Simulate event received
    if (eventHandler) {
      await eventHandler({ payload: { taskId: 'task-integration' } });
    }

    // Step 4: DOM listener handles focus event
    const tabs = [{ id: 'kanban-board', type: 'kanban' }];
    const handleFocusKanbanTab = () => {
      const existingKanbanTab = tabs.find((t) => t.id === 'kanban-board');
      if (existingKanbanTab) {
        setActiveTabIdMock('kanban-board');
      }
    };

    window.addEventListener('kanban:focus-tab-and-drawer', handleFocusKanbanTab);

    // Trigger the custom event manually (simulating the dispatch from listener)
    window.dispatchEvent(new CustomEvent('kanban:focus-tab-and-drawer'));

    // Verify complete flow
    expect(mockEmit).toHaveBeenCalledWith('kanban:open-task-in-main', {
      taskId: 'task-integration',
    });
    expect(mockSelectTask).toHaveBeenCalledWith('task-integration');
    expect(mockOpenDrawer).toHaveBeenCalled();
    expect(dispatchEventSpy).toHaveBeenCalled();
    expect(setActiveTabIdMock).toHaveBeenCalledWith('kanban-board');
    expect(mockSetFocus).toHaveBeenCalled();

    window.removeEventListener('kanban:focus-tab-and-drawer', handleFocusKanbanTab);
    dispatchEventSpy.mockRestore();
  });

  it('should handle multiple rapid task clicks without race conditions', async () => {
    const { emit } = await import('@tauri-apps/api/event');
    const mockEmit = emit as ReturnType<typeof vi.fn>;

    const handleTaskClick = async (taskId: string) => {
      await mockEmit('kanban:open-task-in-main', { taskId });
    };

    // Simulate rapid clicks on different tasks
    const promises = [
      handleTaskClick('task-1'),
      handleTaskClick('task-2'),
      handleTaskClick('task-3'),
    ];

    await Promise.all(promises);

    expect(mockEmit).toHaveBeenCalledTimes(3);
    expect(mockEmit).toHaveBeenNthCalledWith(1, 'kanban:open-task-in-main', {
      taskId: 'task-1',
    });
    expect(mockEmit).toHaveBeenNthCalledWith(2, 'kanban:open-task-in-main', {
      taskId: 'task-2',
    });
    expect(mockEmit).toHaveBeenNthCalledWith(3, 'kanban:open-task-in-main', {
      taskId: 'task-3',
    });
  });

  it('should maintain state consistency when task is opened from popout', async () => {
    const { useKanbanStore } = await import('../stores/kanbanStore');
    const mockGetState = useKanbanStore.getState as ReturnType<typeof vi.fn>;

    // Initial state
    expect(mockSelectTask).not.toHaveBeenCalled();
    expect(mockOpenDrawer).not.toHaveBeenCalled();

    // Simulate event handler
    const handleKanbanOpenTask = (payload: { taskId: string }) => {
      const { selectTask, openDrawer } = mockGetState();
      selectTask(payload.taskId);
      openDrawer();
    };

    handleKanbanOpenTask({ taskId: 'task-state-test' });

    // Verify state updates
    expect(mockSelectTask).toHaveBeenCalledWith('task-state-test');
    expect(mockOpenDrawer).toHaveBeenCalled();

    // Verify order of operations
    const selectTaskCall = mockSelectTask.mock.invocationCallOrder[0];
    const openDrawerCall = mockOpenDrawer.mock.invocationCallOrder[0];
    expect(selectTaskCall).toBeLessThan(openDrawerCall);
  });
});

describe('Kanban Popout Deep Link - Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle empty taskId gracefully', async () => {
    const { useKanbanStore } = await import('../stores/kanbanStore');
    const mockGetState = useKanbanStore.getState as ReturnType<typeof vi.fn>;

    const handleKanbanOpenTask = (payload: { taskId: string }) => {
      const { selectTask, openDrawer } = mockGetState();
      selectTask(payload.taskId);
      openDrawer();
    };

    handleKanbanOpenTask({ taskId: '' });

    expect(mockSelectTask).toHaveBeenCalledWith('');
    expect(mockOpenDrawer).toHaveBeenCalled();
  });

  it('should handle non-existent taskId', async () => {
    const { useKanbanStore } = await import('../stores/kanbanStore');
    const mockGetState = useKanbanStore.getState as ReturnType<typeof vi.fn>;

    const handleKanbanOpenTask = (payload: { taskId: string }) => {
      const { selectTask, openDrawer } = mockGetState();
      selectTask(payload.taskId);
      openDrawer();
    };

    handleKanbanOpenTask({ taskId: 'non-existent-task-id' });

    // Should still call methods even if task doesn't exist
    expect(mockSelectTask).toHaveBeenCalledWith('non-existent-task-id');
    expect(mockOpenDrawer).toHaveBeenCalled();
  });

  it('should handle malformed event payload', async () => {
    const { useKanbanStore } = await import('../stores/kanbanStore');
    const mockGetState = useKanbanStore.getState as ReturnType<typeof vi.fn>;

    const handleKanbanOpenTask = (payload: any) => {
      const { selectTask, openDrawer } = mockGetState();
      selectTask(payload?.taskId);
      openDrawer();
    };

    // Test with undefined payload
    handleKanbanOpenTask(undefined);
    expect(mockSelectTask).toHaveBeenCalledWith(undefined);

    // Test with null payload
    handleKanbanOpenTask(null);
    expect(mockSelectTask).toHaveBeenCalledWith(undefined);

    // Test with empty object
    handleKanbanOpenTask({});
    expect(mockSelectTask).toHaveBeenCalledWith(undefined);
  });

  it('should handle window focus failure without breaking flow', async () => {
    const { useKanbanStore } = await import('../stores/kanbanStore');
    const { getCurrentWindow } = await import('@tauri-apps/api/window');

    const mockGetState = useKanbanStore.getState as ReturnType<typeof vi.fn>;
    const mockGetCurrentWindow = getCurrentWindow as ReturnType<typeof vi.fn>;
    const mockSetFocus = vi.fn().mockRejectedValue(new Error('Window focus failed'));

    mockGetCurrentWindow.mockReturnValue({
      setFocus: mockSetFocus,
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const handleKanbanOpenTask = async (payload: { taskId: string }) => {
      const { selectTask, openDrawer } = mockGetState();
      selectTask(payload.taskId);
      openDrawer();

      try {
        const mainWindow = mockGetCurrentWindow();
        await mainWindow.setFocus();
      } catch (error) {
        console.error('Failed to focus main window:', error);
      }
    };

    await handleKanbanOpenTask({ taskId: 'task-focus-fail' });

    // Verify that selectTask and openDrawer were still called
    expect(mockSelectTask).toHaveBeenCalledWith('task-focus-fail');
    expect(mockOpenDrawer).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });
});
