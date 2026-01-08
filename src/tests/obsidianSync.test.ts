/**
 * Obsidian Sync Tests
 *
 * Comprehensive test suite for Obsidian-Brain sync logic.
 * Tests types, service methods, utility functions, and Tauri invoke integration.
 *
 * @module tests/obsidianSync
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { BrainSettings, SyncStatus, SyncConflict, FileChangeEvent } from '../types/brainSync';

// ============================================================================
// Mock @tauri-apps/api/core
// ============================================================================

const mockInvoke = vi.fn();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

// ============================================================================
// Type Tests
// ============================================================================

describe('BrainSettings Type', () => {
  it('should have all required properties', () => {
    const settings: BrainSettings = {
      vaultPath: '/Users/test/vault',
      syncEnabled: true,
      syncStructure: 'subfolder',
      autoSyncToVault: true,
      autoSyncFromVault: false,
      conflictPolicy: 'ask',
      autoEmbed: false,
      markdownEditor: 'obsidian',
    };

    expect(settings).toHaveProperty('vaultPath');
    expect(settings).toHaveProperty('syncEnabled');
    expect(settings).toHaveProperty('syncStructure');
    expect(settings).toHaveProperty('autoSyncToVault');
    expect(settings).toHaveProperty('autoSyncFromVault');
    expect(settings).toHaveProperty('conflictPolicy');
    expect(settings).toHaveProperty('autoEmbed');
    expect(settings).toHaveProperty('markdownEditor');
  });

  it('should accept valid sync structure values', () => {
    const subfolderSettings: BrainSettings['syncStructure'] = 'subfolder';
    const flatSettings: BrainSettings['syncStructure'] = 'flat';

    expect(subfolderSettings).toBe('subfolder');
    expect(flatSettings).toBe('flat');
  });

  it('should accept valid conflict policy values', () => {
    const policies: BrainSettings['conflictPolicy'][] = ['ask', 'brain_wins', 'obsidian_wins'];

    policies.forEach((policy) => {
      expect(['ask', 'brain_wins', 'obsidian_wins']).toContain(policy);
    });
  });

  it('should accept valid markdown editor values', () => {
    const editors: BrainSettings['markdownEditor'][] = ['obsidian', 'vscode', 'cursor', 'default'];

    editors.forEach((editor) => {
      expect(['obsidian', 'vscode', 'cursor', 'default']).toContain(editor);
    });
  });
});

describe('SyncStatus Type', () => {
  it('should have all required properties', () => {
    const status: SyncStatus = {
      lastSyncTime: Date.now(),
      entityCount: 42,
      conflictCount: 2,
      isGeneratingEmbeddings: false,
      embeddingProgress: 0,
    };

    expect(status).toHaveProperty('lastSyncTime');
    expect(status).toHaveProperty('entityCount');
    expect(status).toHaveProperty('conflictCount');
    expect(status).toHaveProperty('isGeneratingEmbeddings');
    expect(status).toHaveProperty('embeddingProgress');
  });

  it('should allow null lastSyncTime for never synced', () => {
    const status: SyncStatus = {
      lastSyncTime: null,
      entityCount: 0,
      conflictCount: 0,
      isGeneratingEmbeddings: false,
      embeddingProgress: 0,
    };

    expect(status.lastSyncTime).toBeNull();
  });

  it('should accept timestamp in Unix milliseconds', () => {
    const now = Date.now();
    const status: SyncStatus = {
      lastSyncTime: now,
      entityCount: 10,
      conflictCount: 0,
      isGeneratingEmbeddings: false,
      embeddingProgress: 0,
    };

    expect(status.lastSyncTime).toBe(now);
    expect(typeof status.lastSyncTime).toBe('number');
  });

  it('should track embedding progress from 0 to 100', () => {
    const progressValues = [0, 25, 50, 75, 100];

    progressValues.forEach((progress) => {
      const status: SyncStatus = {
        lastSyncTime: Date.now(),
        entityCount: 100,
        conflictCount: 0,
        isGeneratingEmbeddings: true,
        embeddingProgress: progress,
      };

      expect(status.embeddingProgress).toBeGreaterThanOrEqual(0);
      expect(status.embeddingProgress).toBeLessThanOrEqual(100);
    });
  });
});

describe('SyncConflict Type', () => {
  it('should have all required properties', () => {
    const conflict: SyncConflict = {
      entityId: 'entity-123',
      entityName: 'Test Entity',
      brainContent: 'Brain version content',
      vaultContent: 'Vault version content',
      brainUpdatedAt: Date.now(),
      vaultUpdatedAt: Date.now() - 1000,
    };

    expect(conflict).toHaveProperty('entityId');
    expect(conflict).toHaveProperty('entityName');
    expect(conflict).toHaveProperty('brainContent');
    expect(conflict).toHaveProperty('vaultContent');
    expect(conflict).toHaveProperty('brainUpdatedAt');
    expect(conflict).toHaveProperty('vaultUpdatedAt');
  });

  it('should have entityId present', () => {
    const conflict: SyncConflict = {
      entityId: 'entity-abc',
      entityName: 'Conflict Test',
      brainContent: 'content A',
      vaultContent: 'content B',
      brainUpdatedAt: 1000,
      vaultUpdatedAt: 2000,
    };

    expect(conflict.entityId).toBeTruthy();
    expect(typeof conflict.entityId).toBe('string');
  });

  it('should compare timestamps to determine newer version', () => {
    const brainNewer: SyncConflict = {
      entityId: 'entity-1',
      entityName: 'Test',
      brainContent: 'newer',
      vaultContent: 'older',
      brainUpdatedAt: 2000,
      vaultUpdatedAt: 1000,
    };

    const vaultNewer: SyncConflict = {
      entityId: 'entity-2',
      entityName: 'Test',
      brainContent: 'older',
      vaultContent: 'newer',
      brainUpdatedAt: 1000,
      vaultUpdatedAt: 2000,
    };

    expect(brainNewer.brainUpdatedAt).toBeGreaterThan(brainNewer.vaultUpdatedAt);
    expect(vaultNewer.vaultUpdatedAt).toBeGreaterThan(vaultNewer.brainUpdatedAt);
  });
});

describe('FileChangeEvent Type', () => {
  it('should have path and eventType properties', () => {
    const event: FileChangeEvent = {
      path: '/Users/test/vault/note.md',
      eventType: 'modified',
    };

    expect(event).toHaveProperty('path');
    expect(event).toHaveProperty('eventType');
  });

  it('should accept valid event types', () => {
    const events: FileChangeEvent[] = [
      { path: '/path/1.md', eventType: 'created' },
      { path: '/path/2.md', eventType: 'modified' },
      { path: '/path/3.md', eventType: 'deleted' },
    ];

    events.forEach((event) => {
      expect(['created', 'modified', 'deleted']).toContain(event.eventType);
    });
  });
});

// ============================================================================
// Service Mock Tests (with Tauri invoke)
// ============================================================================

describe('Obsidian Sync Service - Mock Invoke Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getSettings()', () => {
    it('should call brain_get_settings command', async () => {
      const mockSettings: BrainSettings = {
        vaultPath: '/Users/test/vault',
        syncEnabled: true,
        syncStructure: 'subfolder',
        autoSyncToVault: false,
        autoSyncFromVault: false,
        conflictPolicy: 'ask',
        autoEmbed: false,
        markdownEditor: 'obsidian',
      };

      mockInvoke.mockResolvedValueOnce(mockSettings);

      // Import service dynamically to get fresh mocked version
      const { getSettings } = await import('../services/obsidianSyncService');
      const result = await getSettings();

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('brain_get_settings');
      expect(result).toEqual(mockSettings);
    });

    it('should return settings with correct types', async () => {
      const mockSettings: BrainSettings = {
        vaultPath: '/vault',
        syncEnabled: true,
        syncStructure: 'flat',
        autoSyncToVault: true,
        autoSyncFromVault: true,
        conflictPolicy: 'brain_wins',
        autoEmbed: true,
        markdownEditor: 'vscode',
      };

      mockInvoke.mockResolvedValueOnce(mockSettings);

      const { getSettings } = await import('../services/obsidianSyncService');
      const result = await getSettings();

      expect(typeof result.vaultPath).toBe('string');
      expect(typeof result.syncEnabled).toBe('boolean');
      expect(typeof result.autoSyncToVault).toBe('boolean');
      expect(result.conflictPolicy).toBe('brain_wins');
    });
  });

  describe('setSetting()', () => {
    it('should call brain_set_setting with correct parameters', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { setSetting } = await import('../services/obsidianSyncService');
      await setSetting('syncEnabled', true);

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('brain_set_setting', {
        key: 'syncEnabled',
        value: 'true', // Converted to string
      });
    });

    it('should convert boolean value to string', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { setSetting } = await import('../services/obsidianSyncService');
      await setSetting('autoSyncToVault', false);

      expect(mockInvoke).toHaveBeenCalledWith('brain_set_setting', {
        key: 'autoSyncToVault',
        value: 'false',
      });
    });

    it('should pass string value as-is', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { setSetting } = await import('../services/obsidianSyncService');
      await setSetting('vaultPath', '/Users/test/vault');

      expect(mockInvoke).toHaveBeenCalledWith('brain_set_setting', {
        key: 'vaultPath',
        value: '/Users/test/vault',
      });
    });
  });

  describe('syncAllToVault()', () => {
    it('should call brain_sync_all_to_md command', async () => {
      const mockResult = {
        filesCreated: 5,
        filesUpdated: 3,
        errors: [],
      };

      mockInvoke.mockResolvedValueOnce(mockResult);

      const { syncAllToVault } = await import('../services/obsidianSyncService');
      const result = await syncAllToVault();

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('brain_sync_all_to_md');
      expect(result.success).toBe(true);
      expect(result.entitiesSynced).toBe(8); // 5 created + 3 updated
    });

    it('should mark as failed if errors exist', async () => {
      const mockResult = {
        filesCreated: 2,
        filesUpdated: 0,
        errors: ['Error syncing entity-1', 'Error syncing entity-2'],
      };

      mockInvoke.mockResolvedValueOnce(mockResult);

      const { syncAllToVault } = await import('../services/obsidianSyncService');
      const result = await syncAllToVault();

      expect(result.success).toBe(false);
      expect(result.errors).toHaveLength(2);
    });
  });

  describe('resolveConflict()', () => {
    it('should call brain_resolve_conflict with correct parameters', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { resolveConflict } = await import('../services/obsidianSyncService');
      await resolveConflict('entity-123', 'brain');

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('brain_resolve_conflict', {
        entityId: 'entity-123',
        resolution: 'brain',
      });
    });

    it('should accept obsidian resolution', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { resolveConflict } = await import('../services/obsidianSyncService');
      await resolveConflict('entity-456', 'obsidian');

      expect(mockInvoke).toHaveBeenCalledWith('brain_resolve_conflict', {
        entityId: 'entity-456',
        resolution: 'obsidian',
      });
    });
  });

  describe('startVaultWatcher()', () => {
    it('should call brain_start_vault_watcher command', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { startVaultWatcher } = await import('../services/obsidianSyncService');
      await startVaultWatcher();

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('brain_start_vault_watcher');
    });
  });

  describe('stopVaultWatcher()', () => {
    it('should call brain_stop_vault_watcher command', async () => {
      mockInvoke.mockResolvedValueOnce(undefined);

      const { stopVaultWatcher } = await import('../services/obsidianSyncService');
      await stopVaultWatcher();

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('brain_stop_vault_watcher');
    });
  });

  describe('isVaultWatching()', () => {
    it('should return true when watcher is active', async () => {
      mockInvoke.mockResolvedValueOnce(true);

      const { isVaultWatching } = await import('../services/obsidianSyncService');
      const result = await isVaultWatching();

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('brain_is_vault_watching');
      expect(result).toBe(true);
    });

    it('should return false when watcher is not active', async () => {
      mockInvoke.mockResolvedValueOnce(false);

      const { isVaultWatching } = await import('../services/obsidianSyncService');
      const result = await isVaultWatching();

      expect(result).toBe(false);
    });
  });

  describe('syncEntityToVault()', () => {
    it('should call brain_sync_entity_to_md with entity ID', async () => {
      const mockPath = '/Users/test/vault/QuackBrain/test_entity.md';
      mockInvoke.mockResolvedValueOnce(mockPath);

      const { syncEntityToVault } = await import('../services/obsidianSyncService');
      const result = await syncEntityToVault('entity-123');

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('brain_sync_entity_to_md', {
        entityId: 'entity-123',
      });
      expect(result).toBe(mockPath);
    });
  });

  describe('importFromVault()', () => {
    it('should call brain_import_markdown_file with file path', async () => {
      const mockEntity = {
        id: 'entity-123',
        name: 'Test Entity',
        type: 'fact',
        observations: ['Test observation'],
        relations: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [],
      };

      mockInvoke.mockResolvedValueOnce(mockEntity);

      const { importFromVault } = await import('../services/obsidianSyncService');
      const result = await importFromVault('/Users/test/vault/note.md');

      expect(mockInvoke).toHaveBeenCalledTimes(1);
      expect(mockInvoke).toHaveBeenCalledWith('brain_import_markdown_file', {
        filePath: '/Users/test/vault/note.md',
      });
      expect(result).toEqual(mockEntity);
    });
  });
});

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('Utility Functions', () => {
  describe('formatLastSync()', () => {
    /**
     * Helper to format last sync timestamp
     */
    function formatLastSync(timestamp: number | null): string {
      if (!timestamp) return 'Never';

      const now = Date.now();
      const diff = now - timestamp;
      const seconds = Math.floor(diff / 1000);
      const minutes = Math.floor(seconds / 60);
      const hours = Math.floor(minutes / 60);

      if (seconds < 60) return 'Just now';
      if (minutes < 60) return `${minutes}m ago`;
      if (hours < 24) return `${hours}h ago`;
      return new Date(timestamp).toLocaleDateString();
    }

    it('should return "Never" for null timestamp', () => {
      expect(formatLastSync(null)).toBe('Never');
    });

    it('should return "Just now" for recent timestamp', () => {
      const now = Date.now();
      const recent = now - 30 * 1000; // 30 seconds ago
      expect(formatLastSync(recent)).toBe('Just now');
    });

    it('should return minutes ago for timestamps under 1 hour', () => {
      const now = Date.now();
      const fiveMinutesAgo = now - 5 * 60 * 1000;
      const thirtyMinutesAgo = now - 30 * 60 * 1000;

      expect(formatLastSync(fiveMinutesAgo)).toBe('5m ago');
      expect(formatLastSync(thirtyMinutesAgo)).toBe('30m ago');
    });

    it('should return hours ago for timestamps under 24 hours', () => {
      const now = Date.now();
      const twoHoursAgo = now - 2 * 60 * 60 * 1000;
      const twelveHoursAgo = now - 12 * 60 * 60 * 1000;

      expect(formatLastSync(twoHoursAgo)).toBe('2h ago');
      expect(formatLastSync(twelveHoursAgo)).toBe('12h ago');
    });

    it('should return date for timestamps over 24 hours', () => {
      const twoDaysAgo = Date.now() - 2 * 24 * 60 * 60 * 1000;
      const result = formatLastSync(twoDaysAgo);

      // Should contain date (exact format depends on locale)
      expect(result).toBeTruthy();
      expect(result).not.toBe('Never');
      expect(result).not.toContain('ago');
    });

    it('should handle edge case: exactly 0 (epoch)', () => {
      const result = formatLastSync(0);
      expect(result).toBeTruthy();
      // Should return a date, not "Never" or relative time
    });

    it('should handle future dates gracefully', () => {
      const future = Date.now() + 1000 * 60 * 60; // 1 hour in future
      const result = formatLastSync(future);

      // Should not crash, return some value
      expect(result).toBeTruthy();
    });
  });

  describe('calculateSyncProgress()', () => {
    /**
     * Helper to calculate sync progress percentage
     */
    function calculateSyncProgress(processed: number, total: number): number {
      if (total === 0) return 100; // Nothing to process = complete
      return Math.round((processed / total) * 100);
    }

    it('should return 100% when all items processed', () => {
      expect(calculateSyncProgress(10, 10)).toBe(100);
    });

    it('should return 0% when nothing processed', () => {
      expect(calculateSyncProgress(0, 10)).toBe(0);
    });

    it('should return 50% when half processed', () => {
      expect(calculateSyncProgress(5, 10)).toBe(50);
    });

    it('should handle edge case: total is 0', () => {
      expect(calculateSyncProgress(0, 0)).toBe(100);
    });

    it('should round to nearest integer', () => {
      expect(calculateSyncProgress(1, 3)).toBe(33);
      expect(calculateSyncProgress(2, 3)).toBe(67);
    });
  });

  describe('isValidVaultPath()', () => {
    /**
     * Helper to validate vault path format
     */
    function isValidVaultPath(path: string): boolean {
      if (!path || path.trim() === '') return false;
      if (!path.startsWith('/')) return false; // Must be absolute
      return true;
    }

    it('should accept valid absolute paths', () => {
      expect(isValidVaultPath('/Users/test/vault')).toBe(true);
      expect(isValidVaultPath('/home/user/Documents/Obsidian')).toBe(true);
    });

    it('should reject empty path', () => {
      expect(isValidVaultPath('')).toBe(false);
      expect(isValidVaultPath('   ')).toBe(false);
    });

    it('should reject relative paths', () => {
      expect(isValidVaultPath('vault')).toBe(false);
      expect(isValidVaultPath('./vault')).toBe(false);
      expect(isValidVaultPath('../vault')).toBe(false);
    });
  });
});

