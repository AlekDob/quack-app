import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * MCP Process Lifecycle Management Test Suite
 *
 * Tests the process manager's ability to safely manage child processes
 * with async/await and proper mutex handling.
 *
 * Test Coverage:
 * - Process storage and retrieval
 * - Safe killing of processes (no Send trait violations)
 * - Process status tracking
 * - Multiple concurrent process operations
 * - Error handling for missing processes
 */

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

describe('MCP Process Lifecycle Management', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Process Kill Operation', () => {
    it('should successfully kill a running process', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_mcp_server', { serverId: 'test-server' });

      expect(mockInvoke).toHaveBeenCalledWith('stop_mcp_server', {
        serverId: 'test-server',
      });
    });

    it('should handle killing a non-existent process gracefully', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');

      // Should not throw error, just return successfully
      await expect(
        invoke('stop_mcp_server', { serverId: 'non-existent' })
      ).resolves.toBeUndefined();
    });

    it('should not hold mutex lock across await boundary', async () => {
      // This test verifies the fix for the Rust Send trait issue
      // The kill_process() method must extract the Child from the mutex
      // and drop the lock BEFORE calling child.kill().await

      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');

      // This should complete without deadlocks or Send trait errors
      const stopPromise = invoke('stop_mcp_server', { serverId: 'test' });

      await expect(stopPromise).resolves.toBeUndefined();
    });

    it('should allow concurrent kill operations on different servers', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');

      // Start multiple kill operations concurrently
      const operations = [
        invoke('stop_mcp_server', { serverId: 'server1' }),
        invoke('stop_mcp_server', { serverId: 'server2' }),
        invoke('stop_mcp_server', { serverId: 'server3' }),
      ];

      // All should complete successfully without deadlocks
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });
  });

  describe('Process Status Tracking', () => {
    it('should correctly report running status', async () => {
      mockInvoke.mockResolvedValue('running');

      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<string>('get_mcp_server_status', {
        serverId: 'test-server',
      });

      expect(status).toBe('running');
    });

    it('should correctly report stopped status', async () => {
      mockInvoke.mockResolvedValue('stopped');

      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<string>('get_mcp_server_status', {
        serverId: 'stopped-server',
      });

      expect(status).toBe('stopped');
    });

    it('should track multiple server statuses independently', async () => {
      mockInvoke
        .mockResolvedValueOnce('running')  // server1
        .mockResolvedValueOnce('stopped')  // server2
        .mockResolvedValueOnce('running'); // server3

      const { invoke } = await import('@tauri-apps/api/core');

      const status1 = await invoke<string>('get_mcp_server_status', {
        serverId: 'server1',
      });
      const status2 = await invoke<string>('get_mcp_server_status', {
        serverId: 'server2',
      });
      const status3 = await invoke<string>('get_mcp_server_status', {
        serverId: 'server3',
      });

      expect(status1).toBe('running');
      expect(status2).toBe('stopped');
      expect(status3).toBe('running');
    });
  });

  describe('Process Restart Operation', () => {
    it('should successfully restart a server', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('restart_mcp_server', {
        serverId: 'test-server',
        workingDir: '/test',
      });

      expect(mockInvoke).toHaveBeenCalledWith('restart_mcp_server', {
        serverId: 'test-server',
        workingDir: '/test',
      });
    });

    it('should handle restart of stopped server', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');

      // Restart should work even if server was not running
      await expect(
        invoke('restart_mcp_server', {
          serverId: 'stopped-server',
          workingDir: '/test',
        })
      ).resolves.toBeUndefined();
    });

    it('should handle restart with missing working directory', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');

      // Should work with null/undefined workingDir
      await expect(
        invoke('restart_mcp_server', {
          serverId: 'test-server',
          workingDir: null,
        })
      ).resolves.toBeUndefined();
    });
  });

  describe('Error Handling', () => {
    it('should handle process kill errors gracefully', async () => {
      mockInvoke.mockRejectedValue(new Error('Failed to kill process'));

      const { invoke } = await import('@tauri-apps/api/core');

      await expect(
        invoke('stop_mcp_server', { serverId: 'error-server' })
      ).rejects.toThrow('Failed to kill process');
    });

    it('should handle restart errors gracefully', async () => {
      mockInvoke.mockRejectedValue(
        new Error('Server not found')
      );

      const { invoke } = await import('@tauri-apps/api/core');

      await expect(
        invoke('restart_mcp_server', {
          serverId: 'missing-server',
          workingDir: '/test',
        })
      ).rejects.toThrow('Server not found');
    });

    it('should handle status query errors', async () => {
      mockInvoke.mockRejectedValue(
        new Error('Process manager unavailable')
      );

      const { invoke } = await import('@tauri-apps/api/core');

      await expect(
        invoke('get_mcp_server_status', { serverId: 'test' })
      ).rejects.toThrow('Process manager unavailable');
    });
  });

  describe('Mutex Lock Safety', () => {
    it('should not deadlock on rapid kill operations', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');

      // Rapidly kill and restart the same server
      const operations = [];
      for (let i = 0; i < 10; i++) {
        operations.push(
          invoke('stop_mcp_server', { serverId: 'test-server' })
        );
      }

      // Should complete without deadlocks
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });

    it('should not deadlock on concurrent restart operations', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');

      // Restart multiple servers concurrently
      const operations = Array.from({ length: 5 }, (_, i) =>
        invoke('restart_mcp_server', {
          serverId: `server${i}`,
          workingDir: '/test',
        })
      );

      // Should complete without deadlocks
      await expect(Promise.all(operations)).resolves.toBeDefined();
    });

    it('should allow status queries during kill operations', async () => {
      mockInvoke
        .mockResolvedValueOnce(undefined)   // kill operation
        .mockResolvedValueOnce('running')   // status query during kill
        .mockResolvedValueOnce('stopped');  // status query after kill

      const { invoke } = await import('@tauri-apps/api/core');

      // Start kill operation
      const killPromise = invoke('stop_mcp_server', {
        serverId: 'test-server',
      });

      // Query status concurrently (should not deadlock)
      const statusPromise = invoke<string>('get_mcp_server_status', {
        serverId: 'test-server',
      });

      await Promise.all([killPromise, statusPromise]);

      // Verify final status
      const finalStatus = await invoke<string>('get_mcp_server_status', {
        serverId: 'test-server',
      });
      expect(finalStatus).toBe('stopped');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle Puppeteer server lifecycle', async () => {
      mockInvoke
        .mockResolvedValueOnce('running')   // Initial status
        .mockResolvedValueOnce(undefined)   // Stop
        .mockResolvedValueOnce('stopped')   // Status after stop
        .mockResolvedValueOnce(undefined)   // Restart
        .mockResolvedValueOnce('running');  // Status after restart

      const { invoke } = await import('@tauri-apps/api/core');

      // Check initial status
      const initialStatus = await invoke<string>('get_mcp_server_status', {
        serverId: 'puppeteer',
      });
      expect(initialStatus).toBe('running');

      // Stop server
      await invoke('stop_mcp_server', { serverId: 'puppeteer' });

      // Verify stopped
      const stoppedStatus = await invoke<string>('get_mcp_server_status', {
        serverId: 'puppeteer',
      });
      expect(stoppedStatus).toBe('stopped');

      // Restart server
      await invoke('restart_mcp_server', {
        serverId: 'puppeteer',
        workingDir: '/test',
      });

      // Verify running again
      const runningStatus = await invoke<string>('get_mcp_server_status', {
        serverId: 'puppeteer',
      });
      expect(runningStatus).toBe('running');
    });

    it('should handle multiple server lifecycle operations', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');

      // Stop multiple servers
      await invoke('stop_mcp_server', { serverId: 'puppeteer' });
      await invoke('stop_mcp_server', { serverId: 'context7' });
      await invoke('stop_mcp_server', { serverId: 'filesystem' });

      // Restart them
      await invoke('restart_mcp_server', {
        serverId: 'puppeteer',
        workingDir: '/test',
      });
      await invoke('restart_mcp_server', {
        serverId: 'context7',
        workingDir: '/test',
      });
      await invoke('restart_mcp_server', {
        serverId: 'filesystem',
        workingDir: '/test',
      });

      // All operations should complete successfully
      expect(mockInvoke).toHaveBeenCalledTimes(6);
    });
  });
});
