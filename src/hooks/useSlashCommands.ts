import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';

export interface SlashCommand {
  name: string;
  description: string;
  content: string;
  isBuiltin: boolean;
  parameters?: string[];
  scope: string; // "global" | "project" | "builtin"
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

  /**
   * Expand slash commands in a message by injecting their content as context.
   * When a message contains /command-name, this function:
   * 1. Detects all /command-name patterns at the start of lines
   * 2. Loads the command definition from .claude/commands/
   * 3. Injects the command content as <command-context> before the message
   *
   * This ensures the AI knows HOW to execute each command.
   */
  const expandCommandsInMessage = useCallback((message: string): {
    expandedMessage: string;
    commandsFound: string[];
    hasCommands: boolean;
  } => {
    const allCommands = [...commands.builtin, ...commands.custom];

    // Regex to find /command-name at the start of a line or message
    // Matches: /command-name (optionally followed by space and arguments)
    const commandPattern = /^\/([a-zA-Z][a-zA-Z0-9_-]*)/gm;

    const commandsFound: string[] = [];
    const commandContexts: string[] = [];

    let match;
    while ((match = commandPattern.exec(message)) !== null) {
      const commandName = match[1];

      // Skip if already processed
      if (commandsFound.includes(commandName)) continue;

      // Find the command definition
      const command = allCommands.find(cmd => cmd.name === commandName);

      if (command && command.content) {
        commandsFound.push(commandName);

        // Build context block with command definition
        commandContexts.push(
          `<command-context name="${commandName}" description="${command.description}">`,
          command.content,
          `</command-context>`
        );
      }
    }

    // If no commands found, return original message
    if (commandsFound.length === 0) {
      return {
        expandedMessage: message,
        commandsFound: [],
        hasCommands: false
      };
    }

    // Build expanded message with context injected before the original message
    const contextBlock = commandContexts.join('\n\n');
    const expandedMessage = `${contextBlock}\n\n---\n\n${message}`;

    console.log(`[useSlashCommands] Expanded ${commandsFound.length} command(s):`, commandsFound);

    return {
      expandedMessage,
      commandsFound,
      hasCommands: true
    };
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
    getCommand,
    expandCommandsInMessage
  };
}