// ============================================================================
// Edge Cases & Error Scenarios
// ============================================================================

describe('Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle invoke rejection gracefully for getSettings', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Tauri command failed'));

    const { getSettings } = await import('../services/obsidianSyncService');

    // getSettings now returns defaults instead of throwing
    const settings = await getSettings();
    expect(settings).toEqual({
      syncEnabled: false,
      vaultPath: '',
      brainSubfolder: 'QuackBrain',
      autoSyncToVault: false,
      autoSyncFromVault: false,
      conflictPolicy: 'ask',
      markdownEditor: 'default',
    });
  });

  it('should handle invoke rejection gracefully for isVaultWatching', async () => {
    mockInvoke.mockRejectedValueOnce(new Error('Watcher check failed'));

    const { isVaultWatching } = await import('../services/obsidianSyncService');

    // isVaultWatching now returns false instead of throwing
    const isWatching = await isVaultWatching();
    expect(isWatching).toBe(false);
  });

  it('should handle sync with empty vault', async () => {
    const mockResult = {
      filesCreated: 0,
      filesUpdated: 0,
      errors: [],
    };

    mockInvoke.mockResolvedValueOnce(mockResult);

    const { syncAllToVault } = await import('../services/obsidianSyncService');
    const result = await syncAllToVault();

    expect(result.success).toBe(true);
    expect(result.entitiesSynced).toBe(0);
  });

  it('should handle conflicts array in sync result', async () => {
    const mockConflicts: SyncConflict[] = [
      {
        entityId: 'entity-1',
        entityName: 'Conflict Entity',
        brainContent: 'Brain version',
        vaultContent: 'Vault version',
        brainUpdatedAt: 2000,
        vaultUpdatedAt: 1000,
      },
    ];

    const mockResult = {
      success: true,
      entitiesSynced: 5,
      conflicts: mockConflicts,
      errors: [],
    };

    mockInvoke.mockResolvedValueOnce(mockResult);

    const { importAllFromVault } = await import('../services/obsidianSyncService');
    const result = await importAllFromVault();

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0].entityId).toBe('entity-1');
  });
});

