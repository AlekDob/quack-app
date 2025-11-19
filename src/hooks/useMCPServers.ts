import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { MCPServer, MCPTemplate } from '../types';

export interface UseMCPServersReturn {
  servers: MCPServer[];
  templates: MCPTemplate[];
  loading: boolean;
  error: string | null;
  refreshServers: () => Promise<void>;
  addServer: (server: MCPServer) => Promise<void>;
  updateServer: (server: MCPServer) => Promise<void>;
  deleteServer: (serverId: string) => Promise<void>;
  testConnection: (server: MCPServer) => Promise<boolean>;
  stopServer: (serverId: string) => Promise<void>;
  restartServer: (serverId: string) => Promise<void>;
  getServerStatus: (serverId: string) => Promise<string>;
}

export function useMCPServers(workingDir?: string): UseMCPServersReturn {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [templates, setTemplates] = useState<MCPTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshServers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const serversList = await invoke<MCPServer[]>('list_mcp_servers', {
        workingDir: workingDir || null,
      });

      setServers(serversList);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(errorMessage);
      console.error('Failed to load MCP servers:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [workingDir]);

  const loadTemplates = useCallback(async () => {
    try {
      const templatesList = await invoke<MCPTemplate[]>('get_mcp_templates');
      setTemplates(templatesList);
    } catch (err) {
      console.error('Failed to load MCP templates:', err);
    }
  }, []);

  const addServer = useCallback(
    async (server: MCPServer) => {
      try {
        await invoke('save_mcp_server', {
          server,
          workingDir: workingDir || null,
        });
        await refreshServers();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to add server: ${errorMessage}`);
      }
    },
    [workingDir, refreshServers]
  );

  const updateServer = useCallback(
    async (server: MCPServer) => {
      try {
        await invoke('save_mcp_server', {
          server,
          workingDir: workingDir || null,
        });
        await refreshServers();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to update server: ${errorMessage}`);
      }
    },
    [workingDir, refreshServers]
  );

  const deleteServer = useCallback(
    async (serverId: string) => {
      try {
        await invoke('delete_mcp_server', {
          serverId,
          workingDir: workingDir || null,
        });
        await refreshServers();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to delete server: ${errorMessage}`);
      }
    },
    [workingDir, refreshServers]
  );

  const testConnection = useCallback(async (server: MCPServer): Promise<boolean> => {
    try {
      const result = await invoke<boolean>('test_mcp_connection', { server });
      return result;
    } catch (err) {
      console.error('Connection test failed:', err);
      return false;
    }
  }, []);

  const stopServer = useCallback(
    async (serverId: string) => {
      try {
        await invoke('stop_mcp_server', { serverId });
        await refreshServers();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to stop server: ${errorMessage}`);
      }
    },
    [refreshServers]
  );

  const restartServer = useCallback(
    async (serverId: string) => {
      try {
        await invoke('restart_mcp_server', {
          serverId,
          workingDir: workingDir || null,
        });
        await refreshServers();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        throw new Error(`Failed to restart server: ${errorMessage}`);
      }
    },
    [workingDir, refreshServers]
  );

  const getServerStatus = useCallback(async (serverId: string): Promise<string> => {
    try {
      const status = await invoke<string>('get_mcp_server_status', { serverId });
      return status;
    } catch (err) {
      console.error('Failed to get server status:', err);
      return 'unknown';
    }
  }, []);

  useEffect(() => {
    refreshServers();
    loadTemplates();
  }, [refreshServers, loadTemplates]);

  return {
    servers,
    templates,
    loading,
    error,
    refreshServers,
    addServer,
    updateServer,
    deleteServer,
    testConnection,
    stopServer,
    restartServer,
    getServerStatus,
  };
}
