import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface SlashCommand {
  name: string;
  description: string;
  content: string;
  isBuiltin: boolean;
  parameters?: string[];
}

export interface SlashCommandsResponse {
  builtin: SlashCommand[];
  custom: SlashCommand[];
}

export function useSlashCommands(basePath: string) {
  const [commands, setCommands] = useState<SlashCommandsResponse>({
    builtin: [],
    custom: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load commands from backend
  const loadCommands = useCallback(async () => {
    if (!basePath) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const result = await invoke<SlashCommandsResponse>('list_slash_commands', {
        basePath
      });
      setCommands(result);
    } catch (err) {
      console.error('Failed to load slash commands:', err);
      setError(err instanceof Error ? err.message : 'Failed to load commands');
    } finally {
      setLoading(false);
    }
  }, [basePath]);

  // Create new custom command
  const createCommand = useCallback(async (
    name: string,
    description: string,
    content: string,
    parameters: string[] = []
  ): Promise<void> => {
    if (!basePath) throw new Error('No base path set');

    // Format command content with frontmatter
    const frontmatter = [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      parameters.length > 0 ? `parameters: [${parameters.join(', ')}]` : '',
      '---',
      ''
    ].filter(Boolean).join('\n');

    const fullContent = frontmatter + content;

    await invoke('create_slash_command', {
      basePath,
      name,
      content: fullContent
    });

    // Reload commands after creation
    await loadCommands();
  }, [basePath, loadCommands]);

  // Update existing custom command
  const updateCommand = useCallback(async (
    name: string,
    description: string,
    content: string,
    parameters: string[] = []
  ): Promise<void> => {
    if (!basePath) throw new Error('No base path set');

    // Format command content with frontmatter
    const frontmatter = [
      '---',
      `name: ${name}`,
      `description: ${description}`,
      parameters.length > 0 ? `parameters: [${parameters.join(', ')}]` : '',
      '---',
      ''
    ].filter(Boolean).join('\n');

    const fullContent = frontmatter + content;

    await invoke('update_slash_command', {
      basePath,
      name,
      content: fullContent
    });

    // Reload commands after update
    await loadCommands();
  }, [basePath, loadCommands]);

  // Delete custom command
  const deleteCommand = useCallback(async (name: string): Promise<void> => {
    if (!basePath) throw new Error('No base path set');

    await invoke('delete_slash_command', {
      basePath,
      name
    });

    // Reload commands after deletion
    await loadCommands();
  }, [basePath, loadCommands]);

  // Search/filter commands
  const searchCommands = useCallback((query: string): SlashCommand[] => {
    const lowerQuery = query.toLowerCase();
    const allCommands = [...commands.builtin, ...commands.custom];

    if (!query.trim()) {
      return allCommands;
    }

    return allCommands.filter(cmd =>
      cmd.name.toLowerCase().includes(lowerQuery) ||
      cmd.description.toLowerCase().includes(lowerQuery)
    );
  }, [commands]);

  // Get command by name
  const getCommand = useCallback((name: string): SlashCommand | undefined => {
    const allCommands = [...commands.builtin, ...commands.custom];
    return allCommands.find(cmd => cmd.name === name);
  }, [commands]);

  // Load commands on mount and when basePath changes
  useEffect(() => {
    loadCommands();
  }, [loadCommands]);

  return {
    commands,
    loading,
    error,
    loadCommands,
    createCommand,
    updateCommand,
    deleteCommand,
    searchCommands,
    getCommand
  };
}