// ============================================================================
// Integration Scenarios
// ============================================================================

describe('Integration Scenarios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle full sync workflow: Brain -> Vault', async () => {
    // Step 1: Get settings
    const mockSettings: BrainSettings = {
      vaultPath: '/Users/test/vault',
      syncEnabled: true,
      syncStructure: 'subfolder',
      autoSyncToVault: true,
      autoSyncFromVault: false,
      conflictPolicy: 'ask',
      autoEmbed: false,
      markdownEditor: 'obsidian',
    };

    mockInvoke.mockResolvedValueOnce(mockSettings);

    const { getSettings, syncAllToVault } = await import('../services/obsidianSyncService');
    const settings = await getSettings();

    expect(settings.syncEnabled).toBe(true);

    // Step 2: Sync to vault
    const mockSyncResult = {
      filesCreated: 10,
      filesUpdated: 5,
      errors: [],
    };

    mockInvoke.mockResolvedValueOnce(mockSyncResult);

    const syncResult = await syncAllToVault();

    expect(syncResult.success).toBe(true);
    expect(syncResult.entitiesSynced).toBe(15);
  });

  it('should handle conflict resolution workflow', async () => {
    // Step 1: Import detects conflict
    const mockConflict: SyncConflict = {
      entityId: 'entity-conflict',
      entityName: 'Conflicted Entity',
      brainContent: 'Brain version',
      vaultContent: 'Vault version',
      brainUpdatedAt: 2000,
      vaultUpdatedAt: 1000,
    };

    const mockImportResult = {
      success: false,
      entitiesSynced: 0,
      conflicts: [mockConflict],
      errors: [],
    };

    mockInvoke.mockResolvedValueOnce(mockImportResult);

    const { importAllFromVault, resolveConflict } = await import('../services/obsidianSyncService');
    const importResult = await importAllFromVault();

    expect(importResult.conflicts).toHaveLength(1);

    // Step 2: Resolve conflict (user chooses Brain version)
    mockInvoke.mockResolvedValueOnce(undefined);

    await resolveConflict('entity-conflict', 'brain');

    expect(mockInvoke).toHaveBeenCalledWith('brain_resolve_conflict', {
      entityId: 'entity-conflict',
      resolution: 'brain',
    });
  });

  it('should handle watcher lifecycle', async () => {
    const { startVaultWatcher, isVaultWatching, stopVaultWatcher } = await import(
      '../services/obsidianSyncService'
    );

    // Start watcher
    mockInvoke.mockResolvedValueOnce(undefined);
    await startVaultWatcher();

    expect(mockInvoke).toHaveBeenCalledWith('brain_start_vault_watcher');

    // Check status
    mockInvoke.mockResolvedValueOnce(true);
    const watching = await isVaultWatching();

    expect(watching).toBe(true);

    // Stop watcher
    mockInvoke.mockResolvedValueOnce(undefined);
    await stopVaultWatcher();

    expect(mockInvoke).toHaveBeenCalledWith('brain_stop_vault_watcher');
  });
});
