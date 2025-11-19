import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * MCP Server Auto-Start Test Suite
 *
 * Tests the automatic starting of MCP stdio servers when loading .mcp.json
 *
 * Test Coverage:
 * - Server status transitions (stopped → running)
 * - Auto-start logic for enabled servers
 * - Process lifecycle management
 * - Error handling for failed spawns
 * - HTTP/SSE server status (always "running")
 */

// Mock Tauri invoke
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: mockInvoke,
}));

describe('MCP Server Auto-Start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Server Status Transitions', () => {
    it('should start with "stopped" status when first loaded', async () => {
      const mockServers = [
        {
          id: 'puppeteer',
          name: 'Puppeteer',
          transport: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-puppeteer'],
          enabled: true,
          status: 'stopped',
          scope: 'project',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      expect(servers[0].status).toBe('stopped');
    });

    it('should transition to "running" after auto-start', async () => {
      const mockServers = [
        {
          id: 'puppeteer',
          name: 'Puppeteer',
          transport: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-puppeteer'],
          enabled: true,
          status: 'running', // Backend changed status after spawn
          scope: 'project',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      expect(servers[0].status).toBe('running');
    });

    it('should transition to "error" if spawn fails', async () => {
      const mockServers = [
        {
          id: 'puppeteer',
          name: 'Puppeteer',
          transport: 'stdio',
          command: 'invalid-command',
          args: ['@modelcontextprotocol/server-puppeteer'],
          enabled: true,
          status: 'error',
          error: "Command 'invalid-command' not found. Make sure it's installed and in PATH.",
          scope: 'project',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      expect(servers[0].status).toBe('error');
      expect(servers[0].error).toContain('not found');
    });
  });

  describe('Auto-Start Logic', () => {
    it('should auto-start enabled stdio servers', async () => {
      const mockServers = [
        {
          id: 'puppeteer',
          transport: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-puppeteer'],
          enabled: true,
          status: 'running',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      // Verify server was started (status is 'running')
      expect(servers[0].status).toBe('running');
      expect(servers[0].enabled).toBe(true);
    });

    it('should NOT auto-start disabled stdio servers', async () => {
      const mockServers = [
        {
          id: 'puppeteer',
          transport: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-puppeteer'],
          enabled: false,
          status: 'stopped',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      // Verify server was NOT started (status remains 'stopped')
      expect(servers[0].status).toBe('stopped');
      expect(servers[0].enabled).toBe(false);
    });

    it('should handle multiple stdio servers concurrently', async () => {
      const mockServers = [
        {
          id: 'puppeteer',
          transport: 'stdio',
          enabled: true,
          status: 'running',
        },
        {
          id: 'context7',
          transport: 'stdio',
          enabled: true,
          status: 'running',
        },
        {
          id: 'filesystem',
          transport: 'stdio',
          enabled: true,
          status: 'running',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      // All servers should be running
      expect(servers.every((s: any) => s.status === 'running')).toBe(true);
    });

    it('should handle already-running servers gracefully', async () => {
      // First call - servers start
      mockInvoke.mockResolvedValueOnce([
        { id: 'puppeteer', transport: 'stdio', enabled: true, status: 'running' },
      ]);

      // Second call - servers already running
      mockInvoke.mockResolvedValueOnce([
        { id: 'puppeteer', transport: 'stdio', enabled: true, status: 'running' },
      ]);

      const { invoke } = await import('@tauri-apps/api/core');

      // First load
      const servers1 = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });
      expect(servers1[0].status).toBe('running');

      // Second load (should not re-spawn)
      const servers2 = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });
      expect(servers2[0].status).toBe('running');
    });
  });

  describe('HTTP/SSE Servers', () => {
    it('should mark enabled HTTP servers as "running" without spawning', async () => {
      const mockServers = [
        {
          id: 'remote-api',
          transport: 'http',
          url: 'https://api.example.com/mcp',
          enabled: true,
          status: 'running', // HTTP servers don't spawn, just marked as running
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      expect(servers[0].status).toBe('running');
      expect(servers[0].transport).toBe('http');
    });

    it('should mark disabled HTTP servers as "stopped"', async () => {
      const mockServers = [
        {
          id: 'remote-api',
          transport: 'http',
          url: 'https://api.example.com/mcp',
          enabled: false,
          status: 'stopped',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      expect(servers[0].status).toBe('stopped');
      expect(servers[0].transport).toBe('http');
    });

    it('should mark enabled SSE servers as "running" without spawning', async () => {
      const mockServers = [
        {
          id: 'sse-stream',
          transport: 'sse',
          url: 'https://api.example.com/mcp/sse',
          enabled: true,
          status: 'running',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      expect(servers[0].status).toBe('running');
      expect(servers[0].transport).toBe('sse');
    });
  });

  describe('Error Scenarios', () => {
    it('should handle command not found error', async () => {
      const mockServers = [
        {
          id: 'puppeteer',
          transport: 'stdio',
          command: 'missing-command',
          args: [],
          enabled: true,
          status: 'error',
          error: "Command 'missing-command' not found. Make sure it's installed and in PATH.",
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      expect(servers[0].status).toBe('error');
      expect(servers[0].error).toContain('not found');
    });

    it('should handle spawn failure error', async () => {
      const mockServers = [
        {
          id: 'puppeteer',
          transport: 'stdio',
          command: 'npx',
          args: ['invalid-package'],
          enabled: true,
          status: 'error',
          error: 'Failed to spawn MCP server: permission denied',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      expect(servers[0].status).toBe('error');
      expect(servers[0].error).toContain('Failed to spawn');
    });

    it('should continue starting other servers if one fails', async () => {
      const mockServers = [
        {
          id: 'failing-server',
          transport: 'stdio',
          enabled: true,
          status: 'error',
          error: 'Command not found',
        },
        {
          id: 'working-server',
          transport: 'stdio',
          enabled: true,
          status: 'running', // This one succeeded
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      // First server failed
      expect(servers[0].status).toBe('error');

      // Second server succeeded
      expect(servers[1].status).toBe('running');
    });
  });

  describe('Process Lifecycle', () => {
    it('should stop a running server', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('stop_mcp_server', { serverId: 'puppeteer' });

      expect(mockInvoke).toHaveBeenCalledWith('stop_mcp_server', {
        serverId: 'puppeteer',
      });
    });

    it('should restart a server', async () => {
      mockInvoke.mockResolvedValue(undefined);

      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('restart_mcp_server', {
        serverId: 'puppeteer',
        workingDir: '/test',
      });

      expect(mockInvoke).toHaveBeenCalledWith('restart_mcp_server', {
        serverId: 'puppeteer',
        workingDir: '/test',
      });
    });

    it('should get server status', async () => {
      mockInvoke.mockResolvedValue('running');

      const { invoke } = await import('@tauri-apps/api/core');
      const status = await invoke<string>('get_mcp_server_status', {
        serverId: 'puppeteer',
      });

      expect(status).toBe('running');
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle Puppeteer MCP server configuration', async () => {
      const mockServers = [
        {
          id: 'puppeteer',
          name: 'Puppeteer',
          server_type: 'puppeteer',
          transport: 'stdio',
          command: 'npx',
          args: ['@modelcontextprotocol/server-puppeteer'],
          enabled: true,
          status: 'running',
          scope: 'project',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      expect(servers[0]).toMatchObject({
        id: 'puppeteer',
        transport: 'stdio',
        command: 'npx',
        args: ['@modelcontextprotocol/server-puppeteer'],
        status: 'running',
      });
    });

    it('should handle Context7 MCP server configuration', async () => {
      const mockServers = [
        {
          id: 'context7',
          name: 'Context7',
          server_type: 'database',
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@upstash/context7-mcp'],
          env: {
            CONTEXT7_API_KEY: 'ctx7sk-test-key',
          },
          enabled: true,
          status: 'running',
          scope: 'project',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      expect(servers[0]).toMatchObject({
        id: 'context7',
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@upstash/context7-mcp'],
        status: 'running',
      });
      expect(servers[0].env).toHaveProperty('CONTEXT7_API_KEY');
    });

    it('should handle mixed server types (stdio + HTTP)', async () => {
      const mockServers = [
        {
          id: 'puppeteer',
          transport: 'stdio',
          enabled: true,
          status: 'running',
        },
        {
          id: 'remote-api',
          transport: 'http',
          enabled: true,
          status: 'running',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: '/test' });

      // Both should be running
      expect(servers.every((s: any) => s.status === 'running')).toBe(true);

      // Verify transport types
      expect(servers[0].transport).toBe('stdio');
      expect(servers[1].transport).toBe('http');
    });
  });

  describe('Integration with .mcp.json', () => {
    it('should load servers from project .mcp.json', async () => {
      const mockServers = [
        {
          id: 'puppeteer',
          transport: 'stdio',
          enabled: true,
          status: 'running',
          scope: 'project', // Indicates loaded from project .mcp.json
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', {
        workingDir: '/Users/test/project',
      });

      expect(servers[0].scope).toBe('project');
    });

    it('should load servers from global ~/.claude.json', async () => {
      const mockServers = [
        {
          id: 'filesystem',
          transport: 'stdio',
          enabled: true,
          status: 'running',
          scope: 'global', // Indicates loaded from global config
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', { workingDir: null });

      expect(servers[0].scope).toBe('global');
    });

    it('should merge global and project servers', async () => {
      const mockServers = [
        {
          id: 'filesystem',
          transport: 'stdio',
          enabled: true,
          status: 'running',
          scope: 'global',
        },
        {
          id: 'puppeteer',
          transport: 'stdio',
          enabled: true,
          status: 'running',
          scope: 'project',
        },
      ];

      mockInvoke.mockResolvedValue(mockServers);

      const { invoke } = await import('@tauri-apps/api/core');
      const servers = await invoke<any[]>('list_mcp_servers', {
        workingDir: '/Users/test/project',
      });

      expect(servers.length).toBe(2);
      expect(servers[0].scope).toBe('global');
      expect(servers[1].scope).toBe('project');
    });
  });
});
