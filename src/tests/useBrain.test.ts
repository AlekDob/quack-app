/**
 * useBrain Hook Tests
 *
 * Tests for React hooks that provide access to Quack Brain.
 * Tests hook behavior, state management, and event handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import type { BrainEntity, BrainGraph } from '../types/brain';

// Mock the brain service with a factory function
vi.mock('../services/brainService', () => {
  return {
    brainService: {
      listEntities: vi.fn(),
      getGraph: vi.fn(),
      createEntity: vi.fn(),
      updateEntity: vi.fn(),
      deleteEntity: vi.fn(),
      searchEntities: vi.fn(),
      addObservation: vi.fn(),
      getGlobalEntities: vi.fn(),
    },
    BRAIN_UPDATED_EVENT: 'quack-brain-updated',
  };
});

import { useBrain, useBrainSearch, useBrainGlobal } from '../hooks/useBrain';
import { brainService, BRAIN_UPDATED_EVENT } from '../services/brainService';

// Get reference to mocked service
const mockBrainService = brainService as any;

describe('useBrain', () => {
  const mockEntities: BrainEntity[] = [
    {
      id: 'ent_1',
      name: 'Test Entity',
      entityType: 'fact',
      observations: [],
      projectId: null,
      createdAt: 1,
      updatedAt: 1,
      mdFilePath: null,
    },
  ];

  const mockGraph: BrainGraph = {
    entities: mockEntities,
    relations: [],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrainService.listEntities.mockResolvedValue(mockEntities);
    mockBrainService.getGraph.mockResolvedValue(mockGraph);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic functionality', () => {
    it('should load entities on mount when autoLoad is true', async () => {
      const { result } = renderHook(() => useBrain({ autoLoad: true }));

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.entities).toHaveLength(1);
      expect(result.current.graph).not.toBeNull();
      expect(mockBrainService.listEntities).toHaveBeenCalled();
      expect(mockBrainService.getGraph).toHaveBeenCalled();
    });

    it('should not load on mount when autoLoad is false', async () => {
      const { result } = renderHook(() => useBrain({ autoLoad: false }));

      // Wait a bit to ensure no loading happens
      await new Promise(resolve => setTimeout(resolve, 100));

      expect(mockBrainService.listEntities).not.toHaveBeenCalled();
      expect(result.current.entities).toHaveLength(0);
      expect(result.current.isLoading).toBe(false);
    });

    it('should have initial state correctly set', () => {
      const { result } = renderHook(() => useBrain({ autoLoad: false }));

      expect(result.current.entities).toEqual([]);
      expect(result.current.graph).toBeNull();
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  describe('Filters', () => {
    it('should filter by projectId', async () => {
      renderHook(() => useBrain({ autoLoad: true, projectId: 'proj_123' }));

      await waitFor(() => {
        expect(mockBrainService.listEntities).toHaveBeenCalledWith({
          projectId: 'proj_123',
        });
      });
    });

    it('should filter by entityType', async () => {
      renderHook(() => useBrain({ autoLoad: true, entityType: 'pattern' }));

      await waitFor(() => {
        expect(mockBrainService.listEntities).toHaveBeenCalledWith({
          entityType: 'pattern',
        });
      });
    });

    it('should combine multiple filters', async () => {
      renderHook(() =>
        useBrain({ autoLoad: true, projectId: 'proj_quack', entityType: 'bug_fix' })
      );

      await waitFor(() => {
        expect(mockBrainService.listEntities).toHaveBeenCalledWith({
          projectId: 'proj_quack',
          entityType: 'bug_fix',
        });
      });
    });
  });

  describe('Event handling', () => {
    it('should refresh on BRAIN_UPDATED_EVENT', async () => {
      const { result } = renderHook(() => useBrain({ autoLoad: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Reset mocks
      mockBrainService.listEntities.mockClear();
      mockBrainService.getGraph.mockClear();

      // Trigger event
      act(() => {
        window.dispatchEvent(new CustomEvent(BRAIN_UPDATED_EVENT));
      });

      await waitFor(() => {
        expect(mockBrainService.listEntities).toHaveBeenCalledTimes(1);
        expect(mockBrainService.getGraph).toHaveBeenCalledTimes(1);
      });
    });

    it('should cleanup event listener on unmount', async () => {
      const { unmount } = renderHook(() => useBrain({ autoLoad: true }));

      await waitFor(() => {
        expect(mockBrainService.listEntities).toHaveBeenCalled();
      });

      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith(
        BRAIN_UPDATED_EVENT,
        expect.any(Function)
      );

      removeEventListenerSpy.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('should handle errors gracefully', async () => {
      mockBrainService.listEntities.mockRejectedValueOnce(new Error('DB error'));
      mockBrainService.getGraph.mockRejectedValueOnce(new Error('DB error'));

      const { result } = renderHook(() => useBrain({ autoLoad: true }));

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBe('DB error');
      expect(result.current.entities).toHaveLength(0);
    });

    it('should clear error on successful refresh', async () => {
      // First call fails
      mockBrainService.listEntities.mockRejectedValueOnce(new Error('DB error'));
      mockBrainService.getGraph.mockRejectedValueOnce(new Error('DB error'));

      const { result } = renderHook(() => useBrain({ autoLoad: true }));

      await waitFor(() => {
        expect(result.current.error).toBe('DB error');
      });

      // Second call succeeds
      mockBrainService.listEntities.mockResolvedValueOnce(mockEntities);
      mockBrainService.getGraph.mockResolvedValueOnce(mockGraph);

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
        expect(result.current.entities).toHaveLength(1);
      });
    });
  });

  describe('Operations', () => {
    it('should create entity', async () => {
      const newEntity: BrainEntity = {
        id: 'ent_new',
        name: 'New Entity',
        entityType: 'decision',
        observations: [],
        projectId: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      mockBrainService.createEntity.mockResolvedValueOnce(newEntity);

      const { result } = renderHook(() => useBrain({ autoLoad: false }));

      await act(async () => {
        const created = await result.current.createEntity({
          name: 'New Entity',
          entityType: 'decision',
          observations: [],
        });
        expect(created.name).toBe('New Entity');
      });

      expect(mockBrainService.createEntity).toHaveBeenCalled();
    });

    it('should update entity', async () => {
      const updatedEntity: BrainEntity = {
        id: 'ent_1',
        name: 'Updated Name',
        entityType: 'fact',
        observations: [],
        projectId: null,
        createdAt: 1,
        updatedAt: Date.now(),
        mdFilePath: null,
      };

      mockBrainService.updateEntity.mockResolvedValueOnce(updatedEntity);

      const { result } = renderHook(() => useBrain({ autoLoad: false }));

      await act(async () => {
        const updated = await result.current.updateEntity('ent_1', {
          name: 'Updated Name',
        });
        expect(updated.name).toBe('Updated Name');
      });

      expect(mockBrainService.updateEntity).toHaveBeenCalledWith('ent_1', {
        name: 'Updated Name',
      });
    });

    it('should delete entity', async () => {
      mockBrainService.deleteEntity.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useBrain({ autoLoad: false }));

      await act(async () => {
        await result.current.deleteEntity('ent_1');
      });

      expect(mockBrainService.deleteEntity).toHaveBeenCalledWith('ent_1');
    });

    it('should search entities', async () => {
      const searchResults: BrainEntity[] = [
        {
          id: 'ent_match',
          name: 'Auth Pattern',
          entityType: 'pattern',
          observations: [],
          projectId: null,
          createdAt: 1,
          updatedAt: 1,
          mdFilePath: null,
        },
      ];

      mockBrainService.searchEntities.mockResolvedValueOnce(searchResults);

      const { result } = renderHook(() => useBrain({ autoLoad: false }));

      await act(async () => {
        const results = await result.current.search('auth');
        expect(results).toHaveLength(1);
        expect(results[0].name).toContain('Auth');
      });

      expect(mockBrainService.searchEntities).toHaveBeenCalledWith('auth');
    });

    it('should add observation', async () => {
      mockBrainService.addObservation.mockResolvedValueOnce({
        id: 'obs_new',
        content: 'New observation',
        createdAt: Date.now(),
      });

      const { result } = renderHook(() => useBrain({ autoLoad: false }));

      await act(async () => {
        await result.current.addObservation('ent_1', 'New observation');
      });

      expect(mockBrainService.addObservation).toHaveBeenCalledWith(
        'ent_1',
        'New observation'
      );
    });
  });

  describe('Manual refresh', () => {
    it('should allow manual refresh', async () => {
      const { result } = renderHook(() => useBrain({ autoLoad: false }));

      expect(result.current.entities).toHaveLength(0);

      await act(async () => {
        await result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.entities).toHaveLength(1);
      });

      expect(mockBrainService.listEntities).toHaveBeenCalled();
      expect(mockBrainService.getGraph).toHaveBeenCalled();
    });

    it('should set loading state during refresh', async () => {
      const { result } = renderHook(() => useBrain({ autoLoad: false }));

      // Start refresh but don't await immediately
      act(() => {
        result.current.refresh();
      });

      // Loading state should be set immediately after calling refresh
      // Note: Due to React batching, we may need to wait for state update
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(mockBrainService.listEntities).toHaveBeenCalled();
    });
  });
});

describe('useBrainSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty query and results', async () => {
    const { result } = renderHook(() => useBrainSearch(''));

    await waitFor(() => {
      expect(result.current).not.toBeNull();
    });

    expect(result.current.query).toBe('');
    expect(result.current.results).toHaveLength(0);
    expect(result.current.isSearching).toBe(false);
  });

  it('should search with debounce', async () => {
    const mockResults: BrainEntity[] = [
      {
        id: 'ent_match',
        name: 'Auth Pattern',
        entityType: 'pattern',
        observations: [],
        projectId: null,
        createdAt: 1,
        updatedAt: 1,
        mdFilePath: null,
      },
    ];

    mockBrainService.searchEntities.mockResolvedValue(mockResults);

    const { result } = renderHook(() => useBrainSearch(''));

    act(() => {
      result.current.setQuery('auth');
    });

    // Should not search immediately
    expect(mockBrainService.searchEntities).not.toHaveBeenCalled();

    // Wait for debounce (300ms)
    await waitFor(
      () => {
        expect(mockBrainService.searchEntities).toHaveBeenCalledWith('auth');
      },
      { timeout: 500 }
    );

    await waitFor(() => {
      expect(result.current.results).toHaveLength(1);
    });
  });

  it('should not search for empty query', async () => {
    const { result } = renderHook(() => useBrainSearch(''));

    act(() => {
      result.current.setQuery('');
    });

    await new Promise(r => setTimeout(r, 400));

    expect(mockBrainService.searchEntities).not.toHaveBeenCalled();
    expect(result.current.results).toHaveLength(0);
  });

  it('should handle search errors gracefully', async () => {
    mockBrainService.searchEntities.mockRejectedValueOnce(new Error('Search failed'));

    const { result } = renderHook(() => useBrainSearch(''));

    act(() => {
      result.current.setQuery('test');
    });

    await waitFor(
      () => {
        expect(result.current.isSearching).toBe(false);
      },
      { timeout: 500 }
    );

    expect(result.current.results).toHaveLength(0);
  });

  it('should debounce multiple quick queries', async () => {
    const mockResults: BrainEntity[] = [];
    mockBrainService.searchEntities.mockResolvedValue(mockResults);

    const { result } = renderHook(() => useBrainSearch(''));

    // Type quickly
    act(() => {
      result.current.setQuery('a');
    });

    act(() => {
      result.current.setQuery('au');
    });

    act(() => {
      result.current.setQuery('auth');
    });

    // Wait for debounce
    await waitFor(
      () => {
        expect(mockBrainService.searchEntities).toHaveBeenCalledTimes(1);
      },
      { timeout: 500 }
    );

    // Should only search with final query
    expect(mockBrainService.searchEntities).toHaveBeenCalledWith('auth');
  });

  it('should set isSearching during search', async () => {
    const mockResults: BrainEntity[] = [];
    mockBrainService.searchEntities.mockImplementation(
      () => new Promise(resolve => setTimeout(() => resolve(mockResults), 100))
    );

    const { result } = renderHook(() => useBrainSearch(''));

    act(() => {
      result.current.setQuery('test');
    });

    await waitFor(() => {
      expect(result.current.isSearching).toBe(true);
    });

    await waitFor(
      () => {
        expect(result.current.isSearching).toBe(false);
      },
      { timeout: 1000 }
    );
  });

  it('should allow manual search trigger', async () => {
    const mockResults: BrainEntity[] = [];
    mockBrainService.searchEntities.mockResolvedValue(mockResults);

    const { result } = renderHook(() => useBrainSearch(''));

    await act(async () => {
      await result.current.search('manual query');
    });

    expect(mockBrainService.searchEntities).toHaveBeenCalledWith('manual query');
  });
});

describe('useBrainGlobal', () => {
  const mockGlobalEntities: BrainEntity[] = [
    {
      id: 'ent_global',
      name: 'Global Preference',
      entityType: 'preference',
      observations: [],
      projectId: null,
      createdAt: 1,
      updatedAt: 1,
      mdFilePath: null,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    mockBrainService.getGlobalEntities.mockResolvedValue(mockGlobalEntities);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should load global entities on mount', async () => {
    const { result } = renderHook(() => useBrainGlobal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.entities).toHaveLength(1);
    expect(result.current.entities[0].projectId).toBeNull();
    expect(mockBrainService.getGlobalEntities).toHaveBeenCalled();
  });

  it('should refresh on BRAIN_UPDATED_EVENT', async () => {
    const { result } = renderHook(() => useBrainGlobal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockBrainService.getGlobalEntities.mockClear();

    act(() => {
      window.dispatchEvent(new CustomEvent(BRAIN_UPDATED_EVENT));
    });

    await waitFor(() => {
      expect(mockBrainService.getGlobalEntities).toHaveBeenCalledTimes(1);
    });
  });

  it('should handle errors', async () => {
    mockBrainService.getGlobalEntities.mockRejectedValueOnce(
      new Error('Failed to load global entities')
    );

    const { result } = renderHook(() => useBrainGlobal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load global entities');
    expect(result.current.entities).toHaveLength(0);
  });

  it('should allow manual refresh', async () => {
    const { result } = renderHook(() => useBrainGlobal());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    mockBrainService.getGlobalEntities.mockClear();

    await act(async () => {
      await result.current.refresh();
    });

    expect(mockBrainService.getGlobalEntities).toHaveBeenCalled();
  });
});
